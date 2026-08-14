import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { readTokens } from "./palette";

/** The design overhaul's whole failure mode was drift: each screen quietly
 *  inventing its own spacing, colour and type until the app read as random.
 *  Types and lint cannot see that. This guard can.
 *
 *  Every rule here is one the spec states and one the tree currently
 *  satisfies, so a failure means something regressed, never that the guard is
 *  aspirational. */

const ROOTS = ["src/app", "src/features", "src/components"];
/** The gallery exists to display every token and variant, so it legitimately
 *  writes things no ordinary screen may. */
const EXCLUDE = [path.join("src", "app", "_design"), "globals.css"];

function walk(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.(tsx?|css)$/.test(e.name)) acc.push(p);
  }
  return acc;
}

const FILES = ROOTS.flatMap((r) => walk(path.join(process.cwd(), r))).filter(
  (f) => !EXCLUDE.some((x) => f.includes(x))
);

type Rule = {
  name: string;
  why: string;
  re: RegExp;
  /** Drop matches that are legitimate despite matching the pattern. */
  allow?: (line: string, match: string) => boolean;
};

const RULES: Rule[] = [
  {
    name: "raw hex colour",
    why: "colours come from tokens, so a palette change reaches every surface",
    re: /#[0-9a-fA-F]{6}\b/g,
    // themeColor is the one place a literal is unavoidable; it gets its own
    // assertion below tying it to --color-ink.
    allow: (line) => line.includes("themeColor"),
  },
  {
    name: "legacy token",
    why: "--color-cream/blue/teal predate the colour-block system",
    re: /--color-(cream|blue|teal)\b/g,
  },
  {
    name: "dark: variant",
    why: "the app is light-mode only; a dark: variant is untested and unreachable",
    re: /\bdark:/g,
  },
  {
    name: "soft shadow",
    why: "the system uses hard offset shadows; soft ones read as a different design language",
    re: /\bshadow-(sm|md|lg|xl)\b/g,
  },
  {
    name: "active:scale press",
    why: "the system's press is travel-into-shadow, not scale",
    re: /\bactive:scale\b/g,
  },
  {
    name: "Tailwind type class",
    why: "type comes from the closed .t-* scale",
    // text-sm etc, but NOT text-[length:var(--text-sm)] — the bracketed form
    // is a token reference and is exactly how the primitives are built.
    re: /\btext-(xs|sm|base|lg|xl|2xl|3xl|4xl)\b/g,
    allow: (line, match) => {
      const i = line.indexOf(match);
      return line.lastIndexOf("[", i) > line.lastIndexOf("]", i);
    },
  },
  {
    name: "arbitrary size",
    why: "spacing, radius and type are closed scales",
    // p-[18px] / rounded-[13px] / text-[17px], but NOT p-[var(--space-3)].
    re: /\b(text|p|px|py|pt|pb|pl|pr|m|mt|mb|ml|mr|gap|rounded)-\[[0-9.]+(px|rem)\]/g,
  },
];

describe("source conforms to DESIGN-SPEC", () => {
  it("finds files to check", () => {
    expect(FILES.length).toBeGreaterThan(20);
  });

  describe.each(RULES)("$name", (rule) => {
    it(rule.why, () => {
      const hits: string[] = [];
      for (const file of FILES) {
        const lines = fs.readFileSync(file, "utf8").split("\n");
        lines.forEach((line, n) => {
          // A rule's own definition in this file would match itself.
          if (line.trimStart().startsWith("//") || line.trimStart().startsWith("*")) return;
          for (const m of line.matchAll(rule.re)) {
            if (rule.allow?.(line, m[0])) continue;
            hits.push(
              `${path.relative(process.cwd(), file)}:${n + 1}  ${m[0]}   ${line.trim().slice(0, 90)}`
            );
          }
        });
      }
      expect(hits, `${hits.length} violation(s):\n${hits.slice(0, 25).join("\n")}`).toEqual([]);
    });
  });
});

/** The one unavoidable literal colour in the app. It tints the browser's own
 *  chrome, so it cannot be a CSS variable — but it can be held equal to the
 *  token it is meant to match, which is what drifted before. */
describe("themeColor", () => {
  it("matches --color-ink exactly", () => {
    const layout = fs.readFileSync(
      path.join(process.cwd(), "src/app/layout.tsx"),
      "utf8"
    );
    const declared = layout.match(/themeColor:\s*"(#[0-9a-fA-F]{6})"/)?.[1]?.toLowerCase();
    const ink = readTokens()["ink"];
    expect(declared, `themeColor ${declared} has drifted from --color-ink ${ink}`).toBe(ink);
  });
});

/** The bug that shipped: Field floored kiosk at the POS height because it
 *  ternaried admin-vs-everything instead of indexing the surface. */
describe("surface tap floors", () => {
  const ui = fs.readFileSync(
    path.join(process.cwd(), "src/components/ui.tsx"),
    "utf8"
  );

  it("routes every control's height through the TAP record", () => {
    const ternaries = [
      ...ui.matchAll(/surface === "admin"\s*\?\s*"min-h-\[var\(--tap-admin\)\]"\s*:\s*"min-h-\[var\(--tap-pos\)\]"/g),
    ];
    expect(
      ternaries.map((t) => t[0]),
      "a surface ternary silently floors kiosk at the POS height — index TAP[surface] instead"
    ).toEqual([]);
  });

  it("defines a floor for all three surfaces", () => {
    for (const s of ["pos", "kiosk", "admin"]) {
      expect(ui, `TAP is missing ${s}`).toContain(`${s}: "min-h-[var(--tap-${s})]"`);
    }
  });
});

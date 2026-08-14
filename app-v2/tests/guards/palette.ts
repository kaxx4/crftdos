import fs from "node:fs";
import path from "node:path";

/** Read the palette out of the stylesheet rather than restating it here.
 *  A guard that keeps its own copy of the colours cannot fail when the
 *  colours change, which is the only time it needs to. */
export function readTokens(): Record<string, string> {
  const css = fs.readFileSync(
    path.join(process.cwd(), "src/app/globals.css"),
    "utf8"
  );
  const out: Record<string, string> = {};
  for (const m of css.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\b/g)) {
    out[m[1]] = m[2].toLowerCase();
  }
  return out;
}

/** WCAG 2.x relative luminance. */
function luminance(hex: string): number {
  const c = [1, 3, 5]
    .map((i) => parseInt(hex.substr(i, 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export function contrast(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

export const WHITE = "#ffffff";

/** DESIGN-SPEC: bright blocks carry ink text, deep blocks carry white. The
 *  split is not stylistic — white on yellow is 1.29:1. */
export const BRIGHT = ["pink", "acid", "yellow", "orange", "lilac", "sky"];
export const DEEP = [
  "cobalt",
  "cobalt-deep",
  "pink-deep",
  "acid-deep",
  "orange-deep",
  "ink",
  "signal",
  "signal-deep",
];
/** Colours the spec permits as TEXT on the paper ground. */
export const ON_PAPER = [
  "ink",
  "muted",
  "acid-deep",
  "pink-deep",
  "orange-deep",
  "signal",
  "cobalt",
];

export const AA_BODY = 4.5;

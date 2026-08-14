import { describe, expect, it } from "vitest";
import {
  AA_BODY,
  BRIGHT,
  DEEP,
  ON_PAPER,
  WHITE,
  contrast,
  readTokens,
} from "./palette";

/** The palette is loud on purpose, and a loud palette is one careless nudge
 *  away from unreadable. This is the guard on the spec's central safety
 *  claim: every pairing the system ALLOWS must clear AA, and every pairing it
 *  BANS must actually be illegible — otherwise the rule is superstition and
 *  the next person will "simplify" it away.
 *
 *  The margin here is genuinely thin: acid-deep on paper passes at 4.54:1.
 *  A 1% darkening of the paper ground breaks it. That is exactly the change
 *  that would otherwise ship unnoticed. */

const tokens = readTokens();

function ratio(a: string, b: string): number {
  const x = tokens[a] ?? a;
  const y = tokens[b] ?? b;
  if (!x.startsWith("#") || !y.startsWith("#")) {
    throw new Error(`missing token: ${!x.startsWith("#") ? a : b}`);
  }
  return contrast(x, y);
}

function report(fg: string, bg: string, actual: number, required: number) {
  return `${fg} on ${bg} is ${actual.toFixed(2)}:1, needs ${required}:1 (${tokens[fg] ?? fg} / ${tokens[bg] ?? bg})`;
}

describe("palette is readable", () => {
  it("defines every token the spec names", () => {
    for (const name of [...BRIGHT, ...DEEP, ...ON_PAPER, "paper"]) {
      expect(tokens[name], `--color-${name} is not defined in globals.css`).toBeTruthy();
    }
  });

  describe.each(BRIGHT)("bright block %s", (block) => {
    it("carries ink text at AA", () => {
      const r = ratio("ink", block);
      expect(r, report("ink", block, r, AA_BODY)).toBeGreaterThanOrEqual(AA_BODY);
    });

    /** Proves the rule is necessary rather than assumed. If a bright block
     *  ever became legible under white, the ink-only rule would be arbitrary
     *  and this test should be revisited deliberately, not silently. */
    it("is correctly banned from carrying white text", () => {
      const r = ratio(WHITE, block);
      expect(r, `white on ${block} is ${r.toFixed(2)}:1 — no longer clearly illegible, so the ink-only rule needs revisiting`).toBeLessThan(3);
    });
  });

  describe.each(DEEP)("deep block %s", (block) => {
    it("carries white text at AA", () => {
      const r = ratio(WHITE, block);
      expect(r, report("white", block, r, AA_BODY)).toBeGreaterThanOrEqual(AA_BODY);
    });

    it("is correctly banned from carrying ink text", () => {
      const r = ratio("ink", block);
      expect(r, `ink on ${block} is ${r.toFixed(2)}:1 — no longer clearly illegible, so the white-only rule needs revisiting`).toBeLessThan(AA_BODY);
    });
  });

  describe.each(ON_PAPER)("text colour %s", (fg) => {
    it("is readable on the paper ground", () => {
      const r = ratio(fg, "paper");
      expect(r, report(fg, "paper", r, AA_BODY)).toBeGreaterThanOrEqual(AA_BODY);
    });
  });

  /** Named explicitly because it is the one with almost no room left. */
  it("keeps acid-deep on paper above AA, its tightest margin", () => {
    const r = ratio("acid-deep", "paper");
    expect(r, report("acid-deep", "paper", r, AA_BODY)).toBeGreaterThanOrEqual(AA_BODY);
  });
});

/**
 * WCAG 2.x contrast maths + a tiny `--color-*` extractor for globals.css.
 *
 * Deliberately dependency-free: the contrast guard is the spec's central
 * safety claim (DESIGN-SPEC.md §2.2) and should not be able to break because
 * a colour library changed its rounding.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

export const GLOBALS_CSS = path.resolve(
  import.meta.dirname,
  "../../src/app/globals.css",
);

export type Rgb = [number, number, number];

/** Parse #rgb / #rrggbb (case-insensitive). Throws on anything else. */
export function hexToRgb(hex: string): Rgb {
  const h = hex.trim().replace(/^#/, "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`Not a hex colour: ${hex}`);
  }
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** WCAG 2.x relative luminance. */
export function relativeLuminance([r, g, b]: Rgb): number {
  const lin = (c8: number) => {
    const c = c8 / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG 2.x contrast ratio, always >= 1. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Extract `--color-*` custom properties from globals.css.
 *
 * Values that are `var(--color-other)` aliases (the legacy names) are resolved
 * transitively, so `--color-cream` reports paper's hex.
 */
export function readColorTokens(file = GLOBALS_CSS): Record<string, string> {
  const css = readFileSync(file, "utf8");
  // Strip block comments so the annotated ratios in globals.css cannot be
  // mistaken for declarations.
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const raw: Record<string, string> = {};
  const decl = /(--color-[a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let m: RegExpExecArray | null;
  while ((m = decl.exec(stripped)) !== null) {
    raw[m[1]] = m[2].trim();
  }

  const resolve = (name: string, seen = new Set<string>()): string => {
    if (seen.has(name)) throw new Error(`Circular token reference: ${name}`);
    seen.add(name);
    const value = raw[name];
    if (value === undefined) throw new Error(`Missing token: ${name}`);
    const alias = value.match(/^var\(\s*(--color-[a-z0-9-]+)\s*\)$/i);
    return alias ? resolve(alias[1], seen) : value;
  };

  const out: Record<string, string> = {};
  for (const name of Object.keys(raw)) {
    const value = resolve(name);
    if (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(value)) out[name] = value;
  }
  return out;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

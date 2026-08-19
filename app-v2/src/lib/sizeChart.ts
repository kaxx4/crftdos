/** Real garment measurements, in inches, as supplied by the print vendor's
 *  size charts for the two fits actually printed today.
 *
 *  Deliberately incomplete rather than filled in: the seed stocks XXL for
 *  both fits and Crop as a third fit, but no chart was supplied for XXL or
 *  for Crop, so those are not invented here. `sizeChartFor` returns `null`
 *  for a fit with no real chart, and the caller is expected to say so
 *  rather than silently show nothing. */

export type SizeChartRow = {
  size: string;
  chestWidth: number;
  frontLength: number;
  sleeveLength: number;
  shoulderWidth: number;
};

const OVERSIZED: SizeChartRow[] = [
  { size: "XS", chestWidth: 35, frontLength: 23, sleeveLength: 8, shoulderWidth: 16 },
  { size: "S", chestWidth: 38, frontLength: 24.5, sleeveLength: 8.5, shoulderWidth: 18 },
  { size: "M", chestWidth: 40, frontLength: 26, sleeveLength: 9, shoulderWidth: 18.5 },
  { size: "L", chestWidth: 44, frontLength: 28, sleeveLength: 9.5, shoulderWidth: 20 },
  { size: "XL", chestWidth: 46, frontLength: 28.5, sleeveLength: 10, shoulderWidth: 21 },
];

const REGULAR: SizeChartRow[] = [
  { size: "XS", chestWidth: 32, frontLength: 22.5, sleeveLength: 7, shoulderWidth: 14 },
  { size: "S", chestWidth: 36, frontLength: 24, sleeveLength: 7.5, shoulderWidth: 16 },
  { size: "M", chestWidth: 38, frontLength: 26, sleeveLength: 8, shoulderWidth: 17 },
  { size: "L", chestWidth: 42, frontLength: 27, sleeveLength: 8, shoulderWidth: 19 },
  { size: "XL", chestWidth: 45, frontLength: 28, sleeveLength: 9, shoulderWidth: 19.5 },
];

const CHARTS: Record<string, SizeChartRow[]> = {
  oversized: OVERSIZED,
  regular: REGULAR,
};

/** Keyed by the fit's display name, lower-cased, since that's the stable
 *  human label (`fit.name`) rather than an id that could change under a
 *  reseed. Returns null for a fit with no supplied chart (Crop, today) —
 *  the caller must handle that explicitly, not fall back to a guess. */
export function sizeChartFor(fitName: string | undefined): SizeChartRow[] | null {
  if (!fitName) return null;
  return CHARTS[fitName.trim().toLowerCase()] ?? null;
}

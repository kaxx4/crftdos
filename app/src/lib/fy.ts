/** Indian financial year, e.g. 2026-08-06 -> "26-27" (Apr 2026 - Mar 2027). */
export function currentFY(d = new Date()): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1; // 1-12
  const startYear = m >= 4 ? y : y - 1;
  const endYear = startYear + 1;
  return `${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`;
}

export function formatReceiptNo(fy: string, n: number): string {
  return `CR/${fy}/${String(n).padStart(6, "0")}`;
}

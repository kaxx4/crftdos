/** Money and numbering. Every rupee amount in this app is a number of RUPEES
 *  (not paise), matching the numeric(10,2) columns.
 *
 *  Formatting lives here and only here. A `toFixed(2)` or a bare ₹ inlined in
 *  a component is how a receipt and a dashboard end up disagreeing about the
 *  same order. */

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const inrPrecise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Display money. Whole rupees by default — a stall does not price in paise,
 *  and two extra glyphs on every price is real cost on a 6" phone. */
export function money(n: number, precise = false): string {
  return (precise ? inrPrecise : inr).format(n || 0);
}

/** For an amount that must be exact and machine-read — the UPI deep link,
 *  a receipt total. Never localised, never a currency symbol. */
export function amountString(n: number): string {
  return (n || 0).toFixed(2);
}

/** Indian financial year: 2026-08-11 -> "26-27" (Apr 2026 - Mar 2027). */
export function currentFY(d = new Date()): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const startYear = m >= 4 ? y : y - 1;
  return `${String(startYear).slice(-2)}-${String(startYear + 1).slice(-2)}`;
}

/** Receipt numbers are environment-scoped off that environment's prefix.
 *  Two environments never share a sequence, which is what makes uniqueness a
 *  property of allocation rather than something to resolve at runtime.
 *
 *    formatReceiptNo("SA", "26-27", 202) -> "CR/SA/26-27/000202"
 */
export function formatReceiptNo(prefix: string, fy: string, n: number): string {
  return `CR/${prefix}/${fy}/${String(n).padStart(6, "0")}`;
}

/** UPI deep link with the amount embedded and the order code as the
 *  transaction note, so bank-statement reconciliation is automatic rather than
 *  manual. Resolved decision, 11 Aug — see the requirements doc, migration 007.
 *
 *  This is NOT payment confirmation. A UPI link is fire-and-forget; nothing
 *  tells the app the customer actually paid. A volunteer confirms at handover. */
export function upiLink(opts: { vpa: string; payee: string; amount: number; note: string }): string {
  const p = new URLSearchParams({
    pa: opts.vpa,
    pn: opts.payee,
    am: amountString(opts.amount),
    tn: opts.note,
    cu: "INR",
  });
  return `upi://pay?${p.toString()}`;
}

/** gross - COGS. The one number that matters, computed identically everywhere
 *  it appears (PRD D23). */
export function raisedForAquaterra(gross: number, cogs: number): number {
  return gross - cogs;
}

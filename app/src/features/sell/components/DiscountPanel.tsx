import { Field, Panel, PanelLabel } from "@/components/ui";

export function DiscountPanel({
  discountAmt,
  setDiscountAmt,
  discountPct,
  setDiscountPct,
  discountReason,
  setDiscountReason,
  needsAdminGate,
  discountUnlocked,
}: {
  discountAmt: string;
  setDiscountAmt: (v: string) => void;
  discountPct: string;
  setDiscountPct: (v: string) => void;
  discountReason: string;
  setDiscountReason: (v: string) => void;
  needsAdminGate: boolean;
  discountUnlocked: boolean;
}) {
  return (
    <Panel>
      <PanelLabel>Step 5 · Discount (optional)</PanelLabel>
      <div className="flex gap-2">
        <Field
          label="Discount amount in rupees"
          placeholder="₹ amount"
          value={discountAmt}
          onChange={(e) => {
            setDiscountAmt(e.target.value);
            setDiscountPct("");
          }}
        />
        <Field
          label="Discount percentage"
          placeholder="% off"
          value={discountPct}
          onChange={(e) => {
            setDiscountPct(e.target.value);
            setDiscountAmt("");
          }}
        />
      </div>
      <select
        aria-label="Discount reason"
        value={discountReason}
        onChange={(e) => setDiscountReason(e.target.value)}
        className="border-2 border-ink p-3 text-base min-h-[48px] bg-white rounded-[var(--radius-pos-sm)]"
      >
        <option value="volunteer_discretion">Volunteer discretion</option>
        <option value="freebie">Freebie</option>
        <option value="bulk">Bulk</option>
        <option value="damaged_item">Damaged item</option>
        <option value="price_match">Price match</option>
        <option value="other">Other</option>
      </select>
      {needsAdminGate && !discountUnlocked && (
        <div className="bg-signal text-cream p-2.5 font-extrabold text-[12px] tracking-wide uppercase">
          Discounts over 10% need an admin&apos;s PIN — you&apos;ll be asked for it when you hit Charge.
        </div>
      )}
    </Panel>
  );
}

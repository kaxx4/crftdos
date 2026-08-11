import { BigButton } from "@/components/ui";

export function ChargeFooter({
  total,
  cartEmpty,
  charging,
  splitOk,
  hasShiftAndBlock,
  onCharge,
}: {
  total: number;
  cartEmpty: boolean;
  charging: boolean;
  splitOk: boolean;
  hasShiftAndBlock: boolean;
  onCharge: () => void;
}) {
  const disabled = cartEmpty || charging || !splitOk || !hasShiftAndBlock;
  // Exposes the existing guard state as copy instead of a bare disabled
  // button a volunteer has to guess about.
  let reason: string | null = null;
  if (cartEmpty) reason = "Add at least one item";
  else if (!splitOk) reason = "Split amounts don't total the order";
  else if (!hasShiftAndBlock) reason = "This phone can't print receipt numbers yet";

  return (
    <div className="px-3.5 py-3 bg-cream border-t-2 border-ink flex flex-col gap-1">
      <BigButton variant="blue" className="w-full" disabled={disabled} onClick={onCharge}>
        {charging ? "CHARGING…" : `CHARGE ₹${total}`}
      </BigButton>
      {reason && !charging && (
        <div className="text-center text-[13px] font-bold text-muted uppercase tracking-wide">{reason}</div>
      )}
    </div>
  );
}

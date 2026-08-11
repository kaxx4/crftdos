"use client";
import { BigButton } from "@/components/ui";

export function CloseShiftPanel({
  countedCash,
  setCountedCash,
  closing,
  setClosing,
  closeBlockedErr,
  closeResult,
  onClose,
}: {
  countedCash: string;
  setCountedCash: (v: string) => void;
  closing: boolean;
  setClosing: (v: boolean) => void;
  closeBlockedErr: string;
  closeResult: { expectedCash: number; variance: number | null } | null;
  onClose: () => void;
}) {
  return (
    <div className="border-2 border-ink bg-white p-3 flex flex-col gap-2.5 mt-2">
      <div className="font-extrabold text-[12px] tracking-[0.14em]">CLOSE SHIFT</div>
      <input
        placeholder="Counted cash ₹"
        value={countedCash}
        onChange={(e) => setCountedCash(e.target.value)}
        className="border-2 border-ink p-3 min-h-[48px]"
      />
      <BigButton variant="blue" onClick={() => setClosing(true)}>
        CLOSE SHIFT
      </BigButton>
      {closeBlockedErr && (
        <div role="alert" className="bg-signal text-cream p-2.5 font-extrabold text-[13px] tracking-wide uppercase">
          {closeBlockedErr}
        </div>
      )}
      {closing && !closeResult && (
        <div className="flex flex-col gap-2">
          <p className="text-sm">Confirm close? Unused receipt numbers on this device will be voided.</p>
          <div className="flex gap-2">
            <BigButton variant="blue" className="flex-1" onClick={onClose}>
              CONFIRM
            </BigButton>
            <BigButton variant="ghost" className="flex-1" onClick={() => setClosing(false)}>
              CANCEL
            </BigButton>
          </div>
        </div>
      )}
      {closeResult && (
        <div className="font-mono text-xs">
          Expected cash ₹{closeResult.expectedCash} · Variance{" "}
          {closeResult.variance != null ? `₹${closeResult.variance}` : "—"}
        </div>
      )}
    </div>
  );
}

import { Chip, Field, Mono, Panel, PanelLabel } from "@/components/ui";
import type { PaymentMethod } from "../types";

export function PaymentPanel({
  payment,
  setPayment,
  cashAmt,
  setCashAmt,
  upiAmt,
  setUpiAmt,
  splitTotal,
  splitOk,
  total,
}: {
  payment: PaymentMethod;
  setPayment: (p: PaymentMethod) => void;
  cashAmt: string;
  setCashAmt: (v: string) => void;
  upiAmt: string;
  setUpiAmt: (v: string) => void;
  splitTotal: number;
  splitOk: boolean;
  total: number;
}) {
  return (
    <Panel>
      <PanelLabel>Step 6 · Payment</PanelLabel>
      <div className="grid grid-cols-4 gap-1.5">
        {(["upi", "cash", "split", "pending"] as const).map((p) => (
          <Chip key={p} active={payment === p} onClick={() => setPayment(p)}>
            {p.toUpperCase()}
          </Chip>
        ))}
      </div>
      {payment === "split" && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Field label="Cash portion in rupees" placeholder="Cash ₹" value={cashAmt} onChange={(e) => setCashAmt(e.target.value)} />
            <Field label="UPI portion in rupees" placeholder="UPI ₹" value={upiAmt} onChange={(e) => setUpiAmt(e.target.value)} />
          </div>
          <div className={`text-xs font-mono ${splitOk ? "text-muted" : "text-signal font-bold"}`}>
            {splitOk ? `Splits to ₹${total}` : `Must total ₹${total} (currently ₹${splitTotal})`}
          </div>
        </div>
      )}
      <Mono>All UPI payments go to the one TerraRoots account — no reference number needed.</Mono>
    </Panel>
  );
}

"use client";
import { useState } from "react";
import { PosFrame } from "@/components/PosFrame";
import { FirstRunHint } from "@/components/FirstRunHint";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TabBar } from "@/components/TabBar";
import { BigButton, Field, Mono, PanelLabel } from "@/components/ui";

type Order = { id: string; receipt_no: string; total: number; created_at: string };

const ACTIONS = ["replace", "refund", "exchange", "reject"] as const;

export default function ReturnsPage() {
  const [search, setSearch] = useState("");
  const [found, setFound] = useState<Order | null>(null);
  const [reason, setReason] = useState("");
  const [action, setAction] = useState<typeof ACTIONS[number]>("refund");
  const [refundAmount, setRefundAmount] = useState("0");
  const [resaleable, setResaleable] = useState(true);
  const [pin, setPin] = useState("");
  const [result, setResult] = useState("");

  async function search_() {
    setFound(null);
    const res = await fetch(`/api/orders/search?receipt=${encodeURIComponent(search.trim())}`);
    const j = await res.json();
    if (j.order) setFound(j.order);
    else setResult("No order with that receipt number. Try the exact CR/26-27/000101 format.");
  }

  // The last native confirm in the app. It worked, but a styled dialog can
  // actually spell out the consequence for the customer standing there.
  const [confirmReject, setConfirmReject] = useState(false);

  // `confirmed` is passed explicitly rather than read from state: the dialog
  // calls back in the same tick it clears the flag, so relying on the state
  // value here would depend on closure timing to be correct.
  async function submit(confirmed = false) {
    if (!found) return;
    if (action === "reject" && !confirmed) {
      setConfirmReject(true);
      return;
    }
    setConfirmReject(false);
    const res = await fetch("/api/returns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        originalOrderId: found.id,
        reason,
        action,
        refundAmount: Number(refundAmount),
        resaleable,
        approverPin: pin,
      }),
    });
    const j = await res.json();
    if (res.ok) {
      setResult(
        `Logged. ${
          j.return.replacement_order
            ? "We've created a replacement order at no extra charge, so stock updates correctly."
            : ""
        }`
      );
      setFound(null);
      setSearch("");
      setPin("");
    } else {
      setResult(j.error || "Could not log this return — try again, or ask an admin if it keeps happening.");
    }
  }

  return (
    <div className="contents">
      <PosFrame
        helpTopic="wrong"
        nav={<TabBar />} kicker="VOLUNTEER · RETURNS" title="Returns">
        <FirstRunHint
          id="returns"
          title="Taking something back"
          points={[
            "Find the original sale first — search by receipt number, phone, or order number.",
            "Replace or refund on genuine defects. No change-of-mind returns; DTF is rated 10-15 washes.",
            "Log rejected returns too. The pattern of what we turn down is worth knowing.",
          ]}
        />
        <div className="bg-signal/20 border-2 border-signal p-2.5 text-xs">
          Replace or refund on genuine defects only. No change-of-mind returns. DTF rated 10–15 washes, hand wash
          recommended.
        </div>
        <PanelLabel>Find the order</PanelLabel>
        <div className="border-2 border-ink bg-white p-2.5 flex flex-col gap-2">
          <Field label="Search by receipt number" placeholder="Receipt no. e.g. CR/26-27/000101" value={search} onChange={(e) => setSearch(e.target.value)} />
          <BigButton variant="ghost" onClick={search_}>
            FIND ORDER
          </BigButton>
          {found && (
            <div className="border border-ink p-2 text-sm">
              <Mono>{found.receipt_no}</Mono> · ₹{found.total}
            </div>
          )}
        </div>
        {found && (
          <div className="border-2 border-ink bg-white p-2.5 flex flex-col gap-2">
            <PanelLabel>Log the return</PanelLabel>
            <Field label="Reason for return" placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
            <div className="flex gap-1.5 flex-wrap">
              {ACTIONS.map((a) => (
                <button
                  key={a}
                  onClick={() => setAction(a)}
                  className={`border-2 border-ink px-2 py-1.5 text-xs font-bold ${action === a ? "bg-ink text-cream" : "bg-white"}`}
                >
                  {a.toUpperCase()}
                </button>
              ))}
            </div>
            <Field label="Refund amount in rupees" type="number" placeholder="Refund ₹" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={resaleable} onChange={(e) => setResaleable(e.target.checked)} />
              Resaleable (restock)
            </label>
            <Field label="Approver admin PIN" type="password" placeholder="Approver admin PIN" value={pin} onChange={(e) => setPin(e.target.value)} />
            <BigButton variant="blue" onClick={() => void submit()}>
              LOG RETURN
            </BigButton>
          </div>
        )}
        {result && <div className="font-mono text-xs text-muted">{result}</div>}
        <ConfirmDialog
          open={confirmReject}
          title="Reject this return?"
          body="The customer keeps the item and gets no refund or exchange. It's still recorded — the pattern of what we turn down is worth knowing."
          confirmLabel="REJECT RETURN"
          onConfirm={() => { setConfirmReject(false); void submit(true); }}
          onCancel={() => setConfirmReject(false)}
        />
      </PosFrame>
    </div>
  );
}

"use client";
import { useState } from "react";
import { PosFrame } from "@/components/PosFrame";
import { TabBar } from "@/components/TabBar";
import { BigButton, Field, Mono } from "@/components/ui";

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

  async function submit() {
    if (!found) return;
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
      setResult(`Logged. ${j.return.replacement_order ? "Zero-value exchange order created." : ""}`);
      setFound(null);
      setSearch("");
      setPin("");
    } else {
      setResult(j.error || "Failed");
    }
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <PosFrame kicker="STALL OS · RETURNS" title="Returns">
        <div className="bg-signal/20 border-2 border-signal p-2.5 text-xs">
          Replace or refund on genuine defects only. No change-of-mind returns. DTF rated 10–15 washes, hand wash
          recommended.
        </div>
        <div className="border-2 border-ink bg-white p-2.5 flex flex-col gap-2">
          <Field placeholder="Receipt no. e.g. CR/26-27/000101" value={search} onChange={(e) => setSearch(e.target.value)} />
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
            <Field placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
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
            <Field type="number" placeholder="Refund ₹" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={resaleable} onChange={(e) => setResaleable(e.target.checked)} />
              Resaleable (restock)
            </label>
            <Field type="password" placeholder="Approver admin PIN" value={pin} onChange={(e) => setPin(e.target.value)} />
            <BigButton variant="blue" onClick={submit}>
              LOG RETURN
            </BigButton>
          </div>
        )}
        {result && <div className="font-mono text-xs text-neutral-600">{result}</div>}
      </PosFrame>
      <TabBar />
    </div>
  );
}

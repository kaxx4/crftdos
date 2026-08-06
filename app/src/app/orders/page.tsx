"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PosFrame } from "@/components/PosFrame";
import { TabBar } from "@/components/TabBar";
import { BigButton, Mono } from "@/components/ui";
import { getDeviceId } from "@/lib/deviceId";

type Order = {
  id: string;
  receipt_no: string;
  total: number;
  payment_method: string;
  fulfillment_status: string;
  voided_at: string | null;
  created_at: string;
};

export default function OrdersPage() {
  const router = useRouter();
  const [shift, setShift] = useState<{ id: string; name: string } | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [closing, setClosing] = useState(false);
  const [countedCash, setCountedCash] = useState("");
  const [closeResult, setCloseResult] = useState<{ expectedCash: number; variance: number | null } | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/shift/current?deviceId=${getDeviceId()}`);
      const j = await res.json();
      if (!j.shift) {
        router.replace("/shift-open");
        return;
      }
      setShift(j.shift);
      const oRes = await fetch(`/api/orders?shiftId=${j.shift.id}`);
      const oJson = await oRes.json();
      setOrders(oJson.orders || []);
    }
    load();
  }, [router]);

  async function voidOrder(id: string) {
    const reason = window.prompt("Void reason?") || "unspecified";
    const res = await fetch(`/api/orders/${id}/void`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, actor: "volunteer" }),
    });
    if (res.ok) {
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, voided_at: new Date().toISOString() } : o)));
    }
  }

  async function closeShift() {
    if (!shift) return;
    const res = await fetch("/api/shift/close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shiftId: shift.id, countedCash: countedCash ? Number(countedCash) : null }),
    });
    const j = await res.json();
    if (res.ok) {
      setCloseResult({ expectedCash: j.expectedCash, variance: j.variance });
    }
  }

  const pending = orders.filter((o) => o.fulfillment_status === "pending_press" && !o.voided_at);

  return (
    <div className="min-h-dvh flex flex-col">
      <PosFrame kicker="STALL OS · ORDERS" title="Orders">
        {pending.length > 0 && (
          <div className="bg-signal text-ink p-2.5 font-extrabold text-[11px] tracking-wide uppercase">
            {pending.length} pending press
          </div>
        )}
        <div className="flex flex-col gap-2">
          {orders.map((o) => (
            <div key={o.id} className="border-2 border-ink bg-white p-2.5 flex justify-between gap-2">
              <div>
                <div className="font-extrabold text-[16px]">{o.receipt_no}</div>
                <Mono>{new Date(o.created_at).toLocaleTimeString("en-IN")} · {o.payment_method.toUpperCase()}</Mono>
              </div>
              <div className="text-right flex flex-col items-end gap-1">
                <div className="font-extrabold text-lg">₹{o.total}</div>
                {o.voided_at ? (
                  <span className="text-[10px] font-extrabold text-signal">VOID</span>
                ) : (
                  <button
                    onClick={() => voidOrder(o.id)}
                    className="border border-signal text-signal text-[9px] font-extrabold px-1.5 py-1"
                  >
                    VOID
                  </button>
                )}
              </div>
            </div>
          ))}
          {orders.length === 0 && (
            <div className="text-center text-sm text-neutral-600 py-6">No orders yet this shift.</div>
          )}
        </div>

        <div className="border-2 border-ink bg-white p-3 flex flex-col gap-2.5 mt-2">
          <div className="font-extrabold text-[10px] tracking-[0.14em]">CLOSE SHIFT</div>
          <input
            placeholder="Counted cash ₹"
            value={countedCash}
            onChange={(e) => setCountedCash(e.target.value)}
            className="border-2 border-ink p-3 min-h-[48px]"
          />
          <BigButton variant="blue" onClick={() => setClosing(true)}>
            CLOSE SHIFT
          </BigButton>
          {closing && !closeResult && (
            <div className="flex flex-col gap-2">
              <p className="text-sm">Confirm close? Unused receipt numbers on this device will be voided.</p>
              <div className="flex gap-2">
                <BigButton variant="blue" className="flex-1" onClick={closeShift}>
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
      </PosFrame>
      <TabBar />
    </div>
  );
}

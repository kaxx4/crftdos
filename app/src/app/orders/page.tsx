"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PosFrame } from "@/components/PosFrame";
import { TabBar } from "@/components/TabBar";
import { BigButton, Mono } from "@/components/ui";
import { getDeviceId } from "@/lib/deviceId";
import { TOKENS } from "@/lib/tokens";
import { PressQueue, type PressOrder } from "@/components/PressQueue";
import { Collections } from "@/components/Collections";
import { Chip } from "@/components/ui";
import { flushOutbox, outboxCount } from "@/lib/outbox";

type Summary = {
  shift: { name: string; venue: string };
  gross: number;
  discounts: number;
  net: number;
  raisedForAquaterra: number;
  unitsSold: number;
  topDesigns: { code: string; count: number }[];
  cashVariance: number | null;
};

type Order = PressOrder & {
  total: number;
  payment_method: string;
  fulfillment_status: string;
  voided_at: string | null;
  collected_at: string | null;
  customer_id: string | null;
};

export default function OrdersPage() {
  const router = useRouter();
  const [shift, setShift] = useState<{ id: string; name: string } | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [closing, setClosing] = useState(false);
  const [countedCash, setCountedCash] = useState("");
  const [closeResult, setCloseResult] = useState<{ expectedCash: number; variance: number | null } | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [tab, setTab] = useState<"press" | "collections">("press");
  const [outboxPending, setOutboxPending] = useState(0);
  const [closeBlockedErr, setCloseBlockedErr] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

  async function pressOrder(id: string) {
    const res = await fetch(`/api/orders/${id}/press`, { method: "POST" });
    if (res.ok) {
      setOrders((prev) =>
        prev.map((o) => (o.id === id ? { ...o, pressed_at: new Date().toISOString() } : o))
      );
    }
  }

  async function handOverOrder(id: string) {
    const res = await fetch(`/api/orders/${id}/handover`, { method: "POST" });
    if (res.ok) {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === id
            ? { ...o, fulfillment_status: "handed_over", pressed_at: o.pressed_at ?? new Date().toISOString() }
            : o
        )
      );
    }
  }

  async function collectOrder(id: string) {
    const res = await fetch(`/api/orders/${id}/collect`, { method: "POST" });
    if (res.ok) {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === id ? { ...o, fulfillment_status: "collected", collected_at: new Date().toISOString() } : o
        )
      );
    }
  }

  async function closeShift() {
    if (!shift) return;
    setCloseBlockedErr("");

    // PRD §10: shift close "must block on a non-empty outbox with a clear
    // '3 sales not yet synced, connect to wifi' message." Previously this
    // called /api/shift/close unconditionally — a volunteer could close on
    // iOS (no Background Sync) with queued sales still sitting in IndexedDB,
    // and the till would reconcile against server data missing those orders.
    if (navigator.onLine) await flushOutbox(setOutboxPending);
    const remaining = await outboxCount();
    setOutboxPending(remaining);
    if (remaining > 0) {
      setCloseBlockedErr(
        `${remaining} sale${remaining === 1 ? "" : "s"} not yet synced — connect to wifi and try again.`
      );
      return;
    }

    const res = await fetch("/api/shift/close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shiftId: shift.id, countedCash: countedCash ? Number(countedCash) : null }),
    });
    const j = await res.json();
    if (res.ok) {
      setCloseResult({ expectedCash: j.expectedCash, variance: j.variance });
      const sJson = await fetch(`/api/shift/summary?shiftId=${shift.id}`).then((r) => r.json());
      setSummary(sJson);
      setTimeout(() => drawSummary(sJson), 50);
    }
  }

  function drawSummary(s: Summary) {
    const canvas = canvasRef.current;
    if (!canvas || !s) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = 600;
    canvas.height = 750;
    ctx.fillStyle = TOKENS.cream;
    ctx.fillRect(0, 0, 600, 750);
    ctx.strokeStyle = TOKENS.ink;
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, 580, 730);
    // crop marks
    ctx.lineWidth = 2;
    [
      [20, 20, 40, 20],
      [20, 20, 20, 40],
      [580, 20, 560, 20],
      [580, 20, 580, 40],
    ].forEach(([x1, y1, x2, y2]) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    });

    ctx.fillStyle = TOKENS.blue;
    ctx.fillRect(30, 60, 540, 90);
    ctx.fillStyle = TOKENS.cream;
    ctx.font = "bold 28px monospace";
    ctx.fillText("CRFTD — SHIFT SUMMARY", 45, 100);
    ctx.font = "14px monospace";
    ctx.fillText(`${s.shift?.name || ""} · ${s.shift?.venue || ""}`, 45, 130);

    ctx.fillStyle = TOKENS.ink;
    ctx.font = "bold 16px monospace";
    const rows: [string, string][] = [
      ["Gross", `₹${s.gross}`],
      ["Discounts", `₹${s.discounts}`],
      ["Net", `₹${s.net}`],
      ["Units sold", `${s.unitsSold}`],
      ["Cash variance", s.cashVariance != null ? `₹${s.cashVariance}` : "—"],
    ];
    rows.forEach(([label, value], i) => {
      ctx.fillText(label, 45, 190 + i * 34);
      ctx.textAlign = "right";
      ctx.fillText(value, 555, 190 + i * 34);
      ctx.textAlign = "left";
    });

    ctx.fillStyle = TOKENS.blue;
    ctx.fillRect(30, 380, 540, 80);
    ctx.fillStyle = TOKENS.cream;
    ctx.font = "bold 12px monospace";
    ctx.fillText("RAISED FOR AQUATERRA", 45, 410);
    ctx.font = "bold 34px monospace";
    ctx.fillText(`₹${s.raisedForAquaterra}`, 45, 445);

    ctx.fillStyle = TOKENS.ink;
    ctx.font = "bold 14px monospace";
    ctx.fillText("TOP DESIGNS", 45, 500);
    ctx.font = "13px monospace";
    (s.topDesigns || []).forEach((d, i) => {
      ctx.fillText(`${i + 1}. ${d.code} × ${d.count}`, 45, 530 + i * 24);
    });

    ctx.font = "11px monospace";
    ctx.fillStyle = TOKENS.muted;
    ctx.fillText("crftd Stall OS · placeholder skin, full crop-mark brutalist card is a later polish pass", 45, 710);
  }

  function downloadSummary() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "shift-summary.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  async function shareSummary() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], "shift-summary.png", { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Shift summary" });
      } else {
        downloadSummary();
      }
    });
  }

  const pending = orders.filter((o) => o.fulfillment_status === "pending_press" && !o.voided_at);
  const collecting = orders.filter((o) => o.fulfillment_status === "collect_later" && !o.voided_at);

  return (
    <div className="min-h-dvh flex flex-col">
      <PosFrame kicker="STALL OS · ORDERS" title="Orders">
        {(pending.length > 0 || collecting.length > 0) && (
          <div className="flex gap-2" role="tablist" aria-label="Press and collection queues">
            <Chip role="tab" aria-selected={tab === "press"} active={tab === "press"} onClick={() => setTab("press")}>
              PRESS QUEUE{pending.length ? ` · ${pending.length}` : ""}
            </Chip>
            <Chip
              role="tab"
              aria-selected={tab === "collections"}
              active={tab === "collections"}
              onClick={() => setTab("collections")}
            >
              COLLECTIONS{collecting.length ? ` · ${collecting.length}` : ""}
            </Chip>
          </div>
        )}
        {/* PRD §3.2: pending items pin to the top with a live timer and the
            press sheet the heat-press operator actually works from. */}
        {tab === "press" ? (
          <PressQueue orders={pending} onPress={pressOrder} onHandOver={handOverOrder} />
        ) : (
          <Collections orders={collecting} onCollect={collectOrder} />
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
                    className="tap-target min-w-[48px] inline-flex items-center justify-center border border-signal text-signal text-[9px] font-extrabold px-1.5 py-1"
                  >
                    VOID
                  </button>
                )}
              </div>
            </div>
          ))}
          {orders.length === 0 && (
            <div className="text-center text-sm text-muted py-6">No orders yet this shift.</div>
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
          {closeBlockedErr && (
            <div role="alert" className="bg-signal text-cream p-2.5 font-extrabold text-[11px] tracking-wide uppercase">
              {closeBlockedErr}
            </div>
          )}
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

        {summary && (
          <div className="flex flex-col gap-2">
            <canvas ref={canvasRef} className="w-full border-2 border-ink" />
            <div className="grid grid-cols-2 gap-2">
              <BigButton variant="blue" onClick={shareSummary}>
                SHARE
              </BigButton>
              <BigButton variant="ghost" onClick={downloadSummary}>
                DOWNLOAD
              </BigButton>
            </div>
          </div>
        )}
      </PosFrame>
      <TabBar />
    </div>
  );
}

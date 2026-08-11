"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PosFrame } from "@/components/PosFrame";
import { TabBar } from "@/components/TabBar";
import { BigButton, Mono, Banner } from "@/components/ui";
import { getDeviceId } from "@/lib/deviceId";
import { TOKENS } from "@/lib/tokens";
import { PressQueue, type PressOrder } from "@/components/PressQueue";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FirstRunHint } from "@/components/FirstRunHint";
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
  const [fulfilErr, setFulfilErr] = useState("");
  const [fulfilBusy, setFulfilBusy] = useState<string | null>(null);
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

  // Voiding reverses a sale and puts stock back. It used to be
  // `window.prompt("Void reason?") || "unspecified"` — so pressing Cancel
  // returned null, fell through the ||, and voided the order anyway. Backing
  // out did not back out. It now goes through a real dialog that says what
  // will happen and requires a reason, because the pattern of what gets
  // voided is the data worth keeping.
  const [voidTarget, setVoidTarget] = useState<Order | null>(null);

  async function confirmVoid(reason: string) {
    const target = voidTarget;
    setVoidTarget(null);
    if (!target) return;
    setFulfilErr("");
    try {
      const res = await fetch(`/api/orders/${target.id}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, actor: "volunteer" }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setFulfilErr(j.error || "Couldn't void that sale — nothing changed. Try again.");
        return;
      }
      setOrders((prev) =>
        prev.map((o) => (o.id === target.id ? { ...o, voided_at: new Date().toISOString() } : o))
      );
    } catch {
      setFulfilErr("No connection — the sale was not voided. Try again once you're back online.");
    }
  }

  // Every one of these three previously did `if (res.ok)` with no else: a
  // failed request left the button looking untapped, so a volunteer would
  // press again, and again, with no idea the server never heard them. On a
  // stall with patchy data that is the normal case, not the edge case.
  async function fulfilStep(
    id: string,
    step: "press" | "handover" | "collect",
    apply: (o: Order) => Order
  ) {
    setFulfilErr("");
    setFulfilBusy(id + step);
    try {
      const res = await fetch(`/api/orders/${id}/${step}`, { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setFulfilErr(j.error || "Couldn't save that — check the connection and try again.");
        return;
      }
      setOrders((prev) => prev.map((o) => (o.id === id ? apply(o) : o)));
    } catch {
      setFulfilErr("No connection — that didn't save. Try again once you're back online.");
    } finally {
      setFulfilBusy(null);
    }
  }

  const pressOrder = (id: string) =>
    fulfilStep(id, "press", (o) => ({ ...o, pressed_at: new Date().toISOString() }));

  const handOverOrder = (id: string) =>
    fulfilStep(id, "handover", (o) => ({
      ...o,
      fulfillment_status: "handed_over",
      pressed_at: o.pressed_at ?? new Date().toISOString(),
    }));

  const collectOrder = (id: string) =>
    fulfilStep(id, "collect", (o) => ({
      ...o,
      fulfillment_status: "collected",
      collected_at: new Date().toISOString(),
    }));

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

    // This card is downloaded and posted to the team WhatsApp group at every
    // shift close — the most widely-seen artefact the product makes. The
    // footer previously read "placeholder skin, full crop-mark brutalist card
    // is a later polish pass", so an internal build note was being shared
    // outside the team at the end of every single shift.
    ctx.font = "11px monospace";
    ctx.fillStyle = TOKENS.muted;
    ctx.fillText(
      `crftd Stall OS · ${new Date().toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })}`,
      45,
      710
    );
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
    <div className="contents">
      <PosFrame
        helpTopic="close"
        nav={<TabBar />} kicker="STALL OS · ORDERS" title="Orders">
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
        {/* Pending items pin to the top with a live wait timer and the press
            sheet the heat-press operator actually works from. */}
        <FirstRunHint
          id="orders"
          title="What this screen is for"
          points={[
            "Anything waiting to be pressed is pinned at the top, oldest first, with how long it's been waiting.",
            "The press sheet shows exactly where each sticker goes — that's what the person on the heat press works from.",
            "Charged the wrong thing? Find the receipt number below and tap VOID. Stock goes back automatically.",
          ]}
        />
        {fulfilErr && (
          <Banner tone="signal" transient>
            <span>{fulfilErr}</span>
          </Banner>
        )}
        {tab === "press" ? (
          <PressQueue
            orders={pending}
            onPress={pressOrder}
            onHandOver={handOverOrder}
            busyId={fulfilBusy}
          />
        ) : (
          <Collections orders={collecting} onCollect={collectOrder} busyId={fulfilBusy} />
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
                  <span className="text-[12px] font-extrabold text-signal">VOID</span>
                ) : (
                  <button
                    onClick={() => setVoidTarget(o)}
                    className="tap-target min-w-[48px] inline-flex items-center justify-center border border-signal text-signal text-[12px] font-extrabold px-1.5 py-1"
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
        <ConfirmDialog
          open={!!voidTarget}
          title="Void this sale?"
          body={
            voidTarget
              ? `${voidTarget.receipt_no} for ₹${voidTarget.total} will be cancelled and every item on it goes back into stock. The receipt number stays used — that's deliberate, so the numbering has no gaps.`
              : ""
          }
          confirmLabel="VOID SALE"
          reasonLabel="Why is this being voided?"
          onConfirm={confirmVoid}
          onCancel={() => setVoidTarget(null)}
        />
      </PosFrame>
    </div>
  );
}

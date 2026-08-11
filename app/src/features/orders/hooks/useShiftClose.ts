"use client";
import { useRef, useState } from "react";
import { TOKENS } from "@/lib/tokens";
import { flushOutbox, outboxCount } from "@/lib/outbox";
import type { Summary } from "../types";

/** Close-shift flow: cash count, the sync-before-close guard, the resulting
 *  variance, and the shareable shift-summary card drawn to canvas.
 *
 *  PRD §10: shift close "must block on a non-empty outbox with a clear
 *  '3 sales not yet synced, connect to wifi' message." This used to call
 *  /api/shift/close unconditionally — a volunteer could close on iOS (no
 *  Background Sync) with queued sales still sitting in IndexedDB, and the
 *  till would reconcile against server data missing those orders. */
export function useShiftClose(shift: { id: string; name: string } | null) {
  const [closing, setClosing] = useState(false);
  const [countedCash, setCountedCash] = useState("");
  const [closeResult, setCloseResult] = useState<{ expectedCash: number; variance: number | null } | null>(
    null
  );
  const [summary, setSummary] = useState<Summary | null>(null);
  const [outboxPending, setOutboxPending] = useState(0);
  const [closeBlockedErr, setCloseBlockedErr] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  async function closeShift() {
    if (!shift) return;
    setCloseBlockedErr("");

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

  return {
    closing,
    setClosing,
    countedCash,
    setCountedCash,
    closeResult,
    summary,
    outboxPending,
    closeBlockedErr,
    canvasRef,
    closeShift,
    downloadSummary,
    shareSummary,
  };
}

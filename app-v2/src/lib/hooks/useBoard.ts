"use client";

/* eslint-disable react-hooks/set-state-in-effect --
   These hooks synchronise React with external systems (the backend seam,
   localStorage, a realtime subscription), which is what effects exist for.
   The rule guards against cascading re-render loops; a one-shot load that
   settles into loading/data/error is the canonical pattern, not that bug. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { getBackend } from "../backend";
import { type BoardStage, type Order, stageOf } from "../domain/types";

/** The POS ticket board.
 *
 *  This is the hook that justified adding a state layer at all. The old model
 *  — every page an isolated island that refetches on mount — cannot express
 *  "a ticket the customer just created at the kiosk appears on the volunteer's
 *  board without anyone refreshing". That is the core interaction of the whole
 *  prep/print/handover pipeline, so it gets a real subscription rather than a
 *  poll.
 *
 *  Scope is deliberately narrow: this is not an app-wide store. It owns the
 *  board's orders for one environment and nothing else. */
export function useBoard(environmentId: string | null) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Ids that arrived while the volunteer was looking at the board, so they can
   *  be visually distinguished from ones that were already there. A ticket
   *  materialising silently in a list is a ticket that gets missed. */
  const [arrived, setArrived] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!environmentId) {
      setLoading(false);
      return;
    }
    const res = await getBackend().listOrders({ environment_id: environmentId, limit: 200 });
    if (res.ok) setOrders(res.data);
    else setError(res.error);
    setLoading(false);
  }, [environmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!environmentId) return;
    return getBackend().subscribeOrders(environmentId, (o) => {
      setArrived((prev) => new Set(prev).add(o.id));
      void load();
    });
  }, [environmentId, load]);

  const byStage = useMemo(() => {
    const out: Record<BoardStage, Order[]> = { prep: [], print: [], handover: [] };
    for (const o of orders) {
      const s = stageOf(o);
      if (s) out[s].push(o);
    }
    // Oldest first in every queue. A stall serves in the order people arrived,
    // so the board must not sort by anything cleverer than that.
    for (const k of Object.keys(out) as BoardStage[]) {
      out[k].sort((a, b) => a.client_created_at.localeCompare(b.client_created_at));
    }
    return out;
  }, [orders]);

  const clearArrived = useCallback((id: string) => {
    setArrived((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  return { orders, byStage, arrived, clearArrived, loading, error, reload: load };
}

/** Contextual guidance for one ticket at one stage.
 *
 *  Driven by the ticket's actual contents rather than written per screen —
 *  this is the "nudge system" as a real mechanism. A volunteer in prep mode is
 *  told which physical stickers to pull and where they live, because walking
 *  to the right box is the actual work.
 *
 *  Bin location is the single highest-value detail on a volunteer's screen. It
 *  is why the sticker catalogue carries `bin_location` at all. */
export function nudgeFor(order: Order, stage: BoardStage): string | null {
  const stickers = order.items.flatMap((i) => i.stickers);

  if (stage === "prep") {
    if (!stickers.length) return "No transfers on this one — just the garment. Pull it and mark prepped.";
    const list = stickers
      .map((s) => (s.bin_location ? `${s.code} (${s.bin_location})` : s.code))
      .join(", then ");
    return `Pull ${list}.`;
  }

  if (stage === "print") {
    const sides = new Set(stickers.map((s) => s.side));
    const garment = order.items[0];
    const desc = [garment?.color_name, garment?.fit_name, garment?.size].filter(Boolean).join(" · ");
    if (sides.size > 1) return `${desc} — press the front first, then turn it and do the back.`;
    return `${desc} — ${stickers.length} transfer${stickers.length === 1 ? "" : "s"} on the ${[...sides][0] ?? "front"}.`;
  }

  if (order.payment_method === "cash" || order.payment_method === "pending") {
    return `Collect ${order.total > 0 ? "payment" : "nothing"} before handing over — this one was marked ${
      order.payment_method === "pending" ? "pay at counter" : "cash"
    }.`;
  }
  return "Paid by UPI at the kiosk. Check their payment screen, then hand it over.";
}

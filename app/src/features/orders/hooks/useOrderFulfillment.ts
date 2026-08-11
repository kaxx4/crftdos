"use client";
import { useState } from "react";
import type { Order } from "../types";

/** Void + press/handover/collect actions for orders on this screen.
 *
 *  Voiding reverses a sale and puts stock back. It used to be
 *  `window.prompt("Void reason?") || "unspecified"` — so pressing Cancel
 *  returned null, fell through the ||, and voided the order anyway. Backing
 *  out did not back out. It now goes through a real dialog that says what
 *  will happen and requires a reason, because the pattern of what gets
 *  voided is the data worth keeping.
 *
 *  Every one of the fulfilment steps below previously did `if (res.ok)`
 *  with no else: a failed request left the button looking untapped, so a
 *  volunteer would press again, and again, with no idea the server never
 *  heard them. On a stall with patchy data that is the normal case, not
 *  the edge case. */
export function useOrderFulfillment(setOrders: React.Dispatch<React.SetStateAction<Order[]>>) {
  const [voidTarget, setVoidTarget] = useState<Order | null>(null);
  const [fulfilErr, setFulfilErr] = useState("");
  const [fulfilBusy, setFulfilBusy] = useState<string | null>(null);

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

  return {
    voidTarget,
    setVoidTarget,
    confirmVoid,
    fulfilErr,
    fulfilBusy,
    pressOrder,
    handOverOrder,
    collectOrder,
  };
}

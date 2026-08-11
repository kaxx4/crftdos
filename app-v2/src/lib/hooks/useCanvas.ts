"use client";

import { useCallback, useMemo, useState } from "react";
import { getBackend } from "../backend";
import type { DesignPayload, KioskDesign, Placement, PrintArea, PrintSide, ProductSku } from "../domain/types";
import { clampCenterPct, findFreeSpot, overlaps, withinPrintArea } from "../geometry";
import { track } from "../analytics";
import { getKioskSessionId } from "../device";

/** The composition state machine for the kiosk canvas.
 *
 *  Owns three things that must stay in lockstep and are easy to desynchronise
 *  if they live in separate places:
 *
 *    1. The placements themselves.
 *    2. The SOFT HOLD behind each placement. A sticker is reserved BEFORE it
 *       appears on the canvas, so two kiosks cannot both compose with the last
 *       M-014. Removing a placement releases its hold; abandoning the session
 *       lets the hold expire on its own. A placement without a hold is a
 *       promise the stall may not be able to keep.
 *    3. The fulfillability constraints, applied on every mutation rather than
 *       only at checkout — a customer must never be told at the till that the
 *       thing they spent five minutes arranging is impossible.
 *
 *  The rejection path is deliberately generous: a tap that would overlap tries
 *  a spread of alternate positions and only refuses when the side is genuinely
 *  full. It still enforces the rule; it just doesn't dead-end someone on their
 *  first tap. */

export type Refusal = { message: string; at: number } | null;

export function useCanvas(environmentId: string | null) {
  const [sku, setSku] = useState<ProductSku | null>(null);
  const [side, setSide] = useState<PrintSide>("front");
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [refusal, setRefusal] = useState<Refusal>(null);
  const [placing, setPlacing] = useState(false);

  const printArea: PrintArea | undefined = useMemo(() => {
    return sku?.print_area?.[side];
  }, [sku, side]);

  const onSide = useMemo(() => placements.filter((p) => p.side === side), [placements, side]);

  const total = useMemo(() => {
    return (sku?.unit_price ?? 0) + placements.reduce((n, p) => n + p.unit_price, 0);
  }, [sku, placements]);

  const refuse = useCallback((message: string) => {
    setRefusal({ message, at: Date.now() });
  }, []);

  /** Place a design. Reserves stock FIRST — if the reservation fails there is
   *  no placement, because a sticker on screen that isn't reserved is a sale
   *  the stall can't fulfil. */
  const place = useCallback(
    async (design: KioskDesign) => {
      if (!printArea || !environmentId || !sku) return;
      setPlacing(true);
      try {
        const spot = findFreeSpot(printArea, design, onSide);
        if (!spot) {
          track(environmentId, "overlap_blocked", { code: design.code, side });
          refuse("No room left on this side. Remove something first, or try the back.");
          return;
        }

        const res = await getBackend().reserveSticker({
          sticker_id: design.id,
          environment_id: environmentId,
          session_id: getKioskSessionId(),
          qty: 1,
        });
        if (!res.ok) {
          track(environmentId, "out_of_stock_seen", { code: design.code });
          refuse(res.error);
          return;
        }

        const placement: Placement = {
          sticker_design_id: design.id,
          code: design.code,
          side,
          pos_x: spot.pos_x,
          pos_y: spot.pos_y,
          rotation: 0,
          print_w_cm: design.print_w_cm,
          print_h_cm: design.print_h_cm,
          cutout_path: design.cutout_path,
          unit_price: design.unit_price,
          unit_cost: design.unit_cost,
          hold_id: res.data.id,
        };
        setPlacements((prev) => [...prev, placement]);
        track(environmentId, "sticker_placed", { code: design.code, side, size: design.size_class });
      } finally {
        setPlacing(false);
      }
    },
    [printArea, environmentId, sku, onSide, side, refuse]
  );

  const remove = useCallback(
    async (index: number) => {
      const p = placements[index];
      if (!p) return;
      setPlacements((prev) => prev.filter((_, i) => i !== index));
      // Release rather than let it expire: the next customer in the queue
      // should be able to use that transfer immediately, not in 30 minutes.
      if (p.hold_id) await getBackend().releaseHold(p.hold_id);
      if (environmentId) track(environmentId, "sticker_removed", { code: p.code });
    },
    [placements, environmentId]
  );

  /** Live drag. Clamps to the print area on every move so a sticker can never
   *  be dragged onto a seam, a hem or a sleeve. */
  const moveTo = useCallback(
    (index: number, xPct: number, yPct: number) => {
      if (!printArea) return;
      setPlacements((prev) =>
        prev.map((p, i) =>
          i === index
            ? {
                ...p,
                pos_x: clampCenterPct(xPct, p.print_w_cm, printArea.cm_w),
                pos_y: clampCenterPct(yPct, p.print_h_cm, printArea.cm_h),
              }
            : p
        )
      );
    },
    [printArea]
  );

  /** Commit a drag or a rotation. `clampCenterPct` is not sufficient on its own
   *  once a placement is rotated — its true corners can leave the printable
   *  rectangle while its centre is still inside — so the commit re-checks both
   *  bounds and overlap, and REVERTS rather than silently accepting an
   *  unpressable arrangement. */
  const commit = useCallback(
    (index: number, previous: Placement) => {
      if (!printArea) return;
      setPlacements((prev) => {
        const candidate = prev[index];
        if (!candidate) return prev;
        const others = prev.filter((_, i) => i !== index && prev[i].side === candidate.side);
        const bad = !withinPrintArea(printArea, candidate) || others.some((o) => overlaps(printArea, candidate, o));
        if (!bad) return prev;
        refuse("That doesn't fit there — put back where it was.");
        return prev.map((p, i) => (i === index ? previous : p));
      });
    },
    [printArea, refuse]
  );

  const rotate = useCallback((index: number, degrees: number) => {
    setPlacements((prev) => prev.map((p, i) => (i === index ? { ...p, rotation: degrees } : p)));
  }, []);

  /** Load a template into the canvas. Deliberately the same code path a design
   *  ticket would take, which is why templates reuse the ticket payload shape.
   *  Each placement still has to reserve its own stock — a template is a
   *  starting point, not a guarantee that its stickers are in the box today. */
  const loadPayload = useCallback(
    async (payload: DesignPayload, skuLookup: ProductSku[]) => {
      const found = skuLookup.find((s) => s.id === payload.product_sku_id);
      if (!found) {
        refuse("That design's garment isn't available right now. Pick another, or start blank.");
        return false;
      }
      setSku(found);
      setSide("front");

      const accepted: Placement[] = [];
      for (const p of payload.placements) {
        if (!environmentId) break;
        const res = await getBackend().reserveSticker({
          sticker_id: p.sticker_design_id,
          environment_id: environmentId,
          session_id: getKioskSessionId(),
          qty: 1,
        });
        // A template whose sticker is out of stock loads WITHOUT that sticker
        // rather than failing outright. Partial is better than a dead end, and
        // the customer can see what's missing and swap it.
        if (res.ok) accepted.push({ ...p, hold_id: res.data.id });
      }
      setPlacements(accepted);
      if (accepted.length < payload.placements.length) {
        refuse("One of the transfers in this design is out of stock here, so we left it off. Pick a replacement.");
      }
      return true;
    },
    [environmentId, refuse]
  );

  /** Release every hold. Called when a customer abandons or completes — an
   *  abandoned session must not keep stock reserved for 30 minutes while a
   *  queue waits. */
  const releaseAll = useCallback(async () => {
    const backend = getBackend();
    await Promise.all(placements.filter((p) => p.hold_id).map((p) => backend.releaseHold(p.hold_id!)));
  }, [placements]);

  const reset = useCallback(() => {
    setPlacements([]);
    setSku(null);
    setSide("front");
    setRefusal(null);
  }, []);

  const toPayload = useCallback((): DesignPayload | null => {
    if (!sku) return null;
    return {
      product_sku_id: sku.id,
      sku_code: sku.sku_code,
      unit_price: sku.unit_price,
      unit_cost: sku.unit_cost,
      placements,
    };
  }, [sku, placements]);

  return {
    sku,
    setSku,
    side,
    setSide,
    printArea,
    placements,
    onSide,
    total,
    refusal,
    placing,
    place,
    remove,
    moveTo,
    commit,
    rotate,
    loadPayload,
    releaseAll,
    reset,
    toPayload,
  };
}

import { useCallback, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { overlaps, withinPrintArea } from "../geometry";
import { getSessionId } from "../session";
import type { Design, Placement, PlacementTrial, Preset, PrintArea } from "../types";

/** Owns the hold lifecycle: every reservation this hook creates is released
 *  exactly once, either when the placement is removed or when the kiosk
 *  resets for the next customer. */
export function usePlacements(printArea: PrintArea | undefined, side: "front" | "back") {
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [overlapMsg, setOverlapMsg] = useState("");
  const rotationDragStart = useRef<number | null>(null);

  const releaseHold = useCallback((holdId: string) => {
    fetch("/api/kiosk/reserve", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ holdId }),
    }).catch(() => {
      // Non-fatal: the hold's TTL will expire it server-side even if this
      // release fails, but surface it so it's not a silent stock-lock.
      setOverlapMsg("Couldn't release that reservation — it'll free up on its own shortly.");
    });
  }, []);

  const reserveSticker = useCallback(async (design: Design): Promise<string | null> => {
    const res = await fetch("/api/kiosk/reserve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: getSessionId(), stickerDesignId: design.id }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setOverlapMsg(j.error || "Could not reserve — try another design");
      return null;
    }
    const j = await res.json();
    return j.hold.id as string;
  }, []);

  const placeDesign = useCallback(
    async (design: Design) => {
      if (!printArea) return;
      setOverlapMsg("");
      const holdId = await reserveSticker(design);
      if (!holdId) return;

      const trial: PlacementTrial = { xPct: 50, yPct: 50, print_w_cm: design.print_w_cm, print_h_cm: design.print_h_cm, rotation: 0 };
      const sameSide = placements.filter((p) => p.side === side);
      const collidesAtCenter = sameSide.some((p) => overlaps(printArea, trial, p));

      const commit = (x: number, y: number) =>
        setPlacements((prev) => [
          ...prev,
          {
            key: uuidv4(),
            sticker_design_id: design.id,
            code: design.code,
            print_w_cm: design.print_w_cm,
            print_h_cm: design.print_h_cm,
            unit_price: design.unit_price,
            unit_cost: design.unit_cost,
            side,
            xPct: x,
            yPct: y,
            rotation: 0,
            holdId,
          },
        ]);

      if (!collidesAtCenter) {
        commit(50, 50);
        return;
      }

      // Try a small grid of alternate centers before refusing outright —
      // still enforces "overlap blocked" (§4.3), just doesn't dead-end the
      // customer on the very first collision.
      const offsets: [number, number][] = [
        [30, 30],
        [70, 30],
        [30, 70],
        [70, 70],
        [50, 25],
        [50, 75],
      ];
      for (const [x, y] of offsets) {
        const candidate: PlacementTrial = { ...trial, xPct: x, yPct: y };
        if (!sameSide.some((p) => overlaps(printArea, candidate, p))) {
          commit(x, y);
          return;
        }
      }
      setOverlapMsg("No free space on this side without overlapping — remove one first.");
      releaseHold(holdId);
    },
    [placements, printArea, side, reserveSticker, releaseHold]
  );

  const removePlacement = useCallback(
    (key: string) => {
      setPlacements((prev) => {
        const p = prev.find((pp) => pp.key === key);
        if (p?.holdId) releaseHold(p.holdId);
        return prev.filter((pp) => pp.key !== key);
      });
      setSelectedKey((prev) => (prev === key ? null : prev));
    },
    [releaseHold]
  );

  const setRotation = useCallback((key: string, rotation: number) => {
    setPlacements((prev) => prev.map((p) => (p.key === key ? { ...p, rotation } : p)));
  }, []);

  const onRotationPointerDown = useCallback(
    (key: string) => {
      rotationDragStart.current = placements.find((p) => p.key === key)?.rotation ?? 0;
    },
    [placements]
  );

  /** Release is where both overlap and bounds get enforced, same as the
   *  position-drag release does: revert to the rotation the drag started at
   *  if the end state overlaps a neighbour or leaves the printable area. */
  const onRotationCommit = useCallback(
    (key: string) => {
      const start = rotationDragStart.current;
      rotationDragStart.current = null;
      if (start === null) return;
      setPlacements((prev) => {
        const moved = prev.find((p) => p.key === key);
        if (!moved) return prev;
        const collides = prev.some((p) => p.key !== key && p.side === moved.side && overlaps(printArea, moved, p));
        const outOfBounds = !withinPrintArea(printArea, moved);
        if (collides || outOfBounds) {
          setOverlapMsg(outOfBounds ? "That rotation puts it off the printable area — reverted." : "That rotation overlaps another sticker — reverted.");
          return prev.map((p) => (p.key === key ? { ...p, rotation: start } : p));
        }
        return prev;
      });
    },
    [printArea]
  );

  const applyPreset = useCallback(
    async (p: Preset, designs: Design[]) => {
      const built: Placement[] = [];
      // Each preset placement must actually reserve stock the same way a
      // manually-placed sticker does — otherwise two kiosks applying the
      // same limited-stock preset can both check out the same last unit.
      for (const pl of p.payload.placements || []) {
        const design = designs.find((d) => d.id === pl.sticker_design_id);
        const holdId = design ? await reserveSticker(design) : null;
        if (!holdId) continue; // sold out / reservation failed — skip, don't silently fake it
        built.push({
          key: uuidv4(),
          sticker_design_id: pl.sticker_design_id,
          code: pl.code,
          print_w_cm: design?.print_w_cm ?? 14,
          print_h_cm: design?.print_h_cm ?? 14,
          unit_price: pl.unit_price,
          unit_cost: pl.unit_cost,
          side: "front" as const,
          xPct: pl.pos_x,
          yPct: pl.pos_y,
          rotation: pl.rotation || 0,
          holdId,
        });
      }
      setPlacements(built);
    },
    [reserveSticker]
  );

  /** Every placement still holding a reservation gets released rather than
   *  left to expire on the TTL — matters most when a customer never reaches
   *  "Get Ticket" and a volunteer resets the kiosk for the next person. */
  const releaseAll = useCallback(() => {
    for (const p of placements) releaseHold(p.holdId);
    setPlacements([]);
    setSelectedKey(null);
    setOverlapMsg("");
  }, [placements, releaseHold]);

  return {
    placements,
    setPlacements,
    selectedKey,
    setSelectedKey,
    overlapMsg,
    setOverlapMsg,
    placeDesign,
    removePlacement,
    setRotation,
    onRotationPointerDown,
    onRotationCommit,
    applyPreset,
    releaseAll,
    reserveSticker,
    releaseHold,
  };
}

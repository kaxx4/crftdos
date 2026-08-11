import { type RefObject, useEffect, useRef, useState } from "react";
import { clampCenterPct, overlaps, withinPrintArea } from "../geometry";
import type { Placement, PrintArea } from "../types";
import { IMG_H, IMG_W } from "../types";

/** Sticker position drag.
 *
 *  FIX (must happen before any restructuring, per the component-architecture
 *  brief): the original implementation attached `pointermove`/`pointerup`
 *  to `window` inside the pointerdown handler and only ever removed them in
 *  `onPointerUp`. If the component unmounted mid-drag (a customer's finger
 *  never lifts and they walk away, or a volunteer navigates out via the
 *  staff-passcode link), the listeners leaked — a stray `window` pointer
 *  listener would keep firing `setPlacements` on stale refs after remount.
 *  Listeners are now attached/detached inside a `useEffect` keyed on whether
 *  a drag is active, so unmounting mid-drag always tears them down. */
export function useCanvasDrag(
  canvasRef: RefObject<HTMLDivElement | null>,
  printArea: PrintArea | undefined,
  setPlacements: React.Dispatch<React.SetStateAction<Placement[]>>,
  onOverlapMsg: (msg: string) => void
) {
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const dragState = useRef<{ key: string; startX: number; startY: number; origX: number; origY: number } | null>(null);

  function onPointerDownSticker(e: React.PointerEvent, p: Placement, onSelect: (key: string) => void) {
    e.stopPropagation();
    onSelect(p.key);
    dragState.current = { key: p.key, startX: e.clientX, startY: e.clientY, origX: p.xPct, origY: p.yPct };
    setDraggingKey(p.key);
  }

  useEffect(() => {
    if (!draggingKey) return;

    function onPointerMove(e: PointerEvent) {
      const ds = dragState.current;
      if (!ds || !printArea) return;
      const rectPxW = printArea.w * IMG_W;
      const rectPxH = printArea.h * IMG_H;
      const scale = (canvasRef.current?.clientWidth || IMG_W) / IMG_W;
      const dxPct = ((e.clientX - ds.startX) / scale / rectPxW) * 100;
      const dyPct = ((e.clientY - ds.startY) / scale / rectPxH) * 100;
      setPlacements((prev) =>
        prev.map((p) => {
          if (p.key !== ds.key || !printArea) return p;
          const nx = clampCenterPct(ds.origX + dxPct, p.print_w_cm, printArea.cm_w);
          const ny = clampCenterPct(ds.origY + dyPct, p.print_h_cm, printArea.cm_h);
          return { ...p, xPct: nx, yPct: ny };
        })
      );
    }

    function onPointerUp() {
      const ds = dragState.current;
      dragState.current = null;
      setDraggingKey(null);
      if (!ds) return;
      setPlacements((prev) => {
        const moved = prev.find((p) => p.key === ds.key);
        if (!moved) return prev;
        const collides = prev.some((p) => p.key !== ds.key && p.side === moved.side && overlaps(printArea, moved, p));
        const outOfBounds = !withinPrintArea(printArea, moved);
        if (collides || outOfBounds) {
          onOverlapMsg(outOfBounds ? "That's off the printable area — placement moved back." : "That overlaps another sticker — placement moved back.");
          return prev.map((p) => (p.key === ds.key ? { ...p, xPct: ds.origX, yPct: ds.origY } : p));
        }
        return prev;
      });
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [draggingKey, printArea, canvasRef, setPlacements, onOverlapMsg]);

  return { onPointerDownSticker };
}

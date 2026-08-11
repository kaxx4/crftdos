"use client";
import { memo } from "react";
import type { Placement } from "../types";

/** One sticker on the canvas.
 *
 *  Split out and memoised because the canvas re-renders on every
 *  `pointermove` during a drag. Previously every sprite re-rendered on every
 *  move event, and each one also ran `designs.find(...)` to resolve its
 *  cutout — an O(placements x designs) scan per frame, with 200 designs in the
 *  catalogue. The lookup is now a Map built once by the parent, and a sprite
 *  only re-renders when its own geometry actually changes.
 *
 *  The comparator is explicit rather than a default shallow compare so the
 *  `onPointerDown` identity (which changes each parent render) can't defeat
 *  the memo. */
export type SpriteRect = { x: number; y: number; w: number; h: number };

function PlacementSpriteInner({
  placement,
  rect,
  src,
  selected,
  imgW,
  imgH,
  onPointerDown,
}: {
  placement: Placement;
  rect: SpriteRect;
  src: string;
  selected: boolean;
  imgW: number;
  imgH: number;
  onPointerDown: (e: React.PointerEvent, p: Placement) => void;
}) {
  return (
    <img
      src={src}
      alt={placement.code}
      loading="lazy"
      draggable={false}
      onPointerDown={(e) => onPointerDown(e, placement)}
      // outline, not box-shadow: an outline doesn't affect layout and doesn't
      // get clipped by the canvas's overflow:hidden the way a shadow can.
      className={`absolute cursor-move touch-none select-none ${
        selected ? "outline outline-2 outline-signal outline-offset-2" : ""
      }`}
      style={{
        left: `${(rect.x / imgW) * 100}%`,
        top: `${(rect.y / imgH) * 100}%`,
        width: `${(rect.w / imgW) * 100}%`,
        height: `${(rect.h / imgH) * 100}%`,
        transform: `rotate(${placement.rotation}deg)`,
        // Fades in where the finger released it. No positional transform — it
        // must land exactly where it was dropped, not slide into place.
        animation: "kiosk-place var(--dur-kiosk) var(--ease-kiosk)",
      }}
    />
  );
}

export const PlacementSprite = memo(PlacementSpriteInner, (a, b) => {
  return (
    a.placement.key === b.placement.key &&
    a.placement.rotation === b.placement.rotation &&
    a.placement.code === b.placement.code &&
    a.selected === b.selected &&
    a.src === b.src &&
    a.imgW === b.imgW &&
    a.imgH === b.imgH &&
    a.rect.x === b.rect.x &&
    a.rect.y === b.rect.y &&
    a.rect.w === b.rect.w &&
    a.rect.h === b.rect.h
  );
});

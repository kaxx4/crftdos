"use client";

/** A composed design, rendered at any size.
 *
 *  One component, four consumers: the storefront's template cards, the canvas
 *  itself, the POS board's ticket thumbnails, and the admin template editor.
 *  That reuse is the reason placements store position as a PERCENTAGE OF THE
 *  PRINT AREA rather than in pixels — the same numbers render correctly at
 *  120px on a phone and 800px on a tablet, and survive any mockup being
 *  reshot at a different resolution.
 *
 *  This is presentational only. It renders whatever it is given and enforces
 *  nothing — the fulfillability constraints live in lib/geometry.ts and are
 *  applied when a placement is created or moved, never at render time. A
 *  preview that silently "fixed" an impossible arrangement would hide exactly
 *  the bug you need to see. */

import Image from "next/image";
import type { Placement, PrintSide, ProductSku } from "@/lib/domain/types";
import { IMG_H, IMG_W, layoutRect } from "@/lib/geometry";
import { clsx } from "@/components/clsx";

export function DesignPreview({
  sku,
  placements,
  side = "front",
  className,
  children,
}: {
  sku: ProductSku | undefined;
  placements: Placement[];
  side?: PrintSide;
  className?: string;
  children?: React.ReactNode;
}) {
  const mockup = side === "front" ? sku?.mockup_front : sku?.mockup_back;
  const printArea = sku?.print_area?.[side];
  const onSide = placements.filter((p) => p.side === side);

  return (
    <div
      className={clsx("relative overflow-hidden", className)}
      style={{ aspectRatio: `${IMG_W} / ${IMG_H}` }}
    >
      {mockup ? (
        <Image src={mockup} alt="" fill sizes="(max-width: 768px) 50vw, 33vw" className="object-contain" />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-[var(--color-cream-2)] text-sm text-[var(--color-muted)]">
          No mockup yet
        </div>
      )}

      {printArea &&
        onSide.map((p, i) => {
          const r = layoutRect(printArea, p);
          return (
            <div
              key={`${p.sticker_design_id}-${i}`}
              className="absolute"
              style={{
                left: `${(r.x / IMG_W) * 100}%`,
                top: `${(r.y / IMG_H) * 100}%`,
                width: `${(r.w / IMG_W) * 100}%`,
                height: `${(r.h / IMG_H) * 100}%`,
                transform: `rotate(${p.rotation}deg)`,
              }}
            >
              {p.cutout_path && (
                <Image src={p.cutout_path} alt={p.code} fill sizes="200px" className="object-contain" />
              )}
            </div>
          );
        })}

      {children}
    </div>
  );
}

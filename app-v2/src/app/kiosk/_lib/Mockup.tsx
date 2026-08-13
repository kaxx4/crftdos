"use client";

/** A garment with transfers on it, rendered at any size.
 *
 *  Presentational only. It draws exactly what it is given and enforces
 *  nothing — the fulfilment constraints (true physical scale, print-area
 *  bounds, no overlap) live in `lib/geometry.ts` and are applied when a
 *  placement is created or moved. A preview that quietly "tidied up" an
 *  impossible arrangement would hide the one class of bug that reaches the
 *  heat press.
 *
 *  Placements are percentages of the print area, so the same numbers render
 *  correctly at 140px in a template tile and at 600px on the canvas. */

import Image from "next/image";
import type { Placement, PrintSide, ProductSku } from "@/lib/domain/types";
import { IMG_H, IMG_W, layoutRect } from "@/lib/geometry";
import { clsx } from "@/components/clsx";

export function Mockup({
  sku,
  placements,
  side = "front",
  className,
  children,
}: {
  sku: ProductSku | null | undefined;
  placements: Placement[];
  side?: PrintSide;
  className?: string;
  /** Interaction layer — drag handles on the canvas, nothing elsewhere. */
  children?: React.ReactNode;
}) {
  const mockup = side === "front" ? sku?.mockup_front : sku?.mockup_back;
  const printArea = sku?.print_area?.[side];
  const onSide = placements.filter((p) => p.side === side);

  return (
    <div
      className={clsx(
        "relative overflow-hidden rounded-[var(--radius-xl)] border-[3px] border-[var(--color-ink)] bg-white",
        className
      )}
      style={{ aspectRatio: `${IMG_W} / ${IMG_H}` }}
    >
      {mockup ? (
        <Image src={mockup} alt="" fill sizes="(max-width: 768px) 90vw, 480px" className="object-contain" />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-[var(--color-paper-2)] p-[var(--space-4)] text-center">
          <p className="t-base text-[var(--color-muted)]">
            No photo of this one yet — a volunteer can show you the real thing.
          </p>
        </div>
      )}

      {printArea &&
        onSide.map((p, i) => {
          const r = layoutRect(printArea, p);
          return (
            <div
              key={`${p.sticker_design_id ?? p.code}-${i}`}
              className="animate-place absolute"
              style={{
                left: `${(r.x / IMG_W) * 100}%`,
                top: `${(r.y / IMG_H) * 100}%`,
                width: `${(r.w / IMG_W) * 100}%`,
                height: `${(r.h / IMG_H) * 100}%`,
                transform: `rotate(${p.rotation}deg)`,
              }}
            >
              {p.cutout_path && <Image src={p.cutout_path} alt={p.code} fill sizes="240px" className="object-contain" />}
            </div>
          );
        })}

      {children}
    </div>
  );
}

"use client";

/** The canvas.
 *
 *  Layout is a genuine two-column tablet composition — picker and live preview
 *  side by side — rather than the phone-width card centred on a tablet screen
 *  the old build shipped (Known Issues #1, where the pragmatic fix was a
 *  max-width bump and the real fix was said to be this layout pass).
 *
 *  The core mechanic underneath is carried forward unchanged and verified:
 *  true-scale rendering, SAT overlap, print-area clamping, stock-aware
 *  placement. What changed is everything around it. */

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import type { Catalogue } from "@/lib/backend";
import type { KioskDesign, Placement, ProductSku } from "@/lib/domain/types";
import type { useCanvas } from "@/lib/hooks/useCanvas";
import { IMG_H, IMG_W, layoutRect } from "@/lib/geometry";
import { money } from "@/lib/money";
import { Button, Chip, EmptyState, Skeleton } from "@/components/ui";
import { clsx } from "@/components/clsx";
import { GarmentPicker } from "./GarmentPicker";
import { DesignRail } from "./DesignRail";

type Canvas = ReturnType<typeof useCanvas>;

export function CanvasStage({
  canvas,
  catalogue,
  designs,
  designsLoading,
  onBack,
  onContinue,
}: {
  canvas: Canvas;
  catalogue: Catalogue | null;
  designs: KioskDesign[];
  designsLoading: boolean;
  onBack: () => void;
  onContinue: () => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);

  // No garment chosen yet — the canvas has nothing to render onto, so the
  // picker takes the whole screen rather than being a cramped column beside
  // an empty tee.
  if (!canvas.sku) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-1 text-3xl font-extrabold tracking-tight">Pick your tee</h1>
        <p className="mb-6 text-[var(--color-muted)]">Colour, fit and size. You can change it later.</p>
        {catalogue ? (
          <GarmentPicker catalogue={catalogue} value={null} onChange={canvas.setSku} />
        ) : (
          <div className="grid gap-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        )}
        <Button className="mt-6" variant="ghost" onClick={onBack}>
          ← Back to designs
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:px-8">
      {/* ── Live preview ─────────────────────────────────────────────── */}
      <section className="lg:sticky lg:top-20 lg:self-start">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex gap-2">
            <Chip selected={canvas.side === "front"} onClick={() => canvas.setSide("front")}>
              Front
            </Chip>
            <Chip selected={canvas.side === "back"} onClick={() => canvas.setSide("back")}>
              Back
            </Chip>
          </div>
          <p className="font-[family-name:var(--font-mono)] text-sm text-[var(--color-muted)]">
            Shown at real printed size
          </p>
        </div>

        <CanvasSurface canvas={canvas} selected={selected} onSelect={setSelected} />

        {canvas.refusal && (
          <p
            key={canvas.refusal.at}
            role="alert"
            className="animate-refuse mt-3 rounded-lg border-2 border-[var(--color-signal)] bg-[var(--color-signal-wash)] px-3 py-2 text-sm font-semibold"
          >
            {canvas.refusal.message}
          </p>
        )}

        {selected !== null && canvas.placements[selected] && (
          <RotationControl
            placement={canvas.placements[selected]}
            onRotate={(deg) => canvas.rotate(selected, deg)}
            onCommit={(previous) => canvas.commit(selected, previous)}
            onRemove={() => {
              void canvas.remove(selected);
              setSelected(null);
            }}
          />
        )}
      </section>

      {/* ── Controls ─────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-5">
        <div className="rounded-xl border-2 border-[var(--color-line)] bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">Your tee</h2>
            <Button size="md" variant="ghost" onClick={() => canvas.setSku(null)}>
              Change
            </Button>
          </div>
          <p className="font-semibold">
            {catalogue?.colors.find((c) => c.id === canvas.sku!.color_id)?.name}{" "}
            {catalogue?.fits.find((f) => f.id === canvas.sku!.fit_id)?.name} · {canvas.sku.size}
          </p>
        </div>

        {designsLoading ? (
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square" />
            ))}
          </div>
        ) : designs.length === 0 ? (
          <EmptyState
            headline="No transfers available here right now"
            teach="Every transfer at this stall is either sold out or reserved by someone else composing at the moment. Ask a volunteer — they may have more in the box."
          />
        ) : (
          <DesignRail
            designs={designs}
            busy={canvas.placing}
            onPick={(d) => void canvas.place(d)}
            placedCodes={canvas.onSide.map((p) => p.code)}
          />
        )}

        {/* Running total, always visible. No surprises at the till. */}
        <div className="sticky bottom-4 rounded-xl border-2 border-[var(--color-ink)] bg-[var(--color-ink)] p-4 text-[var(--color-cream)]">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-cream)]/60">Total</p>
              <p className="font-[family-name:var(--font-mono)] text-3xl font-bold tnum">{money(canvas.total)}</p>
            </div>
            <p className="text-sm text-[var(--color-cream)]/70">
              {canvas.placements.length} transfer{canvas.placements.length === 1 ? "" : "s"}
            </p>
          </div>
          <Button surface="kiosk" size="lg" variant="primary" block onClick={onContinue}>
            {canvas.placements.length ? "Looks good — continue" : "Continue with a plain tee"}
          </Button>
        </div>
      </section>
    </main>
  );
}

/** The draggable surface itself.
 *
 *  Pointer events rather than mouse/touch pairs, and pointer capture so a fast
 *  drag that leaves the element does not drop the sticker mid-move — which on
 *  a tablet is most drags. */
function CanvasSurface({
  canvas,
  selected,
  onSelect,
}: {
  canvas: Canvas;
  selected: number | null;
  onSelect: (i: number | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef<{ index: number; before: Placement } | null>(null);
  const mockup = canvas.side === "front" ? canvas.sku?.mockup_front : canvas.sku?.mockup_back;

  const pctFromEvent = useCallback(
    (e: React.PointerEvent) => {
      const el = ref.current;
      const area = canvas.printArea;
      if (!el || !area) return null;
      const box = el.getBoundingClientRect();
      const relX = (e.clientX - box.left) / box.width;
      const relY = (e.clientY - box.top) / box.height;
      // Convert from a fraction of the whole mockup into a percentage of the
      // print rectangle, which is the coordinate space placements live in.
      return { x: ((relX - area.x) / area.w) * 100, y: ((relY - area.y) / area.h) * 100 };
    },
    [canvas.printArea]
  );

  return (
    /* Height-driven below lg, width-driven above.
     *
     * On a portrait tablet — the kiosk's actual target — a width-driven 4:5
     * canvas fills the entire viewport, so the transfer rail sits below the
     * fold and a customer sees a tee with no visible way to change it. Sizing
     * from height instead keeps the picker on screen beside the preview, which
     * is the real fix the old build's max-width bump was standing in for. */
    <div
      ref={ref}
      className="relative mx-auto h-[54dvh] w-auto max-w-full select-none overflow-hidden rounded-2xl border-2 border-[var(--color-line)] bg-white lg:h-auto lg:w-full"
      style={{ aspectRatio: `${IMG_W} / ${IMG_H}` }}
      onPointerDown={() => onSelect(null)}
    >
      {mockup && <Image src={mockup} alt="Your tee" fill sizes="(max-width: 1024px) 100vw, 60vw" className="object-contain" priority />}

      {/* The printable rectangle, shown faintly. A customer who can see the
          boundary understands the refusal when they hit it, instead of
          experiencing the canvas as arbitrarily uncooperative. */}
      {canvas.printArea && (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-sm border border-dashed border-[var(--color-blue)]/35"
          style={{
            left: `${canvas.printArea.x * 100}%`,
            top: `${canvas.printArea.y * 100}%`,
            width: `${canvas.printArea.w * 100}%`,
            height: `${canvas.printArea.h * 100}%`,
          }}
        />
      )}

      {canvas.placements.map((p, i) => {
        if (p.side !== canvas.side) return null;
        const r = layoutRect(canvas.printArea, p);
        return (
          <div
            key={`${p.sticker_design_id}-${i}`}
            role="button"
            tabIndex={0}
            aria-label={`${p.code}, ${p.print_w_cm}cm. Drag to move.`}
            className={clsx(
              "animate-place absolute cursor-grab touch-none active:cursor-grabbing",
              selected === i && "outline-2 outline-offset-4 outline-[var(--color-blue)]"
            )}
            style={{
              left: `${(r.x / IMG_W) * 100}%`,
              top: `${(r.y / IMG_H) * 100}%`,
              width: `${(r.w / IMG_W) * 100}%`,
              height: `${(r.h / IMG_H) * 100}%`,
              transform: `rotate(${p.rotation}deg)`,
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onSelect(i);
              dragging.current = { index: i, before: { ...p } };
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (dragging.current?.index !== i) return;
              const pt = pctFromEvent(e);
              if (pt) canvas.moveTo(i, pt.x, pt.y);
            }}
            onPointerUp={() => {
              if (dragging.current?.index === i) canvas.commit(i, dragging.current.before);
              dragging.current = null;
            }}
            onPointerCancel={() => {
              if (dragging.current?.index === i) canvas.commit(i, dragging.current.before);
              dragging.current = null;
            }}
          >
            {p.cutout_path && <Image src={p.cutout_path} alt={p.code} fill sizes="300px" className="pointer-events-none object-contain" />}
          </div>
        );
      })}

      {canvas.onSide.length === 0 && (
        <p className="pointer-events-none absolute inset-x-0 bottom-6 text-center text-sm font-semibold text-[var(--color-muted)]">
          Tap a transfer on the right to add it to the {canvas.side}
        </p>
      )}
    </div>
  );
}

/** Rotation. A slider rather than a rotate handle, because a handle on a 12cm
 *  sticker rendered at 90px is smaller than a fingertip. Committing on release
 *  re-runs the same bounds and overlap checks a drag does — a rotation that
 *  ends overlapping a neighbour reverts instead of silently sticking. */
function RotationControl({
  placement,
  onRotate,
  onCommit,
  onRemove,
}: {
  placement: Placement;
  onRotate: (deg: number) => void;
  onCommit: (previous: Placement) => void;
  onRemove: () => void;
}) {
  const before = useRef<Placement>(placement);

  return (
    <div className="mt-3 flex items-center gap-4 rounded-xl border-2 border-[var(--color-line)] bg-white p-3">
      <div className="flex-1">
        <label htmlFor="rot" className="text-sm font-semibold">
          Rotate {placement.code}
        </label>
        <input
          id="rot"
          type="range"
          min={-45}
          max={45}
          step={1}
          value={placement.rotation}
          className="kiosk-slider mt-2 w-full"
          onPointerDown={() => {
            before.current = { ...placement };
          }}
          onChange={(e) => onRotate(Number(e.target.value))}
          onPointerUp={() => onCommit(before.current)}
          onBlur={() => onCommit(before.current)}
        />
      </div>
      <Button variant="ghost" onClick={onRemove} aria-label={`Remove ${placement.code}`}>
        Remove
      </Button>
    </div>
  );
}

export type { ProductSku };

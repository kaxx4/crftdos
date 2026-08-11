"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import type { KioskDesign } from "@/lib/domain/types";
import { money } from "@/lib/money";
import { Chip } from "@/components/ui";
import { clsx } from "@/components/clsx";

/** The transfer picker.
 *
 *  Tap to place — no drag-from-rail. Dragging across a scroll container on a
 *  touchscreen fights the scroll gesture, and the placement is auto-positioned
 *  into free space anyway, so a tap loses the customer nothing and costs them
 *  no precision.
 *
 *  Every design shown here has already passed the fulfillability filter at the
 *  backend seam: real print dimensions, a cutout, and stock available at THIS
 *  environment. Nothing unavailable reaches this component, so there is no
 *  disabled state to render. */
export function DesignRail({
  designs,
  onPick,
  busy,
  placedCodes,
}: {
  designs: KioskDesign[];
  onPick: (d: KioskDesign) => void;
  busy: boolean;
  placedCodes: string[];
}) {
  const [tag, setTag] = useState<string | null>(null);
  const [size, setSize] = useState<"S" | "M" | "L" | null>(null);

  const tags = useMemo(() => {
    const set = new Set<string>();
    for (const d of designs) for (const t of d.tags) set.add(t);
    return [...set].sort();
  }, [designs]);

  const shown = useMemo(
    () => designs.filter((d) => (!tag || d.tags.includes(tag)) && (!size || d.size_class === size)),
    [designs, tag, size]
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">Transfers</h2>
        <p className="text-sm text-[var(--color-muted)]">Tap to add</p>
      </div>

      {/* shrink-0 is load-bearing: without it the chips compress to fit the
          container instead of scrolling, and every tag label truncates to
          three letters ("Ani", "Bol", "Col") — filters nobody can read. */}
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <Chip className="shrink-0" selected={!size && !tag} onClick={() => { setSize(null); setTag(null); }}>
          All
        </Chip>
        {(["S", "M", "L"] as const).map((s) => (
          <Chip key={s} className="shrink-0" selected={size === s} onClick={() => setSize(size === s ? null : s)}>
            {s}
          </Chip>
        ))}
        {tags.map((t) => (
          <Chip
            key={t}
            selected={tag === t}
            onClick={() => setTag(tag === t ? null : t)}
            className="shrink-0 capitalize"
          >
            {t}
          </Chip>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-lg border-2 border-dashed border-[var(--color-line)] px-3 py-6 text-center text-sm text-[var(--color-muted)]">
          Nothing matches that filter. Tap <strong>All</strong> to see everything again.
        </p>
      ) : (
        <div className="stagger grid grid-cols-3 gap-2">
          {shown.map((d) => {
            const placedCount = placedCodes.filter((c) => c === d.code).length;
            return (
              <button
                key={d.id}
                disabled={busy}
                onClick={() => onPick(d)}
                className={clsx(
                  "group relative flex flex-col items-center gap-1 rounded-xl border-2 bg-white p-2",
                  "transition-[transform,border-color] duration-[var(--dur-fast)] ease-[var(--ease-out)]",
                  "active:scale-[0.95] disabled:opacity-60 disabled:active:scale-100",
                  placedCount > 0 ? "border-[var(--color-blue)]" : "border-[var(--color-line)]"
                )}
              >
                <span className="relative block aspect-square w-full">
                  {d.cutout_path && <Image src={d.cutout_path} alt="" fill sizes="120px" className="object-contain" />}
                </span>
                <span className="font-[family-name:var(--font-mono)] text-[11px] font-bold">{d.code}</span>
                <span className="text-[11px] text-[var(--color-muted)]">{money(d.unit_price)}</span>
                {placedCount > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full bg-[var(--color-blue)] font-[family-name:var(--font-mono)] text-xs font-bold text-white">
                    {placedCount}
                  </span>
                )}
                {/* Scarcity, shown honestly and only when it's true. */}
                {d.available_qty <= 2 && (
                  <span className="absolute left-1 top-1 rounded bg-[var(--color-signal)] px-1 text-[10px] font-bold text-white">
                    {d.available_qty} left
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

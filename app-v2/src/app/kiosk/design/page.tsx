"use client";

/** CANVAS — the core mechanic.
 *
 *  Everything fulfilment-critical happens in `lib/geometry.ts` and
 *  `lib/hooks/useCanvas.ts`, which this screen drives and never second-guesses:
 *
 *    - transfers render at TRUE PHYSICAL SIZE and there is no resize handle
 *      anywhere, because the transfers are pre-cut at fixed S/M/L;
 *    - a placement cannot leave the print area, so nothing lands on a seam;
 *    - two transfers cannot overlap;
 *    - stock is reserved BEFORE a transfer appears, so two kiosks cannot both
 *      compose with the last one in the box.
 *
 *  A refusal is therefore a normal, expected outcome here, not an error — so
 *  it is phrased as a next step ("try the back") rather than as a failure, and
 *  it shakes once so a customer who was looking at their finger notices it.
 *
 *  Colour budget: COBALT (side selection + continue) + YELLOW (refusals and
 *  the in-flow nudge). The transfer rail is a repeating collection: one tone,
 *  white, always. */

import { useRef, useState } from "react";
import Link from "next/link";
import { money } from "@/lib/money";
import { IMG_H, IMG_W, layoutRect } from "@/lib/geometry";
import type { KioskDesign, Placement } from "@/lib/domain/types";
import {
  Badge,
  Banner,
  Button,
  Chip,
  EmptyState,
  Heading,
  Mono,
  Nudge,
  Panel,
  Rail,
  Skeleton,
  Text,
  toneMuted,
} from "@/components/ui";
import { KioskFrame } from "../_lib/KioskFrame";
import { Mockup } from "../_lib/Mockup";
import { useKiosk } from "../_lib/session";
import { useStageGuard } from "../_lib/util";
import Image from "next/image";

export default function KioskDesignPage() {
  const { canvas, designs, designsLoading, designsError } = useKiosk();
  const { sku, side, printArea, placements, onSide, total, refusal, placing } = canvas;

  // Landing here without a garment (a reload, a shared URL) is not an error
  // state, it is a missing step — go and do that step.
  useStageGuard(Boolean(sku), "/kiosk/garment");

  const stageRef = useRef<HTMLDivElement>(null);
  const beforeDrag = useRef<Placement | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  if (!sku) return null;

  const indexOf = (p: Placement) => placements.indexOf(p);

  /** Pointer position → percentage of the print area. Percentages are what the
   *  press sheet reads, so the canvas never works in pixels. */
  const toPct = (clientX: number, clientY: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || !printArea) return null;
    const px = ((clientX - rect.left) / rect.width) * IMG_W;
    const py = ((clientY - rect.top) / rect.height) * IMG_H;
    return {
      x: ((px - printArea.x * IMG_W) / (printArea.w * IMG_W)) * 100,
      y: ((py - printArea.y * IMG_H) / (printArea.h * IMG_H)) * 100,
    };
  };

  const place = (d: KioskDesign) => void canvas.place(d);

  const nudge = (index: number, dx: number, dy: number) => {
    const p = placements[index];
    if (!p) return;
    beforeDrag.current = p;
    canvas.moveTo(index, p.pos_x + dx, p.pos_y + dy);
    canvas.commit(index, p);
  };

  return (
    <KioskFrame
      wide
      eyebrow="Step 3 of 4"
      title="Add your transfers"
      teach="Tap a design to drop it on. Drag it to move it, turn it with the dial, and use the back of the tee if the front fills up."
      back={{ href: "/kiosk/garment", label: "Change tee" }}
      foot={
        <>
          <div>
            <p className="t-label text-white/80">Running total</p>
            <p className="t-xl font-[family-name:var(--font-mono)] tnum text-white">{money(total)}</p>
          </div>
          {/* Disabled inside a Link would still navigate on tap, so the link
              only exists once there is something to carry forward. */}
          {placements.length === 0 ? (
            <Button surface="kiosk" size="xl" variant="primary" disabled>
              Add one to carry on
            </Button>
          ) : (
            <Link href="/kiosk/details" className="inline-flex">
              <Button surface="kiosk" size="xl" variant="primary">
                Looks good →
              </Button>
            </Link>
          )}
        </>
      }
    >
      {refusal && (
        // Keyed on the refusal timestamp so a second refusal shakes again
        // rather than sitting there silently as an unchanged element.
        <Banner key={refusal.at} tone="warn" title="Can't put it there" className="animate-refuse">
          {refusal.message}
        </Banner>
      )}

      <div className="grid gap-[var(--space-5)] lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        {/* ── The garment ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-[var(--space-3)]">
          <Rail>
            {(["front", "back"] as const).map((s) => (
              <Chip
                key={s}
                surface="kiosk"
                selected={side === s}
                onClick={() => {
                  canvas.setSide(s);
                  setSelected(null);
                }}
              >
                {s === "front" ? "Front" : "Back"}
                {placements.filter((p) => p.side === s).length > 0 &&
                  ` · ${placements.filter((p) => p.side === s).length}`}
              </Chip>
            ))}
          </Rail>

          <div ref={stageRef} className="relative">
            <Mockup sku={sku} placements={placements} side={side}>
              {printArea &&
                onSide.map((p) => {
                  const index = indexOf(p);
                  const r = layoutRect(printArea, p);
                  const isSelected = selected === index;
                  return (
                    <button
                      key={`${p.code}-${index}`}
                      type="button"
                      aria-label={`Move transfer ${p.code}`}
                      aria-pressed={isSelected}
                      className={[
                        "absolute touch-none rounded-[var(--radius-xs)]",
                        isSelected ? "border-[3px] border-[var(--color-ink)]" : "border-2 border-transparent",
                      ].join(" ")}
                      style={{
                        left: `${(r.x / IMG_W) * 100}%`,
                        top: `${(r.y / IMG_H) * 100}%`,
                        width: `${(r.w / IMG_W) * 100}%`,
                        height: `${(r.h / IMG_H) * 100}%`,
                        transform: `rotate(${p.rotation}deg)`,
                      }}
                      onPointerDown={(e) => {
                        setSelected(index);
                        beforeDrag.current = placements[index];
                        e.currentTarget.setPointerCapture(e.pointerId);
                      }}
                      onPointerMove={(e) => {
                        if (!beforeDrag.current || selected !== index) return;
                        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
                        const pct = toPct(e.clientX, e.clientY);
                        if (pct) canvas.moveTo(index, pct.x, pct.y);
                      }}
                      onPointerUp={(e) => {
                        e.currentTarget.releasePointerCapture(e.pointerId);
                        if (beforeDrag.current) canvas.commit(index, beforeDrag.current);
                        beforeDrag.current = null;
                      }}
                      onKeyDown={(e) => {
                        const step = 3;
                        if (e.key === "ArrowLeft") nudge(index, -step, 0);
                        else if (e.key === "ArrowRight") nudge(index, step, 0);
                        else if (e.key === "ArrowUp") nudge(index, 0, -step);
                        else if (e.key === "ArrowDown") nudge(index, 0, step);
                        else return;
                        e.preventDefault();
                      }}
                    />
                  );
                })}
            </Mockup>
          </div>

          {selected !== null && placements[selected] ? (
            <Panel key={selected} tight className="animate-rise flex flex-col gap-[var(--space-3)]">
              <div className="flex items-center justify-between gap-[var(--space-3)]">
                <Heading level={2} step="lg">
                  {placements[selected].code}
                </Heading>
                <Text step="sm" muted>
                  <Mono>
                    {placements[selected].print_w_cm} × {placements[selected].print_h_cm} cm
                  </Mono>
                </Text>
              </div>
              <label className="flex flex-col gap-[var(--space-1)]">
                <span className="t-label">Turn it</span>
                <input
                  type="range"
                  className="kiosk-slider min-h-[var(--tap-kiosk)]"
                  min={-45}
                  max={45}
                  step={5}
                  value={placements[selected].rotation}
                  onPointerDown={() => {
                    beforeDrag.current = placements[selected];
                  }}
                  onChange={(e) => canvas.rotate(selected, Number(e.target.value))}
                  onPointerUp={() => {
                    if (beforeDrag.current) canvas.commit(selected, beforeDrag.current);
                    beforeDrag.current = null;
                  }}
                />
              </label>
              <Button
                surface="kiosk"
                size="lg"
                variant="secondary"
                block
                onClick={() => {
                  void canvas.remove(selected);
                  setSelected(null);
                }}
              >
                Take this one off
              </Button>
            </Panel>
          ) : (
            <Nudge key={side} className="animate-rise">
              {onSide.length === 0
                ? `Nothing on the ${side} yet — tap a design on the right to drop it on.`
                : "Tap a transfer on the tee to move it, turn it, or take it off."}
            </Nudge>
          )}
        </div>

        {/* ── The transfers ───────────────────────────────────────────── */}
        <div className="flex flex-col gap-[var(--space-3)]">
          <div className="flex items-baseline justify-between gap-[var(--space-3)]">
            <Heading level={2} step="lg">
              Designs in the box today
            </Heading>
            <Text step="sm" muted>
              Tap to add
            </Text>
          </div>

          {designsError && (
            <Banner tone="warn" title="We couldn't load the designs">
              {designsError} A volunteer can reload this tablet — nothing you&apos;ve picked so far is lost.
            </Banner>
          )}

          {designsLoading ? (
            <div className="grid grid-cols-2 gap-[var(--space-3)] sm:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <Skeleton key={i} className="h-[190px]" />
              ))}
            </div>
          ) : designs.length === 0 ? (
            <EmptyState
              headline="No transfers in the box here"
              teach="Only designs physically at this stall show up on the kiosk, and right now that's none. A volunteer books stock in from the van and they appear here on their own."
            />
          ) : (
            <div className="stagger grid grid-cols-2 gap-[var(--space-3)] sm:grid-cols-3">
              {designs.map((d) => {
                const used = placements.filter((p) => p.sticker_design_id === d.id).length;
                const left = d.available_qty - used;
                return (
                  <Panel key={d.id} tight className="flex flex-col gap-[var(--space-2)]">
                    <div className="relative aspect-square">
                      {d.cutout_path ? (
                        <Image src={d.cutout_path} alt="" fill sizes="200px" className="object-contain" />
                      ) : null}
                    </div>
                    <div className="flex flex-col gap-[var(--space-1)]">
                      <p className="t-base font-extrabold">{d.name}</p>
                      <p className={`t-sm ${toneMuted("white")}`}>
                        <Mono>
                          {d.code} · {money(d.unit_price)}
                        </Mono>
                      </p>
                      {left <= 2 && left > 0 && (
                        <div>
                          <Badge tone="orange">Only {left} left</Badge>
                        </div>
                      )}
                    </div>
                    <Button
                      surface="kiosk"
                      size="lg"
                      variant="secondary"
                      block
                      busy={placing}
                      disabled={left <= 0}
                      onClick={() => place(d)}
                    >
                      {left <= 0 ? "All used" : "Add"}
                    </Button>
                  </Panel>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </KioskFrame>
  );
}

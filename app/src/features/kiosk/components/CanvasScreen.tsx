"use client";
import { type RefObject, useMemo, useState } from "react";
import { PlacementSprite } from "./PlacementSprite";
import { pxRect } from "../geometry";
import { BoxLabel } from "./chrome/BoxLabel";
import type { Design, Placement, Sku } from "../types";

export function CanvasScreen({
  sku,
  side,
  onSide,
  canvasRef,
  printArea,
  placements,
  selectedKey,
  onSelect,
  onPointerDownSticker,
  designs,
  filteredDesigns,
  query,
  onQuery,
  onPlace,
  overlapMsg,
  rotation,
  onRotate,
  onRotationPointerDown,
  onRotationCommit,
  onRemove,
  total,
  ticketError,
  onGetTicket,
  gettingTicket,
}: {
  sku: Sku;
  side: "front" | "back";
  onSide: (s: "front" | "back") => void;
  canvasRef: RefObject<HTMLDivElement | null>;
  printArea: Sku["print_area"]["front"];
  placements: Placement[];
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  onPointerDownSticker: (e: React.PointerEvent, p: Placement) => void;
  designs: Design[];
  filteredDesigns: Design[];
  query: string;
  onQuery: (q: string) => void;
  onPlace: (d: Design) => void;
  overlapMsg: string;
  rotation: number;
  onRotate: (v: number) => void;
  onRotationPointerDown: () => void;
  onRotationCommit: () => void;
  onRemove: () => void;
  total: number;
  ticketError: string;
  onGetTicket: () => void;
  gettingTicket: boolean;
}) {
  const IMG_W = 400;
  const IMG_H = 500;
  const sidePlacements = useMemo(() => placements.filter((p) => p.side === side), [placements, side]);

  // One pass over the catalogue instead of a linear scan inside every sprite
  // on every pointermove frame.
  const cutoutByDesignId = useMemo(
    () => new Map(designs.map((d) => [d.id, d.cutout_path])),
    [designs]
  );

  return (
    <div
      className="relative flex flex-col gap-3 w-full max-w-md md:max-w-xl lg:max-w-2xl bg-cream text-ink p-3"
      style={{ borderRadius: "var(--radius-kiosk-md)" }}
    >
      <div className="absolute -top-6 -left-3 -rotate-3 z-10">
        <BoxLabel rotate={-3}>DESIGN STUDIO</BoxLabel>
      </div>
      <div className="flex justify-between items-center pt-2">
        <div className="font-extrabold">{sku.sku_code}</div>
        <div className="flex gap-1.5">
          {(["front", "back"] as const).map((s) => (
            <button
              key={s}
              onClick={() => onSide(s)}
              aria-pressed={side === s}
              className={`border-2 border-ink px-3 py-2 min-h-[48px] text-xs font-bold transition-colors ${side === s ? "bg-ink text-cream" : "bg-white"}`}
              style={{ borderRadius: "var(--radius-kiosk-sm)", transitionDuration: "var(--dur-kiosk)", transitionTimingFunction: "var(--ease-kiosk)" }}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="text-[12px] font-mono uppercase tracking-[0.14em] text-cream/80">Nothing is charged yet — you'll pay a volunteer at the till.</div>

      {/* Canvas render area intentionally stays clean/legible — no
          brutalist texture on top of the customer's actual design; the
          chrome around it carries the skin, not the artwork. */}
      <div
        ref={canvasRef}
        className="relative border-2 border-ink bg-white select-none overflow-hidden"
        style={{ aspectRatio: `${IMG_W}/${IMG_H}`, borderRadius: "var(--radius-kiosk-sm)" }}
        onClick={() => onSelect(null)}
      >
        <img
          src={side === "front" ? sku.mockup_front : sku.mockup_back}
          alt={`${sku.sku_code} ${side} mockup — your stickers appear in position on this preview`}
          loading="lazy"
          width={IMG_W}
          height={IMG_H}
          className="absolute inset-0 w-full h-full pointer-events-none"
          draggable={false}
        />
        <div
          className="absolute border-2 border-dashed border-blue/50 pointer-events-none"
          style={{
            left: `${printArea.x * 100}%`,
            top: `${printArea.y * 100}%`,
            width: `${printArea.w * 100}%`,
            height: `${printArea.h * 100}%`,
          }}
        />
        {sidePlacements.map((p) => (
          <PlacementSprite
            key={p.key}
            placement={p}
            rect={pxRect(printArea, p)}
            src={cutoutByDesignId.get(p.sticker_design_id) || "/mockups/stickers/star.svg"}
            selected={selectedKey === p.key}
            imgW={IMG_W}
            imgH={IMG_H}
            onPointerDown={onPointerDownSticker}
          />
        ))}
      </div>

      {overlapMsg && (
        <div role="status" className="bg-signal text-cream p-2.5 font-extrabold text-[13px]" style={{ borderRadius: "var(--radius-kiosk-sm)" }}>
          {overlapMsg}
        </div>
      )}

      {selectedKey && (
        <div className="border-2 border-ink p-2.5 flex flex-col gap-1.5" style={{ borderRadius: "var(--radius-kiosk-sm)" }}>
          <div className="text-xs font-bold">Rotate {placements.find((p) => p.key === selectedKey)?.code}</div>
          <input
            type="range"
            min={0}
            max={359}
            value={rotation}
            onChange={(e) => onRotate(Number(e.target.value))}
            onPointerDown={onRotationPointerDown}
            onPointerUp={onRotationCommit}
            onBlur={onRotationCommit}
            onKeyDown={onRotationPointerDown}
            onKeyUp={(e) => {
              if (["ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"].includes(e.key)) onRotationCommit();
            }}
            className="w-full h-11 kiosk-slider"
          />
          <button
            onClick={onRemove}
            className="border-2 border-signal text-signal text-xs font-extrabold py-3 min-h-[48px] transition-colors"
            style={{ borderRadius: "var(--radius-kiosk-sm)", transitionDuration: "var(--dur-kiosk)", transitionTimingFunction: "var(--ease-kiosk)" }}
          >
            REMOVE
          </button>
        </div>
      )}

      <label className="sr-only" htmlFor="kiosk-sticker-search">
        Search stickers
      </label>
      <input
        id="kiosk-sticker-search"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder="Search stickers…"
        className="border-2 border-ink p-3 min-h-[48px] bg-white"
        style={{ borderRadius: "var(--radius-kiosk-sm)" }}
      />
      <div className="grid grid-cols-4 md:grid-cols-6 gap-2 max-h-40 overflow-y-auto">
        {filteredDesigns.map((d) => (
          <button
            key={d.id}
            onClick={() => onPlace(d)}
            className="border-2 border-ink p-1 flex flex-col items-center min-h-[48px] transition-colors"
            style={{ borderRadius: "var(--radius-kiosk-sm)", transitionDuration: "var(--dur-kiosk)", transitionTimingFunction: "var(--ease-kiosk)" }}
          >
            <img src={d.cutout_path} alt={d.code} loading="lazy" width={40} height={40} className="w-10 h-10" />
            <span className="text-[12px] font-mono">{d.code}</span>
          </button>
        ))}
        {filteredDesigns.length === 0 && (
          <div className="col-span-4 text-center text-xs text-muted py-2">
            No stickers match that search — or they're sold out for now. Try another word.
          </div>
        )}
      </div>

      <div className="flex justify-between items-center font-extrabold text-lg border-t-2 border-ink pt-2">
        <span>Total</span>
        <span>₹{total}</span>
      </div>
      {ticketError && (
        <div role="alert" className="bg-signal text-cream p-2.5 font-extrabold text-[13px]" style={{ borderRadius: "var(--radius-kiosk-sm)" }}>
          {ticketError}
        </div>
      )}
      <button
        onClick={onGetTicket}
        disabled={gettingTicket}
        className="bg-blue text-cream py-4 min-h-[52px] font-extrabold disabled:opacity-60 disabled:saturate-0 transition-colors"
        style={{ borderRadius: "var(--radius-kiosk-sm)", transitionDuration: "var(--dur-kiosk)", transitionTimingFunction: "var(--ease-kiosk)" }}
      >
        {gettingTicket ? "GETTING TICKET…" : "GET TICKET"}
      </button>
    </div>
  );
}

"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { Fraunces } from "next/font/google";
import QRCode from "qrcode";
import { encodeTicket, type CompactTicket } from "@/lib/ticketPayload";

// Kiosk-only accent face — full brutalist skin lives here per PRD §11/D19;
// every other surface (Sell/Orders/Stock/Admin) stays on the restrained POS
// skin and must not pick this up. Fraunces is OFL/free, no licensing concern
// (unlike the Eina situation documented in the root layout).
const fraunces = Fraunces({ subsets: ["latin"], weight: ["900"], style: ["italic"], variable: "--font-fraunces" });

/** Halftone dot-grid texture, CSS-only (no image assets) — used behind hero
 * blocks on the attract/ticket screens per the collision-layout brief. */
function Halftone({ className = "", color = "var(--color-blue)" }: { className?: string; color?: string }) {
  return (
    <div
      className={`absolute inset-0 pointer-events-none opacity-25 ${className}`}
      style={{
        backgroundImage: `radial-gradient(${color} 1.4px, transparent 1.6px)`,
        backgroundSize: "9px 9px",
      }}
    />
  );
}

/** Crop-mark corners, matching the receipt's print-shop frame. Pass `dark`
 * when the corners sit on a cream/white card (ticket screen) so they don't
 * disappear against a same-color border. */
function KioskCropMarks({ dark = false }: { dark?: boolean }) {
  const arm = `absolute w-3 h-3 ${dark ? "border-ink" : "border-cream"}`;
  return (
    <>
      <span className={`${arm} top-2 left-2 border-t-2 border-l-2`} />
      <span className={`${arm} top-2 right-2 border-t-2 border-r-2`} />
      <span className={`${arm} bottom-2 left-2 border-b-2 border-l-2`} />
      <span className={`${arm} bottom-2 right-2 border-b-2 border-r-2`} />
    </>
  );
}

/** Rotated box-label tag — the "torn sticker" affordance used throughout the
 * kiosk reference files for meta/status chips. */
function BoxLabel({ children, rotate = -3 }: { children: React.ReactNode; rotate?: number }) {
  return (
    <span
      className="inline-block bg-signal text-cream font-extrabold text-[10px] tracking-[0.14em] px-2.5 py-1 border-2 border-ink"
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      {children}
    </span>
  );
}

/** Star-burst glyph — cheap collision-layout ornament, positioned absolutely
 * by the caller. */
function StarBurst({ size = 28, color = "var(--color-cream)" }: { size?: number; color?: string }) {
  return (
    <span style={{ fontSize: size, color, lineHeight: 1 }} className="select-none">
      ✦
    </span>
  );
}

type Color = { id: string; name: string };
type Fit = { id: string; name: string };
type Sku = {
  id: string;
  color_id: string;
  fit_id: string;
  size: string;
  sku_code: string;
  unit_price: number;
  unit_cost: number;
  stock_qty: number;
  mockup_front: string;
  mockup_back: string;
  print_area: {
    front: { x: number; y: number; w: number; h: number; cm_w: number; cm_h: number };
    back: { x: number; y: number; w: number; h: number; cm_w: number; cm_h: number };
  };
};
type Design = {
  id: string;
  code: string;
  name: string;
  size_class: "S" | "M" | "L";
  unit_price: number;
  unit_cost: number;
  print_w_cm: number;
  print_h_cm: number;
  cutout_path: string;
  available_qty: number;
  tags: string[];
};
type Preset = {
  id: string;
  name: string;
  payload: {
    product_sku_id?: string;
    placements?: { sticker_design_id: string; code: string; unit_price: number; unit_cost: number; pos_x: number; pos_y: number; rotation: number }[];
  };
};

type Placement = {
  key: string;
  sticker_design_id: string;
  code: string;
  print_w_cm: number;
  print_h_cm: number;
  unit_price: number;
  unit_cost: number;
  side: "front" | "back";
  xPct: number;
  yPct: number;
  rotation: number;
  holdId: string;
};

/** A candidate placement being tested before it is committed. */
type PlacementTrial = {
  xPct: number;
  yPct: number;
  print_w_cm: number;
  print_h_cm: number;
  rotation?: number;
};

const IMG_W = 400;
const IMG_H = 500;

function getSessionId() {
  if (typeof window === "undefined") return "kiosk";
  let id = sessionStorage.getItem("kiosk_session_id");
  if (!id) {
    id = uuidv4();
    sessionStorage.setItem("kiosk_session_id", id);
  }
  return id;
}

export default function KioskPage() {
  const [stage, setStage] = useState<"attract" | "path" | "product" | "canvas" | "ticket">("attract");
  const [colors, setColors] = useState<Color[]>([]);
  const [fits, setFits] = useState<Fit[]>([]);
  const [skus, setSkus] = useState<Sku[]>([]);
  const [designs, setDesigns] = useState<Design[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);

  const [colorId, setColorId] = useState<string | null>(null);
  const [fitId, setFitId] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [side, setSide] = useState<"front" | "back">("front");
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [overlapMsg, setOverlapMsg] = useState("");
  const [ticket, setTicket] = useState<{ code: string; expires_at: string } | null>(null);
  const [catalogueLoading, setCatalogueLoading] = useState(true);
  const [catalogueError, setCatalogueError] = useState("");
  const [ticketError, setTicketError] = useState("");
  const [ticketQr, setTicketQr] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ key: string; startX: number; startY: number; origX: number; origY: number } | null>(
    null
  );

  useEffect(() => {
    fetch("/api/kiosk/catalogue")
      .then((r) => r.json())
      .then((j) => {
        setColors(j.colors || []);
        setFits(j.fits || []);
        setSkus(j.skus || []);
        // A design with no print dimensions cannot be rendered true-scale,
        // and true-scale is the constraint the whole canvas rests on
        // (PRD §4.3: "The customer sees what they will actually get").
        // print_w_cm / print_h_cm are nullable and unset on most seeded rows;
        // rendering one produced a zero-size or NaN-positioned sticker with
        // no error and a promise nobody could fulfil. Hiding it is the honest
        // failure — the volunteer can still add it at the till.
        setDesigns(
          ((j.designs || []) as Design[]).filter(
            (d) => Number(d.print_w_cm) > 0 && Number(d.print_h_cm) > 0
          )
        );
        setPresets(j.presets || []);
        if (j.colors?.[0]) setColorId(j.colors[0].id);
        if (j.fits?.[0]) setFitId(j.fits[0].id);
      })
      .catch(() => setCatalogueError("Could not load the catalogue. Ask a volunteer for help."))
      .finally(() => setCatalogueLoading(false));
  }, []);

  const sku = useMemo(
    () => skus.find((s) => s.color_id === colorId && s.fit_id === fitId && s.size === size) || null,
    [skus, colorId, fitId, size]
  );

  const printArea = sku?.print_area?.[side];

  const total = useMemo(
    () => (sku ? sku.unit_price : 0) + placements.reduce((s, p) => s + p.unit_price, 0),
    [sku, placements]
  );

  async function reserveSticker(design: Design): Promise<string | null> {
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
  }

  type Pt = { x: number; y: number };

  /** Corners of a placement as an *oriented* box, rotation included.
   *
   *  This used to be an axis-aligned rectangle compared with a simple
   *  interval test, which silently ignored `rotation`. Two rotated transfers
   *  could be accepted as clear of each other and be physically impossible to
   *  press — precisely the order PRD §4.3 exists to prevent. */
  function pxCorners(p: {
    xPct: number;
    yPct: number;
    print_w_cm: number;
    print_h_cm: number;
    rotation?: number;
  }): Pt[] {
    if (!printArea) return [];
    const rectPxW = printArea.w * IMG_W;
    const rectPxH = printArea.h * IMG_H;
    const wPx = p.print_w_cm * (rectPxW / printArea.cm_w);
    const hPx = p.print_h_cm * (rectPxH / printArea.cm_h);
    const cx = printArea.x * IMG_W + (p.xPct / 100) * rectPxW;
    const cy = printArea.y * IMG_H + (p.yPct / 100) * rectPxH;
    const rad = ((p.rotation ?? 0) * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const hw = wPx / 2;
    const hh = hPx / 2;
    return [
      [-hw, -hh],
      [hw, -hh],
      [hw, hh],
      [-hw, hh],
    ].map(([dx, dy]) => ({ x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos }));
  }

  /** Separating Axis Theorem for two convex quads. Two oriented rectangles
   *  are disjoint iff some edge normal of either separates them. */
  function polysOverlap(a: Pt[], b: Pt[]) {
    if (!a.length || !b.length) return false;
    for (const poly of [a, b]) {
      for (let i = 0; i < poly.length; i++) {
        const p1 = poly[i];
        const p2 = poly[(i + 1) % poly.length];
        // Outward normal of this edge.
        const axis = { x: -(p2.y - p1.y), y: p2.x - p1.x };
        const len = Math.hypot(axis.x, axis.y) || 1;
        axis.x /= len;
        axis.y /= len;

        const proj = (pts: Pt[]) => {
          let min = Infinity;
          let max = -Infinity;
          for (const pt of pts) {
            const d = pt.x * axis.x + pt.y * axis.y;
            if (d < min) min = d;
            if (d > max) max = d;
          }
          return [min, max] as const;
        };

        const [aMin, aMax] = proj(a);
        const [bMin, bMax] = proj(b);
        // A shared edge is not a collision; require real interpenetration.
        if (aMax <= bMin + 1e-6 || bMax <= aMin + 1e-6) return false;
      }
    }
    return true;
  }

  function overlaps(a: Placement | PlacementTrial, b: Placement) {
    return polysOverlap(pxCorners(a), pxCorners(b));
  }

  /** Unrotated layout rect. Rendering positions the element axis-aligned and
   *  lets CSS `rotate()` spin it about its own centre, so the DOM box stays
   *  unrotated — collision uses pxCorners, layout uses this. */
  function pxRect(p: { xPct: number; yPct: number; print_w_cm: number; print_h_cm: number }) {
    if (!printArea) return { x: 0, y: 0, w: 0, h: 0 };
    const rectPxW = printArea.w * IMG_W;
    const rectPxH = printArea.h * IMG_H;
    const w = p.print_w_cm * (rectPxW / printArea.cm_w);
    const h = p.print_h_cm * (rectPxH / printArea.cm_h);
    const cx = printArea.x * IMG_W + (p.xPct / 100) * rectPxW;
    const cy = printArea.y * IMG_H + (p.yPct / 100) * rectPxH;
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  }

  async function placeDesign(design: Design) {
    if (!printArea) return;
    setOverlapMsg("");
    const holdId = await reserveSticker(design);
    if (!holdId) return;

    const trial: PlacementTrial = {
      xPct: 50,
      yPct: 50,
      print_w_cm: design.print_w_cm,
      print_h_cm: design.print_h_cm,
      rotation: 0,
    };
    const sameSide = placements.filter((p) => p.side === side);
    const collidesAtCenter = sameSide.some((p) => overlaps(trial, p));

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
      if (!sameSide.some((p) => overlaps(candidate, p))) {
        commit(x, y);
        return;
      }
    }
    setOverlapMsg("No free space on this side without overlapping — remove one first.");
    releaseHold(holdId);
  }

  function releaseHold(holdId: string) {
    fetch("/api/kiosk/reserve", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ holdId }),
    }).catch(() => {
      // Non-fatal: the hold's TTL will expire it server-side even if this
      // release fails, but surface it so it's not a silent stock-lock.
      setOverlapMsg("Couldn't release that reservation — it'll free up on its own shortly.");
    });
  }

  function removePlacement(key: string) {
    const p = placements.find((pp) => pp.key === key);
    setPlacements((prev) => prev.filter((pp) => pp.key !== key));
    if (p?.holdId) releaseHold(p.holdId);
    if (selectedKey === key) setSelectedKey(null);
  }

  function clampCenterPct(pct: number, sizeCm: number, fullCm: number) {
    const halfPct = (sizeCm / fullCm) * 50;
    return Math.max(halfPct, Math.min(100 - halfPct, pct));
  }

  function onPointerDownSticker(e: React.PointerEvent, p: Placement) {
    e.stopPropagation();
    setSelectedKey(p.key);
    dragState.current = { key: p.key, startX: e.clientX, startY: e.clientY, origX: p.xPct, origY: p.yPct };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

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
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    const ds = dragState.current;
    dragState.current = null;
    if (!ds) return;
    setPlacements((prev) => {
      const moved = prev.find((p) => p.key === ds.key);
      if (!moved) return prev;
      const collides = prev.some((p) => p.key !== ds.key && p.side === moved.side && overlaps(moved, p));
      if (collides) {
        setOverlapMsg("That overlaps another sticker — placement reverted.");
        return prev.map((p) => (p.key === ds.key ? { ...p, xPct: ds.origX, yPct: ds.origY } : p));
      }
      return prev;
    });
  }

  function setRotation(key: string, rotation: number) {
    setPlacements((prev) => prev.map((p) => (p.key === key ? { ...p, rotation } : p)));
  }

  async function getTicket() {
    if (!sku) return;
    setTicketError("");
    let res: Response;
    try {
      res = await fetch("/api/kiosk/ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: "kiosk-" + getSessionId().slice(0, 6),
          quotedTotal: total,
          garments: [
            {
              product_sku_id: sku.id,
              sku_code: sku.sku_code,
              unit_price: sku.unit_price,
              unit_cost: sku.unit_cost,
              stickers: placements.map((p) => ({
                sticker_design_id: p.sticker_design_id,
                code: p.code,
                side: p.side,
                pos_x: p.xPct,
                pos_y: p.yPct,
                rotation: p.rotation,
                unit_price: p.unit_price,
                unit_cost: p.unit_cost,
                hold_id: p.holdId,
              })),
            },
          ],
        }),
      });
    } catch {
      setTicketError("Network error — check the connection and try again.");
      return;
    }
    const j = await res.json().catch(() => ({}));
    if (res.ok && j.ticket) {
      setTicket({ code: j.ticket.code, expires_at: j.ticket.expires_at });

      // PRD §10: the QR carries the WHOLE cart, not a lookup code, so the till
      // can redeem it with no network at all. The 4-character code beneath it
      // is the online-only fallback.
      const compact: CompactTicket = {
        v: 1,
        t: j.ticket.code,
        q: total,
        g: [
          {
            k: sku.id,
            c: sku.sku_code,
            p: sku.unit_price,
            o: sku.unit_cost,
            s: placements.map((p) => ({
              d: p.sticker_design_id,
              c: p.code,
              s: p.side === "back" ? (1 as const) : (0 as const),
              x: Math.round(p.xPct * 10) / 10,
              y: Math.round(p.yPct * 10) / 10,
              r: Math.round(p.rotation),
              p: p.unit_price,
              o: p.unit_cost,
              h: p.holdId,
            })),
          },
        ],
      };
      try {
        const encoded = await encodeTicket(compact);
        setTicketQr(
          await QRCode.toDataURL(encoded, {
            errorCorrectionLevel: "M",
            margin: 1,
            width: 512,
            color: { dark: "#0F0F10", light: "#F7F5F1" },
          })
        );
      } catch {
        // No QR just means the volunteer types the 4-character code.
        setTicketQr(null);
      }
      setStage("ticket");
    } else {
      setTicketError(j.error || "Could not get a ticket — a reservation may have expired. Try again.");
    }
  }

  function resetAll() {
    setTicketQr(null);
    setStage("attract");
    setColorId(colors[0]?.id || null);
    setFitId(fits[0]?.id || null);
    setSize(null);
    setSide("front");
    setPlacements([]);
    setTicket(null);
    setOverlapMsg("");
    setTicketError("");
    setSelectedKey(null);
    setQuery("");
    sessionStorage.removeItem("kiosk_session_id");
  }

  async function applyPreset(p: Preset) {
    const matchedSku = skus.find((s) => s.id === p.payload.product_sku_id);
    if (matchedSku) {
      setColorId(matchedSku.color_id);
      setFitId(matchedSku.fit_id);
      setSize(matchedSku.size);
    }
    setStage("canvas");

    // Each preset placement must actually reserve stock the same way a
    // manually-placed sticker does — otherwise two kiosks applying the same
    // limited-stock preset can both check out the same last unit.
    const built: Placement[] = [];
    for (const pl of p.payload.placements || []) {
      const design = designs.find((d) => d.id === pl.sticker_design_id);
      const holdId = design ? await reserveSticker(design) : null;
      if (!holdId) continue; // sold out / reservation failed — skip this sticker, don't silently fake it
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
  }

  const filteredDesigns = designs.filter((d) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return d.code.toLowerCase().includes(q) || d.name?.toLowerCase().includes(q) || d.tags?.some((t) => t.includes(q));
  });

  return (
    <div className={`min-h-dvh bg-ink text-cream flex flex-col items-center justify-center p-4 ${fraunces.variable}`}>
      {stage === "attract" && (
        <div className="relative w-full h-dvh flex flex-col items-center justify-center overflow-hidden">
          <Halftone />
          <KioskCropMarks />
          <div className="absolute top-8 left-8">
            <StarBurst size={40} color="var(--color-signal)" />
          </div>
          <div className="absolute bottom-10 right-10">
            <StarBurst size={28} color="var(--color-blue)" />
          </div>
          <div className="absolute top-10 right-10 rotate-3">
            <BoxLabel>STALL OS · KIOSK</BoxLabel>
          </div>

          <div className="relative flex flex-col items-center gap-8 text-center px-6">
            <div
              className="font-extrabold tracking-wide text-blue leading-none"
              style={{ fontSize: "clamp(56px,14vw,110px)", fontStyle: "italic", transform: "skewX(-4deg)" }}
            >
              CRFT<span className="text-signal not-italic">★</span>D
            </div>
            <div className="text-3xl md:text-4xl font-extrabold">
              Build{" "}
              <span
                className="not-italic"
                style={{ fontFamily: "var(--font-fraunces), serif", fontStyle: "italic", fontWeight: 900 }}
              >
                yours
              </span>
            </div>
            <div className="text-sm text-muted max-w-xs">
              Compose a tee, get a ticket, hand it to a volunteer at the till. Nothing is charged until they scan it.
            </div>
            <button
              onClick={() => setStage("path")}
              className="relative bg-blue text-cream border-2 border-cream px-10 py-5 font-extrabold text-xl tracking-wide"
              style={{ transform: "rotate(-1deg)" }}
            >
              TAP TO START
              <span className="absolute -top-3 -right-3">
                <StarBurst size={22} color="var(--color-cream)" />
              </span>
            </button>
          </div>
        </div>
      )}

      {stage === "path" && catalogueLoading && (
        <div className="flex flex-col items-center gap-3 text-cream">
          <div className="w-10 h-10 border-4 border-cream/30 border-t-cream rounded-full animate-spin" />
          <div className="text-sm text-muted">Loading catalogue…</div>
        </div>
      )}

      {stage === "path" && !catalogueLoading && catalogueError && (
        <div className="flex flex-col items-center gap-3 text-cream text-center max-w-xs">
          <div className="text-signal font-extrabold">{catalogueError}</div>
        </div>
      )}

      {stage === "path" && !catalogueLoading && !catalogueError && (
        <div className="relative flex flex-col gap-4 w-full max-w-md lg:max-w-lg">
          <div className="absolute -top-6 -left-4 rotate-[-6deg]">
            <BoxLabel rotate={-6}>PICK A PATH</BoxLabel>
          </div>
          <div
            className="font-extrabold text-2xl text-center mb-2"
            style={{ fontFamily: "var(--font-fraunces), serif", fontStyle: "italic" }}
          >
            How do you want to build?
          </div>
          <div className="relative border-2 border-cream p-4 bg-ink">
            <Halftone className="opacity-10" />
            <div className="font-extrabold mb-2 tracking-wide">PRESETS</div>
            <div className="grid grid-cols-2 gap-2 relative">
              {presets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p)}
                  className="bg-cream text-ink p-2 text-xs font-bold text-left border-2 border-ink"
                >
                  {p.name}
                </button>
              ))}
              {presets.length === 0 && <div className="text-xs text-muted col-span-2">No presets yet.</div>}
            </div>
          </div>
          <button
            onClick={() => setStage("product")}
            className="border-2 border-cream p-4 font-extrabold text-lg bg-blue relative"
            style={{ transform: "rotate(0.5deg)" }}
          >
            CANVAS — BUILD FROM SCRATCH
          </button>
        </div>
      )}

      {stage === "product" && (
        <div className="flex flex-col gap-4 w-full max-w-md lg:max-w-lg bg-cream text-ink p-4">
          <div className="font-extrabold text-lg">Choose your tee</div>
          <div className="flex gap-2 flex-wrap">
            {colors.map((c) => (
              <button
                key={c.id}
                onClick={() => setColorId(c.id)}
                className={`border-2 border-ink px-3 py-2 font-bold text-sm ${colorId === c.id ? "bg-ink text-cream" : "bg-white"}`}
              >
                {c.name}
              </button>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            {fits.map((f) => (
              <button
                key={f.id}
                onClick={() => setFitId(f.id)}
                className={`border-2 border-ink px-3 py-2 font-bold text-sm ${fitId === f.id ? "bg-ink text-cream" : "bg-white"}`}
              >
                {f.name}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {["XS", "S", "M", "L", "XL", "XXL"].map((sz) => {
              const s = skus.find((x) => x.color_id === colorId && x.fit_id === fitId && x.size === sz);
              const disabled = !s || s.stock_qty <= 0;
              return (
                <button
                  key={sz}
                  disabled={disabled}
                  onClick={() => setSize(sz)}
                  className={`border-2 border-ink py-3 font-extrabold ${
                    disabled ? "bg-hairline text-muted" : size === sz ? "bg-blue text-cream" : "bg-white"
                  }`}
                >
                  {sz}
                  {disabled && <span className="block text-[9px] font-normal">ask a volunteer</span>}
                </button>
              );
            })}
          </div>
          <button
            disabled={!sku}
            onClick={() => setStage("canvas")}
            className="bg-ink text-cream py-3 font-extrabold disabled:opacity-40"
          >
            CONTINUE — ₹{sku?.unit_price ?? "—"}
          </button>
        </div>
      )}

      {stage === "canvas" && sku && printArea && (
        <div className="relative flex flex-col gap-3 w-full max-w-md lg:max-w-xl bg-cream text-ink p-3">
          <div className="absolute -top-5 -left-3 -rotate-3">
            <BoxLabel rotate={-3}>DESIGN STUDIO</BoxLabel>
          </div>
          <div className="flex justify-between items-center pt-2">
            <div className="font-extrabold">{sku.sku_code}</div>
            <div className="flex gap-1.5">
              {(["front", "back"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSide(s)}
                  className={`border-2 border-ink px-2 py-1 text-xs font-bold ${side === s ? "bg-ink text-cream" : "bg-white"}`}
                >
                  {s.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Canvas render area intentionally stays clean/legible — no
              brutalist texture on top of the customer's actual design,
              per the brief. Chrome around it carries the skin instead. */}
          <div
            ref={canvasRef}
            className="relative border-2 border-ink bg-white select-none"
            style={{ aspectRatio: `${IMG_W}/${IMG_H}` }}
            onClick={() => setSelectedKey(null)}
          >
            <img
              src={side === "front" ? sku.mockup_front : sku.mockup_back}
              alt="mockup"
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
            {placements
              .filter((p) => p.side === side)
              .map((p) => {
                const box = pxRect(p);
                return (
                  <img
                    key={p.key}
                    src={designs.find((d) => d.id === p.sticker_design_id)?.cutout_path || "/mockups/stickers/star.svg"}
                    alt={p.code}
                    loading="lazy"
                    onPointerDown={(e) => onPointerDownSticker(e, p)}
                    className={`absolute cursor-move touch-none ${selectedKey === p.key ? "ring-2 ring-signal" : ""}`}
                    style={{
                      left: `${(box.x / IMG_W) * 100}%`,
                      top: `${(box.y / IMG_H) * 100}%`,
                      width: `${(box.w / IMG_W) * 100}%`,
                      height: `${(box.h / IMG_H) * 100}%`,
                      transform: `rotate(${p.rotation}deg)`,
                    }}
                  />
                );
              })}
          </div>

          {overlapMsg && <div className="bg-signal text-cream p-2 font-extrabold text-[11px]">{overlapMsg}</div>}

          {selectedKey && (
            <div className="border-2 border-ink p-2 flex flex-col gap-1.5">
              <div className="text-xs font-bold">Rotate {placements.find((p) => p.key === selectedKey)?.code}</div>
              <input
                type="range"
                min={0}
                max={359}
                value={placements.find((p) => p.key === selectedKey)?.rotation || 0}
                onChange={(e) => setRotation(selectedKey, Number(e.target.value))}
                className="w-full h-11 kiosk-slider"
              />
              <button
                onClick={() => removePlacement(selectedKey)}
                className="border border-signal text-signal text-xs font-extrabold py-2 min-h-[48px]"
              >
                REMOVE
              </button>
            </div>
          )}

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search stickers…"
            className="border-2 border-ink p-2"
          />
          <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">
            {filteredDesigns.map((d) => (
              <button key={d.id} onClick={() => placeDesign(d)} className="border-2 border-ink p-1 flex flex-col items-center">
                <img src={d.cutout_path} alt={d.code} loading="lazy" width={40} height={40} className="w-10 h-10" />
                <span className="text-[9px] font-mono">{d.code}</span>
              </button>
            ))}
            {filteredDesigns.length === 0 && (
              <div className="col-span-4 text-center text-xs text-muted py-2">No match / sold out.</div>
            )}
          </div>

          <div className="flex justify-between items-center font-extrabold text-lg border-t-2 border-ink pt-2">
            <span>Total</span>
            <span>₹{total}</span>
          </div>
          {ticketError && <div className="bg-signal text-cream p-2 font-extrabold text-[11px]">{ticketError}</div>}
          <button onClick={getTicket} className="bg-blue text-cream py-3 font-extrabold min-h-[48px]">
            GET TICKET
          </button>
        </div>
      )}

      {stage === "ticket" && ticket && (
        <div className="relative flex flex-col items-center gap-5 bg-cream text-ink p-8 border-2 border-ink max-w-sm">
          <KioskCropMarks dark />
          <div className="absolute -top-4 -right-4 rotate-6">
            <StarBurst size={32} color="var(--color-signal)" />
          </div>
          <div className="w-full bg-blue text-cream -mt-8 -mx-8 px-8 py-3 mb-2">
            <div
              className="font-extrabold text-2xl text-center"
              style={{ fontFamily: "var(--font-fraunces), serif", fontStyle: "italic" }}
            >
              Get pressed
            </div>
          </div>
          <div className="font-extrabold text-sm tracking-wide">SHOW THIS TO A VOLUNTEER</div>
          {ticketQr && (
            <img
              src={ticketQr}
              alt={`Design ticket ${ticket.code.split("").join(" ")} — scan at the till`}
              width={220}
              height={220}
              className="w-[220px] h-[220px] max-w-full border-2 border-ink bg-cream"
            />
          )}
          <div
            className="font-extrabold tracking-[0.2em] sm:tracking-[0.3em] text-center"
            style={{ fontSize: "clamp(32px,12vw,60px)" }}
          >
            {ticket.code}
          </div>
          <div className="text-xs font-mono text-muted">
            Expires {new Date(ticket.expires_at).toLocaleTimeString("en-IN")} · Total ₹{total}
          </div>
          <button onClick={resetAll} className="bg-ink text-cream px-6 py-3 font-extrabold text-sm w-full">
            DONE — NEXT CUSTOMER
          </button>
        </div>
      )}
    </div>
  );
}

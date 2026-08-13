"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Fraunces } from "next/font/google";
import { Halftone } from "./components/chrome/Halftone";
import { StarBurst } from "./components/chrome/StarBurst";
import { AttractScreen } from "./components/AttractScreen";
import { PathScreen } from "./components/PathScreen";
import { ProductScreen } from "./components/ProductScreen";
import { CanvasScreen } from "./components/CanvasScreen";
import { TicketScreen } from "./components/TicketScreen";
import { StageProgress } from "./components/StageProgress";
import { useKioskCatalogue } from "./hooks/useKioskCatalogue";
import { usePlacements } from "./hooks/usePlacements";
import { useCanvasDrag } from "./hooks/useCanvasDrag";
import { useDesignTicket } from "./hooks/useDesignTicket";
import { clearSessionId } from "./session";
import type { Stage } from "./types";

// Kiosk-only accent face — full brutalist skin lives here per PRD §11/D19;
// every other surface (Sell/Orders/Stock/Admin) stays on the restrained POS
// skin and must not pick this up. Fraunces is OFL/free, no licensing concern.
const fraunces = Fraunces({ subsets: ["latin"], weight: ["900"], style: ["italic"], variable: "--font-fraunces" });

// One full-bleed blue field per non-attract screen (attract owns its own,
// see AttractScreen.tsx) — position/rotation varied per stage so it reads
// as a distinct printed field per screen rather than one repeated texture.
const BLUE_FIELD_BY_STAGE: Record<Exclude<Stage, "attract">, React.CSSProperties> = {
  path: { top: "-18%", right: "-22%", width: "62%", height: "50%", transform: "rotate(-7deg)" },
  product: { bottom: "-22%", left: "-16%", width: "58%", height: "48%", transform: "rotate(5deg)" },
  canvas: { top: "-14%", left: "-20%", width: "42%", height: "130%", transform: "rotate(-4deg)" },
  ticket: { bottom: "-20%", right: "-18%", width: "55%", height: "52%", transform: "rotate(6deg)" },
};

export function KioskPage() {
  const [stage, setStage] = useState<Stage>("attract");
  const [path, setPath] = useState<"scratch" | "preset" | null>(null);

  const catalogue = useKioskCatalogue();
  const { colors, fits, skus, designs, presets, colorId, setColorId, fitId, setFitId, loading, error } = catalogue;

  const [size, setSize] = useState<string | null>(null);
  const [side, setSide] = useState<"front" | "back">("front");
  const [query, setQuery] = useState("");
  const [gettingTicket, setGettingTicket] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);

  const sku = useMemo(
    () => skus.find((s) => s.color_id === colorId && s.fit_id === fitId && s.size === size) || null,
    [skus, colorId, fitId, size]
  );
  const printArea = sku?.print_area?.[side];

  const {
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
  } = usePlacements(printArea, side);

  const { onPointerDownSticker } = useCanvasDrag(canvasRef, printArea, setPlacements, setOverlapMsg);
  const { ticket, ticketQr, ticketError, getTicket, resetTicket } = useDesignTicket();

  const total = useMemo(() => (sku ? sku.unit_price : 0) + placements.reduce((s, p) => s + p.unit_price, 0), [sku, placements]);

  const filteredDesigns = designs.filter((d) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return d.code.toLowerCase().includes(q) || d.name?.toLowerCase().includes(q) || d.tags?.some((t) => t.includes(q));
  });

  function resetAll() {
    releaseAll();
    resetTicket();
    setStage("attract");
    setPath(null);
    setColorId(colors[0]?.id || null);
    setFitId(fits[0]?.id || null);
    setSize(null);
    setSide("front");
    setSelectedKey(null);
    setQuery("");
    clearSessionId();
  }

  async function handlePreset(p: (typeof presets)[number]) {
    const matchedSku = skus.find((s) => s.id === p.payload.product_sku_id);
    if (matchedSku) {
      setColorId(matchedSku.color_id);
      setFitId(matchedSku.fit_id);
      setSize(matchedSku.size);
    }
    setPath("preset");
    setStage("canvas");
    await applyPreset(p, designs);
  }

  async function handleGetTicket() {
    if (!sku) return;
    setGettingTicket(true);
    const ok = await getTicket(sku, placements, total);
    setGettingTicket(false);
    if (ok) setStage("ticket");
  }

  function goBack() {
    if (stage === "product") setStage("path");
    else if (stage === "canvas") {
      if (path === "preset") {
        releaseAll();
        setPath(null);
        setStage("path");
      } else {
        setStage("product");
      }
    } else if (stage === "ticket") {
      setStage("canvas");
    }
  }

  return (
    <div className={`relative h-[100svh] bg-ink text-cream flex flex-col items-center justify-center p-4 overflow-hidden ${fraunces.variable}`}>
      {stage !== "attract" && (
        <>
          {/* Full-bleed blue field, one per screen, position/angle varied by
              stage so it reads as hand-placed rather than a repeated
              template — per the visual-direction rework's colour rule.
              Sits behind the halftone/cards; only visible in the margin
              around each screen's centred panel. */}
          <div aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute bg-blue" style={BLUE_FIELD_BY_STAGE[stage]} />
          </div>
          <Halftone dot={7} className="opacity-[0.07]" />
          <div className="absolute left-[6%] top-[9%] hidden md:block">
            <StarBurst size={16} color="var(--color-blue)" />
          </div>
          <div className="absolute right-[7%] bottom-[10%] hidden md:block">
            <StarBurst size={20} color="var(--color-signal)" />
          </div>
        </>
      )}

      {stage !== "attract" && (
        <div className="relative w-full max-w-md md:max-w-xl lg:max-w-2xl mb-2">
          <StageProgress stage={stage} path={path} onBack={goBack} />
        </div>
      )}

      {stage === "attract" && <AttractScreen onStart={() => setStage("path")} />}

      {stage === "path" && loading && (
        <div className="flex flex-col items-center gap-3 text-cream">
          <div className="w-10 h-10 border-4 border-cream/30 border-t-cream rounded-full animate-spin" />
          <div className="text-sm text-cream/70">Loading catalogue…</div>
        </div>
      )}

      {stage === "path" && !loading && error && (
        <div className="flex flex-col items-center gap-3 text-cream text-center max-w-xs">
          <div className="text-signal font-extrabold">{error}</div>
        </div>
      )}

      {stage === "path" && !loading && !error && (
        <PathScreen
          presets={presets}
          onPreset={handlePreset}
          onScratch={() => {
            setPath("scratch");
            setStage("product");
          }}
        />
      )}

      {stage === "product" && (
        <ProductScreen
          colors={colors}
          fits={fits}
          skus={skus}
          colorId={colorId}
          fitId={fitId}
          size={size}
          sku={sku}
          onColor={setColorId}
          onFit={setFitId}
          onSize={setSize}
          onContinue={() => setStage("canvas")}
        />
      )}

      {stage === "canvas" && sku && printArea && (
        <CanvasScreen
          sku={sku}
          side={side}
          onSide={setSide}
          canvasRef={canvasRef}
          printArea={printArea}
          placements={placements}
          selectedKey={selectedKey}
          onSelect={setSelectedKey}
          onPointerDownSticker={(e, p) => onPointerDownSticker(e, p, setSelectedKey)}
          designs={designs}
          filteredDesigns={filteredDesigns}
          query={query}
          onQuery={setQuery}
          onPlace={placeDesign}
          overlapMsg={overlapMsg}
          rotation={placements.find((p) => p.key === selectedKey)?.rotation || 0}
          onRotate={(v) => selectedKey && setRotation(selectedKey, v)}
          onRotationPointerDown={() => selectedKey && onRotationPointerDown(selectedKey)}
          onRotationCommit={() => selectedKey && onRotationCommit(selectedKey)}
          onRemove={() => selectedKey && removePlacement(selectedKey)}
          total={total}
          ticketError={ticketError}
          onGetTicket={handleGetTicket}
          gettingTicket={gettingTicket}
        />
      )}

      {stage === "ticket" && ticket && (
        <TicketScreen code={ticket.code} expiresAt={ticket.expires_at} qr={ticketQr} total={total} onDone={resetAll} />
      )}
    </div>
  );
}

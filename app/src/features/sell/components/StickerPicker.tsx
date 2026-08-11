import { useState } from "react";
import { BigButton, Chip, Field, Mono, Panel, PanelLabel } from "@/components/ui";
import type { StickerDesign } from "@/lib/types";
import { StickerResultRow } from "./StickerResultRow";

export function StickerPicker({
  targetGarmentLabel,
  stickerQuery,
  setStickerQuery,
  sizeFilter,
  setSizeFilter,
  recentTop8,
  designs,
  stickerResults,
  addSticker,
  addCustomSticker,
}: {
  targetGarmentLabel: string | null;
  stickerQuery: string;
  setStickerQuery: (v: string) => void;
  sizeFilter: "S" | "M" | "L" | null;
  setSizeFilter: (v: "S" | "M" | "L" | null) => void;
  recentTop8: string[];
  designs: StickerDesign[];
  stickerResults: StickerDesign[];
  addSticker: (d: StickerDesign) => void;
  addCustomSticker: (description: string, size: "S" | "M" | "L", price: number) => void;
}) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customDesc, setCustomDesc] = useState("");
  const [customSize, setCustomSize] = useState<"S" | "M" | "L">("M");
  const [customPrice, setCustomPrice] = useState("0");

  function submitCustom() {
    addCustomSticker(customDesc, customSize, Number(customPrice) || 0);
    setCustomOpen(false);
    setCustomDesc("");
    setCustomPrice("0");
  }

  return (
    <Panel>
      <div className="flex justify-between items-baseline gap-2">
        <PanelLabel>Step 4 · Add a sticker</PanelLabel>
        <Mono>{targetGarmentLabel ? `Adding to: ${targetGarmentLabel}` : "Adding as: sticker only (no shirt)"}</Mono>
      </div>
      <Field
        label="Search stickers by code, name or tag"
        value={stickerQuery}
        onChange={(e) => setStickerQuery(e.target.value)}
        placeholder="14, m14, ramen, anime…"
      />
      <Mono>&quot;14&quot; finds every size (S/M/L-014). &quot;m14&quot; finds only the Medium.</Mono>
      <div className="flex flex-wrap gap-1.5">
        {(["S", "M", "L"] as const).map((sz) => (
          <Chip key={sz} active={sizeFilter === sz} onClick={() => setSizeFilter(sizeFilter === sz ? null : sz)}>
            {sz}
          </Chip>
        ))}
      </div>
      {recentTop8.length > 0 && (
        <div className="flex flex-col gap-1">
          <PanelLabel as="h3">Recent</PanelLabel>
          <div className="flex gap-1.5 overflow-x-auto">
            {recentTop8.map((code) => {
              const d = designs.find((x) => x.code === code);
              return (
                d && (
                  <button
                    key={code}
                    onClick={() => addSticker(d)}
                    className="flex-shrink-0 bg-cream border-2 border-ink font-mono text-xs font-bold px-2.5 py-2 min-h-[48px] touch-manipulation transition-transform duration-[var(--dur-press)] ease-out active:scale-[0.97]"
                  >
                    {code}
                  </button>
                )
              );
            })}
          </div>
        </div>
      )}
      <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
        {stickerResults.map((d) => (
          <StickerResultRow key={d.id} design={d} onAdd={addSticker} />
        ))}
        {designs.length === 0 && (
          <div className="text-center text-xs text-muted py-3">
            No stickers loaded yet. Ask an admin to import the sticker catalogue in Admin → Catalogue.
          </div>
        )}
        {designs.length > 0 && stickerResults.length === 0 && (
          <div className="text-center text-xs text-muted py-3">
            No match. Try a code like <strong>14</strong> or <strong>m14</strong>.
          </div>
        )}
      </div>
      {!customOpen && (
        <button
          onClick={() => setCustomOpen(true)}
          className="bg-cream border-2 border-dashed border-ink font-extrabold text-[12px] tracking-wide min-h-[48px] touch-manipulation transition-transform duration-[var(--dur-press)] ease-out active:scale-[0.97]"
        >
          + CUSTOM STICKER
        </button>
      )}
      {customOpen && (
        <div className="flex flex-col gap-2 border-2 border-ink p-2.5 bg-cream">
          <Field
            label="Custom sticker description"
            placeholder="Description"
            value={customDesc}
            onChange={(e) => setCustomDesc(e.target.value)}
          />
          <div className="flex gap-1.5">
            {(["S", "M", "L"] as const).map((sz) => (
              <Chip key={sz} active={customSize === sz} onClick={() => setCustomSize(sz)}>
                {sz}
              </Chip>
            ))}
            <Field
              label="Custom sticker price in rupees"
              type="number"
              value={customPrice}
              onChange={(e) => setCustomPrice(e.target.value)}
              placeholder="₹"
              className="flex-1"
            />
          </div>
          <div className="flex gap-1.5">
            <BigButton variant="blue" onClick={submitCustom} className="flex-1">
              ADD
            </BigButton>
            <BigButton variant="ghost" onClick={() => setCustomOpen(false)} className="flex-1">
              CANCEL
            </BigButton>
          </div>
        </div>
      )}
    </Panel>
  );
}

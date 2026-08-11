import { Chip, Panel, PanelLabel } from "@/components/ui";
import type { Color, Fit, ProductSku } from "@/lib/types";

function cap(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export function GarmentPicker({
  colors,
  fits,
  colorId,
  setColorId,
  fitId,
  setFitId,
  sizesForSelection,
  addGarment,
}: {
  colors: Color[];
  fits: Fit[];
  colorId: string | null;
  setColorId: (id: string) => void;
  fitId: string | null;
  setFitId: (id: string) => void;
  sizesForSelection: ProductSku[];
  addGarment: (sku: ProductSku) => void;
}) {
  return (
    <Panel>
      <PanelLabel>Step 3 · Add a garment</PanelLabel>
      <div className="flex flex-wrap gap-1.5">
        {colors.map((c) => (
          <Chip key={c.id} active={colorId === c.id} onClick={() => setColorId(c.id)}>
            {cap(c.name)}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {fits.map((f) => (
          <Chip key={f.id} active={fitId === f.id} onClick={() => setFitId(f.id)}>
            {cap(f.name)}
          </Chip>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {sizesForSelection.map((sku) => (
          <button
            key={sku.id}
            onClick={() => addGarment(sku)}
            className={`border-2 border-ink py-2 font-extrabold text-sm min-h-[52px] rounded-[var(--radius-pos-sm)] touch-manipulation transition-transform duration-[var(--dur-press)] ease-out active:scale-[0.97] ${
              sku.stock_qty <= 0 ? "bg-hairline text-muted" : "bg-white text-ink"
            }`}
          >
            <span>{sku.size}</span>
            <span className="block font-mono text-[12px] font-normal">{sku.stock_qty} left</span>
          </button>
        ))}
        {sizesForSelection.length === 0 && (
          <div className="col-span-4 text-center text-xs text-muted py-2">
            No sizes stocked in this colour and fit — try another combination.
          </div>
        )}
      </div>
    </Panel>
  );
}

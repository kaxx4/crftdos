import { memo } from "react";
import { Mono } from "@/components/ui";
import type { StickerDesign } from "@/lib/types";

function StickerResultRowImpl({ design, onAdd }: { design: StickerDesign; onAdd: (d: StickerDesign) => void }) {
  return (
    <button
      onClick={() => onAdd(design)}
      className="flex items-center gap-2.5 border-2 border-ink p-2 text-left touch-manipulation transition-transform duration-[var(--dur-press)] ease-out active:scale-[0.97]"
    >
      <span className="w-10 h-10 flex items-center justify-center bg-cream border border-ink font-mono text-[12px] font-bold flex-shrink-0">
        {design.code}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-extrabold text-sm">
          {design.code} · {design.name}
        </span>
        <Mono>
          Go to {design.bin_location || "no bin — ask a volunteer"} · {design.stock_qty} left
        </Mono>
      </span>
      <span className="font-extrabold text-sm">₹{design.unit_price}</span>
    </button>
  );
}

// Compared on id + stock_qty, not the whole design object: `designs` is
// refetched wholesale on boot, so reference-equality memo would never hit
// after a refetch even though most rows are content-unchanged. stock_qty is
// the one field that can change under a row without its identity changing.
export const StickerResultRow = memo(StickerResultRowImpl, (prev, next) => {
  return prev.design.id === next.design.id && prev.design.stock_qty === next.design.stock_qty && prev.onAdd === next.onAdd;
});

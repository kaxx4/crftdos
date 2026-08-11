import { Mono } from "@/components/ui";
import type { CartGarment, CartStandaloneSticker } from "../types";

export function CartList({
  garments,
  standalone,
  total,
  targetGarmentKey,
  setTargetGarmentKey,
  removeGarment,
  removeStickerFromGarment,
  removeStandalone,
}: {
  garments: CartGarment[];
  standalone: CartStandaloneSticker[];
  total: number;
  targetGarmentKey: string | null;
  setTargetGarmentKey: (key: string | null) => void;
  removeGarment: (key: string) => void;
  removeStickerFromGarment: (gKey: string, sKey: string) => void;
  removeStandalone: (sKey: string) => void;
}) {
  const cartEmpty = garments.length === 0 && standalone.length === 0;
  return (
    <div className="border-2 border-ink bg-white">
      <div className="bg-ink text-cream px-2.5 py-1.5 font-extrabold text-[12px] tracking-[0.14em] flex justify-between">
        <span>Step 2 · Cart</span>
        <span>
          {garments.length + standalone.length} item(s) · ₹{total}
        </span>
      </div>
      {cartEmpty && (
        <div className="p-4 text-center text-sm text-muted">
          Nothing in cart. Add a garment below or load a ticket.
        </div>
      )}
      {garments.map((g) => (
        <div
          key={g.key}
          role="button"
          tabIndex={0}
          onClick={() => setTargetGarmentKey(g.key)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setTargetGarmentKey(g.key);
            }
          }}
          // Which garment stickers attach to. A full 2px outline is the
          // surrounding design language (every Panel, Field and Chip is
          // bordered this way) and reads at arm's length; outline does not
          // affect layout, so nothing shifts as selection moves.
          className={`p-2.5 border-b border-hairline cursor-pointer ${
            targetGarmentKey === g.key ? "bg-blue/15 outline-2 -outline-offset-2 outline-blue" : ""
          }`}
        >
          <div className="flex justify-between gap-2">
            <div>
              <div className="font-extrabold text-[17px]">{g.label}</div>
              <Mono>
                {g.stockNote}
                {targetGarmentKey === g.key ? " · adding stickers here" : ""}
              </Mono>
            </div>
            <div className="text-right flex flex-col items-end gap-1.5">
              <div className="font-extrabold text-[17px]">
                ₹{g.unit_price + g.stickers.reduce((s, st) => s + st.unit_price, 0)}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeGarment(g.key);
                }}
                className="tap-target min-w-[48px] inline-flex items-center justify-center border border-signal text-signal text-[12px] font-extrabold px-1.5 py-1 tracking-wide"
              >
                REMOVE
              </button>
            </div>
          </div>
          {g.stickers.map((st) => (
            <div
              key={st.key}
              className="flex justify-between text-[13px] border-t border-dashed border-hairline pt-1.5 mt-1.5"
            >
              <Mono>{st.custom ? `${st.custom.description} (${st.custom.size_class})` : st.code}</Mono>
              <span className="flex gap-2 items-center">
                ₹{st.unit_price}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeStickerFromGarment(g.key, st.key);
                  }}
                  className="tap-target min-w-[48px] inline-flex items-center justify-center text-signal font-bold"
                >
                  ×
                </button>
              </span>
            </div>
          ))}
        </div>
      ))}
      {standalone.map((s) => (
        <div key={s.key} className="p-2.5 border-b border-hairline flex justify-between">
          <div>
            <div className="font-extrabold text-[15px]">
              Sticker only · {s.custom ? s.custom.description : s.code}
            </div>
          </div>
          <div className="flex gap-2 items-center">
            ₹{s.unit_price}
            <button
              onClick={() => removeStandalone(s.key)}
              className="tap-target min-w-[48px] inline-flex items-center justify-center text-signal font-bold text-lg"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

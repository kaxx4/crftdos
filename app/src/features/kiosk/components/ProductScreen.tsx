import { BoxLabel } from "./chrome/BoxLabel";
import type { Color, Fit, Sku } from "../types";

export function ProductScreen({
  colors,
  fits,
  skus,
  colorId,
  fitId,
  size,
  sku,
  onColor,
  onFit,
  onSize,
  onContinue,
}: {
  colors: Color[];
  fits: Fit[];
  skus: Sku[];
  colorId: string | null;
  fitId: string | null;
  size: string | null;
  sku: Sku | null;
  onColor: (id: string) => void;
  onFit: (id: string) => void;
  onSize: (sz: string) => void;
  onContinue: () => void;
}) {
  return (
    <div
      className="relative flex flex-col gap-4 w-full max-w-md md:max-w-xl bg-cream text-ink p-4"
      style={{ borderRadius: "var(--radius-kiosk-md)", transform: "rotate(-0.6deg)" }}
    >
      <div className="absolute -top-6 -right-3 rotate-[4deg] z-10">
        <BoxLabel rotate={4}>PICK YOUR TEE</BoxLabel>
      </div>
      <div className="font-extrabold text-lg">Choose your tee</div>
      <div className="text-xs text-muted">Next: pick your stickers.</div>
      <div className="flex gap-2 flex-wrap" role="group" aria-label="Colour">
        {colors.map((c) => (
          <button
            key={c.id}
            onClick={() => onColor(c.id)}
            aria-pressed={colorId === c.id}
            className={`border-2 border-ink px-3 py-2 min-h-[48px] font-bold text-sm transition-colors ${colorId === c.id ? "bg-ink text-cream" : "bg-white"}`}
            style={{ borderRadius: "var(--radius-kiosk-sm)", transitionDuration: "var(--dur-kiosk)", transitionTimingFunction: "var(--ease-kiosk)" }}
          >
            {c.name}
          </button>
        ))}
      </div>
      <div className="flex gap-2 flex-wrap" role="group" aria-label="Fit">
        {fits.map((f) => (
          <button
            key={f.id}
            onClick={() => onFit(f.id)}
            aria-pressed={fitId === f.id}
            className={`border-2 border-ink px-3 py-2 min-h-[48px] font-bold text-sm transition-colors ${fitId === f.id ? "bg-ink text-cream" : "bg-white"}`}
            style={{ borderRadius: "var(--radius-kiosk-sm)", transitionDuration: "var(--dur-kiosk)", transitionTimingFunction: "var(--ease-kiosk)" }}
          >
            {f.name}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Size">
        {["XS", "S", "M", "L", "XL", "XXL"].map((sz) => {
          const s = skus.find((x) => x.color_id === colorId && x.fit_id === fitId && x.size === sz);
          const disabled = !s || s.stock_qty <= 0;
          return (
            <button
              key={sz}
              disabled={disabled}
              onClick={() => onSize(sz)}
              aria-pressed={size === sz}
              className={`border-2 border-ink py-3 min-h-[52px] font-extrabold transition-colors ${
                disabled ? "bg-hairline text-muted" : size === sz ? "bg-blue text-cream" : "bg-white"
              }`}
              style={{ borderRadius: "var(--radius-kiosk-sm)", transitionDuration: "var(--dur-kiosk)", transitionTimingFunction: "var(--ease-kiosk)" }}
            >
              {sz}
              {disabled && <span className="block text-[12px] font-normal">ask a volunteer</span>}
            </button>
          );
        })}
      </div>
      <button
        disabled={!sku}
        onClick={onContinue}
        className="bg-ink text-cream py-4 min-h-[52px] font-extrabold disabled:opacity-60 disabled:saturate-0 transition-colors"
        style={{ borderRadius: "var(--radius-kiosk-sm)", transitionDuration: "var(--dur-kiosk)", transitionTimingFunction: "var(--ease-kiosk)" }}
      >
        CONTINUE — ₹{sku?.unit_price ?? "—"}
      </button>
    </div>
  );
}

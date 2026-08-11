import { Halftone } from "./chrome/Halftone";
import { BoxLabel } from "./chrome/BoxLabel";
import type { Preset } from "../types";

export function PathScreen({
  presets,
  onPreset,
  onScratch,
}: {
  presets: Preset[];
  onPreset: (p: Preset) => void;
  onScratch: () => void;
}) {
  return (
    <div className="relative flex flex-col gap-4 w-full max-w-md md:max-w-xl">
      <div className="absolute -top-7 -left-4 rotate-[-6deg] z-10">
        <BoxLabel rotate={-6}>PICK A PATH</BoxLabel>
      </div>
      <div
        className="font-extrabold text-2xl text-center mb-2"
        style={{ fontFamily: "var(--font-fraunces), serif", fontStyle: "italic" }}
      >
        How do you want to build?
      </div>
      <div
        className="relative border-2 border-cream p-4 bg-ink overflow-hidden"
        style={{ borderRadius: "var(--radius-kiosk-md)" }}
      >
        <Halftone className="opacity-10" />
        <div className="font-extrabold mb-2 tracking-wide relative">READY-MADE DESIGNS</div>
        <div className="grid grid-cols-2 gap-2 relative">
          {presets.map((p) => (
            <button
              key={p.id}
              onClick={() => onPreset(p)}
              className="bg-cream text-ink p-3 text-sm font-bold text-left border-2 border-ink min-h-[52px] transition-colors"
              style={{ borderRadius: "var(--radius-kiosk-sm)", transitionDuration: "var(--dur-kiosk)", transitionTimingFunction: "var(--ease-kiosk)" }}
            >
              {p.name}
            </button>
          ))}
          {presets.length === 0 && (
            <div className="text-xs text-cream/60 col-span-2">
              No ready-made designs yet — build your own below, it takes under a minute.
            </div>
          )}
        </div>
      </div>
      <button
        onClick={onScratch}
        className="border-2 border-cream p-4 font-extrabold text-lg bg-blue relative min-h-[52px] transition-colors"
        style={{ transform: "rotate(0.5deg)", borderRadius: "var(--radius-kiosk-sm)", transitionDuration: "var(--dur-kiosk)", transitionTimingFunction: "var(--ease-kiosk)" }}
      >
        BUILD FROM SCRATCH
      </button>
    </div>
  );
}

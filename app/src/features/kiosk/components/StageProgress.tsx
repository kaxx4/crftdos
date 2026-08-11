import { BoxLabel } from "./chrome/BoxLabel";
import type { Stage } from "../types";

/** Persistent stage indicator + back affordance, present on every
 *  non-attract stage (UX Architecture §2.1). Reflects the *actual* path
 *  length the customer chose — the preset fast-path skips straight to the
 *  canvas, so its indicator is two steps, not the scratch path's three. */
export function StageProgress({
  stage,
  path,
  onBack,
}: {
  stage: Stage;
  path: "scratch" | "preset" | null;
  onBack: () => void;
}) {
  const steps =
    path === "preset"
      ? ([
          { id: "canvas", label: "STICKERS" },
          { id: "ticket", label: "REVIEW" },
        ] as const)
      : ([
          { id: "product", label: "PRODUCT" },
          { id: "canvas", label: "STICKERS" },
          { id: "ticket", label: "REVIEW" },
        ] as const);

  const activeIndex = steps.findIndex((s) => s.id === stage);

  return (
    <div className="w-full flex items-center gap-3 mb-1">
      <button
        onClick={onBack}
        aria-label="Go back a step"
        className="min-h-[48px] min-w-[48px] flex items-center justify-center border-2 border-ink bg-cream text-ink font-extrabold text-lg shrink-0 transition-colors"
        style={{ transitionDuration: "var(--dur-kiosk)", transitionTimingFunction: "var(--ease-kiosk)" }}
      >
        ←
      </button>
      <div className="flex-1 flex items-center gap-1.5 overflow-x-auto">
        {steps.map((s, i) => {
          const done = i < activeIndex;
          const active = i === activeIndex;
          return (
            <div key={s.id} className="flex items-center gap-1.5 shrink-0">
              {i > 0 && <span className="text-ink/30 font-mono text-xs">·</span>}
              <span
                className={`font-mono text-[12px] font-bold tracking-[0.12em] px-2 py-1 border-2 border-ink transition-colors ${
                  active ? "bg-ink text-cream" : done ? "bg-blue text-cream" : "bg-cream text-ink/50"
                }`}
                style={{ transitionDuration: "var(--dur-kiosk)", transitionTimingFunction: "var(--ease-kiosk)" }}
              >
                {String(i + 1).padStart(2, "0")} {s.label}
              </span>
            </div>
          );
        })}
      </div>
      <div className="hidden sm:block shrink-0">
        <BoxLabel rotate={-2}>NOT CHARGED YET</BoxLabel>
      </div>
    </div>
  );
}

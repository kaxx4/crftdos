import Link from "next/link";
import { Halftone } from "./chrome/Halftone";
import { KioskCropMarks } from "./chrome/KioskCropMarks";
import { StarBurst } from "./chrome/StarBurst";
import { BoxLabel } from "./chrome/BoxLabel";

/** The screen someone points a phone camera at. Collision layout, not a
 *  centred stack: wordmark pinned off-axis upper-left and allowed to bleed
 *  past the safe margin, headline running underneath at a steeper angle,
 *  CTA rotated and overlapping the halftone field — per the visual
 *  direction rework's "broken grid, not stacked cards" spec. */
export function AttractScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="relative w-full h-full flex flex-col justify-center overflow-hidden">
      {/* Full-bleed blue field — per the visual-direction rework's colour
          rule, blue should dominate at least one field per screen, not
          just accent the wordmark/CTA/star-burst. Anchored right so it
          never sits behind the left-pinned wordmark/headline text. */}
      <div
        aria-hidden="true"
        className="absolute -right-20 -top-16 -bottom-16 w-[52%] bg-blue"
        style={{ transform: "rotate(-3deg)" }}
      />
      <Halftone dot={9} className="opacity-[0.12]" />
      <KioskCropMarks arm={16} />

      <div className="absolute top-6 left-6 rotate-[-6deg]">
        <StarBurst size={44} color="var(--color-signal)" />
      </div>
      <div className="absolute bottom-12 right-8 rotate-[10deg]">
        <StarBurst size={22} color="var(--color-blue)" />
      </div>
      <div className="absolute top-[26%] right-[9%] hidden sm:block rotate-[4deg]">
        <StarBurst size={16} color="var(--color-cream)" />
      </div>
      <div className="absolute top-10 right-6 sm:right-10 rotate-3">
        <BoxLabel>CRFTD KIOSK</BoxLabel>
      </div>
      <div className="absolute bottom-[16%] left-[10%] hidden sm:block rotate-[-8deg]">
        <BoxLabel rotate={-8}>SELF SERVE</BoxLabel>
      </div>

      {/* Marquee ticker — the one piece of free, always-on motion; a single
          tracked mono line, not a keyframe-heavy showpiece. */}
      <div
        aria-hidden="true"
        className="absolute bottom-0 left-0 right-0 border-t-2 border-cream/30 overflow-hidden py-2 bg-ink/60"
      >
        <div className="whitespace-nowrap font-mono text-[12px] tracking-[0.2em] text-cream/75" style={{ animation: "kiosk-ticker 46s linear infinite" }}>
          {"BUILD YOUR OWN ✳ TRUE-SCALE STICKERS ✳ NOTHING CHARGED UNTIL THE TILL ✳ RAISED FOR AQUATERRA, EVERY SALE ✳ "
            .repeat(4)}
        </div>
      </div>

      <div className="relative flex flex-col items-start gap-2 px-6 sm:px-10 -translate-y-4">
        <div
          aria-hidden="true"
          className="font-extrabold tracking-wide text-blue leading-[0.85] -ml-1 sm:-ml-2"
          style={{ fontSize: "clamp(64px,16vw,132px)", fontStyle: "italic", transform: "skewX(-5deg)" }}
        >
          CRFT<span className="text-signal not-italic">★</span>D
        </div>
        <h1
          className="text-3xl md:text-5xl font-extrabold leading-none -mt-1 sm:-mt-3 ml-1 sm:ml-4"
          style={{ transform: "rotate(-1.5deg)" }}
        >
          <span className="sr-only">crftd — </span>Build{" "}
          <span
            className="not-italic"
            style={{ fontFamily: "var(--font-fraunces), serif", fontStyle: "italic", fontWeight: 900 }}
          >
            yours
          </span>
        </h1>
        <div className="text-sm text-cream/75 max-w-xs ml-1 sm:ml-4 mt-1">
          Compose a tee, get a ticket, hand it to a volunteer at the till. Nothing is charged until they scan it.
        </div>
        <button
          onClick={onStart}
          className="relative bg-blue text-cream border-2 border-cream px-10 py-5 font-extrabold text-xl tracking-wide mt-6 ml-1 sm:ml-4 min-h-[70px] transition-colors overflow-visible"
          style={{ transform: "rotate(-2deg)", borderRadius: "var(--radius-kiosk-sm)", transitionDuration: "var(--dur-kiosk)", transitionTimingFunction: "var(--ease-kiosk)" }}
        >
          TAP TO START
          <span className="absolute -top-4 -right-4">
            <StarBurst size={26} color="var(--color-cream)" rotate={12} />
          </span>
        </button>
      </div>

      {/* Unobtrusive on purpose — customer-facing showcase; the passcode
          entry is a staff affordance, discoverable but low weight. */}
      <Link
        href="/pin"
        className="absolute bottom-4 left-4 text-cream/80 text-[13px] font-mono tracking-[0.14em] uppercase px-2 py-1 min-h-[48px] min-w-[48px] flex items-center z-10"
      >
        Staff passcode
      </Link>
    </div>
  );
}

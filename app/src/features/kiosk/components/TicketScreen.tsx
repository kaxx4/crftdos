import { KioskCropMarks } from "./chrome/KioskCropMarks";
import { StarBurst } from "./chrome/StarBurst";
import { BoxLabel } from "./chrome/BoxLabel";

export function TicketScreen({
  code,
  expiresAt,
  qr,
  total,
  onDone,
}: {
  code: string;
  expiresAt: string;
  qr: string | null;
  total: number;
  onDone: () => void;
}) {
  return (
    <div
      className="relative flex flex-col items-center gap-5 bg-cream text-ink p-8 border-2 border-ink max-w-sm overflow-hidden"
      style={{ borderRadius: "var(--radius-kiosk-lg)", transform: "rotate(0.5deg)" }}
    >
      <KioskCropMarks dark arm={14} />
      <div className="absolute -top-4 -right-4 rotate-6">
        <StarBurst size={32} color="var(--color-signal)" />
      </div>
      <div className="absolute top-4 left-4 rotate-[-4deg]">
        <BoxLabel rotate={-4}>YOUR TICKET</BoxLabel>
      </div>
      <div className="w-full bg-blue text-cream -mt-8 -mx-8 px-8 py-4 mb-2">
        {/* Hero-moment wordmark, halftone-dot-filled per the visual-direction
            rework's receipt spec (§4) — tighter 5px dots than the attract
            screen's field per the ornament section's "vary dot size per
            screen" rule. Still exactly one Fraunces word on this screen. */}
        <div
          className="font-extrabold text-2xl text-center"
          style={{
            fontFamily: "var(--font-fraunces), serif",
            fontStyle: "italic",
            backgroundImage: "radial-gradient(var(--color-cream) 1.3px, transparent 1.6px)",
            backgroundSize: "5px 5px",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          Get pressed
        </div>
      </div>
      <div className="font-extrabold text-sm tracking-wide text-center">SHOW THIS CODE OR QR TO A CRFTD VOLUNTEER TO PAY</div>
      <div className="text-xs text-muted text-center -mt-3">Nothing has been charged yet.</div>
      {qr && (
        <img
          src={qr}
          alt={`Design ticket ${code.split("").join(" ")} — scan at the till`}
          width={220}
          height={220}
          className="w-[220px] h-[220px] max-w-full border-2 border-ink bg-cream"
        />
      )}
      <div className="font-extrabold tracking-[0.2em] sm:tracking-[0.3em] text-center" style={{ fontSize: "clamp(32px,12vw,60px)" }}>
        {code}
      </div>
      <div className="text-xs font-mono text-muted text-center">
        Show this within 30 minutes · expires {new Date(expiresAt).toLocaleTimeString("en-IN")} · Total ₹{total}
      </div>
      <button
        onClick={onDone}
        className="bg-ink text-cream px-6 py-4 min-h-[52px] font-extrabold text-sm w-full transition-colors"
        style={{ borderRadius: "var(--radius-kiosk-sm)", transitionDuration: "var(--dur-kiosk)", transitionTimingFunction: "var(--ease-kiosk)" }}
      >
        DONE — NEXT CUSTOMER
      </button>
    </div>
  );
}

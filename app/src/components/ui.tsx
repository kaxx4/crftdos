import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

/* Shared POS primitives.
 *
 * Motion and geometry follow [[Rework - Design System and Motion]]. Two rules
 * from that spec govern almost everything here:
 *
 *   1. POS press feedback is ALWAYS scale, never a colour tween. Under
 *      sunlight glare a subtle colour shift may not be visible at all, but a
 *      physical-feeling squash always reads. (The kiosk does the opposite and
 *      uses colour crossfades — the two surfaces are deliberately different.)
 *   2. No `:hover` anywhere. There are no mouse users on this surface, and
 *      hover styles on touch devices produce sticky stuck-looking states.
 *
 * Durations come from the token scale in globals.css. Everything on the POS
 * is <=180ms because these motions fire hundreds of times a shift.
 */

// One focus treatment for every interactive primitive. Nothing here sets
// `outline: none` — this replaces the UA default with a ring that survives on
// ink-on-ink surfaces (the TabBar) where the browser default has nothing to
// contrast against. The 120ms settle stops it snapping when a barcode scanner
// drives focus as keyboard input.
const FOCUS =
  "transition-[box-shadow] duration-[var(--dur-fast)] ease-out " +
  "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-cream";

// Scale-press. `touch-action: manipulation` kills the 300ms tap delay and
// double-tap-to-zoom, both of which make a till feel broken.
const PRESS =
  "touch-manipulation transition-transform duration-[var(--dur-press)] ease-out active:scale-[0.97]";

export function Panel({ children, accent = false }: { children: ReactNode; accent?: boolean }) {
  // Deliberately square. Radius is reserved for controls; keeping the
  // container hard-edged preserves the "printed card stock" reading that the
  // whole brutalist surface depends on.
  return (
    <div
      className={`bg-white p-2.5 flex flex-col gap-2.5 border-2 ${
        accent ? "border-blue" : "border-ink"
      }`}
    >
      {children}
    </div>
  );
}

/** Panel titles are the document's second-level structure, so they render as
 *  real headings by default. Before this, `PosFrame`'s h1 was the only heading
 *  element in the entire app and no screen reader could navigate a page. */
export function PanelLabel({
  children,
  color,
  as: Tag = "h2",
}: {
  children: ReactNode;
  color?: string;
  as?: "h2" | "h3" | "div";
}) {
  return (
    <Tag
      className="font-extrabold text-[13px] tracking-[0.14em] uppercase"
      style={color ? { color } : undefined}
    >
      {children}
    </Tag>
  );
}

/** Always labelled. `label` is required by the type so an unlabelled input
 *  cannot be built by accident.
 *
 *  It renders as `aria-label` rather than a visible `<label>` element and adds
 *  no wrapper, so the DOM and every existing layout are unchanged — several
 *  call sites place Fields inside flex rows and pass width via className. Some
 *  screens already wrap Fields in their own visible `<label>`; there the
 *  accessible name comes from this prop and the visible text stays as-is. */
export function Field({
  label,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  // Fields are focused, not pressed — no scale motion. One radius step below
  // BigButton, per the concentric-radius principle.
  return (
    <input
      {...props}
      aria-label={label}
      className={`border-2 border-ink p-3 text-base min-h-[48px] bg-white w-full rounded-[var(--radius-pos-sm)] ${FOCUS} ${className}`}
    />
  );
}

export function BigButton({
  variant = "blue",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "blue" | "ink" | "ghost" | "cream" }) {
  const styles: Record<string, string> = {
    blue: "bg-blue text-cream border-ink",
    ink: "bg-ink text-cream border-ink",
    cream: "bg-cream text-ink border-ink",
    ghost: "bg-transparent text-ink border-ink",
  };
  return (
    <button
      {...props}
      // Disabled stays a static readout — no motion on the disabled→enabled
      // flip. It was opacity-40, which put the disabled Charge button below
      // readable contrast in sunlight; 60% plus desaturation keeps the state
      // obvious without making it look available.
      className={`border-2 font-extrabold text-sm tracking-[0.08em] min-h-[52px] cursor-pointer rounded-[var(--radius-pos-md)] disabled:opacity-60 disabled:cursor-not-allowed disabled:saturate-0 disabled:active:scale-100 ${styles[variant]} ${PRESS} ${FOCUS} ${className}`}
    />
  );
}

export function Chip({
  active,
  danger,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; danger?: boolean }) {
  return (
    <button
      {...props}
      aria-pressed={active}
      className={`border-2 px-3 py-2 min-h-[48px] min-w-[48px] font-bold text-[13px] tracking-wide cursor-pointer rounded-[var(--radius-pos-sm)] transition-[color,background-color,transform] duration-[var(--dur-fast)] ease-out active:scale-[0.97] touch-manipulation ${
        danger
          ? "border-signal text-signal bg-white"
          : active
          ? "bg-ink text-cream border-ink"
          : "bg-white text-ink border-ink"
      } ${FOCUS} ${(props.className as string) ?? ""}`}
    />
  );
}

/** Secondary text: bin locations, stock notes, codes. This is the text that
 *  sends a volunteer to the right box in a crate of 200 transfers, so it gets
 *  a real size and a real token rather than 11px on a Tailwind default grey. */
export function Mono({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono text-[13px] text-muted ${className}`}>{children}</span>;
}

export function CropCorner() {
  return (
    <>
      <span className="absolute top-1 left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-current opacity-70" />
      <span className="absolute top-1 right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-current opacity-70" />
    </>
  );
}

/** Banners carry sync and error state — "3 sales not yet synced" is the one
 *  message in this app that must not be missed. Announced, not just drawn.
 *
 *  `transient` opts into the enter animation. Only pass it for banners that
 *  actually mount and unmount: a persistent status strip that is always
 *  present must NOT animate, or it replays its entrance on every re-render
 *  and turns a permanent condition into visual noise. A failed charge is the
 *  one moment on this surface where attention must be forcibly redirected,
 *  which is exactly what `transient` is for. */
export function Banner({
  children,
  tone = "signal",
  transient = false,
}: {
  children: ReactNode;
  tone?: "signal" | "blue";
  transient?: boolean;
}) {
  return (
    <div
      role={tone === "signal" ? "alert" : "status"}
      aria-live={tone === "signal" ? "assertive" : "polite"}
      className={`px-3.5 py-2 font-extrabold text-[12px] tracking-[0.1em] uppercase flex justify-between gap-2 ${
        tone === "signal" ? "bg-signal text-cream" : "bg-blue text-cream"
      } ${transient ? "motion-safe:animate-[pos-enter_var(--dur-pos)_var(--ease-out-strong)_both]" : ""}`}
    >
      {children}
    </div>
  );
}

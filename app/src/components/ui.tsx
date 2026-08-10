import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

// One focus treatment for every interactive primitive. Nothing here sets
// `outline: none` — this replaces the UA default with a ring that survives on
// ink-on-ink surfaces (the TabBar) where the browser default has nothing to
// contrast against.
const FOCUS =
  "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-cream";

export function Panel({ children, accent = false }: { children: ReactNode; accent?: boolean }) {
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
      className="font-extrabold text-[11px] tracking-[0.14em] uppercase"
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
 *  screens (shift-open, returns) already wrap Fields in their own visible
 *  `<label>`; there the accessible name comes from this prop and the visible
 *  text stays as-is. */
export function Field({
  label,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <input
      {...props}
      aria-label={label}
      className={`border-2 border-ink p-3 text-base min-h-[48px] bg-white w-full ${FOCUS} ${className}`}
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
      // Disabled was opacity-40, which put the disabled Charge button below
      // readable contrast in direct sunlight — and "can I charge yet?" is the
      // most important question on the screen. 60% plus a hatch keeps the
      // state obvious without making it look available.
      className={`border-2 font-extrabold text-sm tracking-[0.08em] min-h-[52px] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed disabled:saturate-0 ${styles[variant]} ${FOCUS} ${className}`}
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
      className={`border-2 px-3 py-2 min-h-[48px] font-bold text-xs tracking-wide cursor-pointer transition-colors ${
        danger
          ? "border-signal text-signal bg-white"
          : active
          ? "bg-ink text-cream border-ink"
          : "bg-white text-ink border-ink"
      } ${FOCUS} ${(props.className as string) ?? ""}`}
    />
  );
}

/** Secondary text: bin locations, stock notes, codes. Was 11px on Tailwind's
 *  neutral-600 — this is the text that sends a volunteer to the right box in a
 *  crate of 200 transfers, so it gets a real size and a real token. */
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
 *  message in this app that must not be missed. Announced, not just drawn. */
export function Banner({ children, tone = "signal" }: { children: ReactNode; tone?: "signal" | "blue" }) {
  return (
    <div
      role={tone === "signal" ? "alert" : "status"}
      aria-live={tone === "signal" ? "assertive" : "polite"}
      className={`px-3.5 py-2 font-extrabold text-[12px] tracking-[0.1em] uppercase flex justify-between gap-2 ${
        tone === "signal" ? "bg-signal text-cream" : "bg-blue text-cream"
      }`}
    >
      {children}
    </div>
  );
}

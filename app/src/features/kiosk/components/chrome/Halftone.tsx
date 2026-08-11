/** Halftone dot-grid texture, CSS-only (no image assets). Per the visual
 *  direction rework this is now a full-bleed background field by default —
 *  callers on non-hero screens dial opacity down via `className`, but the
 *  component itself no longer hard-codes a "small decorative patch" size. */
export function Halftone({ className = "", color = "var(--color-blue)", dot = 9 }: { className?: string; color?: string; dot?: number }) {
  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 pointer-events-none opacity-25 ${className}`}
      style={{
        backgroundImage: `radial-gradient(${color} 1.4px, transparent 1.6px)`,
        backgroundSize: `${dot}px ${dot}px`,
      }}
    />
  );
}

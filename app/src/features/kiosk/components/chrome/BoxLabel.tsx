/** Rotated box-label tag — the strongest motif in the kiosk vocabulary per
 *  the visual-direction rework. Always signal-fill/cream-text, always a
 *  hard 2px ink border, always rotated -2 to -5deg. Never softened into a
 *  chip. */
export function BoxLabel({ children, rotate = -3 }: { children: React.ReactNode; rotate?: number }) {
  return (
    <span
      className="inline-block bg-signal text-cream font-extrabold text-[12px] tracking-[0.14em] px-2.5 py-1 border-2 border-ink"
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      {children}
    </span>
  );
}

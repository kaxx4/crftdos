/** Star-burst glyph — cheap collision-layout ornament, positioned
 *  absolutely by the caller. Sizes/rotations deliberately vary per
 *  placement across a screen so it reads as hand-stamped, not templated. */
export function StarBurst({ size = 28, color = "var(--color-cream)", rotate = 0 }: { size?: number; color?: string; rotate?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ fontSize: size, color, lineHeight: 1, transform: rotate ? `rotate(${rotate}deg)` : undefined, display: "inline-block" }}
      className="select-none"
    >
      ✦
    </span>
  );
}

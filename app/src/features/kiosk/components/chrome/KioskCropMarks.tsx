/** Crop-mark corners, matching the receipt's print-shop frame. Per the
 *  visual-direction rework these sit at the *viewport* corners on hero
 *  screens (bigger arms, thicker stroke), not just card corners. Pass
 *  `dark` when the corners sit on a cream/white field so they don't
 *  disappear against a same-colour border. */
export function KioskCropMarks({ dark = false, arm = 12 }: { dark?: boolean; arm?: number }) {
  const cls = `absolute ${dark ? "border-ink" : "border-cream"}`;
  const size = { width: arm, height: arm };
  return (
    <>
      <span aria-hidden="true" className={`${cls} top-2 left-2 border-t-[2.5px] border-l-[2.5px]`} style={size} />
      <span aria-hidden="true" className={`${cls} top-2 right-2 border-t-[2.5px] border-r-[2.5px]`} style={size} />
      <span aria-hidden="true" className={`${cls} bottom-2 left-2 border-b-[2.5px] border-l-[2.5px]`} style={size} />
      <span aria-hidden="true" className={`${cls} bottom-2 right-2 border-b-[2.5px] border-r-[2.5px]`} style={size} />
    </>
  );
}

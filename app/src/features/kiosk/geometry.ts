/** Pure canvas geometry — no React state, no closures over component scope.
 *
 *  Deliberately plain functions rather than a hook: `usePlacements`,
 *  `useCanvasDrag`, and the rotation-commit logic all need the exact same
 *  math against whichever `printArea` is current (front vs. back have
 *  different rectangles). Passing `printArea` as a parameter on every call
 *  means none of those call sites can silently evaluate against a stale
 *  side after a front/back switch — see the Component Architecture doc's
 *  risk register for why this must not be a stateful/memoized hook. */
import { IMG_H, IMG_W, type Placement, type PlacementTrial, type PrintArea } from "./types";

export type Pt = { x: number; y: number };

/** Corners of a placement as an *oriented* box, rotation included. SAT-based
 *  overlap detection depends on this being the true rotated rectangle, not
 *  an axis-aligned bounding box — two rotated stickers can be axis-aligned-
 *  clear of each other while still physically overlapping. */
export function pxCorners(
  printArea: PrintArea | undefined,
  p: { xPct: number; yPct: number; print_w_cm: number; print_h_cm: number; rotation?: number }
): Pt[] {
  if (!printArea) return [];
  const rectPxW = printArea.w * IMG_W;
  const rectPxH = printArea.h * IMG_H;
  const wPx = p.print_w_cm * (rectPxW / printArea.cm_w);
  const hPx = p.print_h_cm * (rectPxH / printArea.cm_h);
  const cx = printArea.x * IMG_W + (p.xPct / 100) * rectPxW;
  const cy = printArea.y * IMG_H + (p.yPct / 100) * rectPxH;
  const rad = ((p.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const hw = wPx / 2;
  const hh = hPx / 2;
  return [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ].map(([dx, dy]) => ({ x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos }));
}

/** Separating Axis Theorem for two convex quads. Two oriented rectangles are
 *  disjoint iff some edge normal of either separates them. */
export function polysOverlap(a: Pt[], b: Pt[]): boolean {
  if (!a.length || !b.length) return false;
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p1 = poly[i];
      const p2 = poly[(i + 1) % poly.length];
      const axis = { x: -(p2.y - p1.y), y: p2.x - p1.x };
      const len = Math.hypot(axis.x, axis.y) || 1;
      axis.x /= len;
      axis.y /= len;

      const proj = (pts: Pt[]) => {
        let min = Infinity;
        let max = -Infinity;
        for (const pt of pts) {
          const d = pt.x * axis.x + pt.y * axis.y;
          if (d < min) min = d;
          if (d > max) max = d;
        }
        return [min, max] as const;
      };

      const [aMin, aMax] = proj(a);
      const [bMin, bMax] = proj(b);
      // A shared edge is not a collision; require real interpenetration.
      if (aMax <= bMin + 1e-6 || bMax <= aMin + 1e-6) return false;
    }
  }
  return true;
}

export function overlaps(printArea: PrintArea | undefined, a: Placement | PlacementTrial, b: Placement): boolean {
  return polysOverlap(pxCorners(printArea, a), pxCorners(printArea, b));
}

/** Unrotated layout rect. Rendering positions the element axis-aligned and
 *  lets CSS `rotate()` spin it about its own centre, so the DOM box stays
 *  unrotated — collision uses pxCorners, layout uses this. */
export function pxRect(
  printArea: PrintArea | undefined,
  p: { xPct: number; yPct: number; print_w_cm: number; print_h_cm: number }
) {
  if (!printArea) return { x: 0, y: 0, w: 0, h: 0 };
  const rectPxW = printArea.w * IMG_W;
  const rectPxH = printArea.h * IMG_H;
  const w = p.print_w_cm * (rectPxW / printArea.cm_w);
  const h = p.print_h_cm * (rectPxH / printArea.cm_h);
  const cx = printArea.x * IMG_W + (p.xPct / 100) * rectPxW;
  const cy = printArea.y * IMG_H + (p.yPct / 100) * rectPxH;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

export function clampCenterPct(pct: number, sizeCm: number, fullCm: number): number {
  const halfPct = (sizeCm / fullCm) * 50;
  return Math.max(halfPct, Math.min(100 - halfPct, pct));
}

/** clampCenterPct clamps against the unrotated half-extent, which is correct
 *  while dragging (placements start unrotated) but not once a placement has
 *  been rotated — a rotated sticker's true corners can extend past the
 *  printable rectangle even though its center is still inside it. This is
 *  the drag-end/rotation-end backstop for that case. */
export function withinPrintArea(printArea: PrintArea | undefined, p: Placement | PlacementTrial): boolean {
  if (!printArea) return true;
  const areaX = printArea.x * IMG_W;
  const areaY = printArea.y * IMG_H;
  const areaW = printArea.w * IMG_W;
  const areaH = printArea.h * IMG_H;
  return pxCorners(printArea, p).every(
    (pt) => pt.x >= areaX - 0.5 && pt.x <= areaX + areaW + 0.5 && pt.y >= areaY - 0.5 && pt.y <= areaY + areaH + 0.5
  );
}

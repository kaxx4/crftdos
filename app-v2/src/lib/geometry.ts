/** Canvas geometry — the four constraints that keep a kiosk order physically
 *  fulfillable. This is the highest-risk logic in the product: a design tool
 *  that accepts an order you cannot press is a broken promise at the counter,
 *  not a cosmetic bug.
 *
 *  Carried forward from the verified implementation rather than re-derived.
 *  All four invariants below were checked against the live build (see
 *  `Rework - Master Plan.md`, "All four fulfilment-critical invariants verified
 *  intact"). Rewriting them from intuition is the one avoidable way to ship a
 *  canvas that quietly produces unpressable orders.
 *
 *  1. NO SCALING. Stickers render at true physical size, derived from the
 *     mockup's known print-area centimetres. There is no resize handle
 *     anywhere and there must never be one — the transfers are pre-cut at
 *     fixed S/M/L (PRD D13).
 *  2. PRINT-AREA BOUNDS. Nothing can land on a seam, a hem or a sleeve.
 *  3. NO OVERLAP. Two transfers cannot be pressed on top of each other.
 *  4. STOCK-AWARE. Enforced at the backend seam, not here.
 *
 *  Deliberately plain functions rather than a hook: the same math must run
 *  against whichever print area is current, and front/back have different
 *  rectangles. Passing `printArea` on every call means no call site can
 *  silently evaluate against a stale side after a front/back switch. */

import type { PrintArea } from "./domain/types";

/** The mockup's intrinsic size. Placement percentages are resolution
 *  independent, so this is only ever an internal working space — the rendered
 *  canvas can be any size. */
export const IMG_W = 800;
export const IMG_H = 1000;

export type Pt = { x: number; y: number };

export type Sized = {
  pos_x: number;
  pos_y: number;
  print_w_cm: number;
  print_h_cm: number;
  rotation?: number;
};

/** px-per-cm in each axis, derived from the mockup's declared print rectangle.
 *  This is the whole true-scale mechanism: real print centimetres scaled
 *  against a rectangle whose real size is known. */
export function pxPerCm(printArea: PrintArea) {
  return {
    x: (printArea.w * IMG_W) / printArea.cm_w,
    y: (printArea.h * IMG_H) / printArea.cm_h,
  };
}

/** Corners as an ORIENTED box, rotation included. Overlap detection depends on
 *  this being the true rotated rectangle rather than an axis-aligned bounding
 *  box: two rotated stickers can be AABB-clear of each other while physically
 *  colliding, which is exactly the narrow-but-real bug the old AABB version
 *  had. */
export function corners(printArea: PrintArea | undefined, p: Sized): Pt[] {
  if (!printArea) return [];
  const per = pxPerCm(printArea);
  const rectPxW = printArea.w * IMG_W;
  const rectPxH = printArea.h * IMG_H;
  const wPx = p.print_w_cm * per.x;
  const hPx = p.print_h_cm * per.y;
  const cx = printArea.x * IMG_W + (p.pos_x / 100) * rectPxW;
  const cy = printArea.y * IMG_H + (p.pos_y / 100) * rectPxH;
  const rad = ((p.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const hw = wPx / 2;
  const hh = hPx / 2;
  return (
    [
      [-hw, -hh],
      [hw, -hh],
      [hw, hh],
      [-hw, hh],
    ] as const
  ).map(([dx, dy]) => ({ x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos }));
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

      const project = (pts: Pt[]) => {
        let min = Infinity;
        let max = -Infinity;
        for (const pt of pts) {
          const d = pt.x * axis.x + pt.y * axis.y;
          if (d < min) min = d;
          if (d > max) max = d;
        }
        return [min, max] as const;
      };

      const [aMin, aMax] = project(a);
      const [bMin, bMax] = project(b);
      // A shared edge is not a collision; require real interpenetration.
      if (aMax <= bMin + 1e-6 || bMax <= aMin + 1e-6) return false;
    }
  }
  return true;
}

export function overlaps(printArea: PrintArea | undefined, a: Sized, b: Sized): boolean {
  return polysOverlap(corners(printArea, a), corners(printArea, b));
}

/** Unrotated layout rect. Rendering positions the element axis-aligned and
 *  lets CSS `rotate()` spin it about its own centre, so the DOM box stays
 *  unrotated — collision uses `corners`, layout uses this. */
export function layoutRect(printArea: PrintArea | undefined, p: Sized) {
  if (!printArea) return { x: 0, y: 0, w: 0, h: 0 };
  const per = pxPerCm(printArea);
  const w = p.print_w_cm * per.x;
  const h = p.print_h_cm * per.y;
  const cx = printArea.x * IMG_W + (p.pos_x / 100) * (printArea.w * IMG_W);
  const cy = printArea.y * IMG_H + (p.pos_y / 100) * (printArea.h * IMG_H);
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

/** Clamp a centre so the sticker's half-extent stays inside the printable
 *  rectangle. Correct while dragging, when placements are unrotated. */
export function clampCenterPct(pct: number, sizeCm: number, fullCm: number): number {
  const halfPct = (sizeCm / fullCm) * 50;
  return Math.max(halfPct, Math.min(100 - halfPct, pct));
}

/** The backstop `clampCenterPct` cannot provide: once a placement is rotated,
 *  its true corners can extend past the printable rectangle even though its
 *  centre is still comfortably inside. Checked on drag-end and rotation-end,
 *  where a failure reverts rather than silently sticking. */
export function withinPrintArea(printArea: PrintArea | undefined, p: Sized): boolean {
  if (!printArea) return true;
  const ax = printArea.x * IMG_W;
  const ay = printArea.y * IMG_H;
  const aw = printArea.w * IMG_W;
  const ah = printArea.h * IMG_H;
  return corners(printArea, p).every(
    (pt) => pt.x >= ax - 0.5 && pt.x <= ax + aw + 0.5 && pt.y >= ay - 0.5 && pt.y <= ay + ah + 0.5
  );
}

/** Candidate centres tried when a tap would land on top of an existing
 *  placement. More generous than the spec: rather than refusing the first
 *  collision outright, try a spread of alternates and only refuse when all
 *  fail. It still enforces the rule; it just doesn't dead-end a customer on
 *  their very first tap. */
const FALLBACK_CENTRES: [number, number][] = [
  [50, 50],
  [30, 30],
  [70, 30],
  [30, 70],
  [70, 70],
  [50, 25],
  [50, 75],
  [25, 50],
  [75, 50],
];

/** Find a legal centre for a new placement, or null if the side is genuinely
 *  full. Never returns a position that overlaps or leaves the print area. */
export function findFreeSpot(
  printArea: PrintArea | undefined,
  incoming: { print_w_cm: number; print_h_cm: number },
  existing: Sized[]
): { pos_x: number; pos_y: number } | null {
  if (!printArea) return null;
  for (const [x, y] of FALLBACK_CENTRES) {
    const candidate: Sized = {
      pos_x: clampCenterPct(x, incoming.print_w_cm, printArea.cm_w),
      pos_y: clampCenterPct(y, incoming.print_h_cm, printArea.cm_h),
      print_w_cm: incoming.print_w_cm,
      print_h_cm: incoming.print_h_cm,
      rotation: 0,
    };
    if (!withinPrintArea(printArea, candidate)) continue;
    if (existing.some((e) => overlaps(printArea, candidate, e))) continue;
    return { pos_x: candidate.pos_x, pos_y: candidate.pos_y };
  }
  return null;
}

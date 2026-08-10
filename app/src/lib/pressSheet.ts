"use client";

/** Press sheet rendering (PRD §4.4).
 *
 *  "A composite PNG of the tee with stickers in position, plus a
 *   machine-readable placement list (sticker code, side, x and y as
 *   percentage of print area, rotation in degrees). The press sheet is what
 *   the person at the heat press actually looks at."
 *
 *  Rendered on the device, on demand, from placement data already stored on
 *  the order — no upload, no Storage round trip, and it works offline, which
 *  matters because the press table is the same stall with the same signal.
 *
 *  The placement list is not a fallback for the image, it is the other half of
 *  the deliverable: the image tells the operator where things go, the list
 *  gives exact numbers when "about a third across" is not good enough. */

export type PressPlacement = {
  code: string;
  side: "front" | "back";
  pos_x: number | null; // % of print area width, measured centre
  pos_y: number | null;
  rotation: number | null; // degrees
  print_w_cm: number | null;
  print_h_cm: number | null;
  cutout_path: string | null;
};

export type PrintArea = {
  x: number; // fraction of mockup width
  y: number;
  w: number;
  h: number;
  cm_w: number;
  cm_h: number;
};

const SHEET_W = 800;
const SHEET_H = 1000;

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Composite one side of one garment. Returns a PNG data URL, or null if the
 *  mockup itself could not be loaded — without the garment there is no sheet,
 *  and a bare arrangement of stickers on white would be actively misleading
 *  about where they sit. */
export async function renderPressSheet(opts: {
  mockupSrc: string;
  printArea: PrintArea;
  placements: PressPlacement[];
  side: "front" | "back";
  caption?: string;
}): Promise<string | null> {
  const { mockupSrc, printArea, placements, side, caption } = opts;

  const mockup = await loadImage(mockupSrc);
  if (!mockup) return null;

  const canvas = document.createElement("canvas");
  canvas.width = SHEET_W;
  canvas.height = SHEET_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, SHEET_W, SHEET_H);
  ctx.drawImage(mockup, 0, 0, SHEET_W, SHEET_H);

  const areaX = printArea.x * SHEET_W;
  const areaY = printArea.y * SHEET_H;
  const areaW = printArea.w * SHEET_W;
  const areaH = printArea.h * SHEET_H;

  // Print-area guide. The operator needs to see the boundary the placement
  // was constrained to, not just the stickers.
  ctx.save();
  ctx.strokeStyle = "#1B4DF5";
  ctx.setLineDash([8, 6]);
  ctx.lineWidth = 2;
  ctx.strokeRect(areaX, areaY, areaW, areaH);
  ctx.restore();

  const pxPerCmX = areaW / printArea.cm_w;
  const pxPerCmY = areaH / printArea.cm_h;

  for (const p of placements.filter((q) => q.side === side)) {
    if (!p.print_w_cm || !p.print_h_cm) continue;
    const w = p.print_w_cm * pxPerCmX;
    const h = p.print_h_cm * pxPerCmY;
    const cx = areaX + ((p.pos_x ?? 50) / 100) * areaW;
    const cy = areaY + ((p.pos_y ?? 50) / 100) * areaH;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(((p.rotation ?? 0) * Math.PI) / 180);

    const cutout = p.cutout_path ? await loadImage(p.cutout_path) : null;
    if (cutout) {
      ctx.drawImage(cutout, -w / 2, -h / 2, w, h);
    } else {
      // No cutout on file: draw the footprint and the code so the sheet is
      // still usable rather than silently missing a sticker.
      ctx.strokeStyle = "#C6302B";
      ctx.lineWidth = 2;
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.fillStyle = "#C6302B";
      ctx.font = "bold 16px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(p.code, 0, 0);
    }

    // Crosshair at the true centre — the operator aligns to this, not to the
    // eyeballed middle of the artwork.
    ctx.strokeStyle = "#1B4DF5";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.lineTo(8, 0);
    ctx.moveTo(0, -8);
    ctx.lineTo(0, 8);
    ctx.stroke();
    ctx.restore();
  }

  if (caption) {
    ctx.fillStyle = "#0F0F10";
    ctx.fillRect(0, SHEET_H - 44, SHEET_W, 44);
    ctx.fillStyle = "#F7F5F1";
    ctx.font = "bold 20px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`${caption}  ·  ${side.toUpperCase()}`, 16, SHEET_H - 22);
  }

  return canvas.toDataURL("image/png");
}

/** Machine-readable placement list, per PRD §4.4. */
export function placementList(placements: PressPlacement[], side: "front" | "back") {
  return placements
    .filter((p) => p.side === side)
    .map((p) => ({
      code: p.code,
      side: p.side,
      x: p.pos_x == null ? "—" : `${Number(p.pos_x).toFixed(1)}%`,
      y: p.pos_y == null ? "—" : `${Number(p.pos_y).toFixed(1)}%`,
      rotation: `${Math.round(Number(p.rotation ?? 0))}°`,
      size:
        p.print_w_cm && p.print_h_cm
          ? `${Number(p.print_w_cm).toFixed(1)}×${Number(p.print_h_cm).toFixed(1)}cm`
          : "—",
    }));
}

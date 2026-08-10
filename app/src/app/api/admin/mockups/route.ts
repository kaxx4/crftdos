import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifySession, SESSION_COOKIE } from "@/lib/session";

async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE.admin)?.value;
  return verifySession("admin", token);
}

const BUCKET = "stall-public";
const MAX_BYTES = 8 * 1024 * 1024;

type PrintArea = { x: number; y: number; w: number; h: number; cm_w: number; cm_h: number };

// PRD §16 items 7-8: mockups and print-area measurements are per product
// type/colour/fit, front and back — not per exact SKU. Every SKU sharing a
// (color_id, fit_id) pair gets the same mockup image and print rectangle,
// since a garment's silhouette doesn't change across sizes; only the print
// area's cm dimensions would in principle, and this keeps that a manual
// per-combo decision rather than assuming XS and XXL share one number.
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = supabaseAdmin();

  const { data: skus, error } = await admin
    .from("stall_product_skus")
    .select("color_id, fit_id, size, mockup_front, mockup_back, print_area, stall_colors(name), stall_fits(name)")
    .eq("is_active", true)
    .order("sku_code");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Row = {
    color_id: string;
    fit_id: string;
    size: string;
    mockup_front: string | null;
    mockup_back: string | null;
    print_area: unknown;
    stall_colors: { name: string } | { name: string }[] | null;
    stall_fits: { name: string } | { name: string }[] | null;
  };
  const combos = new Map<
    string,
    { color_id: string; fit_id: string; colorName: string; fitName: string; sizes: string[]; mockup_front: string | null; mockup_back: string | null; print_area: unknown }
  >();
  for (const r of (skus || []) as Row[]) {
    const key = `${r.color_id}:${r.fit_id}`;
    const colorName = Array.isArray(r.stall_colors) ? r.stall_colors[0]?.name : r.stall_colors?.name;
    const fitName = Array.isArray(r.stall_fits) ? r.stall_fits[0]?.name : r.stall_fits?.name;
    if (!combos.has(key)) {
      combos.set(key, {
        color_id: r.color_id,
        fit_id: r.fit_id,
        colorName: colorName || "?",
        fitName: fitName || "?",
        sizes: [],
        mockup_front: r.mockup_front,
        mockup_back: r.mockup_back,
        print_area: r.print_area,
      });
    }
    combos.get(key)!.sizes.push(r.size);
  }

  return NextResponse.json({ combos: [...combos.values()] });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "multipart/form-data required" }, { status: 400 });

  const colorId = form.get("color_id");
  const fitId = form.get("fit_id");
  const side = form.get("side");
  const file = form.get("file");
  if (typeof colorId !== "string" || typeof fitId !== "string" || (side !== "front" && side !== "back")) {
    return NextResponse.json({ error: "color_id, fit_id and side ('front'|'back') required" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: matching, error: matchErr } = await admin
    .from("stall_product_skus")
    .select("id, print_area")
    .eq("color_id", colorId)
    .eq("fit_id", fitId);
  if (matchErr) return NextResponse.json({ error: matchErr.message }, { status: 500 });
  if (!matching?.length) {
    return NextResponse.json({ error: "No SKUs for this colour/fit combination" }, { status: 404 });
  }

  let mockupUrl: string | null = null;
  if (file instanceof File) {
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "File over 8MB" }, { status: 400 });
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `mockups/${colorId}-${fitId}-${side}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: uploadErr } = await admin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: file.type || "image/jpeg", upsert: true });
    if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });
    mockupUrl = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  // Print area is optional per request — a volunteer might upload the photo
  // first and measure later, or vice versa.
  let area: PrintArea | null = null;
  const areaRaw = form.get("print_area");
  if (typeof areaRaw === "string" && areaRaw) {
    try {
      const parsed = JSON.parse(areaRaw);
      if (
        typeof parsed.x === "number" &&
        typeof parsed.y === "number" &&
        typeof parsed.w === "number" &&
        typeof parsed.h === "number" &&
        typeof parsed.cm_w === "number" &&
        typeof parsed.cm_h === "number"
      ) {
        area = parsed;
      }
    } catch {
      return NextResponse.json({ error: "print_area must be valid JSON" }, { status: 400 });
    }
  }

  for (const sku of matching) {
    const patch: Record<string, unknown> = {};
    if (mockupUrl) patch[side === "front" ? "mockup_front" : "mockup_back"] = mockupUrl;
    if (area) {
      const existing = (sku.print_area as Record<string, unknown>) || {};
      patch.print_area = { ...existing, [side]: area };
    }
    if (Object.keys(patch).length === 0) continue;
    const { error } = await admin.from("stall_product_skus").update(patch).eq("id", sku.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await admin.from("stall_admin_audit").insert({
    actor: "admin",
    action: "mockup_set",
    detail: { color_id: colorId, fit_id: fitId, side, skusUpdated: matching.length, hasImage: !!mockupUrl, hasPrintArea: !!area },
  });

  return NextResponse.json({ ok: true, skusUpdated: matching.length, mockupUrl });
}

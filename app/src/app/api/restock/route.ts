import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifySession, SESSION_COOKIE } from "@/lib/session";

async function requireStall(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE.stall)?.value;
  return verifySession("stall", token);
}

export async function GET(req: NextRequest) {
  if (!(await requireStall(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = supabaseAdmin();

  const [{ data: products }, { data: designs }, { data: soldSkus }, { data: soldStickers }] = await Promise.all([
    admin.from("stall_product_skus").select("*").eq("is_active", true),
    admin.from("stall_sticker_designs").select("*").eq("is_active", true),
    admin.from("stall_order_items").select("product_sku_id"),
    admin.from("stall_order_item_stickers").select("sticker_design_id"),
  ]);

  const soldSkuIds = new Set((soldSkus || []).map((r) => r.product_sku_id).filter(Boolean));
  const soldStickerIds = new Set((soldStickers || []).map((r) => r.sticker_design_id).filter(Boolean));

  const belowPar = [
    ...(products || [])
      .filter((p) => p.stock_qty < p.par_level)
      .map((p) => ({ type: "product" as const, id: p.id, code: p.sku_code, stock: p.stock_qty, par: p.par_level })),
    ...(designs || [])
      .filter((d) => d.stock_qty < d.par_level)
      .map((d) => ({ type: "sticker" as const, id: d.id, code: d.code, stock: d.stock_qty, par: d.par_level })),
  ];

  const deadStock = [
    ...(products || [])
      .filter((p) => !soldSkuIds.has(p.id) && p.stock_qty > 0)
      .map((p) => ({ type: "product" as const, id: p.id, code: p.sku_code, stock: p.stock_qty })),
    ...(designs || [])
      .filter((d) => !soldStickerIds.has(d.id) && d.stock_qty > 0)
      .map((d) => ({ type: "sticker" as const, id: d.id, code: d.code, stock: d.stock_qty })),
  ];

  return NextResponse.json({ belowPar, deadStock });
}

export async function POST(req: NextRequest) {
  if (!(await requireStall(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { type, id, qty } = await req.json().catch(() => ({}));
  if (!type || !id || !qty) return NextResponse.json({ error: "type, id, qty required" }, { status: 400 });
  const admin = supabaseAdmin();
  const table = type === "product" ? "stall_product_skus" : "stall_sticker_designs";
  const { data: row } = await admin.from(table).select("stock_qty").eq("id", id).single();
  const { data: updated, error } = await admin
    .from(table)
    .update({ stock_qty: (row?.stock_qty ?? 0) + Number(qty) })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await admin.from("stall_inventory_movements").insert({
    sku_type: type,
    sku_id: id,
    delta: Number(qty),
    reason: "restock",
    actor: "volunteer",
  });
  return NextResponse.json({ row: updated });
}

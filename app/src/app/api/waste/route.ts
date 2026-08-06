import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifySession, SESSION_COOKIE } from "@/lib/session";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE.stall)?.value;
  if (!(await verifySession("stall", token))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = supabaseAdmin();
  const { data } = await admin.from("stall_waste_log").select("*").order("created_at", { ascending: false }).limit(50);
  return NextResponse.json({ waste: data || [] });
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE.stall)?.value;
  if (!(await verifySession("stall", token))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { shiftId, stickerId, stickerQty, productSkuId, productQty, reason, note } = body;
  if (!reason || (!stickerId && !productSkuId)) {
    return NextResponse.json({ error: "reason and a sticker or product required" }, { status: 400 });
  }
  const admin = supabaseAdmin();

  const { data: log, error } = await admin
    .from("stall_waste_log")
    .insert({
      shift_id: shiftId || null,
      sticker_id: stickerId || null,
      sticker_qty: stickerQty || 0,
      product_sku_id: productSkuId || null,
      product_qty: productQty || 0,
      reason,
      note: note || null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (stickerId && stickerQty > 0) {
    const { data: d } = await admin.from("stall_sticker_designs").select("stock_qty").eq("id", stickerId).single();
    await admin.from("stall_sticker_designs").update({ stock_qty: (d?.stock_qty ?? 0) - stickerQty }).eq("id", stickerId);
    await admin.from("stall_inventory_movements").insert({
      sku_type: "sticker",
      sku_id: stickerId,
      delta: -stickerQty,
      reason: "damage",
      note: `waste: ${reason}`,
      actor: "volunteer",
    });
  }
  if (productSkuId && productQty > 0) {
    const { data: p } = await admin.from("stall_product_skus").select("stock_qty").eq("id", productSkuId).single();
    await admin.from("stall_product_skus").update({ stock_qty: (p?.stock_qty ?? 0) - productQty }).eq("id", productSkuId);
    await admin.from("stall_inventory_movements").insert({
      sku_type: "product",
      sku_id: productSkuId,
      delta: -productQty,
      reason: "damage",
      note: `waste: ${reason}`,
      actor: "volunteer",
    });
  }

  return NextResponse.json({ log });
}

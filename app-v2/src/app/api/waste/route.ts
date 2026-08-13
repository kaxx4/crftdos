import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {

  const environmentId = req.nextUrl.searchParams.get("environment_id");
  const admin = supabaseAdmin();
  let q = admin.from("stall_waste_log").select("*").order("created_at", { ascending: false }).limit(50);
  if (environmentId) q = q.eq("environment_id", environmentId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ waste: data ?? [] });
}

export async function POST(req: NextRequest) {

  const body = await req.json().catch(() => ({}));
  const {
    environment_id: environmentId,
    shift_id: shiftId,
    sticker_id: stickerId,
    sticker_qty: stickerQty,
    product_sku_id: productSkuId,
    product_qty: productQty,
    reason,
    note,
  } = body;
  if (!environmentId || !reason || (!stickerId && !productSkuId)) {
    return NextResponse.json({ error: "environment_id, reason and a sticker or product required" }, { status: 400 });
  }
  const admin = supabaseAdmin();

  const { data: log, error } = await admin
    .from("stall_waste_log")
    .insert({
      environment_id: environmentId,
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

  // Decrement stock from the acting device's own environment's allocation —
  // same environment-scoped stock model migration 009 established for every
  // other adjusting reason.
  // "A successful call with zero rows means refused, not fine" — the adjust
  // RPCs refuse silently (empty result set) rather than throwing when the
  // decrement would take stock negative. Ignoring that result would let a
  // waste log claim stock moved when `stall_stock` never actually changed,
  // corrupting the ledger with no error surfaced anywhere.
  let stockWarning: string | undefined;
  if ((stickerId && stickerQty > 0) || (productSkuId && productQty > 0)) {
    const { data: loc } = await admin
      .from("stall_stock_locations")
      .select("id")
      .eq("environment_id", environmentId)
      .limit(1)
      .single();
    if (loc) {
      if (stickerId && stickerQty > 0) {
        const { data: adjusted } = await admin.rpc("stall_adjust_sticker_stock", {
          p_id: stickerId,
          p_delta: -stickerQty,
          p_location_id: loc.id,
        });
        const row = Array.isArray(adjusted) ? adjusted[0] : adjusted;
        if (!row) {
          stockWarning = "Logged, but stock could not be decremented (insufficient stock on hand).";
        } else {
          await admin.from("stall_inventory_movements").insert({
            sku_type: "sticker",
            sku_id: stickerId,
            delta: -stickerQty,
            reason: "damage",
            note: `waste: ${reason}`,
            actor: "volunteer",
            environment_id: environmentId,
            location_id: loc.id,
          });
        }
      }
      if (productSkuId && productQty > 0) {
        const { data: adjusted } = await admin.rpc("stall_adjust_product_stock", {
          p_id: productSkuId,
          p_delta: -productQty,
          p_location_id: loc.id,
        });
        const row = Array.isArray(adjusted) ? adjusted[0] : adjusted;
        if (!row) {
          stockWarning = "Logged, but stock could not be decremented (insufficient stock on hand).";
        } else {
          await admin.from("stall_inventory_movements").insert({
            sku_type: "product",
            sku_id: productSkuId,
            delta: -productQty,
            reason: "damage",
            note: `waste: ${reason}`,
            actor: "volunteer",
            environment_id: environmentId,
            location_id: loc.id,
          });
        }
      }
    }
  }

  return NextResponse.json({ log, ...(stockWarning ? { warning: stockWarning } : {}) });
}

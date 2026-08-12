import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAnySession } from "@/lib/apiAuth";

// PRD §3.3 — held qty subtracts from available, not on-hand. Kiosk soft-holds
// (session-scoped, no customer name) are internal and never shown here —
// mirrors v1's `not customer_name ilike 'kiosk-session:%'` filter.
export async function GET(req: NextRequest) {
  const auth = await requireAnySession(req, ["stall", "admin"]);
  if (!auth.ok) return auth.response;

  const environmentId = req.nextUrl.searchParams.get("environment_id");
  if (!environmentId) return NextResponse.json({ error: "environment_id required" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("stall_holds")
    .select("*")
    .eq("environment_id", environmentId)
    .is("released_at", null)
    .is("converted_order", null)
    .not("customer_name", "ilike", "kiosk-session:%")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ holds: data ?? [] });
}

// Named holds — a volunteer reserving stock for a specific customer, distinct
// from the kiosk's anonymous session-scoped soft-holds (reserveSticker/
// /api/holds/reserve). v1 inserted these with no availability check at all;
// this one refuses the same way reserveSticker does — on-hand minus every
// other active hold at this environment, not just on-hand.
export async function POST(req: NextRequest) {
  const auth = await requireAnySession(req, ["stall", "admin"]);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const {
    environment_id: environmentId,
    product_sku_id: productSkuId,
    sticker_id: stickerId,
    qty,
    customer_name: customerName,
    customer_phone: customerPhone,
    shift_id: shiftId,
    hours,
  } = body;

  if (!environmentId || (!productSkuId && !stickerId) || !customerName) {
    return NextResponse.json(
      { error: "environment_id, a product or sticker, and customer_name are required" },
      { status: 400 }
    );
  }
  const q = Math.max(1, Number(qty) || 1);
  const admin = supabaseAdmin();

  const { data: loc } = await admin
    .from("stall_stock_locations")
    .select("id")
    .eq("environment_id", environmentId)
    .limit(1)
    .single();
  if (!loc) return NextResponse.json({ error: "No stock location for this environment" }, { status: 404 });

  const skuType: "product" | "sticker" = productSkuId ? "product" : "sticker";
  const skuId = productSkuId || stickerId;

  const { data: stockRow } = await admin
    .from("stall_stock")
    .select("qty")
    .eq("location_id", loc.id)
    .eq("sku_type", skuType)
    .eq("sku_id", skuId)
    .single();
  const onHand = stockRow?.qty ?? 0;

  const { data: activeHolds } = await admin
    .from("stall_holds")
    .select("qty")
    .eq("environment_id", environmentId)
    .eq(skuType === "product" ? "product_sku_id" : "sticker_id", skuId)
    .is("released_at", null)
    .is("converted_order", null);
  const heldQty = (activeHolds ?? []).reduce((n, h) => n + h.qty, 0);

  if (onHand - heldQty < q) {
    return NextResponse.json({ error: "Not enough available at this stall to hold that many" }, { status: 409 });
  }

  const { data: hold, error } = await admin
    .from("stall_holds")
    .insert({
      environment_id: environmentId,
      shift_id: shiftId || null,
      product_sku_id: productSkuId || null,
      sticker_id: stickerId || null,
      qty: q,
      customer_name: customerName,
      customer_phone: customerPhone || null,
      expires_at: new Date(Date.now() + (Number(hours) || 2) * 60 * 60 * 1000).toISOString(),
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ hold });
}

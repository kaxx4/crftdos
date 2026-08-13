import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { pgErrorCode } from "@/lib/apiAuth";

// PRD §3.3 — held qty subtracts from available, not on-hand. Kiosk soft-holds
// (session-scoped, no customer name) are internal and never shown here —
// mirrors v1's `not customer_name ilike 'kiosk-session:%'` filter.
export async function GET(req: NextRequest) {

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

const RPC_ERROR_STATUS: Record<string, number> = {
  P0101: 409, // not enough available
  P0107: 404, // no stock location for environment
  "22023": 400, // malformed payload (missing name, bad sku_type)
};

// Named holds — a volunteer reserving stock for a specific customer, distinct
// from the kiosk's anonymous session-scoped soft-holds (reserveSticker/
// /api/holds/reserve). v1 inserted these with no availability check at all.
// This goes through stall_reserve_named_hold, which locks the stock row
// before checking availability and inserting — a plain check-then-insert
// here (an earlier version of this route did exactly that) is a real race:
// two volunteers could both succeed holding the last unit for two different
// customers.
export async function POST(req: NextRequest) {

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

  const { data, error } = await admin.rpc("stall_reserve_named_hold", {
    p_environment_id: environmentId,
    p_sku_type: productSkuId ? "product" : "sticker",
    p_sku_id: productSkuId || stickerId,
    p_qty: q,
    p_customer_name: customerName,
    p_customer_phone: customerPhone || null,
    p_shift_id: shiftId || null,
    p_hours: Number(hours) || 2,
  });

  if (error) {
    const code = pgErrorCode(error);
    const status = RPC_ERROR_STATUS[code ?? ""] ?? 500;
    return NextResponse.json(
      { error: status === 500 ? "Failed to reserve" : error.message, code },
      { status }
    );
  }

  const hold = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({ hold });
}

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifySession, SESSION_COOKIE } from "@/lib/session";

async function requireStall(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE.stall)?.value;
  return verifySession("stall", token);
}

// PRD §3.3 — held qty subtracts from available, not on-hand. Default expiry
// 2h or shift close, whichever first; configurable via stall_settings.
export async function GET(req: NextRequest) {
  if (!(await requireStall(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = supabaseAdmin();
  const { data } = await admin
    .from("stall_holds")
    .select("*")
    .is("released_at", null)
    .is("converted_order", null)
    .not("customer_name", "ilike", "kiosk-session:%") // kiosk soft-holds are internal, not shown in the volunteer list
    .order("created_at", { ascending: false });
  return NextResponse.json({ holds: data || [] });
}

export async function POST(req: NextRequest) {
  if (!(await requireStall(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { productSkuId, stickerId, qty, customerName, customerPhone, shiftId, hours } = body;
  if ((!productSkuId && !stickerId) || !customerName) {
    return NextResponse.json({ error: "productSkuId or stickerId, and customerName required" }, { status: 400 });
  }
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("stall_holds")
    .insert({
      shift_id: shiftId || null,
      product_sku_id: productSkuId || null,
      sticker_id: stickerId || null,
      qty: qty || 1,
      customer_name: customerName,
      customer_phone: customerPhone || null,
      expires_at: new Date(Date.now() + (hours || 2) * 60 * 60 * 1000).toISOString(),
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ hold: data });
}

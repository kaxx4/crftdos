import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAnySession } from "@/lib/apiAuth";

// The `stall_reserve_sticker_hold` RPC requires a shift id (it scopes
// location resolution off it when p_environment_id is omitted, and always
// uses it to attribute the hold). The Backend contract's `reserveSticker`
// only carries environment_id + session_id, so this route resolves the
// environment's currently open shift itself.
export async function POST(req: NextRequest) {
  const auth = await requireAnySession(req, ["stall", "kiosk"]);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { sticker_id, environment_id, session_id, qty } = body as {
    sticker_id?: string;
    environment_id?: string;
    session_id?: string;
    qty?: number;
  };
  if (!sticker_id || !environment_id || !qty || qty <= 0) {
    return NextResponse.json({ error: "sticker_id, environment_id and a positive qty are required" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: shift } = await admin
    .from("stall_shifts")
    .select("id")
    .eq("environment_id", environment_id)
    .is("closed_at", null)
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!shift) {
    return NextResponse.json({ error: "No open shift for this environment." }, { status: 404 });
  }

  const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
  const { data, error } = await admin.rpc("stall_reserve_sticker_hold", {
    p_sticker_id: sticker_id,
    p_shift_id: shift.id,
    p_qty: qty,
    p_expires_at: expiresAt,
    p_customer_name: session_id ? `kiosk-session:${session_id}` : null,
    p_customer_phone: null,
    p_created_by: null,
    p_environment_id: environment_id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // "A successful call with zero rows means refused, not fine."
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "That sticker just went out of stock at this stall.", code: "out_of_stock" }, { status: 409 });
  }

  return NextResponse.json({ hold: data[0] });
}

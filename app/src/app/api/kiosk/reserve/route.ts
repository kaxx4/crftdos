import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifySession, SESSION_COOKIE } from "@/lib/session";

const RESERVE_MINUTES = 15;

async function requireKiosk(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE.kiosk)?.value;
  return verifySession("kiosk", token);
}

// Kiosk session reservations reuse `stall_holds` (sticker_id + a
// kiosk:<sessionId> marker in created_by-less form via `customer_name`) so a
// second kiosk composing against the same last unit is blocked, per §4.3.
// This is a soft hold: it never touches `stock_qty`, only availability.
//
// The availability check + insert run inside stall_reserve_sticker_hold, a
// single Postgres function that locks the sticker design row for the
// duration of the check — this closes the check-then-insert race where two
// concurrent kiosk sessions could both reserve the last unit.
export async function POST(req: NextRequest) {
  if (!(await requireKiosk(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId, stickerDesignId } = await req.json().catch(() => ({}));
  if (!sessionId || !stickerDesignId) {
    return NextResponse.json({ error: "sessionId and stickerDesignId required" }, { status: 400 });
  }
  const admin = supabaseAdmin();

  const { data: holds, error } = await admin.rpc("stall_reserve_sticker_hold", {
    p_sticker_id: stickerDesignId,
    p_shift_id: null,
    p_qty: 1,
    p_expires_at: new Date(Date.now() + RESERVE_MINUTES * 60 * 1000).toISOString(),
    p_customer_name: `kiosk-session:${sessionId}`,
    p_customer_phone: null,
    p_created_by: null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const hold = Array.isArray(holds) ? holds[0] : holds;
  if (!hold) {
    return NextResponse.json({ error: "Sold out (or reserved by another kiosk session)" }, { status: 409 });
  }
  return NextResponse.json({ hold });
}

export async function DELETE(req: NextRequest) {
  if (!(await requireKiosk(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { holdId } = await req.json().catch(() => ({}));
  if (!holdId) return NextResponse.json({ error: "holdId required" }, { status: 400 });
  const admin = supabaseAdmin();
  const { error } = await admin.from("stall_holds").update({ released_at: new Date().toISOString() }).eq("id", holdId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

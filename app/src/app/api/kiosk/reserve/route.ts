import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

const RESERVE_MINUTES = 15;

// Kiosk session reservations reuse `stall_holds` (sticker_id + a
// kiosk:<sessionId> marker in created_by-less form via `customer_name`) so a
// second kiosk composing against the same last unit is blocked, per §4.3.
// This is a soft hold: it never touches `stock_qty`, only availability.
export async function POST(req: NextRequest) {
  const { sessionId, stickerDesignId } = await req.json().catch(() => ({}));
  if (!sessionId || !stickerDesignId) {
    return NextResponse.json({ error: "sessionId and stickerDesignId required" }, { status: 400 });
  }
  const admin = supabaseAdmin();

  const { data: design } = await admin
    .from("stall_sticker_designs")
    .select("stock_qty")
    .eq("id", stickerDesignId)
    .single();
  const { data: activeHolds } = await admin
    .from("stall_holds")
    .select("id")
    .eq("sticker_id", stickerDesignId)
    .is("released_at", null)
    .is("converted_order", null)
    .gt("expires_at", new Date().toISOString());

  if ((design?.stock_qty ?? 0) - (activeHolds?.length ?? 0) <= 0) {
    return NextResponse.json({ error: "Sold out (or reserved by another kiosk session)" }, { status: 409 });
  }

  const { data: hold, error } = await admin
    .from("stall_holds")
    .insert({
      sticker_id: stickerDesignId,
      qty: 1,
      customer_name: `kiosk-session:${sessionId}`,
      expires_at: new Date(Date.now() + RESERVE_MINUTES * 60 * 1000).toISOString(),
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ hold });
}

export async function DELETE(req: NextRequest) {
  const { holdId } = await req.json().catch(() => ({}));
  if (!holdId) return NextResponse.json({ error: "holdId required" }, { status: 400 });
  const admin = supabaseAdmin();
  await admin.from("stall_holds").update({ released_at: new Date().toISOString() }).eq("id", holdId);
  return NextResponse.json({ ok: true });
}

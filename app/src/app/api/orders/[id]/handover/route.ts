import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifySession, SESSION_COOKIE } from "@/lib/session";

// PRD §3.2: one-tap "Handed Over" on the pending queue — the on-site press
// flow's exit. If the garment was never explicitly marked Pressed first,
// this stamps pressed_at too rather than leaving it null on a handed-over order.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.cookies.get(SESSION_COOKIE.stall)?.value;
  const session = await verifySession("stall", token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const admin = supabaseAdmin();

  const { data: existing, error: fetchError } = await admin
    .from("stall_orders")
    .select("pressed_at, fulfillment_status, voided_at")
    .eq("id", id)
    .single();

  if (fetchError || !existing || existing.voided_at || existing.fulfillment_status !== "pending_press") {
    return NextResponse.json({ error: "Order not found or not awaiting press" }, { status: 404 });
  }

  const { data, error } = await admin
    .from("stall_orders")
    .update({
      fulfillment_status: "handed_over",
      pressed_at: existing.pressed_at ?? new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Failed to hand over order" }, { status: 500 });
  }
  return NextResponse.json({ order: data });
}

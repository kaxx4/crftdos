import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifySession, SESSION_COOKIE } from "@/lib/session";

// PRD §3.2: one-tap "Pressed" on the pending queue. Marks the garment pressed
// without leaving the queue — it still needs to be handed over.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.cookies.get(SESSION_COOKIE.stall)?.value;
  const session = await verifySession("stall", token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("stall_orders")
    .update({ pressed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("fulfillment_status", "pending_press")
    .is("voided_at", null)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Order not found or not awaiting press" }, { status: 404 });
  }
  return NextResponse.json({ order: data });
}

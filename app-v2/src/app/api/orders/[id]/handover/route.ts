import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { mapOrderRow, ORDER_SELECT, type OrderRow } from "@/lib/backend/live/orderMap";

// No RPC for this stage either — a timestamp stamp, mirrors the mock's
// `markHandedOver` guard: must be printed first, must not already be handed
// over, must not be void.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {

  const { id } = await params;
  const admin = supabaseAdmin();

  const { data: existing } = await admin.from("stall_orders").select("pressed_at, collected_at, voided_at").eq("id", id).single();
  if (!existing) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (existing.voided_at) return NextResponse.json({ error: "This order was voided." }, { status: 409 });
  if (!existing.pressed_at) return NextResponse.json({ error: "Press this ticket before handing it over." }, { status: 409 });
  if (existing.collected_at) return NextResponse.json({ error: "This ticket is already handed over." }, { status: 409 });

  const { data, error } = await admin
    .from("stall_orders")
    .update({ collected_at: new Date().toISOString(), fulfillment_status: "handed_over" })
    .eq("id", id)
    .select(ORDER_SELECT)
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Failed to hand over order." }, { status: 500 });
  return NextResponse.json({ order: mapOrderRow(data as unknown as OrderRow) });
}

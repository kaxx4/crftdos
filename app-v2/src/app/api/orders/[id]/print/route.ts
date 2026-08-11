import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAnySession } from "@/lib/apiAuth";
import { mapOrderRow, ORDER_SELECT, type OrderRow } from "@/lib/backend/live/orderMap";

// No RPC for this stage — it is a timestamp stamp with no stock effect, same
// as v1's press route. Mirrors the mock's `markPrinted` guard: must be
// prepped first, must not already be printed, must not be void.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAnySession(req, ["stall", "admin"]);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const admin = supabaseAdmin();

  const { data: existing } = await admin.from("stall_orders").select("prepped_at, pressed_at, voided_at").eq("id", id).single();
  if (!existing) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (existing.voided_at) return NextResponse.json({ error: "This order was voided." }, { status: 409 });
  if (!existing.prepped_at) return NextResponse.json({ error: "Pull the stickers and mark this prepped first." }, { status: 409 });
  if (existing.pressed_at) return NextResponse.json({ error: "This ticket is already printed." }, { status: 409 });

  const { data, error } = await admin
    .from("stall_orders")
    .update({ pressed_at: new Date().toISOString() })
    .eq("id", id)
    .select(ORDER_SELECT)
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Failed to mark printed." }, { status: 500 });
  return NextResponse.json({ order: mapOrderRow(data as unknown as OrderRow) });
}

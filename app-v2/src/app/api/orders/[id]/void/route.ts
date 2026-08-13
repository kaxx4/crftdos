import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { pgErrorCode } from "@/lib/apiAuth";
import { mapOrderRow, ORDER_SELECT, type OrderRow } from "@/lib/backend/live/orderMap";

const RPC_ERROR_STATUS: Record<string, number> = {
  P0103: 404, // order not found
  P0104: 409, // already void
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const admin = supabaseAdmin();
  const { error } = await admin.rpc("stall_void_order", {
    p_order_id: id,
    p_actor: (body?.actor as string) || "volunteer",
    p_reason: (body?.reason as string) || null,
  });

  if (error) {
    const code = pgErrorCode(error);
    const status = RPC_ERROR_STATUS[code ?? ""] ?? 500;
    return NextResponse.json({ error: status === 500 ? "Failed to void order" : error.message, code }, { status });
  }

  const { data: row, error: selErr } = await admin.from("stall_orders").select(ORDER_SELECT).eq("id", id).single();
  if (selErr || !row) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  return NextResponse.json({ order: mapOrderRow(row as unknown as OrderRow) });
}

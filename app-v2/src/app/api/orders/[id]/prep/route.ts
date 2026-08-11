import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAnySession, pgErrorCode } from "@/lib/apiAuth";
import { mapOrderRow, ORDER_SELECT, type OrderRow } from "@/lib/backend/live/orderMap";

const RPC_ERROR_STATUS: Record<string, number> = {
  P0101: 409, // product out of stock
  P0102: 409, // sticker out of stock
};

// Where a deferred-stock (kiosk) order's stock actually decrements — can
// refuse. For a non-deferred order this is just a timestamp stamp. Idempotent:
// a double-tap returns alreadyPrepped: true without re-decrementing.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAnySession(req, ["stall", "admin"]);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const actor = (body?.actor as string | undefined) ?? "volunteer";

  const admin = supabaseAdmin();
  const { error } = await admin.rpc("stall_prep_order", { p_order_id: id, p_actor: actor });
  if (error) {
    const code = pgErrorCode(error);
    const status = RPC_ERROR_STATUS[code ?? ""] ?? 500;
    return NextResponse.json({ error: status === 500 ? "Failed to prep order" : error.message, code }, { status });
  }

  const { data: row, error: selErr } = await admin.from("stall_orders").select(ORDER_SELECT).eq("id", id).single();
  if (selErr || !row) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  return NextResponse.json({ order: mapOrderRow(row as unknown as OrderRow) });
}

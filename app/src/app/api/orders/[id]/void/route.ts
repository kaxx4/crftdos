import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifySession, SESSION_COOKIE } from "@/lib/session";

const RPC_ERROR_STATUS: Record<string, number> = {
  P0103: 404, // order not found
  P0104: 400, // already void
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.cookies.get(SESSION_COOKIE.stall)?.value;
  const session = await verifySession("stall", token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  // Restock every line, write the ledger, and mark the order void in one
  // transaction. The previous implementation read stock_qty into Node and
  // wrote back a computed value per line — the lost-update race migration 001
  // removed from the sale path but never from this one — and left a window
  // where a crash mid-loop restocked some lines but never voided the order.
  //
  // The receipt number is deliberately kept: gapless numbering means a void
  // retains its number and is flagged, never reused.
  const admin = supabaseAdmin();
  const { data, error } = await admin.rpc("stall_void_order", {
    p_order_id: id,
    p_actor: body.actor || "volunteer",
    p_reason: body.reason || null,
  });

  if (error) {
    const status = RPC_ERROR_STATUS[error.code ?? ""] ?? 500;
    return NextResponse.json(
      { error: status === 500 ? "Failed to void order" : error.message },
      { status }
    );
  }

  return NextResponse.json({ order: data });
}

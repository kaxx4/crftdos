import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAnySession } from "@/lib/apiAuth";
import { mapOrderRow, ORDER_SELECT, type OrderRow } from "@/lib/backend/live/orderMap";

// PRD §4.4's multi-order batch view: everything prepped and not yet pressed,
// oldest first — the queue the press table works through, distinct from the
// single-ticket prep/print/handover flow in /api/orders/[id]/print.
export async function GET(req: NextRequest) {
  const auth = await requireAnySession(req, ["stall", "admin"]);
  if (!auth.ok) return auth.response;

  const environmentId = req.nextUrl.searchParams.get("environment_id");
  const admin = supabaseAdmin();
  let q = admin
    .from("stall_orders")
    .select(ORDER_SELECT)
    .is("voided_at", null)
    .not("prepped_at", "is", null)
    .is("pressed_at", null)
    .order("prepped_at", { ascending: true });
  if (environmentId) q = q.eq("environment_id", environmentId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ orders: (data ?? []).map((r) => mapOrderRow(r as unknown as OrderRow)) });
}

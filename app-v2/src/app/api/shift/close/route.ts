import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAnySession } from "@/lib/apiAuth";

export async function POST(req: NextRequest) {
  const auth = await requireAnySession(req, ["stall", "admin"]);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { shift_id, counted_cash } = body as { shift_id?: string; counted_cash?: number };
  if (!shift_id) return NextResponse.json({ error: "shift_id is required" }, { status: 400 });

  const admin = supabaseAdmin();

  const { data: shiftRow } = await admin
    .from("stall_shifts")
    .select("opening_float, environment_id, opened_at")
    .eq("id", shift_id)
    .single();
  if (!shiftRow) return NextResponse.json({ error: "Shift not found." }, { status: 404 });

  const { data: orders } = await admin
    .from("stall_orders")
    .select("total, payment_method, paid_cash")
    .eq("shift_id", shift_id)
    .is("voided_at", null);

  // Cash refunds during this shift leave the till legitimately short —
  // stall_returns has no shift_id (the sale being returned may be from an
  // earlier shift), so this is attributed by when the refund happened
  // within this shift's own open window, not which shift the original
  // order was on.
  const { data: refunds } = await admin
    .from("stall_returns")
    .select("refund_amount")
    .eq("environment_id", shiftRow.environment_id)
    .eq("refund_method", "cash")
    .gte("created_at", shiftRow.opened_at);
  const cashRefunds = (refunds ?? []).reduce((sum, r) => sum + Number(r.refund_amount || 0), 0);

  const expectedCash =
    Number(shiftRow.opening_float ?? 0) +
    (orders ?? []).reduce((sum, o) => {
      if (o.payment_method === "cash") return sum + Number(o.total);
      if (o.payment_method === "split") return sum + Number(o.paid_cash || 0);
      return sum;
    }, 0) -
    cashRefunds;

  const variance = counted_cash != null ? Number(counted_cash) - expectedCash : null;

  const { data: shift, error } = await admin
    .from("stall_shifts")
    .update({
      closed_at: new Date().toISOString(),
      counted_cash: counted_cash ?? null,
      expected_cash: expectedCash,
      variance,
    })
    .eq("id", shift_id)
    .is("closed_at", null)
    .select()
    .single();

  if (error || !shift) {
    if (error?.code === "PGRST116") return NextResponse.json({ error: "Shift is already closed" }, { status: 409 });
    return NextResponse.json({ error: error?.message ?? "Shift not found." }, { status: error ? 500 : 404 });
  }

  await admin.from("stall_receipt_blocks").update({ closed_at: new Date().toISOString() }).eq("shift_id", shift_id).is("closed_at", null);

  return NextResponse.json({ shift });
}

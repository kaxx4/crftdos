import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifySession, SESSION_COOKIE } from "@/lib/session";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE.stall)?.value;
  const session = await verifySession("stall", token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { shiftId, countedCash, notes } = body;
  if (!shiftId) return NextResponse.json({ error: "shiftId required" }, { status: 400 });

  const admin = supabaseAdmin();

  const { data: orders } = await admin
    .from("stall_orders")
    .select("total, payment_method, paid_cash")
    .eq("shift_id", shiftId)
    .is("voided_at", null);

  const expectedCash = (orders || []).reduce((sum, o) => {
    if (o.payment_method === "cash") return sum + Number(o.total);
    if (o.payment_method === "split") return sum + Number(o.paid_cash || 0);
    return sum;
  }, 0);

  const variance = countedCash != null ? Number(countedCash) - expectedCash : null;

  const { data: shift, error } = await admin
    .from("stall_shifts")
    .update({
      closed_at: new Date().toISOString(),
      counted_cash: countedCash ?? null,
      expected_cash: expectedCash,
      variance,
      notes: notes || null,
    })
    .eq("id", shiftId)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Void every unused number in every open block for this shift.
  const { data: blocks } = await admin
    .from("stall_receipt_blocks")
    .select("*")
    .eq("shift_id", shiftId)
    .is("closed_at", null);

  for (const b of blocks || []) {
    await admin
      .from("stall_receipt_blocks")
      .update({ closed_at: new Date().toISOString() })
      .eq("id", b.id);
  }

  const unusedCount = (blocks || []).reduce((s, b) => s + (b.end_no - b.next_no + 1), 0);

  return NextResponse.json({ shift, expectedCash, variance, unusedReceiptNumbers: unusedCount });
}

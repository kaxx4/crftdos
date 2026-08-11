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

  // Guarding the update itself with .is("closed_at", null) — rather than a
  // separate check-then-update — closes the race where two near-simultaneous
  // close requests (or a retried one) could both pass a prior check and the
  // second would silently overwrite the first close's counted_cash/variance.
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
    .is("closed_at", null)
    .select()
    .single();
  if (error) {
    // PGRST116: no row matched the filter — either the shift doesn't exist
    // or (far more likely) it's already closed.
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Shift is already closed" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Void every unused number in every open block for this shift in one
  // bulk update — a loop of per-row updates left a window where a crash
  // mid-loop could leave the shift closed but a block still open.
  const { data: blocks } = await admin
    .from("stall_receipt_blocks")
    .select("*")
    .eq("shift_id", shiftId)
    .is("closed_at", null);

  if (blocks?.length) {
    await admin
      .from("stall_receipt_blocks")
      .update({ closed_at: new Date().toISOString() })
      .eq("shift_id", shiftId)
      .is("closed_at", null);
  }

  const unusedCount = (blocks || []).reduce((s, b) => s + (b.end_no - b.next_no + 1), 0);

  return NextResponse.json({ shift, expectedCash, variance, unusedReceiptNumbers: unusedCount });
}

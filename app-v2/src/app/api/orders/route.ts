import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAnySession, pgErrorCode } from "@/lib/apiAuth";
import { mapOrderRow, ORDER_SELECT, type OrderRow } from "@/lib/backend/live/orderMap";

const RPC_ERROR_STATUS: Record<string, number> = {
  P0100: 409, // no receipt numbers left
  P0101: 409, // product out of stock
  P0102: 409, // sticker out of stock
  P0107: 404, // no stock location for environment
  "22023": 400, // malformed payload
};

const RPC_ERROR_CODE: Record<string, string> = {
  P0100: "no_receipt_numbers",
  P0101: "out_of_stock",
  P0102: "out_of_stock",
  P0107: "not_found",
};

// Body is the already-shaped `p_order` jsonb the `stall_create_order` RPC
// expects — the LiveBackend does the CreateOrderInput -> RPC-shape mapping,
// this route just authenticates, calls the RPC, and re-selects the order in
// the shape the Backend contract's `Order` type needs.
export async function POST(req: NextRequest) {
  const auth = await requireAnySession(req, ["stall", "kiosk"]);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "Missing client order id" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data, error } = await admin.rpc("stall_create_order", { p_order: body });

  if (error) {
    const code = pgErrorCode(error);
    const status = RPC_ERROR_STATUS[code ?? ""] ?? 500;
    return NextResponse.json(
      { error: status === 500 ? "Failed to record order" : error.message, code: RPC_ERROR_CODE[code ?? ""] ?? "unknown" },
      { status }
    );
  }

  const result = data as { order: { id: string }; alreadyExisted: boolean };
  const { data: row, error: selErr } = await admin.from("stall_orders").select(ORDER_SELECT).eq("id", result.order.id).single();
  if (selErr || !row) return NextResponse.json({ error: selErr?.message ?? "Order not found after create" }, { status: 500 });

  // Discount/freebie log — every below-catalogue-price sale is auditable,
  // not just visible as a smaller number on the receipt. Skipped on an
  // idempotent re-hit (outbox retry) so a retried charge doesn't log twice.
  const discountAmount = Number((row as Record<string, unknown>).discount_amount ?? 0);
  if (!result.alreadyExisted && discountAmount > 0) {
    await admin.from("stall_admin_audit").insert({
      actor: (body as Record<string, unknown>).deviceId ?? auth.kind,
      action: (row as Record<string, unknown>).discount_reason === "freebie" ? "freebie_given" : "discount_applied",
      detail: {
        order_id: result.order.id,
        amount: discountAmount,
        reason: (row as Record<string, unknown>).discount_reason,
        note: (row as Record<string, unknown>).discount_note,
      },
    });
  }

  return NextResponse.json({ order: mapOrderRow(row as unknown as OrderRow), alreadyExisted: result.alreadyExisted });
}

export async function GET(req: NextRequest) {
  const auth = await requireAnySession(req, ["stall", "admin"]);
  if (!auth.ok) return auth.response;

  const environmentId = req.nextUrl.searchParams.get("environment_id");
  const shiftId = req.nextUrl.searchParams.get("shift_id");
  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = Math.min(Math.max(parseInt(limitParam || "200", 10) || 200, 1), 500);

  const admin = supabaseAdmin();
  let q = admin.from("stall_orders").select(ORDER_SELECT).order("created_at", { ascending: false });
  if (environmentId) q = q.eq("environment_id", environmentId);
  if (shiftId) q = q.eq("shift_id", shiftId);
  q = q.limit(limit);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ orders: (data ?? []).map((r) => mapOrderRow(r as unknown as OrderRow)) });
}

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifySession, SESSION_COOKIE } from "@/lib/session";

async function requireStall(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE.stall)?.value;
  return verifySession("stall", token);
}

export async function GET(req: NextRequest) {
  if (!(await requireStall(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = supabaseAdmin();
  const { data } = await admin.from("stall_returns").select("*").order("created_at", { ascending: false }).limit(50);
  return NextResponse.json({ returns: data || [] });
}

// PRD §3.5 — exchanges create a linked ZERO-VALUE replacement order so
// inventory moves correctly without inflating revenue.
export async function POST(req: NextRequest) {
  if (!(await requireStall(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const {
    originalOrderId,
    reason,
    action, // 'replace' | 'refund' | 'exchange' | 'reject'
    refundAmount,
    resaleable,
    approverPin,
    note,
    shiftId,
    deviceId,
    exchangeItem, // { product_sku_id, qty, unit_price, unit_cost } — for 'exchange'
    restockItems, // [{ sku_type, sku_id, qty }] — items coming back into stock
  } = body;

  if (!originalOrderId || !reason || !action) {
    return NextResponse.json({ error: "originalOrderId, reason, action required" }, { status: 400 });
  }

  const admin = supabaseAdmin();

  // Approval gate — any return needs an admin PIN per PRD's "approved_by" field intent.
  if (approverPin) {
    const { verify } = await import("@node-rs/argon2");
    const { data: pinRow } = await admin.from("stall_settings").select("value").eq("key", "pin_admin").single();
    const ok = pinRow ? await verify(pinRow.value as string, approverPin).catch(() => false) : false;
    if (!ok) return NextResponse.json({ error: "Incorrect admin PIN" }, { status: 401 });
  } else {
    return NextResponse.json({ error: "Approver PIN required" }, { status: 401 });
  }

  const { data: original } = await admin.from("stall_orders").select("*").eq("id", originalOrderId).single();
  if (!original) return NextResponse.json({ error: "Original order not found" }, { status: 404 });

  let replacementOrderId: string | null = null;

  if (action === "exchange" && exchangeItem) {
    replacementOrderId = crypto.randomUUID();
    await admin.from("stall_orders").insert({
      id: replacementOrderId,
      shift_id: shiftId || original.shift_id,
      channel: "stall",
      device_id: deviceId || "returns",
      subtotal: 0,
      discount_amount: 0,
      total: 0, // zero-value: inventory moves without inflating revenue
      cost_total: 0,
      payment_method: "pending",
      notes: `Exchange replacement for ${original.receipt_no}`,
    });
    const { data: item } = await admin
      .from("stall_order_items")
      .insert({
        order_id: replacementOrderId,
        product_sku_id: exchangeItem.product_sku_id,
        qty: exchangeItem.qty || 1,
        unit_price: 0,
        unit_cost: 0,
        line_total: 0,
      })
      .select()
      .single();
    if (item && exchangeItem.product_sku_id) {
      const { data: sku } = await admin
        .from("stall_product_skus")
        .select("stock_qty")
        .eq("id", exchangeItem.product_sku_id)
        .single();
      await admin
        .from("stall_product_skus")
        .update({ stock_qty: (sku?.stock_qty ?? 0) - (exchangeItem.qty || 1) })
        .eq("id", exchangeItem.product_sku_id);
      await admin.from("stall_inventory_movements").insert({
        sku_type: "product",
        sku_id: exchangeItem.product_sku_id,
        delta: -(exchangeItem.qty || 1),
        reason: "sale",
        ref_order: replacementOrderId,
        actor: "returns",
        note: "exchange replacement",
      });
    }
  }

  // Restock what's coming back, if marked resaleable.
  if (resaleable && restockItems?.length) {
    for (const r of restockItems as { sku_type: "product" | "sticker"; sku_id: string; qty: number }[]) {
      const table = r.sku_type === "product" ? "stall_product_skus" : "stall_sticker_designs";
      const { data: row } = await admin.from(table).select("stock_qty").eq("id", r.sku_id).single();
      await admin.from(table).update({ stock_qty: (row?.stock_qty ?? 0) + r.qty }).eq("id", r.sku_id);
      await admin.from("stall_inventory_movements").insert({
        sku_type: r.sku_type,
        sku_id: r.sku_id,
        delta: r.qty,
        reason: "return_restock",
        actor: "returns",
      });
    }
  }

  const { data: ret, error } = await admin
    .from("stall_returns")
    .insert({
      original_order: originalOrderId,
      replacement_order: replacementOrderId,
      reason,
      action,
      refund_amount: refundAmount || 0,
      restocked: !!resaleable,
      note: note || null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ return: ret });
}

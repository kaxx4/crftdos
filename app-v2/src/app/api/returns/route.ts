import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {

  const environmentId = req.nextUrl.searchParams.get("environment_id");
  const admin = supabaseAdmin();
  let q = admin.from("stall_returns").select("*").order("created_at", { ascending: false }).limit(50);
  if (environmentId) q = q.eq("environment_id", environmentId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ returns: data ?? [] });
}

// PRD §3.5 — exchanges/replacements create a linked ZERO-VALUE replacement
// order so inventory moves correctly without inflating revenue.
export async function POST(req: NextRequest) {

  const body = await req.json().catch(() => ({}));
  const {
    environment_id: environmentId,
    original_order_id: originalOrderId,
    reason,
    action, // 'replace' | 'refund' | 'exchange' | 'reject'
    refund_amount: refundAmount,
    refund_method: refundMethod,
    resaleable,
    approved_by: approvedBy,
    note,
    shift_id: shiftId,
    device_id: deviceId,
    exchange_item: exchangeItem, // { product_sku_id, qty, unit_price, unit_cost }
    restock_items: restockItems, // [{ sku_type, sku_id, qty }]
  } = body;

  if (!environmentId || !originalOrderId || !reason || !action) {
    return NextResponse.json({ error: "environment_id, original_order_id, reason, action required" }, { status: 400 });
  }
  if (refundAmount && !refundMethod) {
    return NextResponse.json({ error: "refund_method is required when refund_amount is set" }, { status: 400 });
  }
  // Named approver, not a PIN — PIN step-up was removed app-wide (361bc4c).
  // This is an accountability record for the audit row below, not a gate.
  if (!approvedBy || !String(approvedBy).trim()) {
    return NextResponse.json({ error: "Approver name required" }, { status: 400 });
  }

  const admin = supabaseAdmin();

  const { data: original } = await admin.from("stall_orders").select("*").eq("id", originalOrderId).single();
  if (!original) return NextResponse.json({ error: "Original order not found" }, { status: 404 });

  // A refund can never exceed what the customer actually paid — the PIN gate
  // stops a stranger from triggering this, but not a mistyped amount.
  if (refundAmount && Number(refundAmount) > Number(original.total)) {
    return NextResponse.json({ error: "Refund amount cannot exceed the original order's total" }, { status: 400 });
  }

  let replacementOrderId: string | null = null;

  if (action === "exchange" && exchangeItem) {
    // Single transaction: order + item + stock decrement + ledger row all roll
    // back together if the item is out of stock, instead of leaving an
    // orphaned zero-value order behind.
    const { data: exch, error: exchErr } = await admin.rpc("stall_create_exchange", {
      p_original_order: originalOrderId,
      p_shift_id: shiftId || original.shift_id,
      p_device_id: deviceId || "returns",
      p_product_sku_id: exchangeItem.product_sku_id || null,
      p_qty: exchangeItem.qty || 1,
    });
    if (exchErr) {
      const status = exchErr.code === "P0101" ? 409 : exchErr.code === "P0103" ? 404 : 500;
      return NextResponse.json(
        { error: status === 500 ? exchErr.message : "Exchange item is out of stock" },
        { status }
      );
    }
    replacementOrderId = (exch as { order: { id: string } }).order.id;
  }

  // Restock what's coming back, if marked resaleable — into the acting
  // device's own environment's location, same as every other stock-adjusting
  // reason (migration 009).
  if (resaleable && restockItems?.length) {
    const { data: loc } = await admin
      .from("stall_stock_locations")
      .select("id")
      .eq("environment_id", environmentId)
      .limit(1)
      .single();
    if (!loc) {
      return NextResponse.json({ error: "No stock location for this environment" }, { status: 404 });
    }
    for (const r of restockItems as { sku_type: "product" | "sticker"; sku_id: string; qty: number }[]) {
      const rpcName = r.sku_type === "product" ? "stall_adjust_product_stock" : "stall_adjust_sticker_stock";
      await admin.rpc(rpcName, { p_id: r.sku_id, p_delta: r.qty, p_location_id: loc.id });
      await admin.from("stall_inventory_movements").insert({
        sku_type: r.sku_type,
        sku_id: r.sku_id,
        delta: r.qty,
        reason: "return_restock",
        actor: "returns",
        environment_id: environmentId,
        location_id: loc.id,
      });
    }
  }

  const { data: ret, error } = await admin
    .from("stall_returns")
    .insert({
      environment_id: environmentId,
      original_order: originalOrderId,
      replacement_order: replacementOrderId,
      reason,
      action,
      refund_amount: refundAmount || 0,
      refund_method: refundAmount ? refundMethod || null : null,
      restocked: !!resaleable,
      note: note || null,
      approved_by: String(approvedBy).trim(),
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("stall_admin_audit").insert({
    actor: deviceId || "returns",
    action: action === "exchange" ? "exchange_created" : "return_processed",
    detail: { return_id: ret.id, original_order_id: originalOrderId, action, refund_amount: refundAmount || 0, replacement_order_id: replacementOrderId },
  });

  return NextResponse.json({ return: ret });
}

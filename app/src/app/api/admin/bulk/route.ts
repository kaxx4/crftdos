import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifySession, SESSION_COOKIE } from "@/lib/session";
import { formatReceiptNo, currentFY } from "@/lib/fy";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE.admin)?.value;
  if (!(await verifySession("admin", token))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { items, paymentMethod, note } = await req.json().catch(() => ({}));
  if (!items?.length) return NextResponse.json({ error: "items required" }, { status: 400 });

  const admin = supabaseAdmin();
  const fy = currentFY();
  // Bulk entries get their own tiny receipt block on the fly (they're rare
  // one-off admin entries, not shift-bound like till sales).
  const { data: lastBlock } = await admin
    .from("stall_receipt_blocks")
    .select("end_no")
    .eq("fy", fy)
    .order("end_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextNo = (lastBlock?.end_no || 0) + 1;
  await admin.from("stall_receipt_blocks").insert({
    device_id: "admin-bulk",
    fy,
    start_no: nextNo,
    end_no: nextNo,
    next_no: nextNo + 1,
    closed_at: new Date().toISOString(),
  });

  const subtotal = items.reduce((s: number, i: { unit_price: number; qty: number }) => s + i.unit_price * i.qty, 0);
  const costTotal = items.reduce((s: number, i: { unit_cost: number; qty: number }) => s + (i.unit_cost || 0) * i.qty, 0);

  const orderId = crypto.randomUUID();
  const { data: order, error } = await admin
    .from("stall_orders")
    .insert({
      id: orderId,
      receipt_no: formatReceiptNo(fy, nextNo),
      channel: "bulk",
      subtotal,
      total: subtotal,
      cost_total: costTotal,
      payment_method: paymentMethod || "pending",
      device_id: "admin-bulk",
      notes: note || null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const lines = items as { product_sku_id?: string; qty: number; unit_price: number; unit_cost: number }[];

  // One insert for every line, not one per line.
  const { error: itemsErr } = await admin.from("stall_order_items").insert(
    lines.map((i) => ({
      order_id: orderId,
      product_sku_id: i.product_sku_id || null,
      qty: i.qty,
      unit_price: i.unit_price,
      unit_cost: i.unit_cost || 0,
      line_total: i.unit_price * i.qty,
    }))
  );
  if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 });

  // Stock via the floor-guarded RPC. This path used to SELECT stock_qty and
  // write back a value computed in Node — a lost-update race that could
  // oversell whenever a bulk entry overlapped a till sale, and the one stock
  // write migration 001 never converted.
  const stockLines = lines.filter((i) => i.product_sku_id);
  const failed: string[] = [];
  for (const i of stockLines) {
    const { data: adjusted, error: adjErr } = await admin.rpc("stall_adjust_product_stock", {
      p_id: i.product_sku_id,
      p_delta: -i.qty,
    });
    const row = Array.isArray(adjusted) ? adjusted[0] : adjusted;
    if (adjErr || !row) failed.push(i.product_sku_id!);
  }

  if (stockLines.length) {
    await admin.from("stall_inventory_movements").insert(
      stockLines
        .filter((i) => !failed.includes(i.product_sku_id!))
        .map((i) => ({
          sku_type: "product",
          sku_id: i.product_sku_id!,
          delta: -i.qty,
          reason: "sale" as const,
          ref_order: orderId,
          actor: "admin-bulk",
        }))
    );
  }

  // Bulk entries are retrospective admin records, so an insufficient-stock
  // line is reported rather than failing the whole entry — but it is reported,
  // not swallowed, because the stock count is now knowingly out of step.
  return NextResponse.json({
    order,
    ...(failed.length ? { warning: "Some lines exceeded available stock and were not decremented", failed } : {}),
  });
}

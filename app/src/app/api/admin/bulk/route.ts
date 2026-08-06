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

  for (const i of items as { product_sku_id?: string; qty: number; unit_price: number; unit_cost: number }[]) {
    await admin.from("stall_order_items").insert({
      order_id: orderId,
      product_sku_id: i.product_sku_id || null,
      qty: i.qty,
      unit_price: i.unit_price,
      unit_cost: i.unit_cost || 0,
      line_total: i.unit_price * i.qty,
    });
    if (i.product_sku_id) {
      const { data: sku } = await admin.from("stall_product_skus").select("stock_qty").eq("id", i.product_sku_id).single();
      await admin.from("stall_product_skus").update({ stock_qty: (sku?.stock_qty ?? 0) - i.qty }).eq("id", i.product_sku_id);
      await admin.from("stall_inventory_movements").insert({
        sku_type: "product",
        sku_id: i.product_sku_id,
        delta: -i.qty,
        reason: "sale",
        ref_order: orderId,
        actor: "admin-bulk",
      });
    }
  }

  return NextResponse.json({ order });
}

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAnySession } from "@/lib/apiAuth";
import { currentFY, formatReceiptNo } from "@/lib/money";

// Bulk entries are retrospective admin records (DM sales, forgotten till
// entries) — not tied to a specific stall, same as v1: they land against the
// org's default (HQ/cloud) environment, whatever stall_orders.environment_id
// defaults to, rather than requiring the admin to pick one.
export async function POST(req: NextRequest) {
  const auth = await requireAnySession(req, ["admin"]);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { items, payment_method: paymentMethod, note } = body as {
    items?: { product_sku_id?: string | null; qty: number; unit_price: number; unit_cost: number }[];
    payment_method?: string;
    note?: string | null;
  };
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

  const subtotal = items.reduce((s, i) => s + i.unit_price * i.qty, 0);
  const costTotal = items.reduce((s, i) => s + (i.unit_cost || 0) * i.qty, 0);

  const orderId = crypto.randomUUID();
  const { data: order, error } = await admin
    .from("stall_orders")
    .insert({
      id: orderId,
      receipt_no: formatReceiptNo("HQ", fy, nextNo),
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

  const { error: itemsErr } = await admin.from("stall_order_items").insert(
    items.map((i) => ({
      order_id: orderId,
      product_sku_id: i.product_sku_id || null,
      qty: i.qty,
      unit_price: i.unit_price,
      unit_cost: i.unit_cost || 0,
      line_total: i.unit_price * i.qty,
    }))
  );
  if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 });

  // Stock via the floor-guarded, location-aware RPC (migration 009) — bulk
  // entries decrement the order's own environment allocation, same as the
  // main charge path.
  const stockLines = items.filter((i) => i.product_sku_id);
  const failed: string[] = [];
  if (stockLines.length) {
    const { data: loc } = await admin
      .from("stall_stock_locations")
      .select("id")
      .eq("environment_id", order.environment_id)
      .limit(1)
      .single();

    for (const i of stockLines) {
      if (!loc) {
        failed.push(i.product_sku_id!);
        continue;
      }
      const { data: adjusted } = await admin.rpc("stall_adjust_product_stock", {
        p_id: i.product_sku_id,
        p_delta: -i.qty,
        p_location_id: loc.id,
      });
      const row = Array.isArray(adjusted) ? adjusted[0] : adjusted;
      if (!row) failed.push(i.product_sku_id!);
    }

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
          environment_id: order.environment_id,
          location_id: loc?.id,
        }))
    );
  }

  // Bulk entries are retrospective admin records, so an insufficient-stock
  // line is reported rather than failing the whole entry — but it is
  // reported, not swallowed, because the stock count is now knowingly out
  // of step.
  return NextResponse.json({
    order,
    ...(failed.length ? { warning: "Some lines exceeded available stock and were not decremented", failed } : {}),
  });
}

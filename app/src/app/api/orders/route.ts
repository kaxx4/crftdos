import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifySession, SESSION_COOKIE } from "@/lib/session";
import { formatReceiptNo } from "@/lib/fy";

type CartSticker = {
  sticker_design_id?: string;
  custom_sticker_id?: string;
  size_class?: "S" | "M" | "L";
  description?: string;
  unit_price: number;
  unit_cost: number;
};

type CartLine = {
  product_sku_id?: string | null;
  qty: number;
  unit_price: number;
  unit_cost: number;
  stickers?: CartSticker[];
};

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE.stall)?.value;
  const session = await verifySession("stall", token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "Missing client order id" }, { status: 400 });

  const admin = supabaseAdmin();

  // Idempotency: if this client UUID already landed (e.g. retried after an
  // offline sync), return the existing order instead of double-charging.
  const { data: existing } = await admin
    .from("stall_orders")
    .select("*")
    .eq("id", body.id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ order: existing, alreadyExisted: true });
  }

  const {
    shiftId,
    deviceId,
    items,
    subtotal,
    discountAmount,
    discountReason,
    discountNote,
    total,
    costTotal,
    manualOverride,
    paymentMethod,
    paidCash,
    paidUpi,
    paymentRef,
    designTicket,
    customer,
    clientCreatedAt,
    soldBy,
    fulfillmentStatus,
    promisedDate,
  } = body as {
    shiftId: string;
    deviceId: string;
    items: CartLine[];
    subtotal: number;
    discountAmount: number;
    discountReason?: string;
    discountNote?: string;
    total: number;
    costTotal: number;
    manualOverride?: boolean;
    paymentMethod: "upi" | "cash" | "split" | "pending";
    paidCash?: number;
    paidUpi?: number;
    paymentRef?: string;
    designTicket?: string;
    customer?: { name?: string; phone?: string; email?: string; consent_marketing?: boolean };
    clientCreatedAt?: string;
    soldBy?: string;
    fulfillmentStatus?: string;
    promisedDate?: string;
  };

  if (!shiftId || !items?.length || !paymentMethod) {
    return NextResponse.json({ error: "Missing required order fields" }, { status: 400 });
  }

  // Consume a receipt number from this device's open block.
  const { data: block } = await admin
    .from("stall_receipt_blocks")
    .select("*")
    .eq("shift_id", shiftId)
    .eq("device_id", deviceId)
    .is("closed_at", null)
    .maybeSingle();

  if (!block || block.next_no > block.end_no) {
    return NextResponse.json(
      { error: "No receipt numbers left on this device's block. Reopen shift on this device." },
      { status: 409 }
    );
  }

  const receiptNo = formatReceiptNo(block.fy, block.next_no);
  await admin
    .from("stall_receipt_blocks")
    .update({ next_no: block.next_no + 1 })
    .eq("id", block.id);

  let customerId: string | null = null;
  if (customer?.phone || customer?.name || customer?.email) {
    const { data: cust } = await admin
      .from("stall_customers")
      .insert({
        name: customer.name || null,
        phone_e164: customer.phone || null,
        email: customer.email || null,
        consent_marketing: !!customer.consent_marketing,
      })
      .select()
      .single();
    customerId = cust?.id ?? null;
  }

  const { data: order, error: orderErr } = await admin
    .from("stall_orders")
    .insert({
      id: body.id,
      receipt_no: receiptNo,
      shift_id: shiftId,
      channel: "stall",
      design_ticket: designTicket || null,
      sold_by: soldBy || null,
      customer_id: customerId,
      subtotal,
      discount_amount: discountAmount || 0,
      discount_reason: discountReason || null,
      discount_note: discountNote || null,
      total,
      cost_total: costTotal || 0,
      manual_override: !!manualOverride,
      payment_method: paymentMethod,
      paid_cash: paidCash || 0,
      paid_upi: paidUpi || 0,
      payment_ref: paymentRef || null,
      fulfillment_status: fulfillmentStatus || "handed_over",
      promised_date: promisedDate || null,
      device_id: deviceId,
      client_created_at: clientCreatedAt || null,
    })
    .select()
    .single();

  if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 500 });

  if (designTicket) {
    const { data: ticketRow } = await admin
      .from("stall_design_tickets")
      .select("id, payload")
      .eq("code", designTicket)
      .eq("status", "open")
      .maybeSingle();
    if (ticketRow) {
      await admin
        .from("stall_design_tickets")
        .update({ status: "redeemed", order_id: order.id })
        .eq("id", ticketRow.id);
      // Real stock now decrements below, so release the kiosk's soft-hold
      // session reservations for this ticket's stickers.
      const payload = ticketRow.payload as { garments?: { stickers?: { hold_id?: string }[] }[] };
      const holdIds = (payload.garments || []).flatMap((g) => (g.stickers || []).map((s) => s.hold_id)).filter(Boolean);
      if (holdIds.length) {
        await admin
          .from("stall_holds")
          .update({ released_at: new Date().toISOString() })
          .in("id", holdIds as string[]);
      }
    }
  }

  for (const line of items) {
    const lineTotal = line.unit_price * line.qty;
    const { data: item, error: itemErr } = await admin
      .from("stall_order_items")
      .insert({
        order_id: order.id,
        product_sku_id: line.product_sku_id || null,
        qty: line.qty,
        unit_price: line.unit_price,
        unit_cost: line.unit_cost,
        line_total: lineTotal,
      })
      .select()
      .single();
    if (itemErr) continue;

    if (line.product_sku_id) {
      const { data: sku } = await admin
        .from("stall_product_skus")
        .select("stock_qty")
        .eq("id", line.product_sku_id)
        .single();
      await admin
        .from("stall_product_skus")
        .update({ stock_qty: (sku?.stock_qty ?? 0) - line.qty })
        .eq("id", line.product_sku_id);
      await admin.from("stall_inventory_movements").insert({
        sku_type: "product",
        sku_id: line.product_sku_id,
        delta: -line.qty,
        reason: "sale",
        ref_order: order.id,
        actor: deviceId,
      });
    }

    for (const st of line.stickers || []) {
      let customStickerId = st.custom_sticker_id || null;
      if (!st.sticker_design_id && st.description) {
        const { data: seq } = await admin.rpc("stall_next_custom_sticker_no");
        const code = seq ? `C-${String(seq).padStart(4, "0")}` : `C-${Date.now()}`;
        const { data: custom } = await admin
          .from("stall_custom_stickers")
          .insert({
            code,
            size_class: st.size_class || "M",
            description: st.description,
            unit_price: st.unit_price,
            order_id: order.id,
          })
          .select()
          .single();
        customStickerId = custom?.id ?? null;
      }

      await admin.from("stall_order_item_stickers").insert({
        order_item_id: item.id,
        sticker_design_id: st.sticker_design_id || null,
        custom_sticker_id: customStickerId,
        unit_price: st.unit_price,
        unit_cost: st.unit_cost,
      });

      if (st.sticker_design_id) {
        const { data: design } = await admin
          .from("stall_sticker_designs")
          .select("stock_qty")
          .eq("id", st.sticker_design_id)
          .single();
        await admin
          .from("stall_sticker_designs")
          .update({ stock_qty: (design?.stock_qty ?? 0) - 1 })
          .eq("id", st.sticker_design_id);
        await admin.from("stall_inventory_movements").insert({
          sku_type: "sticker",
          sku_id: st.sticker_design_id,
          delta: -1,
          reason: "sale",
          ref_order: order.id,
          actor: deviceId,
        });
      }
    }
  }

  return NextResponse.json({ order });
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE.stall)?.value;
  const session = await verifySession("stall", token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const shiftId = req.nextUrl.searchParams.get("shiftId");
  const admin = supabaseAdmin();
  let q = admin.from("stall_orders").select("*, stall_order_items(*, stall_order_item_stickers(*))").order("created_at", { ascending: false });
  if (shiftId) q = q.eq("shift_id", shiftId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ orders: data });
}

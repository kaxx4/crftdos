import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifySession, SESSION_COOKIE } from "@/lib/session";

async function requireStall(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE.stall)?.value;
  return verifySession("stall", token);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // action=release | convert
  if (!(await requireStall(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const admin = supabaseAdmin();

  const { data: hold } = await admin.from("stall_holds").select("*").eq("id", id).single();
  if (!hold) return NextResponse.json({ error: "Hold not found" }, { status: 404 });

  if (body.action === "release") {
    await admin.from("stall_holds").update({ released_at: new Date().toISOString() }).eq("id", id);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "convert") {
    // Convert-to-sale: create a real charged order for exactly this held unit,
    // release the hold, decrement real stock (handled by /api/orders' normal path).
    const skuType = hold.product_sku_id ? "product" : "sticker";
    const skuId = hold.product_sku_id || hold.sticker_id;
    const table = skuType === "product" ? "stall_product_skus" : "stall_sticker_designs";
    const { data: item } = await admin.from(table).select("*").eq("id", skuId).single();
    if (!item) return NextResponse.json({ error: "Underlying SKU not found" }, { status: 404 });

    const orderId = crypto.randomUUID();
    const items =
      skuType === "product"
        ? [{ product_sku_id: skuId, qty: hold.qty, unit_price: item.unit_price, unit_cost: item.unit_cost, stickers: [] }]
        : [
            {
              product_sku_id: null,
              qty: 1,
              unit_price: item.unit_price,
              unit_cost: item.unit_cost,
              stickers: [{ sticker_design_id: skuId, unit_price: item.unit_price, unit_cost: item.unit_cost }],
            },
          ];
    const total = item.unit_price * hold.qty;

    const orderRes = await fetch(new URL("/api/orders", req.url), {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: req.headers.get("cookie") || "" },
      body: JSON.stringify({
        id: orderId,
        shiftId: body.shiftId || hold.shift_id,
        deviceId: body.deviceId || "holds-convert",
        items,
        subtotal: total,
        discountAmount: 0,
        total,
        costTotal: item.unit_cost * hold.qty,
        paymentMethod: body.paymentMethod || "cash",
        paidCash: body.paymentMethod === "upi" ? 0 : total,
        paidUpi: body.paymentMethod === "upi" ? total : 0,
        clientCreatedAt: new Date().toISOString(),
      }),
    });
    if (!orderRes.ok) {
      const j = await orderRes.json().catch(() => ({}));
      return NextResponse.json({ error: j.error || "Could not create order" }, { status: 500 });
    }
    const orderJson = await orderRes.json();

    await admin
      .from("stall_holds")
      .update({ converted_order: orderJson.order.id, released_at: new Date().toISOString() })
      .eq("id", id);

    return NextResponse.json({ order: orderJson.order });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

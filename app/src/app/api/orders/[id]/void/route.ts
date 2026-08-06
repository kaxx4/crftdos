import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifySession, SESSION_COOKIE } from "@/lib/session";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.cookies.get(SESSION_COOKIE.stall)?.value;
  const session = await verifySession("stall", token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const admin = supabaseAdmin();
  const { data: order } = await admin.from("stall_orders").select("*").eq("id", id).single();
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.voided_at) return NextResponse.json({ error: "Already void" }, { status: 400 });

  // Restock what this order consumed.
  const { data: items } = await admin
    .from("stall_order_items")
    .select("*, stall_order_item_stickers(*)")
    .eq("order_id", id);

  for (const item of items || []) {
    if (item.product_sku_id) {
      const { data: sku } = await admin
        .from("stall_product_skus")
        .select("stock_qty")
        .eq("id", item.product_sku_id)
        .single();
      await admin
        .from("stall_product_skus")
        .update({ stock_qty: (sku?.stock_qty ?? 0) + item.qty })
        .eq("id", item.product_sku_id);
      await admin.from("stall_inventory_movements").insert({
        sku_type: "product",
        sku_id: item.product_sku_id,
        delta: item.qty,
        reason: "void",
        ref_order: id,
        actor: body.actor || "volunteer",
      });
    }
    for (const st of item.stall_order_item_stickers || []) {
      if (st.sticker_design_id) {
        const { data: design } = await admin
          .from("stall_sticker_designs")
          .select("stock_qty")
          .eq("id", st.sticker_design_id)
          .single();
        await admin
          .from("stall_sticker_designs")
          .update({ stock_qty: (design?.stock_qty ?? 0) + 1 })
          .eq("id", st.sticker_design_id);
        await admin.from("stall_inventory_movements").insert({
          sku_type: "sticker",
          sku_id: st.sticker_design_id,
          delta: 1,
          reason: "void",
          ref_order: id,
          actor: body.actor || "volunteer",
        });
      }
    }
  }

  const { data: updated, error } = await admin
    .from("stall_orders")
    .update({
      voided_at: new Date().toISOString(),
      voided_by: body.actor || "volunteer",
      void_reason: body.reason || null,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ order: updated });
}

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifySession, SESSION_COOKIE } from "@/lib/session";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE.admin)?.value;
  if (!(await verifySession("admin", token))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: orders } = await admin
    .from("stall_orders")
    .select("total, cost_total, discount_amount, voided_at");

  const live = (orders || []).filter((o) => !o.voided_at);
  const gross = live.reduce((s, o) => s + Number(o.total), 0);
  const cogs = live.reduce((s, o) => s + Number(o.cost_total), 0);
  const discounts = live.reduce((s, o) => s + Number(o.discount_amount), 0);
  const raisedForAquaterra = gross - cogs;

  const { data: waste } = await admin.from("stall_waste_log").select("sticker_qty, product_qty, sticker_id, product_sku_id");
  const { data: designs } = await admin.from("stall_sticker_designs").select("id, unit_cost");
  const { data: skus } = await admin.from("stall_product_skus").select("id, unit_cost");

  const designCostById = new Map((designs || []).map((d) => [d.id, Number(d.unit_cost)]));
  const skuCostById = new Map((skus || []).map((s) => [s.id, Number(s.unit_cost)]));

  const wasteCost = (waste || []).reduce((s, w) => {
    const dCost = w.sticker_id ? designCostById.get(w.sticker_id) : undefined;
    const pCost = w.product_sku_id ? skuCostById.get(w.product_sku_id) : undefined;
    return s + (dCost !== undefined ? dCost * w.sticker_qty : 0) + (pCost !== undefined ? pCost * w.product_qty : 0);
  }, 0);

  const { data: returns } = await admin.from("stall_returns").select("id, action, reason");

  return NextResponse.json({
    gross,
    cogs,
    discounts,
    raisedForAquaterra,
    orderCount: live.length,
    wasteCount: (waste || []).length,
    wasteCost,
    returnCount: (returns || []).length,
    returnRate: live.length ? ((returns || []).length / live.length) * 100 : 0,
  });
}

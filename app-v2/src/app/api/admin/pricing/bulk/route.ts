import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

// Bulk price set across every SKU of one fit (e.g. "all crop tees are now
// ₹399"). Same snapshot-at-sale-time rule as the single-SKU edit.
export async function PATCH(req: NextRequest) {

  const body = await req.json().catch(() => ({}));
  const { fit_name: fitName, unit_price: unitPrice, unit_cost: unitCost } = body;
  if (!fitName) return NextResponse.json({ error: "fit_name required" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: fit } = await admin.from("stall_fits").select("id").eq("name", fitName).single();
  if (!fit) return NextResponse.json({ error: "Fit not found" }, { status: 404 });

  const patch: Record<string, number> = {};
  if (typeof unitPrice === "number") patch.unit_price = unitPrice;
  if (typeof unitCost === "number") patch.unit_cost = unitCost;

  const { error } = await admin.from("stall_product_skus").update(patch).eq("fit_id", fit.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("stall_admin_audit").insert({ actor: "admin", action: "bulk_price_set", detail: { fitName, ...patch } });
  return NextResponse.json({ ok: true });
}

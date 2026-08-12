import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAnySession } from "@/lib/apiAuth";

// Prices SNAPSHOT onto order lines at sale time (see /api/orders) — editing
// here never rewrites history, only what future sales charge. Reads for the
// pricing editor go through the existing /api/catalogue; this is writes only.
export async function PATCH(req: NextRequest) {
  const auth = await requireAnySession(req, ["admin"]);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { type, id, unit_price: unitPrice, unit_cost: unitCost } = body;
  if (!type || !id) return NextResponse.json({ error: "type and id required" }, { status: 400 });

  const admin = supabaseAdmin();
  const table = type === "product" ? "stall_product_skus" : "stall_sticker_designs";
  const patch: Record<string, number> = {};
  if (typeof unitPrice === "number") patch.unit_price = unitPrice;
  if (typeof unitCost === "number") patch.unit_cost = unitCost;

  const { data, error } = await admin.from(table).update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("stall_admin_audit").insert({ actor: "admin", action: "price_edit", detail: { type, id, patch } });
  return NextResponse.json({ row: data });
}

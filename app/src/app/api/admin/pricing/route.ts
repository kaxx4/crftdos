import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifySession, SESSION_COOKIE } from "@/lib/session";

async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE.admin)?.value;
  return verifySession("admin", token);
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = supabaseAdmin();
  const [skus, designs, colors, fits] = await Promise.all([
    admin.from("stall_product_skus").select("*").order("sku_code"),
    admin.from("stall_sticker_designs").select("*").order("code"),
    admin.from("stall_colors").select("*"),
    admin.from("stall_fits").select("*"),
  ]);
  return NextResponse.json({
    skus: skus.data,
    designs: designs.data,
    colors: colors.data,
    fits: fits.data,
  });
}

// Prices SNAPSHOT onto order lines at sale time (see /api/orders) — editing
// here never rewrites history, only what future sales charge.
export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { type, id, unit_price, unit_cost, bulk } = body;
  const admin = supabaseAdmin();

  if (bulk) {
    // e.g. { bulk: { type: 'product', fitName: 'crop', unit_price: 399 } }
    const { fitName, ...rest } = bulk;
    if (fitName) {
      const { data: fit } = await admin.from("stall_fits").select("id").eq("name", fitName).single();
      if (fit) {
        await admin.from("stall_product_skus").update(rest).eq("fit_id", fit.id);
      }
    }
    await admin.from("stall_admin_audit").insert({ actor: "admin", action: "bulk_price_set", detail: bulk });
    return NextResponse.json({ ok: true });
  }

  if (!type || !id) return NextResponse.json({ error: "type and id required" }, { status: 400 });
  const table = type === "product" ? "stall_product_skus" : "stall_sticker_designs";
  const patch: Record<string, number> = {};
  if (typeof unit_price === "number") patch.unit_price = unit_price;
  if (typeof unit_cost === "number") patch.unit_cost = unit_cost;
  const { data, error } = await admin.from(table).update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await admin.from("stall_admin_audit").insert({ actor: "admin", action: "price_edit", detail: { type, id, patch } });
  return NextResponse.json({ row: data });
}

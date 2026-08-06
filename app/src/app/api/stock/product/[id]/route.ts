import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifySession, SESSION_COOKIE } from "@/lib/session";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.cookies.get(SESSION_COOKIE.stall)?.value;
  const session = await verifySession("stall", token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { stock_qty } = await req.json().catch(() => ({}));
  if (typeof stock_qty !== "number") return NextResponse.json({ error: "stock_qty required" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: before } = await admin.from("stall_product_skus").select("stock_qty").eq("id", id).single();
  const { data, error } = await admin
    .from("stall_product_skus")
    .update({ stock_qty })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("stall_inventory_movements").insert({
    sku_type: "product",
    sku_id: id,
    delta: stock_qty - (before?.stock_qty ?? 0),
    reason: "correction",
    actor: "volunteer",
    note: "Manual stock edit via /stock/products",
  });

  return NextResponse.json({ sku: data });
}

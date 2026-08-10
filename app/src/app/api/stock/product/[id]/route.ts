import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifySession, SESSION_COOKIE } from "@/lib/session";

// Any single manual edit at or past this magnitude writes to
// stall_admin_audit, not just stall_inventory_movements.
const STOCK_AUDIT_THRESHOLD = 10;

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

  const delta = stock_qty - (before?.stock_qty ?? 0);
  await admin.from("stall_inventory_movements").insert({
    sku_type: "product",
    sku_id: id,
    delta,
    reason: "correction",
    actor: "volunteer",
    note: "Manual stock edit via /stock/products",
  });
  // PRD §12: "stock adjustments above a threshold" is one of four action
  // types that must write to admin_audit — previously only price changes
  // and discount overrides did.
  if (Math.abs(delta) >= STOCK_AUDIT_THRESHOLD) {
    await admin.from("stall_admin_audit").insert({
      actor: "volunteer",
      action: "stock_adjustment",
      detail: { type: "product", id, delta, before: before?.stock_qty ?? null, after: stock_qty },
    });
  }

  return NextResponse.json({ sku: data });
}

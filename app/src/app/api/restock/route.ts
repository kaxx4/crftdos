import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifySession, SESSION_COOKIE } from "@/lib/session";

async function requireStall(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE.stall)?.value;
  return verifySession("stall", token);
}

export async function GET(req: NextRequest) {
  if (!(await requireStall(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = supabaseAdmin();

  // Below-par and dead-stock are computed in Postgres and only the answer
  // crosses the wire. This route used to SELECT every row of
  // stall_order_items and stall_order_item_stickers purely to build two id
  // sets in JavaScript, so its payload grew with lifetime sales forever —
  // fine at one test order, ruinous after a season of stalls.
  const { data, error } = await admin.rpc("stall_restock_signals");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const signals = data as {
    belowPar: { type: string; id: string; code: string; stock: number; par: number }[];
    deadStock: { type: string; id: string; code: string; stock: number }[];
  };
  return NextResponse.json({ belowPar: signals.belowPar, deadStock: signals.deadStock });
}

export async function POST(req: NextRequest) {
  if (!(await requireStall(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { type, id, qty } = await req.json().catch(() => ({}));
  if (!type || !id || !qty) return NextResponse.json({ error: "type, id, qty required" }, { status: 400 });
  const admin = supabaseAdmin();
  const rpcName = type === "product" ? "stall_adjust_product_stock" : "stall_adjust_sticker_stock";
  const { data: updatedRows, error } = await admin.rpc(rpcName, { p_id: id, p_delta: Number(qty) });
  const updated = Array.isArray(updatedRows) ? updatedRows[0] : updatedRows;
  if (error || !updated) {
    return NextResponse.json({ error: error?.message || "Restock update failed" }, { status: 500 });
  }
  await admin.from("stall_inventory_movements").insert({
    sku_type: type,
    sku_id: id,
    delta: Number(qty),
    reason: "restock",
    actor: "volunteer",
  });
  return NextResponse.json({ row: updated });
}

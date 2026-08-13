import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { pgErrorCode } from "@/lib/apiAuth";

const RPC_ERROR_STATUS: Record<string, number> = {
  P0106: 409, // insufficient stock at source
};

export async function POST(req: NextRequest) {

  const body = await req.json().catch(() => ({}));
  const { from_location_id, to_location_id, sku_type, sku_id, qty, actor } = body as {
    from_location_id?: string;
    to_location_id?: string;
    sku_type?: string;
    sku_id?: string;
    qty?: number;
    actor?: string;
  };

  if (!from_location_id || !to_location_id || !sku_type || !sku_id || !qty || qty <= 0) {
    return NextResponse.json({ error: "from_location_id, to_location_id, sku_type, sku_id and a positive qty are required" }, { status: 400 });
  }
  if (from_location_id === to_location_id) {
    return NextResponse.json({ error: "Pick two different locations." }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { error } = await admin.rpc("stall_transfer_stock", {
    p_from: from_location_id,
    p_to: to_location_id,
    p_sku_type: sku_type,
    p_sku_id: sku_id,
    p_qty: qty,
    p_actor: actor ?? null,
  });

  if (error) {
    const code = pgErrorCode(error);
    const status = RPC_ERROR_STATUS[code ?? ""] ?? 500;
    return NextResponse.json({ error: status === 500 ? "Transfer failed" : error.message, code }, { status });
  }

  const [{ data: from }, { data: to }] = await Promise.all([
    admin.from("stall_stock").select("*").eq("location_id", from_location_id).eq("sku_type", sku_type).eq("sku_id", sku_id).single(),
    admin.from("stall_stock").select("*").eq("location_id", to_location_id).eq("sku_type", sku_type).eq("sku_id", sku_id).single(),
  ]);

  // Not hold-netted — this response confirms the physical move, same as the
  // mock's equivalent. Callers re-fetch getStock for a netted display.
  return NextResponse.json({
    from: from ? { ...from, available_qty: from.qty } : from,
    to: to ? { ...to, available_qty: to.qty } : to,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifySession, SESSION_COOKIE } from "@/lib/session";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE.stall)?.value;
  if (!(await verifySession("stall", token))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const shiftId = req.nextUrl.searchParams.get("shiftId");
  if (!shiftId) return NextResponse.json({ error: "shiftId required" }, { status: 400 });
  const admin = supabaseAdmin();

  const { data: shift } = await admin.from("stall_shifts").select("*").eq("id", shiftId).single();
  const { data: orders } = await admin
    .from("stall_orders")
    .select("*, stall_order_items(*, stall_order_item_stickers(*))")
    .eq("shift_id", shiftId)
    .is("voided_at", null);

  const gross = (orders || []).reduce((s, o) => s + Number(o.total), 0);
  const discounts = (orders || []).reduce((s, o) => s + Number(o.discount_amount), 0);
  const cost = (orders || []).reduce((s, o) => s + Number(o.cost_total), 0);
  const net = gross - cost;
  const unitsSold = (orders || []).reduce((s, o) => s + (o.stall_order_items?.length || 0), 0);

  const designCounts = new Map<string, number>();
  for (const o of orders || []) {
    for (const item of o.stall_order_items || []) {
      for (const st of item.stall_order_item_stickers || []) {
        if (st.sticker_design_id) designCounts.set(st.sticker_design_id, (designCounts.get(st.sticker_design_id) || 0) + 1);
      }
    }
  }
  const topDesignIds = [...designCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const { data: designs } = topDesignIds.length
    ? await admin
        .from("stall_sticker_designs")
        .select("id, code")
        .in("id", topDesignIds.map(([id]) => id))
    : { data: [] as { id: string; code: string }[] };
  const topDesigns = topDesignIds.map(([id, count]) => ({
    code: designs?.find((d) => d.id === id)?.code || id,
    count,
  }));

  return NextResponse.json({
    shift,
    gross,
    discounts,
    net,
    raisedForAquaterra: net,
    unitsSold,
    topDesigns,
    cashVariance: shift?.variance ?? null,
  });
}

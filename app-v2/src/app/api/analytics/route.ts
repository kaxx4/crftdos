import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAnySession } from "@/lib/apiAuth";

// `stall_analytics_summary(p_from, p_to)` is not environment-aware (checked
// live against pg_proc — no p_environment_id parameter exists). Rather than
// bolt an environment filter onto a jsonb-returning RPC we don't own, this
// route computes the summary directly against stall_orders/items so the
// environment_id filter is honoured uniformly whether or not it's passed.
export async function GET(req: NextRequest) {
  const auth = await requireAnySession(req, ["stall", "admin"]);
  if (!auth.ok) return auth.response;

  const environmentId = req.nextUrl.searchParams.get("environment_id");
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");

  const admin = supabaseAdmin();
  let q = admin
    .from("stall_orders")
    .select(
      `id, environment_id, total, discount_amount, cost_total, client_created_at,
       environment:stall_environments(id, name),
       items:stall_order_items(id,
         stickers:stall_order_item_stickers(unit_price, unit_cost,
           design:stall_sticker_designs(code, name)))`
    )
    .is("voided_at", null);
  if (environmentId) q = q.eq("environment_id", environmentId);
  // Report on client_created_at, not created_at — they differ by hours on an
  // offline sale, and the volunteer charged at the former.
  if (from) q = q.gte("client_created_at", from);
  if (to) q = q.lte("client_created_at", to);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Row = {
    id: string;
    environment_id: string;
    total: number;
    discount_amount: number;
    cost_total: number;
    environment: { id: string; name: string } | { id: string; name: string }[] | null;
    items: { stickers: { unit_price: number; unit_cost: number; design: { code: string; name: string } | { code: string; name: string }[] | null }[] }[];
  };
  const rows = (data ?? []) as unknown as Row[];
  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

  const gross = rows.reduce((n, o) => n + Number(o.total), 0);
  const discounts = rows.reduce((n, o) => n + Number(o.discount_amount), 0);
  const cogs = rows.reduce((n, o) => n + Number(o.cost_total), 0);
  const units = rows.reduce((n, o) => n + o.items.length, 0);

  const byEnvMap = new Map<string, { environment_id: string; name: string; gross: number; raised: number; orders: number }>();
  for (const o of rows) {
    const env = one(o.environment);
    const key = o.environment_id;
    const cur = byEnvMap.get(key) ?? { environment_id: key, name: env?.name ?? "Unknown", gross: 0, raised: 0, orders: 0 };
    cur.gross += Number(o.total);
    cur.raised += Number(o.total) - Number(o.cost_total);
    cur.orders += 1;
    byEnvMap.set(key, cur);
  }

  const tally = new Map<string, { name: string; units: number }>();
  for (const o of rows) {
    for (const item of o.items) {
      for (const st of item.stickers) {
        const design = one(st.design);
        if (!design) continue;
        const cur = tally.get(design.code) ?? { name: design.name, units: 0 };
        cur.units += 1;
        tally.set(design.code, cur);
      }
    }
  }

  return NextResponse.json({
    gross,
    discounts,
    cogs,
    raisedForAquaterra: gross - cogs,
    orders: rows.length,
    units,
    byEnvironment: [...byEnvMap.values()],
    topDesigns: [...tally.entries()]
      .sort((a, b) => b[1].units - a[1].units)
      .slice(0, 5)
      .map(([code, v]) => ({ code, name: v.name, units: v.units })),
  });
}

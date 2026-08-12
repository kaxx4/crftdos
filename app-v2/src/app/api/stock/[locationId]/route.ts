import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAnySession } from "@/lib/apiAuth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ locationId: string }> }) {
  const auth = await requireAnySession(req, ["stall", "admin"]);
  if (!auth.ok) return auth.response;

  const { locationId } = await params;
  const admin = supabaseAdmin();
  const { data, error } = await admin.from("stall_stock").select("*").eq("location_id", locationId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // available_qty nets active named holds — qty alone overstates what's
  // actually sellable, the same gap the kiosk's getKioskCatalogue already
  // closes for stickers via its own environment-scoped query.
  const { data: loc } = await admin.from("stall_stock_locations").select("environment_id").eq("id", locationId).single();
  let held = new Map<string, number>();
  if (loc?.environment_id) {
    const { data: holds } = await admin
      .from("stall_holds")
      .select("product_sku_id, sticker_id, qty, expires_at")
      .eq("environment_id", loc.environment_id)
      .is("released_at", null)
      .is("converted_order", null);
    const now = Date.now();
    held = new Map();
    for (const h of holds ?? []) {
      if (new Date(h.expires_at).getTime() <= now) continue;
      const skuId = h.product_sku_id ?? h.sticker_id;
      if (!skuId) continue;
      held.set(skuId, (held.get(skuId) ?? 0) + h.qty);
    }
  }

  const stock = (data ?? []).map((r) => ({ ...r, available_qty: Math.max(0, r.qty - (held.get(r.sku_id) ?? 0)) }));
  return NextResponse.json({ stock });
}

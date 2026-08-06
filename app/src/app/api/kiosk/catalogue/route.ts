import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

// Kiosk needs the service-role view because "available" stock must subtract
// active session reservations (soft-holds), which anon can't see via RLS.
export async function GET() {
  const admin = supabaseAdmin();
  const [{ data: colors }, { data: fits }, { data: skus }, { data: designs }, { data: presets }, { data: holds }] =
    await Promise.all([
      admin.from("stall_colors").select("*").eq("is_active", true).order("sort"),
      admin.from("stall_fits").select("*").eq("is_active", true).order("sort"),
      admin.from("stall_product_skus").select("*").eq("is_active", true),
      admin.from("stall_sticker_designs").select("*").eq("is_active", true).eq("kiosk_visible", true),
      admin.from("stall_presets").select("*").eq("is_active", true).order("sort"),
      admin
        .from("stall_holds")
        .select("sticker_id, qty")
        .is("released_at", null)
        .is("converted_order", null)
        .gt("expires_at", new Date().toISOString())
        .not("sticker_id", "is", null),
    ]);

  const heldBySticker = new Map<string, number>();
  for (const h of holds || []) {
    if (!h.sticker_id) continue;
    heldBySticker.set(h.sticker_id, (heldBySticker.get(h.sticker_id) || 0) + h.qty);
  }

  const availableDesigns = (designs || [])
    .map((d) => ({ ...d, available_qty: d.stock_qty - (heldBySticker.get(d.id) || 0) }))
    .filter((d) => d.available_qty > 0);

  return NextResponse.json({ colors, fits, skus, designs: availableDesigns, presets });
}

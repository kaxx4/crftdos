import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

// Public/kiosk-facing — deliberately no session gate (the kiosk root "/" is a
// public unauthenticated surface, see middleware.ts), but every field it can
// leak is already anon-readable catalogue data.
export async function GET(req: NextRequest) {
  const environmentId = req.nextUrl.searchParams.get("environmentId");
  if (!environmentId) return NextResponse.json({ error: "environmentId is required" }, { status: 400 });

  const admin = supabaseAdmin();

  const { data: avail, error: availErr } = await admin.rpc("stall_product_availability_at", {
    p_environment_id: environmentId,
  });
  if (availErr) return NextResponse.json({ error: availErr.message }, { status: 500 });

  const availableStickerIds = new Set(
    (avail ?? []).filter((r: { sku_type: string; available_qty: number }) => r.sku_type === "sticker" && r.available_qty > 0).map((r: { id: string }) => r.id)
  );
  const availableQty = new Map<string, number>(
    (avail ?? []).map((r: { id: string; available_qty: number }) => [r.id, r.available_qty])
  );

  const { data: designs, error } = await admin
    .from("stall_sticker_designs")
    .select("*")
    .eq("is_active", true)
    .eq("kiosk_visible", true)
    .not("print_w_cm", "is", null)
    .not("print_h_cm", "is", null)
    .not("cutout_path", "is", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const out = (designs ?? [])
    .filter((d) => availableStickerIds.has(d.id))
    .map((d) => ({ ...d, available_qty: availableQty.get(d.id) ?? 0 }));

  return NextResponse.json({ designs: out });
}

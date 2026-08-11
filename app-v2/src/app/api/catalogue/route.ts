import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAnySession } from "@/lib/apiAuth";

export async function GET(req: NextRequest) {
  const auth = await requireAnySession(req, ["stall", "admin", "kiosk"]);
  if (!auth.ok) return auth.response;

  const admin = supabaseAdmin();
  const [colors, fits, skus, designs] = await Promise.all([
    admin.from("stall_colors").select("*").order("sort"),
    admin.from("stall_fits").select("*").order("sort"),
    admin.from("stall_product_skus").select("*"),
    admin.from("stall_sticker_designs").select("*"),
  ]);
  for (const r of [colors, fits, skus, designs]) {
    if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 });
  }

  return NextResponse.json({
    colors: colors.data,
    fits: fits.data,
    skus: skus.data,
    designs: designs.data,
    fetchedAt: new Date().toISOString(),
  });
}

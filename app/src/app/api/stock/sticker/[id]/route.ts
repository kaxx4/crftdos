import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifySession, SESSION_COOKIE } from "@/lib/session";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.cookies.get(SESSION_COOKIE.stall)?.value;
  const session = await verifySession("stall", token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { stock_qty, bin_location } = await req.json().catch(() => ({}));

  const admin = supabaseAdmin();
  const patch: Record<string, unknown> = {};
  if (typeof stock_qty === "number") patch.stock_qty = stock_qty;
  if (typeof bin_location === "string") patch.bin_location = bin_location;

  const { data: before } = await admin.from("stall_sticker_designs").select("stock_qty").eq("id", id).single();
  const { data, error } = await admin.from("stall_sticker_designs").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (typeof stock_qty === "number") {
    await admin.from("stall_inventory_movements").insert({
      sku_type: "sticker",
      sku_id: id,
      delta: stock_qty - (before?.stock_qty ?? 0),
      reason: "correction",
      actor: "volunteer",
      note: "Manual stock edit via /stock/stickers",
    });
  }

  return NextResponse.json({ design: data });
}

export async function POST(req: NextRequest) {
  // Create a new sticker design (minimal CRUD — no image upload yet).
  const token = req.cookies.get(SESSION_COOKIE.stall)?.value;
  const session = await verifySession("stall", token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (!body.code || !body.size_class) {
    return NextResponse.json({ error: "code and size_class required" }, { status: 400 });
  }
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("stall_sticker_designs")
    .insert({
      code: body.code,
      size_class: body.size_class,
      name: body.name || null,
      bin_location: body.bin_location || null,
      stock_qty: body.stock_qty || 0,
      unit_price: body.unit_price || 0,
      unit_cost: body.unit_cost || 0,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ design: data });
}

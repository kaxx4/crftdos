import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAnySession } from "@/lib/apiAuth";
import { mapOrderRow, ORDER_SELECT, type OrderRow } from "@/lib/backend/live/orderMap";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAnySession(req, ["stall", "admin"]);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const admin = supabaseAdmin();
  const { data, error } = await admin.from("stall_orders").select(ORDER_SELECT).eq("id", id).single();
  if (error || !data) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  return NextResponse.json({ order: mapOrderRow(data as unknown as OrderRow) });
}

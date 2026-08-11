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
  return NextResponse.json({ stock: data });
}

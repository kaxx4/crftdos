import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAnySession } from "@/lib/apiAuth";

export async function GET(req: NextRequest) {
  const auth = await requireAnySession(req, ["stall", "admin", "kiosk"]);
  if (!auth.ok) return auth.response;

  const admin = supabaseAdmin();
  const { data, error } = await admin.from("stall_stock_locations").select("*");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ locations: data });
}

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifySession, SESSION_COOKIE } from "@/lib/session";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE.admin)?.value;
  if (!(await verifySession("admin", token))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Aggregated in Postgres. This route used to pull every order ever, every
  // waste row, and the whole cost side of both catalogues, then reduce in
  // Node — four full-table reads whose payload grew with lifetime sales and
  // whose work was redone on every dashboard load.
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");

  const admin = supabaseAdmin();
  const { data, error } = await admin.rpc("stall_analytics_summary", {
    p_from: from || null,
    p_to: to || null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

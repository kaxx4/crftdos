import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifySession, SESSION_COOKIE } from "@/lib/session";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE.stall)?.value;
  if (!(await verifySession("stall", token))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const receipt = req.nextUrl.searchParams.get("receipt");
  if (!receipt) return NextResponse.json({ error: "receipt query param required" }, { status: 400 });
  const admin = supabaseAdmin();
  const { data } = await admin
    .from("stall_orders")
    .select("id, receipt_no, total, created_at")
    .eq("receipt_no", receipt.trim())
    .maybeSingle();
  return NextResponse.json({ order: data || null });
}

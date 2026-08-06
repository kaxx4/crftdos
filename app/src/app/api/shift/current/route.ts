import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifySession, SESSION_COOKIE } from "@/lib/session";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE.stall)?.value;
  const session = await verifySession("stall", token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: shift } = await admin
    .from("stall_shifts")
    .select("*")
    .is("closed_at", null)
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!shift) return NextResponse.json({ shift: null, block: null });

  const deviceId = req.nextUrl.searchParams.get("deviceId") || "unknown";
  const { data: block } = await admin
    .from("stall_receipt_blocks")
    .select("*")
    .eq("shift_id", shift.id)
    .eq("device_id", deviceId)
    .is("closed_at", null)
    .order("start_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ shift, block });
}

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAnySession } from "@/lib/apiAuth";

export async function GET(req: NextRequest) {
  const auth = await requireAnySession(req, ["stall", "admin"]);
  if (!auth.ok) return auth.response;

  const environmentId = req.nextUrl.searchParams.get("environmentId");
  const deviceId = req.nextUrl.searchParams.get("deviceId");
  if (!environmentId || !deviceId) {
    return NextResponse.json({ error: "environmentId and deviceId are required" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: shift } = await admin
    .from("stall_shifts")
    .select("*")
    .eq("environment_id", environmentId)
    .is("closed_at", null)
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let block = null;
  if (shift) {
    const { data } = await admin
      .from("stall_receipt_blocks")
      .select("*")
      .eq("shift_id", shift.id)
      .eq("device_id", deviceId)
      .is("closed_at", null)
      .maybeSingle();
    block = data;
  }

  return NextResponse.json({ shift: shift ?? null, block: block ?? null });
}

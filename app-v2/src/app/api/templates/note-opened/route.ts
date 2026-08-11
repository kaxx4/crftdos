import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

// Public — a customer opening a template on the kiosk is not an authenticated
// action, and times_used is a pure counter with no sensitive read.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const id = body?.id as string | undefined;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: existing } = await admin.from("stall_templates").select("times_used").eq("id", id).maybeSingle();
  if (existing) {
    await admin.from("stall_templates").update({ times_used: (existing.times_used ?? 0) + 1 }).eq("id", id);
  }
  return NextResponse.json({ ok: true });
}

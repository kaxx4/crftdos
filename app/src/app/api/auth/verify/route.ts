import { NextRequest, NextResponse } from "next/server";
import { verify } from "@node-rs/argon2";
import { supabaseAdmin } from "@/lib/supabase/server";

// One-off PIN check used to gate a single action (e.g. >10% discount) in
// place, without granting a full admin session/route access.
export async function POST(req: NextRequest) {
  const { kind, pin } = await req.json().catch(() => ({}));
  if (!kind || !pin) return NextResponse.json({ ok: false }, { status: 400 });
  const key = kind === "admin" ? "pin_admin" : kind === "kiosk" ? "pin_kiosk" : "pin_stall";
  const admin = supabaseAdmin();
  const { data } = await admin.from("stall_settings").select("value").eq("key", key).single();
  if (!data) return NextResponse.json({ ok: false }, { status: 500 });
  const ok = await verify(data.value as string, pin).catch(() => false);
  return NextResponse.json({ ok });
}

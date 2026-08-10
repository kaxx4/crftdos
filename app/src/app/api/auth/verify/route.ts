import { NextRequest, NextResponse } from "next/server";
import { verify } from "@node-rs/argon2";
import { supabaseAdmin } from "@/lib/supabase/server";
import { checkRateLimit, recordFailure, clearRateLimit, rateLimitKey } from "@/lib/rateLimit";

// One-off PIN check used to gate a single action (e.g. >10% discount) in
// place, without granting a full admin session/route access.
//
// This route previously had NO rate limiting of any kind — not even the
// per-process limiter /api/auth/pin used. It validates the same admin PIN, so
// it was the softer of the two doors and the one worth attacking. It now
// shares the same cross-instance limiter and the same key scope, meaning
// failures here and on /api/auth/pin count against one budget.
export async function POST(req: NextRequest) {
  const { kind, pin } = await req.json().catch(() => ({}));
  if (!kind || !pin) return NextResponse.json({ ok: false }, { status: 400 });

  const rlKey = rateLimitKey(req, kind);
  const rl = await checkRateLimit(rlKey);
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: `Too many failed attempts. Try again in ${Math.ceil(rl.retryAfterSeconds / 60)} minutes.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  const key = kind === "admin" ? "pin_admin" : kind === "kiosk" ? "pin_kiosk" : "pin_stall";
  const admin = supabaseAdmin();
  const { data } = await admin.from("stall_settings").select("value").eq("key", key).single();
  if (!data) return NextResponse.json({ ok: false }, { status: 500 });

  const ok = await verify(data.value as string, pin).catch(() => false);
  if (!ok) {
    await recordFailure(rlKey);
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  await clearRateLimit(rlKey);
  return NextResponse.json({ ok: true });
}

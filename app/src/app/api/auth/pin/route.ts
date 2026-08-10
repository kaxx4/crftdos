import { NextRequest, NextResponse } from "next/server";
import { verify } from "@node-rs/argon2";
import { supabaseAdmin } from "@/lib/supabase/server";
import { signSession, SESSION_COOKIE, cookieMaxAge, SessionKind } from "@/lib/session";
import { checkRateLimit, recordFailure, clearRateLimit, rateLimitKey } from "@/lib/rateLimit";

const SETTINGS_KEY: Record<SessionKind, string> = {
  stall: "pin_stall",
  admin: "pin_admin",
  kiosk: "pin_kiosk",
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const kind = body?.kind as SessionKind;
  const pin = body?.pin as string;
  const deviceId = body?.deviceId as string | undefined;

  if (!kind || !["stall", "admin", "kiosk"].includes(kind) || !pin) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const rlKey = rateLimitKey(req, kind);
  const rl = await checkRateLimit(rlKey);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Too many failed attempts. Try again in ${Math.ceil(rl.retryAfterSeconds / 60)} minutes.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  try {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("stall_settings")
      .select("value")
      .eq("key", SETTINGS_KEY[kind])
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "PIN not configured" }, { status: 500 });
    }

    const hash = data.value as string;
    const ok = await verify(hash, pin).catch(() => false);

    if (!ok) {
      await recordFailure(rlKey);
      return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
    }

    await clearRateLimit(rlKey);
    const token = await signSession(kind, deviceId);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE[kind], token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: cookieMaxAge(kind),
    });
    return res;
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const kind = body?.kind as SessionKind;
  const res = NextResponse.json({ ok: true });
  if (kind && SESSION_COOKIE[kind]) {
    res.cookies.delete(SESSION_COOKIE[kind]);
  }
  return res;
}

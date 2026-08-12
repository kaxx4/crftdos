import { NextRequest, NextResponse } from "next/server";
import { hash, verify } from "@node-rs/argon2";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAnySession, pgErrorCode } from "@/lib/apiAuth";
import { checkRateLimit, recordFailure, clearRateLimit, rateLimitKey } from "@/lib/rateLimit";

const SETTINGS_KEY: Record<"stall" | "admin" | "kiosk", string> = {
  stall: "pin_stall",
  admin: "pin_admin",
  kiosk: "pin_kiosk",
};

// Every operation here re-verifies the caller's own admin PIN in the request
// body, not just the session cookie — a walked-away unlocked admin session
// is the realistic threat model for "change the PINs" specifically, more so
// than for an ordinary read.
async function reverifyAdmin(admin: ReturnType<typeof supabaseAdmin>, req: NextRequest, currentPin: string) {
  const rlKey = rateLimitKey(req, "admin-pin");
  const rl = await checkRateLimit(rlKey);
  if (!rl.allowed) {
    return { ok: false as const, status: 429, error: `Too many failed attempts. Try again in ${Math.ceil(rl.retryAfterSeconds / 60)} minutes.` };
  }
  const { data: row } = await admin.from("stall_settings").select("value").eq("key", "pin_admin").single();
  const ok = row ? await verify(row.value as string, currentPin).catch(() => false) : false;
  if (!ok) {
    await recordFailure(rlKey);
    return { ok: false as const, status: 401, error: "Incorrect admin PIN" };
  }
  await clearRateLimit(rlKey);
  return { ok: true as const };
}

export async function GET(req: NextRequest) {
  const auth = await requireAnySession(req, ["admin"]);
  if (!auth.ok) return auth.response;

  const admin = supabaseAdmin();
  const { data, error } = await admin.from("stall_settings").select("key, value, updated_at").in("key", Object.values(SETTINGS_KEY));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const byKey = new Map((data ?? []).map((r) => [r.key, r]));
  const out: Record<string, { configured: boolean; updated_at: string | null }> = {};
  for (const [kind, key] of Object.entries(SETTINGS_KEY)) {
    const row = byKey.get(key);
    out[kind] = { configured: !!row?.value, updated_at: row?.updated_at ?? null };
  }
  return NextResponse.json(out);
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAnySession(req, ["admin"]);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { kind, current_pin: currentPin, new_pin: newPin } = body as { kind?: string; current_pin?: string; new_pin?: string };

  if (!kind || !(kind in SETTINGS_KEY)) return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  if (!currentPin) return NextResponse.json({ error: "Your current admin PIN is required" }, { status: 400 });
  if (!newPin || !/^\d{4,8}$/.test(newPin)) {
    return NextResponse.json({ error: "New PIN must be 4-8 digits" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const check = await reverifyAdmin(admin, req, currentPin);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const newHash = await hash(newPin);
  const { error } = await admin
    .from("stall_settings")
    .update({ value: newHash, updated_at: new Date().toISOString() })
    .eq("key", SETTINGS_KEY[kind as keyof typeof SETTINGS_KEY]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAnySession(req, ["admin"]);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { kind, current_pin: currentPin } = body as { kind?: string; current_pin?: string };

  if (!kind || !(kind in SETTINGS_KEY)) return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  // Deleting the admin PIN would lock every admin — including whoever's
  // doing this — out of the console with no recovery path short of direct
  // database access. Not allowed from the app itself.
  if (kind === "admin") {
    return NextResponse.json({ error: "The admin PIN can't be deleted from here — it would lock out the console." }, { status: 400 });
  }
  if (!currentPin) return NextResponse.json({ error: "Your current admin PIN is required" }, { status: 400 });

  const admin = supabaseAdmin();
  const check = await reverifyAdmin(admin, req, currentPin);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const { error } = await admin
    .from("stall_settings")
    .update({ value: null, updated_at: new Date().toISOString() })
    .eq("key", SETTINGS_KEY[kind as keyof typeof SETTINGS_KEY]);
  if (error) return NextResponse.json({ error: pgErrorCode(error) ?? error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

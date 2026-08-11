import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAnySession } from "@/lib/apiAuth";

const PUBLIC_KEYS = new Set(["upi_vpa", "upi_payee_name"]);

export async function GET(req: NextRequest) {
  // The kiosk needs upi_vpa/upi_payee_name to build a payment link with no
  // session of its own. Everything else requires stall/admin.
  const admin = supabaseAdmin();
  const { data, error } = await admin.from("stall_settings").select("key, value");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const auth = await requireAnySession(req, ["stall", "admin", "kiosk"]);
  const rows = auth.ok ? (data ?? []) : (data ?? []).filter((r) => PUBLIC_KEYS.has(r.key));

  const out: Record<string, unknown> = {};
  for (const r of rows) out[r.key] = r.value;
  return NextResponse.json(out);
}

export async function POST(req: NextRequest) {
  const auth = await requireAnySession(req, ["admin"]);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { key, value } = body as { key?: string; value?: unknown };
  if (!key) return NextResponse.json({ error: "key is required" }, { status: 400 });

  const admin = supabaseAdmin();
  const { error } = await admin
    .from("stall_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

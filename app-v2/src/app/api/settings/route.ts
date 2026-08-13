import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET() {
  const admin = supabaseAdmin();
  const { data, error } = await admin.from("stall_settings").select("key, value");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const out: Record<string, unknown> = {};
  for (const r of data ?? []) out[r.key] = r.value;
  return NextResponse.json(out);
}

export async function POST(req: NextRequest) {

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

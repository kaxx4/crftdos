import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAnySession } from "@/lib/apiAuth";

// Intentionally public, no session required. A device that has never been
// through Settings (including a fresh, unauthenticated kiosk) still has to
// list environments to bind to one — that's the entire point of migration
// 004.4's anon SELECT policy on stall_environments. Listing leaks only names
// and prefixes, which the migration's RLS comment calls out as acceptable.
export async function GET(_req: NextRequest) {
  const admin = supabaseAdmin();
  const { data, error } = await admin.from("stall_environments").select("*").order("opened_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ environments: data });
}

export async function POST(req: NextRequest) {
  const auth = await requireAnySession(req, ["admin"]);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { name, prefix, kind } = body as { name?: string; prefix?: string; kind?: string };
  if (!name || !prefix || !kind) {
    return NextResponse.json({ error: "name, prefix and kind are required" }, { status: 400 });
  }
  const normalizedPrefix = String(prefix).trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9]{1,5}$/.test(normalizedPrefix)) {
    return NextResponse.json({ error: "A prefix is 2-6 characters, starting with a letter. Example: SA" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: env, error } = await admin
    .from("stall_environments")
    .insert({ name, prefix: normalizedPrefix, kind, is_active: true })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: `Prefix ${normalizedPrefix} is already used by another environment.` }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // An environment without a stock location can never sell anything, so the
  // two are created together — there is no valid state where one exists
  // without the other.
  const { error: locErr } = await admin
    .from("stall_stock_locations")
    .insert({ environment_id: env.id, name: env.name, is_warehouse: false });
  if (locErr) {
    return NextResponse.json({ error: `Environment created but stock location failed: ${locErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ environment: env });
}

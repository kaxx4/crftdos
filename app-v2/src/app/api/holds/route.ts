import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAnySession } from "@/lib/apiAuth";

// PRD §3.3 — held qty subtracts from available, not on-hand. Kiosk soft-holds
// (session-scoped, no customer name) are internal and never shown here —
// mirrors v1's `not customer_name ilike 'kiosk-session:%'` filter.
export async function GET(req: NextRequest) {
  const auth = await requireAnySession(req, ["stall", "admin"]);
  if (!auth.ok) return auth.response;

  const environmentId = req.nextUrl.searchParams.get("environment_id");
  if (!environmentId) return NextResponse.json({ error: "environment_id required" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("stall_holds")
    .select("*")
    .eq("environment_id", environmentId)
    .is("released_at", null)
    .is("converted_order", null)
    .not("customer_name", "ilike", "kiosk-session:%")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ holds: data ?? [] });
}

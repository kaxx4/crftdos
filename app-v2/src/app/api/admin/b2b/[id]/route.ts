import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAnySession } from "@/lib/apiAuth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAnySession(req, ["admin"]);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const admin = supabaseAdmin();

  const patch: Record<string, unknown> = {};
  for (const k of [
    "stage",
    "deposit_amount",
    "deposit_date",
    "deposit_method",
    "balance_amount",
    "balance_date",
    "balance_method",
    "promised_date",
    "dispatched_date",
    "lost_reason",
    "notes",
  ]) {
    if (body[k] !== undefined) patch[k] = body[k];
  }
  patch.updated_at = new Date().toISOString();

  const { data, error } = await admin.from("stall_b2b_orders").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("stall_b2b_activity").insert({ b2b_id: id, event: "updated", detail: patch });
  return NextResponse.json({ order: data });
}

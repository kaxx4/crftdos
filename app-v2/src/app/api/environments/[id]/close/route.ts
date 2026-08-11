import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAnySession } from "@/lib/apiAuth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAnySession(req, ["admin"]);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const admin = supabaseAdmin();

  const { data: loc } = await admin.from("stall_stock_locations").select("id").eq("environment_id", id).maybeSingle();
  if (loc) {
    const { data: rows } = await admin.from("stall_stock").select("qty").eq("location_id", loc.id);
    const remaining = (rows ?? []).reduce((n, r) => n + (r.qty ?? 0), 0);
    if (remaining > 0) {
      return NextResponse.json(
        { error: `${remaining} items are still allocated here. Return them to the warehouse before closing.` },
        { status: 409 }
      );
    }
  }

  const { data, error } = await admin
    .from("stall_environments")
    .update({ is_active: false, closed_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message ?? "Environment not found." }, { status: error ? 500 : 404 });
  return NextResponse.json({ environment: data });
}

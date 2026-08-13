import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

// Audit trail for every order that discounted or gave something away —
// `stall_admin_audit` rows written at order time (see /api/orders). Admin-only
// read; there's no write path here.
export async function GET(req: NextRequest) {

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("stall_admin_audit")
    .select("*")
    .in("action", ["discount_applied", "freebie_given"])
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data ?? [] });
}

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAnySession } from "@/lib/apiAuth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAnySession(req, ["stall", "kiosk"]);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const admin = supabaseAdmin();
  await admin
    .from("stall_holds")
    .update({ released_at: new Date().toISOString() })
    .eq("id", id)
    .is("released_at", null);
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {

  const { id } = await params;
  const admin = supabaseAdmin();
  await admin
    .from("stall_holds")
    .update({ released_at: new Date().toISOString() })
    .eq("id", id)
    .is("released_at", null);
  return NextResponse.json({ ok: true });
}

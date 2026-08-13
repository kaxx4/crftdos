import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

// Org-wide, not environment-scoped — a lead isn't tied to a physical stall,
// same reasoning as B2B (migration 004.2).
export async function GET(req: NextRequest) {

  const admin = supabaseAdmin();
  const { data, error } = await admin.from("stall_leads").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ leads: data ?? [] });
}

export async function POST(req: NextRequest) {

  const body = await req.json().catch(() => ({}));
  const { name, phone, notes } = body as { name?: string; phone?: string | null; notes?: string | null };
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: lead, error } = await admin
    .from("stall_leads")
    .insert({ name: name.trim(), phone: phone?.trim() || null, notes: notes?.trim() || null, logged_by: "device" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lead });
}

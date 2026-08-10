import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

// Unambiguous alphabet per PRD §4.4 — no O/0, I/1.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function genCode() {
  let s = "";
  for (let i = 0; i < 4; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

// The kiosk is a public, unauthenticated customer surface — no session to
// check here; the ticket itself expires in 30 minutes.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { garments, quotedTotal, deviceId } = body as {
    garments: unknown[];
    quotedTotal: number;
    deviceId?: string;
  };
  if (!garments?.length) return NextResponse.json({ error: "garments required" }, { status: 400 });

  const admin = supabaseAdmin();
  let code = genCode();
  // Extremely low collision odds (32^4), but guard anyway.
  for (let i = 0; i < 5; i++) {
    const { data: clash } = await admin.from("stall_design_tickets").select("id").eq("code", code).maybeSingle();
    if (!clash) break;
    code = genCode();
  }

  const { data: ticket, error } = await admin
    .from("stall_design_tickets")
    .insert({
      code,
      device_id: deviceId || "kiosk",
      payload: { garments },
      quoted_total: quotedTotal,
      status: "open",
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ticket });
}

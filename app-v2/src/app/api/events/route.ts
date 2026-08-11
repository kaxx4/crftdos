import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { KioskEvent } from "@/lib/domain/types";

// Public, unauthenticated, anon-insert-only surface — batched analytics from
// the kiosk. See the volume warning in the requirements doc: never log raw
// pointer-move, always batch.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const events = (body?.events ?? []) as KioskEvent[];
  if (!Array.isArray(events) || events.length === 0) return NextResponse.json({ ok: true });
  if (events.length > 500) return NextResponse.json({ error: "Batch too large." }, { status: 400 });

  const admin = supabaseAdmin();
  const { error } = await admin.from("stall_kiosk_events").insert(
    events.map((e) => ({
      session_id: e.session_id,
      environment_id: e.environment_id,
      event: e.event,
      detail: e.detail ?? null,
      created_at: e.created_at,
    }))
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAnySession } from "@/lib/apiAuth";
import { currentFY } from "@/lib/money";

export async function POST(req: NextRequest) {
  const auth = await requireAnySession(req, ["stall", "admin"]);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { environment_id, device_id, name, type, venue, press_on_site, opening_float } = body as {
    environment_id?: string;
    device_id?: string;
    name?: string;
    type?: string;
    venue?: string | null;
    press_on_site?: boolean;
    opening_float?: number;
  };
  if (!environment_id || !device_id || !name) {
    return NextResponse.json({ error: "environment_id, device_id and name are required" }, { status: 400 });
  }

  const admin = supabaseAdmin();

  // At most one open shift per environment. A second device joins the
  // existing shift rather than failing — a joining device that silently got
  // no receipt block and could not charge was a real production bug.
  const { data: existing } = await admin
    .from("stall_shifts")
    .select("*")
    .eq("environment_id", environment_id)
    .is("closed_at", null)
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let shift = existing;
  if (!shift) {
    const { data: created, error } = await admin
      .from("stall_shifts")
      .insert({
        environment_id,
        name,
        type: type ?? "stall",
        venue: venue ?? null,
        press_on_site: press_on_site ?? true,
        opening_float: opening_float ?? 0,
      })
      .select()
      .single();
    if (error) {
      if (error.code === "23505") {
        const { data: winner } = await admin
          .from("stall_shifts")
          .select("*")
          .eq("environment_id", environment_id)
          .is("closed_at", null)
          .order("opened_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!winner) return NextResponse.json({ error: error.message }, { status: 500 });
        shift = winner;
      } else {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      shift = created;
    }
  }

  const fy = currentFY();
  const { data: block, error: blockErr } = await admin.rpc("stall_allocate_receipt_block", {
    p_environment_id: environment_id,
    p_shift_id: shift.id,
    p_device_id: device_id,
    p_fy: fy,
    p_block_size: 100,
  });
  if (blockErr) return NextResponse.json({ error: blockErr.message }, { status: 500 });

  return NextResponse.json({ shift, block });
}

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifySession, SESSION_COOKIE } from "@/lib/session";
import { currentFY } from "@/lib/fy";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE.stall)?.value;
  const session = await verifySession("stall", token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { name, venue, event_name, press_on_site, volunteer_ids, opening_float, deviceId } = body;

  if (!name || !deviceId) {
    return NextResponse.json({ error: "Shift name and device id required" }, { status: 400 });
  }

  const admin = supabaseAdmin();

  // Reuse an already-open shift (e.g. a second device joining) instead of
  // violating the one-open-shift unique index.
  const { data: existing } = await admin
    .from("stall_shifts")
    .select("*")
    .is("closed_at", null)
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let shift = existing;
  if (!shift) {
    const { data: created, error } = await admin
      .from("stall_shifts")
      .insert({
        name,
        venue,
        event_name: event_name || null,
        press_on_site: press_on_site ?? true,
        volunteer_ids: volunteer_ids || [],
        opening_float: opening_float || 0,
      })
      .select()
      .single();
    if (error) {
      // A concurrent device may have won the race and already opened a
      // shift, tripping the stall_one_open_shift unique index (23505).
      // Re-select and join it instead of surfacing a hard failure.
      if (error.code === "23505") {
        const { data: winner } = await admin
          .from("stall_shifts")
          .select("*")
          .is("closed_at", null)
          .order("opened_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (winner) {
          shift = winner;
        } else {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      } else {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      shift = created;
    }
  }

  // Allocate a block of 100 receipt numbers to this device for this shift,
  // unless one is already open for it.
  const fy = currentFY();
  const { data: existingBlock } = await admin
    .from("stall_receipt_blocks")
    .select("*")
    .eq("shift_id", shift.id)
    .eq("device_id", deviceId)
    .is("closed_at", null)
    .maybeSingle();

  let block = existingBlock;
  if (!block) {
    const { data: lastBlock } = await admin
      .from("stall_receipt_blocks")
      .select("end_no")
      .eq("fy", fy)
      .order("end_no", { ascending: false })
      .limit(1)
      .maybeSingle();

    const start = (lastBlock?.end_no || 0) + 1;
    const end = start + 99;

    const { data: newBlock, error: blockErr } = await admin
      .from("stall_receipt_blocks")
      .insert({
        shift_id: shift.id,
        device_id: deviceId,
        fy,
        start_no: start,
        end_no: end,
        next_no: start,
      })
      .select()
      .single();
    if (blockErr) {
      // Two near-simultaneous opens for the SAME device (e.g. two tabs, or
      // React StrictMode's dev-only double effect) can each see no open
      // block and both reach this insert. migration 005's unique index on
      // (shift_id, device_id) where closed_at is null turns the loser into a
      // 23505 instead of a second silently-created block — re-select and use
      // the winner's row rather than surfacing a hard failure.
      if (blockErr.code === "23505") {
        const { data: winner } = await admin
          .from("stall_receipt_blocks")
          .select("*")
          .eq("shift_id", shift.id)
          .eq("device_id", deviceId)
          .is("closed_at", null)
          .maybeSingle();
        if (!winner) return NextResponse.json({ error: blockErr.message }, { status: 500 });
        block = winner;
      } else {
        return NextResponse.json({ error: blockErr.message }, { status: 500 });
      }
    } else {
      block = newBlock;
    }
  }

  return NextResponse.json({ shift, block });
}

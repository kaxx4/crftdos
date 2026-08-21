import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

// stall_b2b_orders / stall_b2b_activity are explicitly NOT environment-scoped
// (migration 004.2, org-wide) — no environment_id filtering here.
export async function GET(req: NextRequest) {

  const admin = supabaseAdmin();
  const { data: orders, error } = await admin.from("stall_b2b_orders").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: volunteers, error: volErr } = await admin
    .from("stall_volunteers")
    .select("id, name, is_active")
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (volErr) return NextResponse.json({ error: volErr.message }, { status: 500 });

  const committed = (orders || [])
    .filter((o) => !["enquiry", "quoted", "lost"].includes(o.stage))
    .reduce((s, o) => s + Number(o.gross_value || 0), 0);
  const collected = (orders || []).reduce(
    (s, o) => s + Number(o.deposit_amount || 0) + Number(o.balance_amount || 0),
    0
  );

  return NextResponse.json({ orders: orders || [], volunteers: volunteers || [], committed, collected });
}

export async function POST(req: NextRequest) {

  const body = await req.json().catch(() => ({}));
  const {
    client_org: clientOrg,
    account_owner: accountOwner,
    quantity,
    unit_price: unitPrice,
    unit_cost: unitCost,
    contact_name: contactName,
    contact_phone: contactPhone,
    contact_email: contactEmail,
  } = body;

  if (!clientOrg || !accountOwner) {
    return NextResponse.json({ error: "client organisation and account owner are required" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: owner } = await admin.from("stall_volunteers").select("id").eq("id", accountOwner).eq("is_active", true).single();
  if (!owner) return NextResponse.json({ error: "Account owner must be an active volunteer" }, { status: 400 });

  const qty = Number(quantity) || 0;
  const price = Number(unitPrice) || 0;
  const cost = Number(unitCost) || 0;
  // Informational only now — no gate, no PIN. Still logged so margin is
  // visible in the activity trail, same as it always was for scrutiny.
  const margin = price > 0 ? ((price - cost) / price) * 100 : 0;

  const { data, error } = await admin
    .from("stall_b2b_orders")
    .insert({
      client_org: clientOrg,
      contact_name: contactName || null,
      contact_phone: contactPhone || null,
      contact_email: contactEmail || null,
      account_owner: accountOwner,
      quantity: qty,
      unit_price: price,
      unit_cost: cost,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("stall_b2b_activity").insert({ b2b_id: data.id, event: "created", detail: { margin } });
  return NextResponse.json({ order: data, margin });
}

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifySession, SESSION_COOKIE } from "@/lib/session";
import { verify } from "@node-rs/argon2";
import { checkRateLimit, recordFailure, clearRateLimit } from "@/lib/rateLimit";

async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE.admin)?.value;
  return verifySession("admin", token);
}

function clientIp(req: NextRequest) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = supabaseAdmin();
  const { data: orders } = await admin.from("stall_b2b_orders").select("*").order("created_at", { ascending: false });
  const { data: volunteers } = await admin.from("stall_volunteers").select("*").eq("is_active", true);

  const committed = (orders || [])
    .filter((o) => !["enquiry", "quoted", "lost"].includes(o.stage))
    .reduce((s, o) => s + Number(o.gross_value || 0), 0);
  const collected = (orders || []).reduce(
    (s, o) => s + Number(o.deposit_amount || 0) + Number(o.balance_amount || 0),
    0
  );

  return NextResponse.json({ orders: orders || [], volunteers: volunteers || [], committed, collected });
}

// D17 — below 15% margin: amber warning (client-side). Below 10%: requires
// admin PIN to save (checked here). Below 0%: hard-blocked, no PIN can save it.
export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { clientOrg, accountOwner, quantity, unitPrice, unitCost, adminPin, contactName, contactPhone, contactEmail } = body;

  if (!clientOrg || !accountOwner) {
    return NextResponse.json({ error: "client organisation and account owner are required" }, { status: 400 });
  }

  const qty = Number(quantity) || 0;
  const price = Number(unitPrice) || 0;
  const cost = Number(unitCost) || 0;
  const margin = price > 0 ? ((price - cost) / price) * 100 : 0;

  if (margin < 0) {
    return NextResponse.json({ error: "Margin below 0% — hard blocked, cannot save at a loss." }, { status: 400 });
  }

  if (margin < 10) {
    const rlKey = `${clientIp(req)}:admin-pin`;
    const rl = checkRateLimit(rlKey);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many failed attempts. Try again in 15 minutes." }, { status: 429 });
    }
    const admin = supabaseAdmin();
    const { data: pinRow } = await admin.from("stall_settings").select("value").eq("key", "pin_admin").single();
    const ok = pinRow && adminPin ? await verify(pinRow.value as string, adminPin).catch(() => false) : false;
    if (!ok) {
      recordFailure(rlKey);
      return NextResponse.json(
        { error: `Margin is ${margin.toFixed(1)}% — below 10% requires admin PIN to save.` },
        { status: 401 }
      );
    }
    clearRateLimit(rlKey);
  }

  const admin = supabaseAdmin();
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

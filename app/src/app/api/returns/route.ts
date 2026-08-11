import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifySession, SESSION_COOKIE } from "@/lib/session";
import { checkRateLimit, recordFailure, clearRateLimit, rateLimitKey } from "@/lib/rateLimit";

async function requireStall(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE.stall)?.value;
  return verifySession("stall", token);
}

export async function GET(req: NextRequest) {
  if (!(await requireStall(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = supabaseAdmin();
  const { data } = await admin.from("stall_returns").select("*").order("created_at", { ascending: false }).limit(50);
  return NextResponse.json({ returns: data || [] });
}

// PRD §3.5 — exchanges create a linked ZERO-VALUE replacement order so
// inventory moves correctly without inflating revenue.
export async function POST(req: NextRequest) {
  if (!(await requireStall(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const {
    originalOrderId,
    reason,
    action, // 'replace' | 'refund' | 'exchange' | 'reject'
    refundAmount,
    resaleable,
    approverPin,
    note,
    shiftId,
    deviceId,
    exchangeItem, // { product_sku_id, qty, unit_price, unit_cost } — for 'exchange'
    restockItems, // [{ sku_type, sku_id, qty }] — items coming back into stock
  } = body;

  if (!originalOrderId || !reason || !action) {
    return NextResponse.json({ error: "originalOrderId, reason, action required" }, { status: 400 });
  }

  const admin = supabaseAdmin();

  // Approval gate — any return needs an admin PIN per PRD's "approved_by" field intent.
  // Rate-limited the same way as /api/auth/pin: a stall session is lower
  // privilege than admin, so this check must not be brute-forceable.
  const rlKey = rateLimitKey(req, "admin-pin");
  const rl = await checkRateLimit(rlKey);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Too many failed attempts. Try again in ${Math.ceil(rl.retryAfterSeconds / 60)} minutes.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }
  if (approverPin) {
    const { verify } = await import("@node-rs/argon2");
    const { data: pinRow } = await admin.from("stall_settings").select("value").eq("key", "pin_admin").single();
    const ok = pinRow ? await verify(pinRow.value as string, approverPin).catch(() => false) : false;
    if (!ok) {
      await recordFailure(rlKey);
      return NextResponse.json({ error: "Incorrect admin PIN" }, { status: 401 });
    }
    await clearRateLimit(rlKey);
  } else {
    return NextResponse.json({ error: "Approver PIN required" }, { status: 401 });
  }

  const { data: original } = await admin.from("stall_orders").select("*").eq("id", originalOrderId).single();
  if (!original) return NextResponse.json({ error: "Original order not found" }, { status: 404 });

  let replacementOrderId: string | null = null;

  if (action === "exchange" && exchangeItem) {
    // Single transaction: order + item + stock decrement + ledger row all
    // roll back together if the item is out of stock, instead of leaving an
    // orphaned zero-value order behind (see migration 006).
    const { data: exch, error: exchErr } = await admin.rpc("stall_create_exchange", {
      p_original_order: originalOrderId,
      p_shift_id: shiftId || original.shift_id,
      p_device_id: deviceId || "returns",
      p_product_sku_id: exchangeItem.product_sku_id || null,
      p_qty: exchangeItem.qty || 1,
    });
    if (exchErr) {
      const status = exchErr.code === "P0101" ? 409 : exchErr.code === "P0103" ? 404 : 500;
      return NextResponse.json(
        { error: status === 500 ? exchErr.message : "Exchange item is out of stock" },
        { status }
      );
    }
    replacementOrderId = (exch as { order: { id: string } }).order.id;
  }

  // Restock what's coming back, if marked resaleable.
  if (resaleable && restockItems?.length) {
    for (const r of restockItems as { sku_type: "product" | "sticker"; sku_id: string; qty: number }[]) {
      const rpcName = r.sku_type === "product" ? "stall_adjust_product_stock" : "stall_adjust_sticker_stock";
      await admin.rpc(rpcName, { p_id: r.sku_id, p_delta: r.qty });
      await admin.from("stall_inventory_movements").insert({
        sku_type: r.sku_type,
        sku_id: r.sku_id,
        delta: r.qty,
        reason: "return_restock",
        actor: "returns",
      });
    }
  }

  const { data: ret, error } = await admin
    .from("stall_returns")
    .insert({
      original_order: originalOrderId,
      replacement_order: replacementOrderId,
      reason,
      action,
      refund_amount: refundAmount || 0,
      restocked: !!resaleable,
      note: note || null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ return: ret });
}

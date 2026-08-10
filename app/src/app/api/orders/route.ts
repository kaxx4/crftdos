import { NextRequest, NextResponse } from "next/server";
import { verify } from "@node-rs/argon2";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifySession, SESSION_COOKIE } from "@/lib/session";

type CartSticker = {
  sticker_design_id?: string;
  custom_sticker_id?: string;
  size_class?: "S" | "M" | "L";
  description?: string;
  side?: "front" | "back";
  pos_x?: number;
  pos_y?: number;
  rotation?: number;
  unit_price: number;
  unit_cost: number;
};

type CartLine = {
  product_sku_id?: string | null;
  qty: number;
  unit_price: number;
  unit_cost: number;
  stickers?: CartSticker[];
};

// Business failures the RPC raises with custom SQLSTATEs (see migration 002).
// Anything else is a genuine 500.
const RPC_ERROR_STATUS: Record<string, number> = {
  P0100: 409, // receipt block missing or exhausted
  P0101: 409, // product out of stock
  P0102: 409, // sticker out of stock
  "22023": 400, // malformed payload
};

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE.stall)?.value;
  const session = await verifySession("stall", token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "Missing client order id" }, { status: 400 });

  const { shiftId, items, paymentMethod } = body as {
    shiftId?: string;
    items?: CartLine[];
    paymentMethod?: string;
  };

  if (!shiftId || !items?.length || !paymentMethod) {
    return NextResponse.json({ error: "Missing required order fields" }, { status: 400 });
  }

  // PRD §3.1: "Above 10% requires admin PIN." The Sell screen enforces this
  // client-side, but nothing previously re-checked it here — the RPC
  // inserted whatever discountAmount the payload carried, PIN or not. A
  // hand-crafted POST to this route (or a client that skipped the prompt)
  // could apply any discount at all. Re-verify the same hash /api/auth/verify
  // checks before the discount reaches the database.
  const subtotal = Number(body.subtotal) || 0;
  const discountAmount = Number(body.discountAmount) || 0;
  const discountPct = subtotal > 0 ? (discountAmount / subtotal) * 100 : 0;
  if (discountPct > 10 && discountAmount > 0) {
    const admin0 = supabaseAdmin();
    const { data: pinRow } = await admin0.from("stall_settings").select("value").eq("key", "pin_admin").single();
    const pinOk = pinRow && (await verify(pinRow.value as string, body.adminPin || "").catch(() => false));
    if (!pinOk) {
      return NextResponse.json({ error: "Admin PIN required for discounts above 10%" }, { status: 403 });
    }
    // PRD §12: "discount overrides" are one of the four action types that
    // must write to admin_audit. Previously none of them did.
    await admin0.from("stall_admin_audit").insert({
      actor: "volunteer",
      action: "discount_override",
      detail: { orderId: body.id, subtotal, discountAmount, discountPct: Math.round(discountPct * 10) / 10 },
    });
  }

  // The whole charge — idempotency check, receipt-number consumption, customer
  // de-duplication, order, ticket redemption, every line item and sticker,
  // every stock decrement and ledger row — happens in ONE round trip inside a
  // single transaction.
  //
  // This replaced ~30 sequential PostgREST calls that were NOT transactional:
  // a mid-order stock failure left earlier lines already decremented and
  // committed, and the compensating soft-void did not give that stock back.
  // Now a failure anywhere unwinds everything, including the receipt number.
  const admin = supabaseAdmin();
  const { data, error } = await admin.rpc("stall_create_order", { p_order: body });

  if (error) {
    const status = RPC_ERROR_STATUS[error.code ?? ""] ?? 500;
    return NextResponse.json(
      { error: status === 500 ? "Failed to record order" : error.message, code: error.code },
      { status }
    );
  }

  const result = data as { order: unknown; alreadyExisted: boolean };
  return NextResponse.json({ order: result.order, alreadyExisted: result.alreadyExisted });
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE.stall)?.value;
  const session = await verifySession("stall", token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const shiftId = req.nextUrl.searchParams.get("shiftId");
  const pageParam = req.nextUrl.searchParams.get("limit");
  const limit = Math.min(Math.max(parseInt(pageParam || "100", 10) || 100, 1), 200);

  // Joins the mockup, print area and cutout paths the press sheet needs
  // (PRD §4.4) so the queue can composite on-device without a second fetch —
  // the press table has the same signal as the rest of the stall.
  const admin = supabaseAdmin();
  let q = admin
    .from("stall_orders")
    .select(
      `*, stall_order_items(
         *,
         stall_product_skus(sku_code, mockup_front, mockup_back, print_area),
         stall_order_item_stickers(
           *,
           stall_sticker_designs(code, cutout_path, print_w_cm, print_h_cm),
           stall_custom_stickers(code, description)
         )
       )`
    )
    .order("created_at", { ascending: false });
  if (shiftId) {
    // A shift is one day, so this is bounded — but bound it anyway rather
    // than trusting that forever.
    q = q.eq("shift_id", shiftId).limit(500);
  } else {
    q = q.limit(limit);
  }
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ orders: data });
}

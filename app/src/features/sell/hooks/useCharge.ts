"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { getDeviceId } from "@/lib/deviceId";
import { enqueueOrder, removeFromOutbox } from "@/lib/outbox";
import type { Shift, ReceiptBlock } from "@/lib/types";
import type { CartGarment, CartStandaloneSticker, PaymentMethod, UndoSnapshot } from "../types";

type ChargeDeps = {
  shift: Shift | null;
  block: ReceiptBlock | null;
  setBlock: (updater: (b: ReceiptBlock | null) => ReceiptBlock | null) => void;
  refreshOutboxCount: () => void;

  garments: CartGarment[];
  standalone: CartStandaloneSticker[];
  cartEmpty: boolean;
  cartHasFulfillmentTrigger: boolean;
  subtotal: number;
  resetCart: () => void;
  restoreCart: (g: CartGarment[], s: CartStandaloneSticker[]) => void;

  discountAmt: string;
  discountPct: string;
  discountAmount: number;
  discountReason: string;
  resetDiscount: () => void;
  restoreDiscount: (amt: string, pct: string) => void;

  needsAdminGate: boolean;
  discountUnlocked: boolean;
  adminPinValue: string;
  setAdminPinPrompt: (v: boolean) => void;
  resetAdminStepUp: () => void;

  payment: PaymentMethod;
  setPayment: (p: PaymentMethod) => void;
  cashAmt: string;
  setCashAmt: (v: string) => void;
  upiAmt: string;
  setUpiAmt: (v: string) => void;
  splitOk: boolean;
  resetPayment: () => void;

  collectLater: boolean;
  promisedDate: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerConsent: boolean;
  setCustomerErr: (v: string) => void;
  setCustomerSheetOpen: (v: boolean) => void;
  resetCustomerSheet: () => void;

  redeemedTicketCode: string | undefined;
  resetTicketState: () => void;

  total: number;
};

/** The one legitimate fan-in point: assembling cart + discount + payment +
 *  customer + shift state into an order payload. Preserves, verbatim:
 *  optimistic charge (cart clears before the network resolves, <100ms,
 *  falling back to the IndexedDB outbox offline) and the receipt-block
 *  increment on success. */
export function useCharge(deps: ChargeDeps) {
  const router = useRouter();
  const [charging, setCharging] = useState(false);
  const [undo, setUndo] = useState<{ orderId: string; snapshot: UndoSnapshot; timer: ReturnType<typeof setTimeout> } | null>(
    null
  );

  function openCharge() {
    if (deps.cartEmpty) return;
    if (deps.needsAdminGate && !deps.discountUnlocked) {
      deps.setAdminPinPrompt(true);
      return;
    }
    if (!deps.splitOk) return;
    if (!deps.shift || !deps.block) return;
    deps.setCustomerErr("");
    deps.setCustomerSheetOpen(true);
  }

  async function charge() {
    if (deps.collectLater && (!deps.promisedDate || !deps.customerPhone.trim())) {
      deps.setCustomerErr(
        "Promised date and a phone number are required — this garment isn't handed over today."
      );
      return;
    }
    if (!deps.shift || !deps.block) return;

    const shift = deps.shift;

    deps.setCustomerSheetOpen(false);
    setCharging(true);
    const orderId = uuidv4();
    const deviceId = getDeviceId();

    const items = [
      ...deps.garments.map((g) => ({
        product_sku_id: g.product_sku_id,
        qty: 1,
        unit_price: g.unit_price,
        unit_cost: g.unit_cost,
        stickers: g.stickers.map((s) => ({
          sticker_design_id: s.sticker_design_id,
          size_class: s.custom?.size_class,
          description: s.custom?.description,
          unit_price: s.unit_price,
          unit_cost: s.unit_cost,
          side: s.side,
          pos_x: s.pos_x,
          pos_y: s.pos_y,
          rotation: s.rotation,
        })),
      })),
      ...deps.standalone.map((s) => ({
        product_sku_id: null,
        qty: 1,
        unit_price: s.unit_price,
        unit_cost: s.unit_cost,
        stickers: [
          {
            sticker_design_id: s.sticker_design_id,
            size_class: s.custom?.size_class,
            description: s.custom?.description,
            unit_price: s.unit_price,
            unit_cost: s.unit_cost,
          },
        ],
      })),
    ];

    const fulfillmentStatus = deps.cartHasFulfillmentTrigger
      ? shift.press_on_site
        ? "pending_press"
        : "collect_later"
      : undefined;

    const payload = {
      id: orderId,
      shiftId: shift.id,
      deviceId,
      items,
      subtotal: deps.subtotal,
      discountAmount: deps.discountAmount,
      discountReason: deps.discountAmount > 0 ? deps.discountReason : undefined,
      designTicket: deps.redeemedTicketCode,
      total: deps.total,
      costTotal: deps.garments.reduce((s, g) => s + g.unit_cost, 0),
      paymentMethod: deps.payment,
      paidCash: deps.payment === "cash" ? deps.total : deps.payment === "split" ? Number(deps.cashAmt) || 0 : 0,
      paidUpi: deps.payment === "upi" ? deps.total : deps.payment === "split" ? Number(deps.upiAmt) || 0 : 0,
      clientCreatedAt: new Date().toISOString(),
      fulfillmentStatus,
      promisedDate: deps.collectLater ? deps.promisedDate : undefined,
      customer:
        deps.customerName || deps.customerPhone || deps.customerEmail
          ? {
              name: deps.customerName || undefined,
              phone: deps.customerPhone || undefined,
              email: deps.customerEmail || undefined,
              consent_marketing: deps.customerConsent,
            }
          : undefined,
      // Re-verified server-side against the same hash /api/auth/verify uses —
      // the client-side unlock alone is never enforced past this point.
      adminPin: deps.needsAdminGate && deps.discountUnlocked ? deps.adminPinValue : undefined,
    };

    const snapshot: UndoSnapshot = {
      garments: deps.garments,
      standalone: deps.standalone,
      discountAmt: deps.discountAmt,
      discountPct: deps.discountPct,
      payment: deps.payment,
      cashAmt: deps.cashAmt,
      upiAmt: deps.upiAmt,
    };

    // Optimistic charge: the cart clears before the network resolves,
    // regardless of connectivity. Falls back to the outbox below if the
    // request fails or there's no network at all.
    deps.resetCart();
    deps.resetDiscount();
    deps.resetAdminStepUp();
    deps.resetPayment();
    deps.resetTicketState();
    deps.resetCustomerSheet();
    setCharging(false);

    let synced = false;
    let receiptNo = "PENDING SYNC";
    if (navigator.onLine) {
      try {
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const j = await res.json();
          receiptNo = j.order.receipt_no;
          synced = true;
          // Advance the header's block counter. It was only read at boot, so
          // it sat at "0/100 used" all shift — a volunteer could not see the
          // block being consumed and would first learn it was exhausted when
          // a charge was refused mid-queue.
          if (!j.alreadyExisted) {
            deps.setBlock((b) => (b ? { ...b, next_no: b.next_no + 1 } : b));
          }
        }
      } catch {
        // fall through to outbox
      }
    }
    if (!synced) {
      await enqueueOrder({ id: orderId, payload, queuedAt: new Date().toISOString(), status: "queued" });
      deps.refreshOutboxCount();
    }

    sessionStorage.setItem(
      "last_receipt",
      JSON.stringify({ ...payload, receipt_no: receiptNo, synced, shiftName: shift.name })
    );

    const timer = setTimeout(() => {
      setUndo(null);
      router.push("/receipt");
    }, 8000);
    setUndo({ orderId, snapshot, timer });
  }

  function doUndo() {
    if (!undo) return;
    clearTimeout(undo.timer);
    const snap = undo.snapshot;
    deps.restoreCart(snap.garments, snap.standalone);
    deps.restoreDiscount(snap.discountAmt, snap.discountPct);
    deps.setPayment(snap.payment);
    deps.setCashAmt(snap.cashAmt);
    deps.setUpiAmt(snap.upiAmt);
    setUndo(null);
    void removeFromOutbox(undo.orderId);
    fetch(`/api/orders/${undo.orderId}/void`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "undo" }),
    }).catch(() => null);
  }

  return { charging, undo, openCharge, charge, doUndo };
}

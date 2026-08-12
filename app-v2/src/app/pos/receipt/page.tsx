"use client";

/** Printable/showable receipt for one completed order (PRD's receipt view,
 *  ported from v1 `app/src/app/receipt/page.tsx`).
 *
 *  v1 read a one-shot `sessionStorage` handoff written by the sell flow.
 *  app-v2's `Order` already carries everything a receipt needs, so this reads
 *  the order straight from the backend by id — shareable as a link, works
 *  after a refresh, and works for any past order, not just the one just
 *  rung up. */

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getBackend } from "@/lib/backend";
import { useAsync } from "@/lib/hooks/useAsync";
import { PosShell } from "@/features/pos/PosShell";
import { Banner, Button, Skeleton } from "@/components/ui";
import { money } from "@/lib/money";

function ReceiptInner() {
  const params = useSearchParams();
  const orderId = params.get("order") ?? "";

  const order = useAsync(
    () => (orderId ? getBackend().getOrder(orderId) : Promise.resolve({ ok: false as const, error: "No order specified." })),
    [orderId]
  );

  return (
    <PosShell title="Receipt">
      <div className="print:hidden flex flex-col gap-3 p-3">
        {order.loading && (
          <>
            <Skeleton className="h-40" />
            <Skeleton className="h-20" />
          </>
        )}
        {order.error && <Banner tone="danger" title="Couldn't load this receipt">{order.error}</Banner>}
      </div>

      {order.data && (
        <div className="flex flex-col gap-4 p-3">
          <div id="receipt-print" className="relative border-2 border-[var(--color-ink)] bg-white">
            <div className="pt-5 px-4 pb-2 text-center">
              <div className="font-extrabold text-4xl tracking-wide text-[var(--color-blue)]">CRFTD</div>
              <div className="font-extrabold text-[12px] tracking-[0.2em] mt-1">TERRAROOTS FOUNDATION</div>
            </div>
            <div className="h-2 bg-[var(--color-blue)] mx-4" />
            <div className="px-4 pb-4 pt-1 flex flex-col gap-2.5">
              <div className="flex justify-between font-[family-name:var(--font-mono)] text-[13px]">
                <span>{order.data.receipt_no ?? `#${order.data.order_no}`}</span>
                <span>{new Date(order.data.client_created_at).toLocaleString("en-IN")}</span>
              </div>
              {order.data.customer_name && (
                <div className="font-[family-name:var(--font-mono)] text-[13px] text-[var(--color-muted)]">
                  {order.data.customer_name}
                  {order.data.customer_phone ? ` · ${order.data.customer_phone}` : ""}
                </div>
              )}
              {order.data.voided_at && (
                <div className="bg-[var(--color-signal)] text-white p-2 font-extrabold text-[12px] tracking-wide uppercase">
                  Void — {order.data.void_reason}
                </div>
              )}

              <div className="border-t-2 border-b-2 border-[var(--color-ink)] py-2 flex flex-col gap-2">
                {order.data.items.map((it) => (
                  <div key={it.id} className="flex flex-col gap-0.5">
                    <div className="flex justify-between text-sm font-bold">
                      <span>
                        {it.sku_code
                          ? `${it.sku_code}${it.size ? ` · ${it.size}` : ""}${it.color_name ? ` · ${it.color_name}` : ""}`
                          : "Sticker"}
                        {it.qty > 1 ? ` ×${it.qty}` : ""}
                      </span>
                      <span className="font-extrabold text-base">
                        {money(it.line_total + it.stickers.reduce((s, st) => s + st.unit_price, 0))}
                      </span>
                    </div>
                    {it.stickers.length > 0 && (
                      <div className="font-[family-name:var(--font-mono)] text-[12px] text-[var(--color-muted)]">
                        {it.stickers.map((s) => s.code).join(", ")}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-1 text-[13px]">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{money(order.data.subtotal)}</span>
                </div>
                {order.data.discount_amount > 0 && (
                  <div className="flex justify-between text-[var(--color-signal)] font-bold">
                    <span>Discount{order.data.discount_reason ? ` (${order.data.discount_reason})` : ""}</span>
                    <span>-{money(order.data.discount_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-extrabold text-base">
                  <span>Total ({order.data.payment_method.toUpperCase()})</span>
                  <span>{money(order.data.total)}</span>
                </div>
              </div>

              <div className="bg-[var(--color-blue)] text-white p-2.5 flex justify-between items-center">
                <span className="font-extrabold text-[12px] tracking-[0.14em] max-w-[14ch]">RAISED FOR AQUATERRA</span>
                <span className="font-extrabold text-2xl">{money(order.data.total - order.data.cost_total)}</span>
              </div>

              <div className="text-[13px] text-[var(--color-muted)] leading-relaxed">
                Proceeds support AquaTerra welfare work. Hand wash recommended. DTF transfers rated 10–15 washes
                minimum. No change-of-mind returns.
              </div>
            </div>
          </div>

          <div className="print:hidden">
            <Button size="lg" block variant="primary" onClick={() => window.print()}>
              Print receipt
            </Button>
          </div>
        </div>
      )}
    </PosShell>
  );
}

export default function ReceiptPage() {
  return (
    <Suspense>
      <ReceiptInner />
    </Suspense>
  );
}

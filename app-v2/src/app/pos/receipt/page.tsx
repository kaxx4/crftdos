"use client";

/** Printable/showable receipt for one completed order (PRD's receipt view,
 *  ported from v1 `app/src/app/receipt/page.tsx`).
 *
 *  v1 read a one-shot `sessionStorage` handoff written by the sell flow.
 *  app-v2's `Order` already carries everything a receipt needs, so this reads
 *  the order straight from the backend by id — shareable as a link, works
 *  after a refresh, and works for any past order, not just the one just
 *  rung up.
 *
 *  This is the one POS screen a CUSTOMER looks at, so it is allowed to carry
 *  the brand: a cobalt masthead and one acid block for the amount raised.
 *  Everything else stays a plain ink-ruled document, because it is also the
 *  thing that gets printed on a thermal printer in black and white. */

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getBackend } from "@/lib/backend";
import { useAsync } from "@/lib/hooks/useAsync";
import { PosShell } from "@/features/pos/PosShell";
import { Banner, Button, Mono, PosScreen, Skeleton, Text, TicketStub } from "@/components/ui";
import { money } from "@/lib/money";

function ReceiptInner() {
  const params = useSearchParams();
  const orderId = params.get("order") ?? "";

  const order = useAsync(
    () => (orderId ? getBackend().getOrder(orderId) : Promise.resolve({ ok: false as const, error: "No order specified." })),
    [orderId]
  );

  const o = order.data;

  return (
    <PosShell title="Receipt">
      <PosScreen>
        <PosScreen.Body>
          {order.loading && (
            <>
              <Skeleton className="h-56" />
              <Skeleton className="h-24" />
            </>
          )}
          {order.error && <Banner tone="danger" title="Couldn't load this receipt">{order.error}</Banner>}

          {o && (
            // A receipt is a physical object twice over — a printout AND a
            // keepsake — so it gets the same torn-stub treatment as the
            // kiosk ticket: the transaction (what was bought, what it cost)
            // is one act, and what the money did (the AquaTerra line, the
            // care instructions) is the other, torn apart at the seam. The
            // notches print fine on a thermal printer — they're just ink.
            //
            // TicketStub doesn't pass through arbitrary DOM attributes, and
            // `id="receipt-print"` predates this component — kept on a
            // plain wrapper in case something outside React still queries
            // it (a print bridge, a future thermal-printer integration).
            <div id="receipt-print">
              <TicketStub>
                <div className="on-deep bg-[var(--color-cobalt)] px-[var(--space-4)] py-[var(--space-4)] text-center text-white">
                  <p className="t-xxl">CRFTD</p>
                  <p className="t-label mt-[var(--space-1)] text-white/80">Terraroots Foundation</p>
                </div>

                <TicketStub.Section className="flex flex-col gap-[var(--space-3)] border-t-[3px] border-[var(--color-ink)]">
                  <div className="flex flex-wrap justify-between gap-[var(--space-2)]">
                    <Mono className="t-base font-bold">{o.receipt_no ?? `#${o.order_no}`}</Mono>
                    <Mono className="t-base text-[var(--color-muted)]">
                      {new Date(o.client_created_at).toLocaleString("en-IN")}
                    </Mono>
                  </div>

                  {o.customer_name && (
                    <Mono className="t-base text-[var(--color-muted)]">
                      {o.customer_name}
                      {o.customer_phone ? ` · ${o.customer_phone}` : ""}
                    </Mono>
                  )}

                  {o.voided_at && (
                    <div className="on-deep rounded-[var(--radius-md)] border-[3px] border-[var(--color-ink)] bg-[var(--color-signal)] p-[var(--space-3)] t-md text-white">
                      Void — {o.void_reason}
                    </div>
                  )}

                  <ul className="flex flex-col gap-[var(--space-3)] border-y-[3px] border-[var(--color-ink)] py-[var(--space-3)]">
                    {o.items.map((it) => (
                      <li key={it.id}>
                        <div className="flex justify-between gap-[var(--space-3)] t-base font-bold">
                          <span>
                            {it.sku_code
                              ? `${it.sku_code}${it.size ? ` · ${it.size}` : ""}${it.color_name ? ` · ${it.color_name}` : ""}`
                              : "Sticker"}
                            {it.qty > 1 ? ` ×${it.qty}` : ""}
                          </span>
                          <Mono className="t-md">
                            {money(it.line_total + it.stickers.reduce((s, st) => s + st.unit_price, 0))}
                          </Mono>
                        </div>
                        {it.stickers.length > 0 && (
                          <Mono className="t-base text-[var(--color-muted)]">
                            {it.stickers.map((s) => s.code).join(", ")}
                          </Mono>
                        )}
                      </li>
                    ))}
                  </ul>

                  <div className="flex flex-col gap-[var(--space-1)] t-base">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <Mono>{money(o.subtotal)}</Mono>
                    </div>
                    {o.discount_amount > 0 && (
                      <div className="flex justify-between font-bold">
                        <span>Discount{o.discount_reason ? ` (${o.discount_reason})` : ""}</span>
                        <Mono>−{money(o.discount_amount)}</Mono>
                      </div>
                    )}
                    <div className="flex justify-between t-md">
                      <span>Total ({o.payment_method.toUpperCase()})</span>
                      <Mono className="t-lg">{money(o.total)}</Mono>
                    </div>
                  </div>
                </TicketStub.Section>

                <TicketStub.Divider />

                <TicketStub.Section className="flex flex-col gap-[var(--space-3)]">
                  {/* The reason anybody keeps this bit of paper. */}
                  <div className="flex items-center justify-between gap-[var(--space-3)] rounded-[var(--radius-md)] border-[3px] border-[var(--color-ink)] bg-[var(--color-acid)] p-[var(--space-3)] text-[var(--color-ink)]">
                    <span className="t-label max-w-[14ch]">Raised for AquaTerra</span>
                    <Mono className="t-xl">{money(o.total - o.cost_total)}</Mono>
                  </div>

                  <Text muted>
                    Proceeds support AquaTerra welfare work. Hand wash recommended. DTF transfers rated 10–15
                    washes minimum. No change-of-mind returns.
                  </Text>
                </TicketStub.Section>
              </TicketStub>
            </div>
          )}
        </PosScreen.Body>

        {o && (
          <PosScreen.Foot className="print:hidden">
            <Button variant="primary" size="xl" block onClick={() => window.print()}>
              Print receipt
            </Button>
          </PosScreen.Foot>
        )}
      </PosScreen>
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

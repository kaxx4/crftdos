"use client";

import { useState } from "react";
import Link from "next/link";
import { getBackend } from "@/lib/backend";
import { useEnvironment } from "@/lib/hooks/useEnvironment";
import { useAction, useAsync } from "@/lib/hooks/useAsync";
import type { Order } from "@/lib/domain/types";
import { money } from "@/lib/money";
import { Banner, Button, EmptyState, Panel, Sheet, Skeleton } from "@/components/ui";
import { clsx } from "@/components/clsx";

/** Everything sold in this environment, newest first, with voids.
 *
 *  A void is SOFT — the row and its receipt number survive, because a receipt
 *  number that disappears from the sequence is an audit problem, not a
 *  tidiness win. It restocks to the location the order drew from. */
export function OrdersLog() {
  const { environment } = useEnvironment();
  const orders = useAsync(
    () =>
      environment
        ? getBackend().listOrders({ environment_id: environment.id, limit: 100 })
        : Promise.resolve({ ok: true as const, data: [] as Order[] }),
    [environment?.id]
  );
  const [voiding, setVoiding] = useState<Order | null>(null);
  const [reason, setReason] = useState("");
  const { run, busy, error } = useAction();

  const doVoid = async () => {
    if (!voiding || reason.trim().length < 3) return;
    const res = await run(() => getBackend().voidOrder(voiding.id, reason.trim(), "volunteer"));
    if (res) {
      setVoiding(null);
      setReason("");
      void orders.reload();
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3">
      {orders.loading ? (
        <>
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </>
      ) : !orders.data?.length ? (
        <EmptyState
          headline="No sales here yet"
          teach="Every sale from this stall — from the kiosk or from the Sell tab — shows up here as soon as it happens."
        />
      ) : (
        orders.data.map((o) => (
          <Panel key={o.id} tight className={clsx(o.voided_at && "opacity-70")}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-[family-name:var(--font-mono)] font-bold">
                  {o.receipt_no ?? `#${o.order_no}`}
                  {o.voided_at && <span className="ml-2 text-[var(--color-signal)]">VOID</span>}
                </p>
                <p className="text-sm text-[var(--color-muted)]">
                  {o.customer_name ?? "Walk-up"} · {o.items.length} item{o.items.length === 1 ? "" : "s"} ·{" "}
                  {o.payment_method}
                </p>
                <p className="text-xs text-[var(--color-muted)]">
                  {new Date(o.client_created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <div className="text-right">
                <p className="font-[family-name:var(--font-mono)] text-lg font-bold tnum">{money(o.total)}</p>
                <div className="flex justify-end gap-1">
                  <Link href={`/pos/receipt?order=${o.id}`}>
                    <Button size="md" variant="ghost">
                      Receipt
                    </Button>
                  </Link>
                  {!o.voided_at && (
                    <Button size="md" variant="ghost" onClick={() => setVoiding(o)}>
                      Void
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Panel>
        ))
      )}

      <Sheet
        open={Boolean(voiding)}
        onClose={() => setVoiding(null)}
        title={`Void ${voiding?.receipt_no ?? ""}`}
        footer={
          <Button variant="danger" size="lg" block busy={busy} disabled={reason.trim().length < 3} onClick={doVoid}>
            Void this sale
          </Button>
        }
      >
        <p className="mb-3 text-sm">
          This puts the stock back and marks the sale void. The receipt number stays in the sequence — that&apos;s
          deliberate, so the books still add up.
        </p>
        <label htmlFor="void-reason" className="text-sm font-semibold">
          Why?
        </label>
        <textarea
          id="void-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Rung up twice, customer changed their mind…"
          className="mt-1.5 w-full rounded-lg border-2 border-[var(--color-line)] p-3 text-base"
        />
        {error && <Banner tone="danger" className="mt-3">{error}</Banner>}
      </Sheet>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { getBackend } from "@/lib/backend";
import { useEnvironment } from "@/lib/hooks/useEnvironment";
import { useAction, useAsync } from "@/lib/hooks/useAsync";
import type { Order } from "@/lib/domain/types";
import { money } from "@/lib/money";
import {
  Badge,
  Banner,
  Button,
  ConfirmAction,
  EmptyState,
  Mono,
  PosScreen,
  Sheet,
  Skeleton,
  Text,
  Textarea,
} from "@/components/ui";
import { clsx } from "@/components/clsx";

/** Everything sold in this environment, newest first, with voids.
 *
 *  A void is SOFT — the row and its receipt number survive, because a receipt
 *  number that disappears from the sequence is an audit problem, not a
 *  tidiness win. It restocks to the location the order drew from.
 *
 *  The rows are one tone. A log is read by scanning receipt numbers and
 *  totals; giving each row its own colour would make the list louder and no
 *  faster to read. The only row that looks different is a voided one, and it
 *  differs by a signal badge and a struck total, not by decoration. */
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

  const live = (orders.data ?? []).filter((o) => !o.voided_at);
  const taken = live.reduce((n, o) => n + o.total, 0);

  return (
    <PosScreen>
      <PosScreen.Body className="stagger">
        {orders.loading ? (
          <>
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </>
        ) : !orders.data?.length ? (
          <div className="flex flex-col items-center">
            <EmptyState
              headline="No sales here yet"
              teach="Every sale from this stall — from the kiosk or from the Sell tab — shows up here as soon as it happens, with a receipt you can show or print."
            />
            {/* One small hand-drawn touch, first-run only — this whole block
                disappears the moment a real sale lands, so it never sits near
                live transaction data. DESIGN-SPEC §3a: light touch, POS. */}
            <div aria-hidden="true" className="mt-[var(--space-2)] flex flex-col items-center text-[var(--color-ink)]/70">
              <svg width="40" height="52" viewBox="0 0 40 52" fill="none" className="shrink-0">
                <path
                  d="M20 2C13 14 10 26 20 46"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  fill="none"
                />
                <path
                  d="M11 39L20 47L27 37"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
              <span className="t-hand t-xl">your first one lands down there</span>
            </div>
          </div>
        ) : (
          <ul className="stagger flex flex-col gap-[var(--space-3)]">
            {orders.data.map((o) => (
              <li
                key={o.id}
                className={clsx(
                  "rounded-[var(--radius-lg)] border-[3px] border-[var(--color-ink)] bg-white p-[var(--space-3)]",
                  o.voided_at && "bg-[var(--color-signal-wash)]"
                )}
              >
                <div className="flex items-start justify-between gap-[var(--space-3)]">
                  <div className="min-w-0">
                    <Mono className="t-md font-bold">{o.receipt_no ?? `#${o.order_no}`}</Mono>
                    {o.voided_at && (
                      <span className="ml-[var(--space-2)]">
                        <Badge tone="signal">Void</Badge>
                      </span>
                    )}
                    <Text className="truncate">
                      {o.customer_name ?? "Walk-up"} · {o.items.length} item
                      {o.items.length === 1 ? "" : "s"} · {o.payment_method}
                    </Text>
                    <Text muted className="tnum">
                      {new Date(o.client_created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </div>
                  <Mono className={clsx("t-lg shrink-0", o.voided_at && "line-through")}>
                    {money(o.total)}
                  </Mono>
                </div>

                <div className="mt-[var(--space-3)] flex flex-wrap gap-[var(--space-3)]">
                  <Link href={`/pos/receipt?order=${o.id}`} className="inline-flex flex-1">
                    <Button variant="secondary" block>
                      Receipt
                    </Button>
                  </Link>
                  {!o.voided_at && (
                    // Void is destructive and money-shaped: it opens a sheet
                    // that asks why, and the sheet's own confirm is two-tap.
                    <Button variant="ghost" onClick={() => setVoiding(o)}>
                      Void…
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </PosScreen.Body>

      {/* No action to pin on a log, so the foot carries the number an operator
          is actually asked for mid-shift: what has this stall taken. */}
      <PosScreen.Foot className="flex flex-col gap-[var(--space-2)]">
        <div className="flex items-end justify-between gap-[var(--space-3)]">
          <span className="t-label text-white/80">
            Taken here · {live.length} sale{live.length === 1 ? "" : "s"}
          </span>
          <Mono className="t-xl">{money(taken)}</Mono>
        </div>
        <Link href="/pos/sell" className="inline-flex w-full">
          <Button variant="primary" size="xl" block>
            Record a sale
          </Button>
        </Link>
      </PosScreen.Foot>

      <Sheet
        open={Boolean(voiding)}
        onClose={() => setVoiding(null)}
        title={`Void ${voiding?.receipt_no ?? ""}`}
        footer={
          <ConfirmAction
            variant="danger"
            size="xl"
            block
            busy={busy}
            disabled={reason.trim().length < 3}
            label="Void this sale"
            confirmLabel={`Confirm void ${voiding?.receipt_no ?? ""}?`}
            onConfirm={doVoid}
          />
        }
      >
        <div className="flex flex-col gap-[var(--space-3)]">
          <Text>
            This puts the stock back and marks the sale void. The receipt number stays in the sequence —
            that&apos;s deliberate, so the books still add up.
          </Text>
          <Textarea
            label="Why?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Rung up twice, customer changed their mind…"
            hint="At least a few words — this is what an admin reads when the day is reconciled."
          />
          {error && <Banner tone="danger">{error}</Banner>}
        </div>
      </Sheet>
    </PosScreen>
  );
}

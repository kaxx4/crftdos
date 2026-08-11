"use client";

/** The prep → print → handover board.
 *
 *  This is the central reframe of the rework: the old build had one "Sell"
 *  screen and a press queue bolted beside it. The actual work at a stall is a
 *  pipeline with three physical stations, so the software is now a pipeline
 *  with three modes.
 *
 *    PREP      pull the physical transfers from the box
 *    PRINT     press them onto the garment
 *    HANDOVER  package, take any cash owed, hand it over
 *
 *  Two properties this screen must have that the old one didn't:
 *
 *  1. Tickets arrive on their own. A kiosk order appears here without anyone
 *     refreshing, and arrives visibly, because a ticket that materialises
 *     silently in a list is a ticket that gets missed.
 *  2. Every state teaches. An empty queue explains what will fill it. An open
 *     ticket says which stickers to pull and which box they're in, because
 *     walking to the right box IS the work.
 *
 *  Both kiosk-originated tickets and volunteer-created walk-up sales land in
 *  the same queue — walk-ups are additive, not replaced. */

import { useState } from "react";
import { getBackend } from "@/lib/backend";
import { useEnvironment } from "@/lib/hooks/useEnvironment";
import { useAction } from "@/lib/hooks/useAsync";
import { nudgeFor, useBoard } from "@/lib/hooks/useBoard";
import { minutesSince, useNow } from "@/lib/hooks/useNow";
import type { BoardStage, Order } from "@/lib/domain/types";
import { money } from "@/lib/money";
import { Banner, Button, EmptyState, Nudge, Skeleton } from "@/components/ui";
import { clsx } from "@/components/clsx";

const STAGES: { id: BoardStage; label: string; verb: string; teach: string }[] = [
  {
    id: "prep",
    label: "Prep",
    verb: "Mark prepped",
    teach: "New orders from the kiosk land here automatically. Nothing to do until one arrives.",
  },
  {
    id: "print",
    label: "Print",
    verb: "Mark printed",
    teach: "Once someone marks a ticket prepped, it shows up here for the heat press.",
  },
  {
    id: "handover",
    label: "Handover",
    verb: "Handed over",
    teach: "Pressed tickets waiting to be collected will appear here.",
  },
];

export function Board() {
  const { environment, bound, loading: envLoading } = useEnvironment();
  const [stage, setStage] = useState<BoardStage>("prep");
  const board = useBoard(environment?.id ?? null);
  const { run, busy, error, clearError } = useAction();

  if (!envLoading && !bound) {
    return (
      <div className="p-4">
        <Banner tone="warn" title="This phone isn't assigned to a stall yet">
          Open Settings and pick which stall you&apos;re working at, so your sales land in the right place.
        </Banner>
      </div>
    );
  }

  const advance = async (o: Order) => {
    const backend = getBackend();
    const fn =
      stage === "prep"
        ? () => backend.markPrepped(o.id, "volunteer")
        : stage === "print"
          ? () => backend.markPrinted(o.id, "volunteer")
          : () => backend.markHandedOver(o.id, "volunteer");
    const res = await run(fn);
    if (res) {
      board.clearArrived(o.id);
      void board.reload();
    }
  };

  const queue = board.byStage[stage];
  const current = STAGES.find((s) => s.id === stage)!;

  return (
    <div className="flex flex-col gap-4 p-3">
      {/* Mode switch. Counts on the tabs so a volunteer at the press knows
          there's work waiting without switching to look. */}
      <div role="tablist" aria-label="Pipeline stage" className="grid grid-cols-3 gap-2">
        {STAGES.map((s) => {
          const count = board.byStage[s.id].length;
          const active = stage === s.id;
          return (
            <button
              key={s.id}
              role="tab"
              aria-selected={active}
              onClick={() => setStage(s.id)}
              className={clsx(
                "tap-target flex flex-col items-center justify-center rounded-xl border-2 px-2 py-2 font-bold",
                "transition-[transform,background-color] duration-[var(--dur-fast)] active:scale-[0.97]",
                active
                  ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-cream)]"
                  : "border-[var(--color-line)] bg-white"
              )}
            >
              <span className="text-sm">{s.label}</span>
              <span className="font-[family-name:var(--font-mono)] text-xl tnum">{count}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <Banner tone="danger" title="That didn't go through" action={<Button size="md" variant="ghost" onClick={clearError}>Dismiss</Button>}>
          {error}
        </Banner>
      )}

      {board.loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      ) : queue.length === 0 ? (
        <EmptyState headline={`Nothing waiting to ${current.label.toLowerCase()}`} teach={current.teach} />
      ) : (
        <ul className="flex flex-col gap-3">
          {queue.map((o) => (
            <li key={o.id}>
              <TicketCard
                order={o}
                stage={stage}
                justArrived={board.arrived.has(o.id)}
                busy={busy}
                actionLabel={current.verb}
                onAdvance={() => advance(o)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TicketCard({
  order,
  stage,
  justArrived,
  busy,
  actionLabel,
  onAdvance,
}: {
  order: Order;
  stage: BoardStage;
  justArrived: boolean;
  busy: boolean;
  actionLabel: string;
  onAdvance: () => void;
}) {
  const garment = order.items[0];
  const stickers = order.items.flatMap((i) => i.stickers);
  // Against a ticking clock, so the wait actually counts up while the board
  // sits open. See useNow for why this isn't a bare Date.now().
  const waitedMin = minutesSince(order.client_created_at, useNow());

  return (
    <article
      className={clsx(
        "rounded-xl border-2 bg-white p-4",
        justArrived ? "animate-arrive border-[var(--color-blue)]" : "border-[var(--color-line)]"
      )}
    >
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-bold">{order.customer_name ?? "Walk-up"}</p>
          <p className="font-[family-name:var(--font-mono)] text-sm text-[var(--color-muted)]">
            {order.receipt_no ?? `#${order.order_no}`}
            {order.customer_phone && ` · ${order.customer_phone}`}
          </p>
        </div>
        <div className="text-right">
          <p className="font-[family-name:var(--font-mono)] text-lg font-bold tnum">{money(order.total)}</p>
          {/* Waiting time, not order time. A volunteer cares how long this
              person has been standing there, not what o'clock it was. */}
          <p className={clsx("text-sm", waitedMin > 15 ? "font-bold text-[var(--color-signal)]" : "text-[var(--color-muted)]")}>
            {waitedMin < 1 ? "just now" : `waiting ${waitedMin}m`}
          </p>
        </div>
      </header>

      {garment && (
        <p className="mb-2 text-sm">
          <strong>{[garment.color_name, garment.fit_name, garment.size].filter(Boolean).join(" · ")}</strong>
        </p>
      )}

      {stickers.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-1.5">
          {stickers.map((s) => (
            <li
              key={s.id}
              className="rounded-md border border-[var(--color-line)] bg-[var(--color-cream)] px-2 py-1 font-[family-name:var(--font-mono)] text-xs font-bold"
            >
              {s.code}
              <span className="ml-1.5 font-normal text-[var(--color-muted)]">{s.side}</span>
            </li>
          ))}
        </ul>
      )}

      <Nudge className="mb-3">{nudgeFor(order, stage)}</Nudge>

      <Button variant="primary" size="lg" block busy={busy} onClick={onAdvance}>
        {actionLabel}
      </Button>
    </article>
  );
}

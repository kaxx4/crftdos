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
 *  THE ADVANCE BUTTON IS NOT ON THE CARD. It used to be, which meant the
 *  single most-tapped control on the busiest screen moved every time the queue
 *  reordered and vanished off-screen as soon as you scrolled. A ticket is now
 *  *selected* (oldest by default — that is the one you should be working) and
 *  the one advance button lives in the pinned foot, where a thumb can find it
 *  without looking. DESIGN-SPEC §6.
 *
 *  Both kiosk-originated tickets and volunteer-created walk-up sales land in
 *  the same queue — walk-ups are additive, not replaced. */

import Link from "next/link";
import { useState } from "react";
import { getBackend } from "@/lib/backend";
import { useEnvironment } from "@/lib/hooks/useEnvironment";
import { useAction } from "@/lib/hooks/useAsync";
import { nudgeFor, useBoard } from "@/lib/hooks/useBoard";
import { minutesSince, useNow } from "@/lib/hooks/useNow";
import type { BoardStage, Order } from "@/lib/domain/types";
import { money } from "@/lib/money";
import {
  Badge,
  Banner,
  Button,
  EmptyState,
  Mono,
  Nudge,
  PosScreen,
  Skeleton,
  Text,
} from "@/components/ui";
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

const LONG_WAIT_MIN = 15;

export function Board() {
  const { environment, bound, loading: envLoading } = useEnvironment();
  const [stage, setStage] = useState<BoardStage>("prep");
  const [picked, setPicked] = useState<string | null>(null);
  const board = useBoard(environment?.id ?? null);
  const { run, busy, error, clearError } = useAction();

  if (!envLoading && !bound) {
    return (
      <PosScreen>
        <PosScreen.Body>
          <Banner tone="warn" title="This phone isn't assigned to a stall yet">
            Pick which stall you&apos;re working at, so the tickets you see — and the sales you take —
            belong to the right place.
          </Banner>
        </PosScreen.Body>
        <PosScreen.Foot>
          <Link href="/settings" className="inline-flex w-full">
            <Button variant="primary" size="xl" block>
              Choose this phone&apos;s stall
            </Button>
          </Link>
        </PosScreen.Foot>
      </PosScreen>
    );
  }

  const queue = board.byStage[stage];
  const current = STAGES.find((s) => s.id === stage)!;
  // Default to the oldest ticket in the stage: that is the one that should be
  // worked next, so the foot is already aimed correctly without a tap.
  const active = queue.find((o) => o.id === picked) ?? queue[0] ?? null;

  const advance = async () => {
    if (!active) return;
    const backend = getBackend();
    const fn =
      stage === "prep"
        ? () => backend.markPrepped(active.id, "volunteer")
        : stage === "print"
          ? () => backend.markPrinted(active.id, "volunteer")
          : () => backend.markHandedOver(active.id, "volunteer");
    const res = await run(fn);
    if (res) {
      board.clearArrived(active.id);
      setPicked(null);
      void board.reload();
    }
  };

  return (
    <PosScreen>
      {/* Fixed: which station you are standing at, and how much work is
          waiting at the other two. State, not actions. */}
      <PosScreen.Head>
        <div role="tablist" aria-label="Pipeline stage" className="grid grid-cols-3 gap-[var(--space-2)]">
          {STAGES.map((s) => {
            const count = board.byStage[s.id].length;
            const on = stage === s.id;
            return (
              <button
                key={s.id}
                role="tab"
                aria-selected={on}
                onClick={() => {
                  setStage(s.id);
                  setPicked(null);
                }}
                className={clsx(
                  "flex min-h-[var(--tap-pos)] flex-col items-center justify-center rounded-[var(--radius-lg)]",
                  "border-[var(--color-ink)] transition-[transform,box-shadow] duration-[var(--dur-fast)] ease-[var(--ease-out)]",
                  "active:translate-x-[3px] active:translate-y-[3px] active:shadow-none",
                  on
                    ? "on-deep border-[3px] bg-[var(--color-cobalt)] text-white shadow-[var(--shadow-sticker)]"
                    : "border-2 bg-white text-[var(--color-ink)]"
                )}
              >
                <span className="t-base font-extrabold">{s.label}</span>
                <Mono className="t-lg font-bold">{count}</Mono>
              </button>
            );
          })}
        </div>
      </PosScreen.Head>

      <PosScreen.Body>
        {error && (
          <Banner
            tone="danger"
            title="That didn't go through"
            action={
              <Button variant="ghost" onClick={clearError}>
                Dismiss
              </Button>
            }
          >
            {error}
          </Banner>
        )}

        {board.loading ? (
          <>
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </>
        ) : queue.length === 0 ? (
          <EmptyState
            headline={`Nothing waiting to ${current.label.toLowerCase()}`}
            teach={current.teach}
          />
        ) : (
          <ul className="flex flex-col gap-[var(--space-3)]">
            {queue.map((o) => (
              <li key={o.id}>
                <TicketCard
                  order={o}
                  stage={stage}
                  selected={active?.id === o.id}
                  justArrived={board.arrived.has(o.id)}
                  onSelect={() => setPicked(o.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </PosScreen.Body>

      {/* The one action, pinned. It names the ticket it will act on, because
          "Mark prepped" with no subject is how the wrong ticket gets advanced. */}
      <PosScreen.Foot className="flex flex-col gap-[var(--space-2)]">
        <div className="flex items-baseline justify-between gap-[var(--space-3)]">
          <span className="t-label text-white/80">Working on</span>
          <span className="t-base min-w-0 flex-1 truncate text-right font-extrabold">
            {active
              ? `${active.customer_name ?? "Walk-up"} · ${active.receipt_no ?? `#${active.order_no}`}`
              : "Nothing selected"}
          </span>
        </div>
        <Button variant="primary" size="xl" block busy={busy} disabled={!active} onClick={advance}>
          {active ? current.verb : `Nothing to ${current.label.toLowerCase()}`}
        </Button>
      </PosScreen.Foot>
    </PosScreen>
  );
}

function TicketCard({
  order,
  stage,
  selected,
  justArrived,
  onSelect,
}: {
  order: Order;
  stage: BoardStage;
  selected: boolean;
  justArrived: boolean;
  onSelect: () => void;
}) {
  const garment = order.items[0];
  const stickers = order.items.flatMap((i) => i.stickers);
  // Against a ticking clock, so the wait actually counts up while the board
  // sits open. See useNow for why this isn't a bare Date.now().
  const waitedMin = minutesSince(order.client_created_at, useNow());
  const waitedLong = waitedMin > LONG_WAIT_MIN;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={clsx(
        "w-full rounded-[var(--radius-lg)] bg-white p-[var(--space-4)] text-left",
        "border-[var(--color-ink)] transition-[box-shadow,border-width] duration-[var(--dur-fast)]",
        // Selection is never colour alone: the edge goes to the heaviest
        // weight in the system and the card takes the screen's one hero shadow.
        selected ? "border-[5px] shadow-[var(--shadow-block)]" : "border-[3px]",
        justArrived && "animate-arrive"
      )}
    >
      <header className="flex items-start justify-between gap-[var(--space-3)]">
        <div className="min-w-0">
          <p className="t-lg truncate">{order.customer_name ?? "Walk-up"}</p>
          <Mono className="t-base text-[var(--color-muted)]">
            {order.receipt_no ?? `#${order.order_no}`}
          </Mono>
          {order.customer_phone && (
            <Mono className="t-base block text-[var(--color-muted)]">{order.customer_phone}</Mono>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-[var(--space-2)]">
          <Mono className="t-xl">{money(order.total)}</Mono>
          {/* Waiting time, not order time. A volunteer cares how long this
              person has been standing there, not what o'clock it was. */}
          {waitedLong ? (
            <Badge tone="yellow">Waiting {waitedMin}m</Badge>
          ) : (
            <Text step="base" muted className="tnum">
              {waitedMin < 1 ? "just now" : `waiting ${waitedMin}m`}
            </Text>
          )}
        </div>
      </header>

      {justArrived && (
        <p className="mt-[var(--space-2)]">
          <Badge tone="yellow">Just arrived</Badge>
        </p>
      )}

      {garment && (
        <p className="mt-[var(--space-3)] t-md">
          {[garment.color_name, garment.fit_name, garment.size].filter(Boolean).join(" · ")}
        </p>
      )}

      {stickers.length > 0 && (
        <ul className="mt-[var(--space-2)] flex flex-wrap gap-[var(--space-2)]">
          {stickers.map((s) => (
            <li key={s.id}>
              {/* One tone for the whole collection — a code per colour is
                  confetti, and the codes are what must be read, not ranked. */}
              <Badge tone="white">
                <Mono>{s.code}</Mono>
                <span className="font-normal">{s.side}</span>
              </Badge>
            </li>
          ))}
        </ul>
      )}

      <Nudge className="mt-[var(--space-3)]">{nudgeFor(order, stage)}</Nudge>
    </button>
  );
}

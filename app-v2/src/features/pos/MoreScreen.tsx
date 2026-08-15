"use client";

/** Shift management and the overflow.
 *
 *  Shift open is here rather than being a gate the app throws you at, because
 *  the eighth-pass bug in the old build was a second device joining an
 *  already-open shift, getting no receipt block, and being unable to charge
 *  with nothing on screen explaining why. Opening a shift is now something a
 *  volunteer does deliberately and can see the result of.
 *
 *  Shift state is the loudest thing on the screen — an acid panel when open, a
 *  plain one when not — because "are we trading?" is a question asked from two
 *  metres away, and the answer decides whether the Sell tab works at all. The
 *  open/close action itself lives in the foot, so it is never scrolled past
 *  and never sits next to a link that just navigates. */

import { useState } from "react";
import Link from "next/link";
import { getBackend } from "@/lib/backend";
import { getDeviceId } from "@/lib/device";
import { useEnvironment } from "@/lib/hooks/useEnvironment";
import { useDeviceId } from "@/lib/hooks/useDeviceId";
import { useAction, useAsync } from "@/lib/hooks/useAsync";
import { listOutbox, discardOutboxItem, onOutboxChange, MAX_FAILED_RETRIES, type OutboxOrder } from "@/lib/outbox";
import { money } from "@/lib/money";
import {
  Badge,
  Banner,
  Button,
  ConfirmAction,
  Field,
  Mono,
  Panel,
  PosScreen,
  Text,
} from "@/components/ui";
import { useEffect } from "react";

const TOOLS = [
  { href: "/pos/returns", label: "Returns & exchanges", teach: "Log a defect, refund or swap" },
  { href: "/pos/waste", label: "Log waste", teach: "Something ruined in the press" },
  { href: "/pos/holds", label: "Active holds", teach: "Items reserved for a customer" },
  { href: "/pos/press", label: "Press queue", teach: "Every sheet waiting at the heat press" },
  { href: "/pos/leads", label: "Leads", teach: "Someone worth following up" },
];

export function MoreScreen() {
  const { environment, bound } = useEnvironment();
  const deviceId = useDeviceId();
  const shift = useAsync(
    () =>
      environment
        ? getBackend().getShiftContext(environment.id, getDeviceId())
        : Promise.resolve({ ok: true as const, data: { shift: null, block: null } }),
    [environment?.id]
  );
  const { run, busy, error } = useAction();
  const [float, setFloat] = useState("2000");
  const [counted, setCounted] = useState("");
  const [queue, setQueue] = useState<OutboxOrder[]>([]);

  useEffect(() => {
    const refresh = () => void listOutbox().then(setQueue);
    refresh();
    // Without this, a sale that finishes syncing (or a new one that queues)
    // while this screen is open leaves the outbox banner stale — a volunteer
    // could be told to "keep the app open" for a queue that already cleared,
    // or not see a newly-queued sale that should block shift close.
    const stop = onOutboxChange(refresh);
    return () => {
      stop();
    };
  }, []);

  const open = async () => {
    if (!environment) return;
    const res = await run(() =>
      getBackend().openShift({
        environment_id: environment.id,
        device_id: getDeviceId(),
        name: `${environment.name} — ${new Date().toLocaleDateString()}`,
        type: "stall",
        venue: null,
        press_on_site: true,
        opening_float: Number(float) || 0,
      })
    );
    if (res) void shift.reload();
  };

  const close = async () => {
    const id = shift.data?.shift?.id;
    if (!id) return;
    const res = await run(() => getBackend().closeShift({ shift_id: id, counted_cash: Number(counted) || 0 }));
    if (res) void shift.reload();
  };

  const current = shift.data;
  const isOpen = Boolean(current?.shift);
  const blocked = queue.length > 0;

  return (
    <PosScreen>
      <PosScreen.Body>
        {/* The one colour-block on the screen, and it carries the answer to
            the only question worth asking here. */}
        <Panel
          tone={isOpen ? "acid" : "white"}
          lift
          title="Shift"
          action={<Badge tone={isOpen ? "white" : "yellow"}>{isOpen ? "Open" : "Not open"}</Badge>}
        >
          {!bound ? (
            <Banner tone="warn">Assign this phone to a stall in Settings first.</Banner>
          ) : current?.shift ? (
            <div className="flex flex-col gap-[var(--space-3)]">
              <p className="t-lg">{current.shift.name}</p>
              <Text className="text-[var(--color-ink)]/70">
                Opened{" "}
                {new Date(current.shift.opened_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ·
                float {money(current.shift.opening_float)}
              </Text>
              {current.block ? (
                <Text className="text-[var(--color-ink)]/70">
                  Receipts{" "}
                  <Mono className="font-bold text-[var(--color-ink)]">
                    {current.block.next_no}–{current.block.end_no}
                  </Mono>{" "}
                  left on this phone
                </Text>
              ) : (
                <Banner tone="warn" title="This phone has no receipt numbers">
                  You can&apos;t charge until it does. Get a block for this phone before the next customer.
                  <Button className="mt-[var(--space-2)]" variant="secondary" busy={busy} onClick={open}>
                    Get receipt numbers
                  </Button>
                </Banner>
              )}

              {/* Shift close blocks on a non-empty outbox. An unsynced sale is
                  a sale nobody has a record of once the phone is put away. */}
              {blocked ? (
                <Banner tone="warn" title={`${queue.length} sale${queue.length === 1 ? "" : "s"} haven't synced`}>
                  Keep the app open until they clear — you can&apos;t close the shift until they do. If one is
                  stuck, you can discard it, but check with whoever&apos;s running the stall first.
                  <ul className="mt-[var(--space-2)] flex flex-col gap-[var(--space-2)]">
                    {queue.map((q) => {
                      const stuck = q.status === "failed" && (q.attempts ?? 0) >= MAX_FAILED_RETRIES;
                      return (
                        <li key={q.id} className="flex items-center justify-between gap-[var(--space-3)]">
                          <span className="min-w-0 truncate t-base">
                            {stuck && <span className="font-extrabold">Needs review — </span>}
                            {q.lastError ?? q.status}
                          </span>
                          <ConfirmAction
                            label="Discard"
                            confirmLabel="Discard for good?"
                            onConfirm={() => {
                              void (async () => {
                                await discardOutboxItem(q.id);
                                setQueue(await listOutbox());
                              })();
                            }}
                          />
                        </li>
                      );
                    })}
                  </ul>
                </Banner>
              ) : (
                <Field
                  label="Cash counted in the tin"
                  value={counted}
                  onChange={(e) => setCounted(e.target.value)}
                  inputMode="numeric"
                  hint="We'll compare it with what the app expected."
                />
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-[var(--space-3)]">
              <Text>
                A shift is one day of trading. Opening one gives this phone its own block of receipt numbers —
                until it has them, the Sell tab can&apos;t charge anyone.
              </Text>
              <Field
                label="Opening float"
                value={float}
                onChange={(e) => setFloat(e.target.value)}
                inputMode="numeric"
                hint="Cash in the tin before the first customer."
              />
            </div>
          )}
          {error && <Banner tone="danger" className="mt-[var(--space-3)]">{error}</Banner>}
        </Panel>

        <Panel title="Stall tools">
          {/* One tone for the whole set. These are five doors, not five
              priorities. */}
          <ul className="stagger flex flex-col gap-[var(--space-2)]">
            {TOOLS.map((t) => (
              <li key={t.href}>
                <Link
                  href={t.href}
                  className="flex min-h-[var(--tap-pos)] flex-col justify-center rounded-[var(--radius-lg)] border-[3px] border-[var(--color-ink)] bg-white px-[var(--space-3)] py-[var(--space-2)] shadow-[var(--shadow-sticker)] transition-[transform,box-shadow] duration-[var(--dur-fast)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
                >
                  <span className="t-md">{t.label}</span>
                  <span className="t-base text-[var(--color-muted)]">{t.teach}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="This device">
          <ul className="flex flex-col gap-[var(--space-2)]">
            <li>
              <Link
                href="/settings"
                className="flex min-h-[var(--tap-pos)] items-center rounded-[var(--radius-lg)] border-[3px] border-[var(--color-ink)] bg-white px-[var(--space-3)] t-md"
              >
                Settings — which stall this phone sells for
              </Link>
            </li>
            <li>
              <Link
                href="/admin"
                className="flex min-h-[var(--tap-pos)] items-center rounded-[var(--radius-lg)] border-[3px] border-[var(--color-ink)] bg-white px-[var(--space-3)] t-md"
              >
                Admin console
              </Link>
            </li>
          </ul>
          <p className="mt-[var(--space-3)] t-base text-[var(--color-muted)]">
            Device <Mono>{deviceId ?? "…"}</Mono>
          </p>
        </Panel>
      </PosScreen.Body>

      <PosScreen.Foot className="flex flex-col gap-[var(--space-2)]">
        <div className="flex items-end justify-between gap-[var(--space-3)]">
          <span className="t-label text-white/80">Shift</span>
          <span className="t-base font-extrabold">{isOpen ? "Trading" : "Not open"}</span>
        </div>
        {!bound ? (
          <Link href="/settings" className="inline-flex w-full">
            <Button variant="primary" size="xl" block>
              Choose this phone&apos;s stall
            </Button>
          </Link>
        ) : isOpen ? (
          <ConfirmAction
            variant="secondary"
            size="xl"
            block
            busy={busy}
            disabled={blocked}
            label={blocked ? "Waiting for sales to sync" : "Close the shift"}
            confirmLabel={`Confirm close — ${money(Number(counted) || 0)} counted?`}
            onConfirm={close}
          />
        ) : (
          <Button variant="primary" size="xl" block busy={busy} onClick={open}>
            Open the shift
          </Button>
        )}
      </PosScreen.Foot>
    </PosScreen>
  );
}

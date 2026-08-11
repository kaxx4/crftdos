"use client";

/** Shift management and the overflow.
 *
 *  Shift open is here rather than being a gate the app throws you at, because
 *  the eighth-pass bug in the old build was a second device joining an
 *  already-open shift, getting no receipt block, and being unable to charge
 *  with nothing on screen explaining why. Opening a shift is now something a
 *  volunteer does deliberately and can see the result of. */

import { useState } from "react";
import Link from "next/link";
import { getBackend } from "@/lib/backend";
import { getDeviceId } from "@/lib/device";
import { useEnvironment } from "@/lib/hooks/useEnvironment";
import { useDeviceId } from "@/lib/hooks/useDeviceId";
import { useAction, useAsync } from "@/lib/hooks/useAsync";
import { listOutbox, discardOutboxItem, type OutboxOrder } from "@/lib/outbox";
import { money } from "@/lib/money";
import { Banner, Button, Field, Panel } from "@/components/ui";
import { useEffect } from "react";

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
    void listOutbox().then(setQueue);
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

  return (
    <div className="flex flex-col gap-4 p-3">
      <Panel title="Shift">
        {!bound ? (
          <Banner tone="warn">Assign this phone to a stall in Settings first.</Banner>
        ) : current?.shift ? (
          <div className="flex flex-col gap-3">
            <p className="font-semibold">{current.shift.name}</p>
            <p className="text-sm text-[var(--color-muted)]">
              Opened {new Date(current.shift.opened_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              {" · float "}
              {money(current.shift.opening_float)}
            </p>
            {current.block ? (
              <p className="font-[family-name:var(--font-mono)] text-sm">
                Receipts {current.block.next_no}–{current.block.end_no} left on this phone
              </p>
            ) : (
              <Banner tone="warn" title="This phone has no receipt numbers">
                You can&apos;t charge until it does. Tap below to get a block for this phone.
                <Button className="mt-2" size="md" variant="primary" busy={busy} onClick={open}>
                  Get receipt numbers
                </Button>
              </Banner>
            )}

            {/* Shift close blocks on a non-empty outbox. An unsynced sale is a
                sale nobody has a record of once the phone is put away. */}
            {queue.length > 0 ? (
              <Banner tone="warn" title={`${queue.length} sale${queue.length === 1 ? "" : "s"} haven't synced`}>
                Keep the app open until they clear. If one is stuck, you can discard it below — but check with
                whoever&apos;s running the stall first.
                <ul className="mt-2 flex flex-col gap-1.5">
                  {queue.map((q) => (
                    <li key={q.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate">{q.lastError ?? q.status}</span>
                      <Button
                        size="md"
                        variant="ghost"
                        onClick={async () => {
                          await discardOutboxItem(q.id);
                          setQueue(await listOutbox());
                        }}
                      >
                        Discard
                      </Button>
                    </li>
                  ))}
                </ul>
              </Banner>
            ) : (
              <>
                <Field
                  label="Cash counted in the tin"
                  value={counted}
                  onChange={(e) => setCounted(e.target.value)}
                  inputMode="numeric"
                  hint="We'll compare it with what the app expected."
                />
                <Button variant="secondary" size="lg" block busy={busy} onClick={close}>
                  Close the shift
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-[var(--color-muted)]">
              A shift is one day of trading. Opening one gives this phone its own block of receipt numbers.
            </p>
            <Field
              label="Opening float"
              value={float}
              onChange={(e) => setFloat(e.target.value)}
              inputMode="numeric"
              hint="Cash in the tin before the first customer."
            />
            <Button variant="primary" size="lg" block busy={busy} onClick={open}>
              Open the shift
            </Button>
          </div>
        )}
        {error && <Banner tone="danger" className="mt-3">{error}</Banner>}
      </Panel>

      <Panel title="This device">
        <ul className="flex flex-col gap-2">
          <li>
            <Link href="/settings" className="tap-target flex items-center font-semibold underline">
              Settings — which stall this phone sells for
            </Link>
          </li>
          <li>
            <Link href="/admin" className="tap-target flex items-center font-semibold underline">
              Admin console
            </Link>
          </li>
        </ul>
        <p className="mt-3 font-[family-name:var(--font-mono)] text-xs text-[var(--color-muted)]">{deviceId ?? "…"}</p>
      </Panel>
    </div>
  );
}

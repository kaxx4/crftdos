"use client";

/** Stall (environment) management.
 *
 *  Creating an environment asks for a PREFIX up front, and that is the whole
 *  mechanism behind cross-stall id uniqueness: two environments never share an
 *  id-generation sequence, so receipt numbers can never collide and nothing
 *  has to be resolved at runtime. It is immutable once the environment has
 *  sold anything, which the form says out loud rather than discovering later.
 *
 *  Closing is deliberately blocked while stock is still allocated. Auto-
 *  returning it would hide a physical reconciliation somebody has to do
 *  anyway — there are real transfers in a real box that need to go back. */

import { useState } from "react";
import { getBackend } from "@/lib/backend";
import { useAsync, useAction } from "@/lib/hooks/useAsync";
import type { EnvironmentKind } from "@/lib/domain/types";
import { AdminShell } from "@/features/admin/AdminShell";
import { Banner, Button, Chip, Field, Panel, Sheet, Skeleton } from "@/components/ui";

export default function EnvironmentsPage() {
  const environments = useAsync(() => getBackend().listEnvironments(), []);
  const { run, busy, error, clearError } = useAction();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [prefix, setPrefix] = useState("");
  const [kind, setKind] = useState<EnvironmentKind>("stall");
  const [closing, setClosing] = useState<string | null>(null);

  const create = async () => {
    const res = await run(() => getBackend().createEnvironment({ name, prefix, kind }));
    if (res) {
      setCreating(false);
      setName("");
      setPrefix("");
      void environments.reload();
    }
  };

  const close = async (id: string) => {
    const res = await run(() => getBackend().closeEnvironment(id));
    if (res) {
      setClosing(null);
      void environments.reload();
    }
  };

  return (
    <AdminShell title="Stalls">
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="max-w-[70ch] text-sm text-[var(--color-muted)]">
          A stall is a scope on live data — not a separate copy of it. Everything a device bound to a stall records
          lands in the same database instantly, tagged with that stall. Multiple stalls and an online link can all run
          at the same time.
        </p>
        <Button variant="primary" onClick={() => setCreating(true)}>
          New stall
        </Button>
      </div>

      {error && (
        <Banner tone="danger" className="mb-4" action={<Button size="sm" variant="ghost" onClick={clearError}>Dismiss</Button>}>
          {error}
        </Banner>
      )}

      {environments.loading ? (
        <Skeleton className="h-40" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {environments.data?.map((e) => (
            <Panel key={e.id}>
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-bold">{e.name}</p>
                  <p className="text-sm capitalize text-[var(--color-muted)]">{e.kind}</p>
                </div>
                <span className="rounded-md bg-[var(--color-ink)] px-2 py-1 font-[family-name:var(--font-mono)] text-sm font-bold text-white">
                  {e.prefix}
                </span>
              </div>
              <p className="text-sm text-[var(--color-muted)]">
                {e.is_active ? `Open since ${new Date(e.opened_at).toLocaleDateString()}` : `Closed ${new Date(e.closed_at!).toLocaleDateString()}`}
              </p>
              {e.notes && <p className="mt-2 text-sm">{e.notes}</p>}
              {e.is_active && e.kind !== "cloud" && (
                closing === e.id ? (
                  <Banner tone="danger" title="Close this stall?" className="mt-3">
                    This is blocked while stock is still allocated to it — you&apos;ll need to transfer stock back
                    first if so. Closing stops sales from this stall.
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="danger" busy={busy} onClick={() => close(e.id)}>
                        Yes, close it
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setClosing(null)}>
                        Cancel
                      </Button>
                    </div>
                  </Banner>
                ) : (
                  <Button size="sm" variant="ghost" className="mt-3" onClick={() => setClosing(e.id)}>
                    Close this stall
                  </Button>
                )
              )}
            </Panel>
          ))}
        </div>
      )}

      <Sheet
        open={creating}
        onClose={() => setCreating(false)}
        title="New stall"
        footer={
          <Button variant="primary" size="lg" block busy={busy} disabled={!name.trim() || !prefix.trim()} onClick={create}>
            Create
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <Field
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Stall C — Library Lawn"
            hint="What volunteers will see on their device."
          />
          <Field
            label="Prefix"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value.toUpperCase())}
            placeholder="SC"
            maxLength={6}
            hint="2–6 letters or digits, starting with a letter. This goes into every receipt number from this stall, and it cannot be changed later."
          />
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Type</legend>
            <div className="flex gap-2">
              {(["stall", "online"] as const).map((k) => (
                <Chip key={k} selected={kind === k} onClick={() => setKind(k)} className="capitalize">
                  {k === "online" ? "Online link" : "Physical stall"}
                </Chip>
              ))}
            </div>
          </fieldset>
          <Banner tone="info">
            New stalls start with no stock. Allocate transfers to it from the warehouse on the Stock allocation page
            before anyone tries to sell.
          </Banner>
        </div>
      </Sheet>
    </AdminShell>
  );
}

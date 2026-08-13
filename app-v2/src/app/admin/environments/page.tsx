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
 *  anyway — there are real transfers in a real box that need to go back.
 *
 *  Colour budget: acid marks the stalls that are open (the thing you scan this
 *  page for), cobalt is the one primary action. Every card is the same tone —
 *  a stall is not more important than the stall beside it. */

import { useState } from "react";
import { getBackend } from "@/lib/backend";
import { useAsync, useAction } from "@/lib/hooks/useAsync";
import type { EnvironmentKind } from "@/lib/domain/types";
import { AdminShell } from "@/features/admin/AdminShell";
import {
  Badge,
  Banner,
  Button,
  Chip,
  ConfirmAction,
  EmptyState,
  Field,
  Heading,
  Mono,
  Panel,
  Sheet,
  Skeleton,
  Text,
} from "@/components/ui";

export default function EnvironmentsPage() {
  const environments = useAsync(() => getBackend().listEnvironments(), []);
  const { run, busy, error, clearError } = useAction();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [prefix, setPrefix] = useState("");
  const [kind, setKind] = useState<EnvironmentKind>("stall");

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
    if (res) void environments.reload();
  };

  // Open stalls first: this page is opened to check what is running, and the
  // closed ones are history.
  const sorted = [...(environments.data ?? [])].sort(
    (a, b) => Number(b.is_active) - Number(a.is_active)
  );

  return (
    <AdminShell
      title="Stalls"
      lede="A stall is a scope on live data, not a separate copy of it. Everything a device bound to a stall records lands in the same database instantly, tagged with that stall."
      action={
        <Button surface="admin" size="sm" variant="primary" onClick={() => setCreating(true)}>
          New stall
        </Button>
      }
    >
      {error && (
        <Banner
          tone="danger"
          title="Couldn't do that"
          action={
            <Button size="sm" surface="admin" variant="ghost" onClick={clearError}>
              Dismiss
            </Button>
          }
        >
          {error}
        </Banner>
      )}

      {environments.error && (
        <Banner tone="danger" title="Couldn't load stalls">
          {environments.error}
        </Banner>
      )}

      {environments.loading ? (
        <div className="grid gap-[var(--space-5)] md:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState
          headline="No stalls yet"
          teach="A stall is what a device binds itself to before it can sell anything. Create one, give it a prefix for its receipt numbers, then allocate stock to it."
          action={
            <Button surface="admin" size="sm" variant="primary" onClick={() => setCreating(true)}>
              New stall
            </Button>
          }
        />
      ) : (
        <div className="grid gap-[var(--space-5)] md:grid-cols-2 xl:grid-cols-3">
          {sorted.map((e) => (
            <Panel key={e.id} className="flex flex-col gap-[var(--space-3)]">
              <div className="flex items-start justify-between gap-[var(--space-3)]">
                <div className="min-w-0">
                  <Heading level={3} step="lg">
                    {e.name}
                  </Heading>
                  <Text step="sm" muted className="capitalize">
                    {e.kind}
                  </Text>
                </div>
                <Badge tone="ink">
                  <Mono>{e.prefix}</Mono>
                </Badge>
              </div>

              <div>
                {/* State is never colour alone: the badge carries the word. */}
                <Badge tone={e.is_active ? "acid" : "white"}>{e.is_active ? "Open" : "Closed"}</Badge>
                <Text step="sm" muted className="mt-[var(--space-2)]">
                  {e.is_active
                    ? `Open since ${new Date(e.opened_at).toLocaleDateString()}`
                    : `Closed ${new Date(e.closed_at!).toLocaleDateString()}`}
                </Text>
              </div>

              {e.notes && <Text step="sm">{e.notes}</Text>}

              {e.is_active && e.kind !== "cloud" && (
                <div className="mt-auto flex flex-col gap-[var(--space-2)]">
                  <Text step="sm" muted>
                    Closing stops sales from this stall. It is blocked while stock is still allocated — transfer that
                    back to the warehouse first.
                  </Text>
                  <ConfirmAction
                    size="sm"
                    surface="admin"
                    variant="secondary"
                    busy={busy}
                    label="Close this stall"
                    confirmLabel={`Close ${e.name}?`}
                    onConfirm={() => close(e.id)}
                  />
                </div>
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
          <Button
            variant="primary"
            size="lg"
            block
            busy={busy}
            disabled={!name.trim() || !prefix.trim()}
            onClick={create}
          >
            Create stall
          </Button>
        }
      >
        <div className="flex flex-col gap-[var(--space-4)]">
          <Field
            surface="admin"
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Stall C — Library Lawn"
            hint="What volunteers will see on their device."
          />
          <Field
            surface="admin"
            label="Prefix"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value.toUpperCase())}
            placeholder="SC"
            maxLength={6}
            hint="2–6 letters or digits, starting with a letter. This goes into every receipt number from this stall, and it cannot be changed later."
          />
          <fieldset>
            <legend className="mb-[var(--space-2)] t-label text-[var(--color-ink)]">Type</legend>
            <div className="flex gap-[var(--space-2)]">
              {(["stall", "online"] as const).map((k) => (
                <Chip key={k} surface="admin" selected={kind === k} onClick={() => setKind(k)}>
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

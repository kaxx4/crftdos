"use client";

/** Analytics — sales, plus the genuinely new interaction stream.
 *
 *  The sales half aggregates across every stall and the online link as one
 *  total, with a per-stall filter. The interaction half is new data that did
 *  not exist before: what customers actually do on the kiosk, whether or not
 *  they buy. Its most useful number is the drop-off — sessions that composed
 *  something and left without ordering are the clearest signal the flow has a
 *  problem, and previously they were completely invisible.
 *
 *  Event volume is batched and throttled at the client; see lib/analytics.ts
 *  for why that is non-negotiable rather than an optimisation. */

import { useState } from "react";
import { getBackend } from "@/lib/backend";
import { useAsync } from "@/lib/hooks/useAsync";
import { money } from "@/lib/money";
import { AdminShell } from "@/features/admin/AdminShell";
import { Banner, Chip, EmptyState, Panel, Skeleton, Stat } from "@/components/ui";

export default function AnalyticsPage() {
  const environments = useAsync(() => getBackend().listEnvironments(), []);
  const [envId, setEnvId] = useState<string | undefined>(undefined);

  const sales = useAsync(() => getBackend().getAnalytics({ environment_id: envId }), [envId]);
  const interaction = useAsync(() => getBackend().getInteractionAnalytics({ environment_id: envId }), [envId]);

  return (
    <AdminShell title="Analytics">
      <div className="mb-5 flex flex-wrap gap-2">
        <Chip selected={envId === undefined} onClick={() => setEnvId(undefined)}>
          All stalls
        </Chip>
        {environments.data
          ?.filter((e) => e.is_active)
          .map((e) => (
            <Chip key={e.id} selected={envId === e.id} onClick={() => setEnvId(e.id)}>
              {e.name}
            </Chip>
          ))}
      </div>

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">Sales</h2>
        {sales.loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        ) : sales.data ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Raised for AquaTerra" value={money(sales.data.raisedForAquaterra)} emphasis />
            <Stat label="Gross" value={money(sales.data.gross)} />
            <Stat label="Discounts given" value={money(sales.data.discounts)} />
            <Stat label="Orders" value={sales.data.orders} />
          </div>
        ) : null}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">
          What customers do on the kiosk
        </h2>

        {interaction.loading ? (
          <Skeleton className="h-56" />
        ) : !interaction.data || interaction.data.sessions === 0 ? (
          <EmptyState
            headline="No kiosk sessions recorded yet"
            teach="Every time someone uses the kiosk — whether they buy or not — we record what they picked and where they stopped. Once a few people have used it, the drop-off point will show up here."
          />
        ) : (
          <>
            <div className="mb-4 grid gap-4 sm:grid-cols-3">
              <Stat label="Sessions" value={interaction.data.sessions} />
              <Stat
                label="Ordered"
                value={interaction.data.completed}
                sub={`${Math.round((interaction.data.completed / interaction.data.sessions) * 100)}% of sessions`}
              />
              <Stat
                label="Walked away"
                value={interaction.data.abandoned}
                sub="Composed something, didn't order"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Where people stop">
                <ul className="flex flex-col gap-2">
                  {interaction.data.funnel.map((f) => {
                    const pct = interaction.data!.sessions ? (f.sessions / interaction.data!.sessions) * 100 : 0;
                    return (
                      <li key={f.stage}>
                        <div className="mb-1 flex justify-between text-sm">
                          <span className="capitalize font-semibold">{f.stage}</span>
                          <span className="font-[family-name:var(--font-mono)] tnum">
                            {f.sessions} · {Math.round(pct)}%
                          </span>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-[var(--color-cream-2)]">
                          <div
                            className="h-full rounded-full bg-[var(--color-blue)] transition-[width] duration-[var(--dur-slow)]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Panel>

              <Panel title="Most-picked transfers">
                {interaction.data.topPicked.length === 0 ? (
                  <p className="text-sm text-[var(--color-muted)]">Nothing picked yet.</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-[var(--color-line)]">
                    {interaction.data.topPicked.map((p) => (
                      <li key={p.code} className="flex items-center justify-between gap-4 py-2">
                        <span>
                          <span className="font-[family-name:var(--font-mono)] font-bold">{p.code}</span>
                          <span className="ml-2 text-sm text-[var(--color-muted)]">{p.name}</span>
                        </span>
                        <span className="font-[family-name:var(--font-mono)] font-bold tnum">{p.picks}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>

            {interaction.data.overlapBlocks > 0 && (
              <Banner tone="warn" title="Customers are hitting the overlap limit" className="mt-4">
                {interaction.data.overlapBlocks} placement{interaction.data.overlapBlocks === 1 ? " was" : "s were"}{" "}
                refused because there was no room left without transfers touching. If this number is high relative to
                sessions, the print area may be too small for the transfer sizes on offer.
              </Banner>
            )}
          </>
        )}
      </section>
    </AdminShell>
  );
}

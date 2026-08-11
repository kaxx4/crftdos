"use client";

import { getBackend } from "@/lib/backend";
import { useAsync } from "@/lib/hooks/useAsync";
import { money } from "@/lib/money";
import { AdminShell } from "@/features/admin/AdminShell";
import { Banner, EmptyState, Panel, Skeleton, Stat } from "@/components/ui";

/** The dashboard.
 *
 *  "Raised for AquaTerra" is first-class and above everything else, because it
 *  is the reason the organisation exists and it should not take three clicks
 *  (PRD D23). It is gross minus COGS, computed identically here, on the shift
 *  summary card, and on every receipt.
 *
 *  The all-environments aggregate is the default view: the org does not care
 *  which physical stall a sale came from for the headline number. Drilling
 *  into one stall is a deliberate act, not the starting position. */
export default function AdminDashboard() {
  const summary = useAsync(() => getBackend().getAnalytics({}), []);
  const environments = useAsync(() => getBackend().listEnvironments(), []);

  return (
    <AdminShell title="Dashboard">
      {summary.error && <Banner tone="danger" title="Couldn't load the numbers">{summary.error}</Banner>}

      {summary.loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : summary.data && summary.data.orders === 0 ? (
        <EmptyState
          headline="Nothing sold yet"
          teach="As soon as a stall makes its first sale — from the kiosk or from a volunteer's phone — the totals will appear here, live. You don't need to refresh."
        />
      ) : (
        summary.data && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Stat
                label="Raised for AquaTerra"
                value={money(summary.data.raisedForAquaterra)}
                sub="Gross minus what the stock cost"
                emphasis
              />
              <Stat label="Gross" value={money(summary.data.gross)} sub={`${summary.data.orders} orders`} />
              <Stat label="Cost of goods" value={money(summary.data.cogs)} />
              <Stat label="Items sold" value={summary.data.units} />
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <Panel title="By stall">
                {summary.data.byEnvironment.length === 0 ? (
                  <p className="text-sm text-[var(--color-muted)]">No sales attributed to a stall yet.</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-[var(--color-line)]">
                    {summary.data.byEnvironment.map((e) => (
                      <li key={e.environment_id} className="flex items-center justify-between gap-4 py-2.5">
                        <span className="font-semibold">{e.name}</span>
                        <span className="flex gap-5 font-[family-name:var(--font-mono)] tnum text-sm">
                          <span className="text-[var(--color-muted)]">{e.orders} orders</span>
                          <span>{money(e.gross)}</span>
                          <span className="font-bold text-[var(--color-blue)]">{money(e.raised)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel title="Most-sold transfers">
                {summary.data.topDesigns.length === 0 ? (
                  <p className="text-sm text-[var(--color-muted)]">Nothing yet.</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-[var(--color-line)]">
                    {summary.data.topDesigns.map((d) => (
                      <li key={d.code} className="flex items-center justify-between gap-4 py-2.5">
                        <span>
                          <span className="font-[family-name:var(--font-mono)] font-bold">{d.code}</span>
                          <span className="ml-2 text-sm text-[var(--color-muted)]">{d.name}</span>
                        </span>
                        <span className="font-[family-name:var(--font-mono)] font-bold tnum">{d.units}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          </>
        )
      )}

      <Panel title="Stalls running" className="mt-5">
        {environments.loading ? (
          <Skeleton className="h-16" />
        ) : (
          <ul className="flex flex-wrap gap-2">
            {environments.data
              ?.filter((e) => e.is_active)
              .map((e) => (
                <li
                  key={e.id}
                  className="flex items-center gap-2 rounded-lg border-2 border-[var(--color-line)] bg-white px-3 py-2"
                >
                  <span className="rounded bg-[var(--color-ink)] px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-xs font-bold text-white">
                    {e.prefix}
                  </span>
                  <span className="text-sm font-semibold">{e.name}</span>
                </li>
              ))}
          </ul>
        )}
      </Panel>
    </AdminShell>
  );
}

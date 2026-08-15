"use client";

import { getBackend } from "@/lib/backend";
import { useAsync } from "@/lib/hooks/useAsync";
import { money } from "@/lib/money";
import { AdminShell, NumHead } from "@/features/admin/AdminShell";
import { Badge, Banner, EmptyState, Mono, Panel, Skeleton, Stat, Table, Td, Th } from "@/components/ui";

/** The dashboard.
 *
 *  "Raised for AquaTerra" is first-class and above everything else, because it
 *  is the reason the organisation exists and it should not take three clicks
 *  (PRD D23). It is gross minus COGS, computed identically here, on the shift
 *  summary card, and on every receipt.
 *
 *  The all-environments aggregate is the default view: the org does not care
 *  which physical stall a sale came from for the headline number. Drilling
 *  into one stall is a deliberate act, not the starting position.
 *
 *  Colour budget: acid on the one emphasised Stat, sky on the stall chips.
 *  Everything else is white, paper and ink — the two breakdown tables are
 *  neutral because a table of rows is one tone or no tone. */
export default function AdminDashboard() {
  const summary = useAsync(() => getBackend().getAnalytics({}), []);
  const environments = useAsync(() => getBackend().listEnvironments(), []);

  const openStalls = environments.data?.filter((e) => e.is_active) ?? [];

  return (
    <AdminShell
      title="Dashboard"
      lede="Every stall and the online link, added together. Numbers update as sales land — nothing here needs refreshing."
    >
      {summary.error && (
        <Banner tone="danger" title="Couldn't load the numbers">
          {summary.error}
        </Banner>
      )}

      {summary.loading ? (
        <div className="grid gap-[var(--space-3)] sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : summary.data && summary.data.orders === 0 ? (
        <EmptyState
          headline="Nothing sold yet"
          teach="As soon as a stall makes its first sale — from the kiosk or from a volunteer's phone — the totals appear here, live. You don't need to refresh."
        />
      ) : (
        summary.data && (
          <>
            <div className="stagger grid gap-[var(--space-3)] sm:grid-cols-2 xl:grid-cols-4">
              <Stat
                label="Raised for AquaTerra"
                value={money(summary.data.raisedForAquaterra)}
                sub="Gross minus what the stock cost"
                emphasis
              />
              <Stat label="Gross" value={money(summary.data.gross)} sub={`${summary.data.orders} orders`} />
              <Stat label="Cost of goods" value={money(summary.data.cogs)} sub="What the stock cost us" />
              <Stat label="Items sold" value={summary.data.units} sub="Across every stall" />
            </div>

            <div className="animate-rise stagger grid gap-[var(--space-5)] xl:grid-cols-2">
              <Panel title="By stall">
                {summary.data.byEnvironment.length === 0 ? (
                  <EmptyState
                    headline="No sales attributed to a stall yet"
                    teach="Once a device bound to a stall records a sale, that stall appears here with its own gross and raised totals."
                  />
                ) : (
                  <Table
                    caption="Sales broken down by stall"
                    head={["Stall", <NumHead key="o">Orders</NumHead>, <NumHead key="g">Gross</NumHead>, <NumHead key="r">Raised</NumHead>]}
                  >
                    {summary.data.byEnvironment.map((e) => (
                      <tr key={e.environment_id}>
                        <Th>{e.name}</Th>
                        <Td mono className="text-right text-[var(--color-muted)]">
                          {e.orders}
                        </Td>
                        <Td mono className="text-right">
                          {money(e.gross)}
                        </Td>
                        <Td mono className="text-right font-bold text-[var(--color-acid-deep)]">
                          {money(e.raised)}
                        </Td>
                      </tr>
                    ))}
                  </Table>
                )}
              </Panel>

              <Panel title="Most-sold transfers">
                {summary.data.topDesigns.length === 0 ? (
                  <EmptyState
                    headline="No transfer has sold yet"
                    teach="This ranks transfers by units sold, so you can see what to reprint before a stall runs dry."
                  />
                ) : (
                  <Table caption="Transfers ranked by units sold" head={["Code", "Name", <NumHead key="u">Units</NumHead>]}>
                    {summary.data.topDesigns.map((d) => (
                      <tr key={d.code}>
                        <Th className="font-[family-name:var(--font-mono)]">{d.code}</Th>
                        <Td className="text-[var(--color-muted)]">{d.name}</Td>
                        <Td mono className="text-right font-bold">
                          {d.units}
                        </Td>
                      </tr>
                    ))}
                  </Table>
                )}
              </Panel>
            </div>
          </>
        )
      )}

      <Panel title="Stalls running now">
        {environments.loading ? (
          <Skeleton className="h-16" />
        ) : openStalls.length === 0 ? (
          <EmptyState
            headline="No stall is open"
            teach="Nothing can be sold until at least one stall is open. Open one on the Stalls page, then allocate stock to it."
          />
        ) : (
          <ul className="stagger flex flex-wrap gap-[var(--space-2)]">
            {openStalls.map((e) => (
              <li key={e.id}>
                {/* One tone for the whole collection. A stall is not more
                    important than the stall next to it. */}
                <Badge tone="sky">
                  <Mono className="font-bold">{e.prefix}</Mono>
                  <span className="font-bold">{e.name}</span>
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </AdminShell>
  );
}

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
 *  for why that is non-negotiable rather than an optimisation.
 *
 *  Colour budget: acid on the single emphasised Stat, cobalt on the filter
 *  chips and the funnel bars. The stat rows are deliberately NOT one colour
 *  each — a row of differently-coloured tiles is confetti and it stops the
 *  eye finding the one number that matters. */

import { useState } from "react";
import { getBackend } from "@/lib/backend";
import { useAsync } from "@/lib/hooks/useAsync";
import { money } from "@/lib/money";
import { AdminShell, NumHead } from "@/features/admin/AdminShell";
import {
  Banner,
  Chip,
  EmptyState,
  Heading,
  Mono,
  Panel,
  ProgressBar,
  Rail,
  Ring,
  Skeleton,
  Stat,
  Table,
  Td,
  Th,
} from "@/components/ui";

export default function AnalyticsPage() {
  const environments = useAsync(() => getBackend().listEnvironments(), []);
  const [envId, setEnvId] = useState<string | undefined>(undefined);

  const sales = useAsync(() => getBackend().getAnalytics({ environment_id: envId }), [envId]);
  const interaction = useAsync(() => getBackend().getInteractionAnalytics({ environment_id: envId }), [envId]);

  return (
    <AdminShell
      title="Analytics"
      lede="Money on the left of the day, behaviour on the right. The kiosk numbers count everyone who touched it, not only the people who bought."
    >
      <Rail>
        <Chip surface="admin" selected={envId === undefined} onClick={() => setEnvId(undefined)}>
          All stalls
        </Chip>
        {environments.data
          ?.filter((e) => e.is_active)
          .map((e) => (
            <Chip key={e.id} surface="admin" selected={envId === e.id} onClick={() => setEnvId(e.id)}>
              {e.name}
            </Chip>
          ))}
      </Rail>

      {sales.error && (
        <Banner tone="danger" title="Couldn't load the sales figures">
          {sales.error}
        </Banner>
      )}

      <section className="flex flex-col gap-[var(--space-3)]">
        <Heading level={2} step="lg">
          Sales
        </Heading>
        {sales.loading ? (
          <div className="grid gap-[var(--space-3)] sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : sales.data ? (
          <div className="grid gap-[var(--space-3)] sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Raised for AquaTerra"
              value={money(sales.data.raisedForAquaterra)}
              sub="Gross minus what the stock cost"
              emphasis
            />
            <Stat label="Gross" value={money(sales.data.gross)} sub={`${sales.data.orders} orders`} />
            <Stat label="Discounts given" value={money(sales.data.discounts)} sub="Knocked off at the till" />
            <Stat label="Orders" value={sales.data.orders} sub="Every channel" />
          </div>
        ) : null}
      </section>

      <section className="flex flex-col gap-[var(--space-3)]">
        <Heading level={2} step="lg">
          What customers do on the kiosk
        </Heading>

        {interaction.error && (
          <Banner tone="danger" title="Couldn't load the kiosk figures">
            {interaction.error}
          </Banner>
        )}

        {interaction.loading ? (
          <Skeleton className="h-56" />
        ) : !interaction.data || interaction.data.sessions === 0 ? (
          <EmptyState
            headline="No kiosk sessions recorded yet"
            teach="Every time someone uses the kiosk — whether they buy or not — we record what they picked and where they stopped. Once a few people have used it, the drop-off point shows up here."
          />
        ) : (
          <>
            {/* Conversion is the one genuinely bounded 0-100% figure this
                page has (completed/sessions) — the only honest use for a
                Ring here. raisedForAquaterra on the main dashboard has no
                ceiling to ring against, so it stays a plain Stat there. */}
            <Panel tone="white" className="flex flex-wrap items-center gap-[var(--space-5)]">
              <Ring
                value={interaction.data.completed}
                max={interaction.data.sessions}
                tone="acid"
                size="md"
              >
                <Heading step="xl">
                  {Math.round((interaction.data.completed / interaction.data.sessions) * 100)}%
                </Heading>
              </Ring>
              <div>
                <p className="t-label text-[var(--color-muted)]">Conversion</p>
                <p className="t-md">
                  {interaction.data.completed} of {interaction.data.sessions} sessions ordered.
                </p>
              </div>
            </Panel>

            <div className="grid gap-[var(--space-3)] sm:grid-cols-3">
              <Stat label="Sessions" value={interaction.data.sessions} sub="People who touched the kiosk" />
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

            <div className="grid gap-[var(--space-5)] xl:grid-cols-2">
              <Panel title="Where people stop">
                <ul className="flex flex-col gap-[var(--space-4)]">
                  {interaction.data.funnel.map((f) => {
                    const pct = interaction.data!.sessions ? Math.round((f.sessions / interaction.data!.sessions) * 100) : 0;
                    return (
                      <li key={f.stage}>
                        {/* The number is stated, not only drawn — a bar
                            alone is colour-as-information. Session count
                            sits in its own line since ProgressBar's own
                            percent label doesn't carry the raw count. */}
                        <div className="mb-1 flex items-baseline justify-between gap-[var(--space-3)] t-sm">
                          <span className="font-extrabold capitalize">{f.stage}</span>
                          <Mono className="tnum text-[var(--color-muted)]">
                            {f.sessions} · {pct}%
                          </Mono>
                        </div>
                        {/* Own header above already states stage/count/percent
                            in words, so ProgressBar's label row is switched
                            off here — this is purely the accessible track+fill. */}
                        <ProgressBar
                          value={f.sessions}
                          max={interaction.data!.sessions}
                          tone="cobalt"
                          showPercent={false}
                        />
                      </li>
                    );
                  })}
                </ul>
              </Panel>

              <Panel title="Most-picked transfers">
                {interaction.data.topPicked.length === 0 ? (
                  <EmptyState
                    headline="Nothing picked yet"
                    teach="This ranks transfers by how often a customer dropped one onto the canvas — including the ones who never ordered, which is where it differs from sales."
                  />
                ) : (
                  <Table
                    caption="Transfers ranked by how often customers picked them"
                    head={["Code", "Name", <NumHead key="p">Picks</NumHead>]}
                  >
                    {interaction.data.topPicked.map((p) => (
                      <tr key={p.code}>
                        <Th className="font-[family-name:var(--font-mono)]">{p.code}</Th>
                        <Td className="text-[var(--color-muted)]">{p.name}</Td>
                        <Td mono className="text-right font-bold">
                          {p.picks}
                        </Td>
                      </tr>
                    ))}
                  </Table>
                )}
              </Panel>
            </div>

            {interaction.data.overlapBlocks > 0 && (
              <Banner tone="warn" title="Customers are hitting the overlap limit">
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

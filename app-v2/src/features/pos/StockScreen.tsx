"use client";

import Link from "next/link";
import { getBackend } from "@/lib/backend";
import { useEnvironment } from "@/lib/hooks/useEnvironment";
import { useAsync } from "@/lib/hooks/useAsync";
import type { StockRow } from "@/lib/domain/types";
import {
  Badge,
  Banner,
  Button,
  EmptyState,
  Mono,
  Panel,
  PosScreen,
  Skeleton,
  Text,
} from "@/components/ui";
import { clsx } from "@/components/clsx";

/** Stock AT THIS STALL, not org-wide.
 *
 *  This is the visible consequence of per-environment allocation: the numbers
 *  here are what is physically in this stall's box, not what the organisation
 *  owns. Two stalls at one event legitimately show different counts, and a
 *  volunteer who doesn't understand that will think the app is wrong — so the
 *  screen says it explicitly rather than leaving it to be inferred.
 *
 *  Structure follows the question being asked. Nobody opens this screen to
 *  browse; they open it because they need to know whether they can still sell
 *  something. So the short list of what is running out is pinned above the
 *  long list of everything, and the count of it rides in the foot where it is
 *  readable at arm's length. */
export function StockScreen() {
  const { environment, bound } = useEnvironment();
  const locations = useAsync(() => getBackend().listStockLocations(), []);
  const location = locations.data?.find((l) => l.environment_id === environment?.id);
  const stock = useAsync(
    () => (location ? getBackend().getStock(location.id) : Promise.resolve({ ok: true as const, data: [] as StockRow[] })),
    [location?.id]
  );
  const catalogue = useAsync(() => getBackend().getCatalogue(), []);

  if (!bound) {
    return (
      <PosScreen>
        <PosScreen.Body>
          <Banner tone="warn" title="Assign this phone to a stall first">
            Stock counts are per stall, so we need to know which one you&apos;re at.
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

  const stickers = (stock.data ?? [])
    .filter((r) => r.sku_type === "sticker")
    .map((r) => ({ row: r, design: catalogue.data?.designs.find((d) => d.id === r.sku_id) }))
    .filter((x) => x.design)
    .sort((a, b) => a.design!.code.localeCompare(b.design!.code));

  const low = stickers.filter((s) => s.row.qty <= s.row.par_level);
  const loading = stock.loading || catalogue.loading;

  return (
    <PosScreen>
      <PosScreen.Body>
        <Banner tone="info">
          These are {environment?.name}&apos;s counts — what&apos;s in this stall&apos;s box, not the whole
          organisation&apos;s. Another stall will show different numbers.
        </Banner>

        {/* The one block colour on this screen. Orange is the low-stock
            anchor, and it is spent here rather than sprinkled per row. */}
        {low.length > 0 && (
          <Panel tone="orange" title={`Running low (${low.length})`}>
            <ul className="flex flex-col divide-y-2 divide-[var(--color-ink)]">
              {low.map(({ row, design }) => (
                <li
                  key={row.sku_id}
                  className="flex items-center justify-between gap-[var(--space-3)] py-[var(--space-2)]"
                >
                  <span className="min-w-0">
                    <Mono className="t-md font-bold">{design!.code}</Mono>
                    <span className="block t-base text-[var(--color-ink)]/70">{design!.bin_location}</span>
                  </span>
                  {row.qty === 0 ? (
                    <Badge tone="signal">None left</Badge>
                  ) : (
                    <Mono className="t-lg">{row.qty}</Mono>
                  )}
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <Panel title="All transfers here">
          {loading ? (
            <div className="flex flex-col gap-[var(--space-2)]">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : stickers.length === 0 ? (
            <EmptyState
              headline="No transfers allocated to this stall"
              teach="An admin allocates stock to each stall from the warehouse. Until they do, there's nothing here to sell — ask whoever's running the event to send some over."
            />
          ) : (
            <ul className="flex flex-col divide-y-2 divide-[var(--color-line-soft)]">
              {stickers.map(({ row, design }) => (
                <li
                  key={row.sku_id}
                  className="flex items-center justify-between gap-[var(--space-3)] py-[var(--space-3)]"
                >
                  <span className="min-w-0">
                    <Mono className="t-md font-bold">{design!.code}</Mono>
                    <span className="ml-2 t-base">{design!.name}</span>
                    <span className="block t-base text-[var(--color-muted)]">{design!.bin_location}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <Mono
                      className={clsx(
                        "t-lg",
                        row.qty === 0 ? "text-[var(--color-signal)]" : "text-[var(--color-ink)]"
                      )}
                    >
                      {row.qty}
                    </Mono>
                    {row.available_qty < row.qty && (
                      <span className="block t-base text-[var(--color-muted)]">
                        {row.qty - row.available_qty} held · {row.available_qty} sellable
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </PosScreen.Body>

      <PosScreen.Foot className="flex flex-col gap-[var(--space-2)]">
        <div className="flex items-end justify-between gap-[var(--space-3)]">
          <span className="t-label text-white/80">At this stall</span>
          <Text className="t-base font-extrabold">
            <Mono>{stickers.length}</Mono> transfers · <Mono>{low.length}</Mono> running low
          </Text>
        </div>
        <Link href="/pos/waste" className="inline-flex w-full">
          <Button variant="secondary" size="lg" block>
            Log something ruined
          </Button>
        </Link>
      </PosScreen.Foot>
    </PosScreen>
  );
}

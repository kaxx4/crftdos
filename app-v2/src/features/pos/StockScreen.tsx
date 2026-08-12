"use client";

import { getBackend } from "@/lib/backend";
import { useEnvironment } from "@/lib/hooks/useEnvironment";
import { useAsync } from "@/lib/hooks/useAsync";
import type { StockRow } from "@/lib/domain/types";
import { Banner, EmptyState, Panel, Skeleton } from "@/components/ui";
import { clsx } from "@/components/clsx";

/** Stock AT THIS STALL, not org-wide.
 *
 *  This is the visible consequence of per-environment allocation: the numbers
 *  here are what is physically in this stall's box, not what the organisation
 *  owns. Two stalls at one event legitimately show different counts, and a
 *  volunteer who doesn't understand that will think the app is wrong — so the
 *  screen says it explicitly rather than leaving it to be inferred. */
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
      <div className="p-4">
        <Banner tone="warn" title="Assign this phone to a stall first">
          Stock counts are per stall, so we need to know which one you&apos;re at.
        </Banner>
      </div>
    );
  }

  const stickers = (stock.data ?? [])
    .filter((r) => r.sku_type === "sticker")
    .map((r) => ({ row: r, design: catalogue.data?.designs.find((d) => d.id === r.sku_id) }))
    .filter((x) => x.design)
    .sort((a, b) => a.design!.code.localeCompare(b.design!.code));

  const low = stickers.filter((s) => s.row.qty <= s.row.par_level);

  return (
    <div className="flex flex-col gap-4 p-3">
      <Banner tone="info">
        These are {environment?.name}&apos;s counts — what&apos;s in this stall&apos;s box, not the whole
        organisation&apos;s. Another stall will show different numbers.
      </Banner>

      {low.length > 0 && (
        <Panel title={`Running low (${low.length})`}>
          <ul className="flex flex-col gap-1.5">
            {low.map(({ row, design }) => (
              <li key={row.sku_id} className="flex items-center justify-between gap-3">
                <span className="font-[family-name:var(--font-mono)] font-bold">{design!.code}</span>
                <span className="text-sm text-[var(--color-muted)]">{design!.bin_location}</span>
                <span
                  className={clsx(
                    "font-[family-name:var(--font-mono)] font-bold tnum",
                    row.qty === 0 && "text-[var(--color-signal)]"
                  )}
                >
                  {row.qty}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title="All transfers here">
        {stock.loading || catalogue.loading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
          </div>
        ) : stickers.length === 0 ? (
          <EmptyState
            headline="No transfers allocated to this stall"
            teach="An admin allocates stock to each stall from the warehouse. Until they do, there's nothing here to sell."
          />
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--color-line)]">
            {stickers.map(({ row, design }) => (
              <li key={row.sku_id} className="flex items-center justify-between gap-3 py-2.5">
                <span>
                  <span className="font-[family-name:var(--font-mono)] font-bold">{design!.code}</span>
                  <span className="ml-2 text-sm">{design!.name}</span>
                  <span className="block text-xs text-[var(--color-muted)]">{design!.bin_location}</span>
                </span>
                <span className="text-right">
                  <span
                    className={clsx(
                      "font-[family-name:var(--font-mono)] text-lg font-bold tnum",
                      row.qty === 0 ? "text-[var(--color-signal)]" : row.qty <= row.par_level && "text-[var(--color-signal)]"
                    )}
                  >
                    {row.qty}
                  </span>
                  {row.available_qty < row.qty && (
                    <span className="block text-xs text-[var(--color-muted)]">
                      {row.qty - row.available_qty} held · {row.available_qty} sellable
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

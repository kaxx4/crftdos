"use client";

import { useEffect } from "react";
import { getBackend } from "@/lib/backend";
import { useEnvironment } from "@/lib/hooks/useEnvironment";
import { useAsync, useAction } from "@/lib/hooks/useAsync";
import { useNow } from "@/lib/hooks/useNow";
import type { Hold } from "@/lib/domain/types";
import { Banner, Button, EmptyState, Mono, Panel, Skeleton } from "@/components/ui";
import { clsx } from "@/components/clsx";

/** Active holds at this stall.
 *
 *  A hold reserves an item for a customer without pulling it off the shelf —
 *  it stops anyone else selling it while it counts against available stock.
 *  Holds expire on their own (30 min in the mock, see `reserveSticker`), so
 *  this screen polls rather than loading once: a hold that ages out must
 *  visibly drop off without a manual refresh, or a volunteer will believe an
 *  item is still spoken for after it isn't. */
export function HoldsScreen() {
  const { environment, bound } = useEnvironment();
  const catalogue = useAsync(() => getBackend().getCatalogue(), []);
  const holds = useAsync(
    () => (environment ? getBackend().listHolds(environment.id) : Promise.resolve({ ok: true as const, data: [] as Hold[] })),
    [environment?.id]
  );
  const release = useAction();
  const now = useNow(15_000);

  // Re-poll periodically so a hold that ages out drops off the list on its
  // own rather than sitting there stale until a manual reload.
  const reload = holds.reload;
  useEffect(() => {
    const id = setInterval(() => void reload(), 15_000);
    return () => clearInterval(id);
  }, [reload]);

  function label(h: Hold) {
    if (h.product_sku_id) return catalogue.data?.skus.find((s) => s.id === h.product_sku_id)?.sku_code ?? "Product";
    return catalogue.data?.designs.find((d) => d.id === h.sticker_id)?.code ?? "Sticker";
  }

  function minutesLeft(h: Hold) {
    return Math.max(0, Math.round((new Date(h.expires_at).getTime() - now) / 60_000));
  }

  async function doRelease(id: string) {
    const res = await release.run(() => getBackend().releaseHold(id));
    if (res !== null) void holds.reload();
  }

  if (!bound) {
    return (
      <div className="p-4">
        <Banner tone="warn" title="Assign this phone to a stall first">
          Holds are per stall, so we need to know which one you&apos;re at.
        </Banner>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-3">
      {holds.error && <Banner tone="danger" title="Couldn't load holds">{holds.error}</Banner>}
      {release.error && <Banner tone="danger" title="Couldn't release that hold">{release.error}</Banner>}

      <Panel title={`Active holds${holds.data ? ` (${holds.data.length})` : ""}`}>
        {holds.loading || catalogue.loading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : !holds.data || holds.data.length === 0 ? (
          <EmptyState
            headline="No active holds"
            teach="A hold reserves an item for a customer who says they'll come back. It still counts as stock, but stops anyone else buying it. Holds here expire on their own — release one early only if the customer isn't coming back."
          />
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--color-line)]">
            {holds.data.map((h) => {
              const mins = minutesLeft(h);
              const urgent = mins <= 5;
              return (
                <li key={h.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex flex-col gap-0.5">
                    <span>
                      <span className="font-[family-name:var(--font-mono)] font-bold">{label(h)}</span>
                      <span className="ml-2 text-sm text-[var(--color-muted)]">× {h.qty}</span>
                    </span>
                    <Mono
                      className={clsx(
                        "text-sm font-bold",
                        urgent ? "text-[var(--color-signal)]" : "text-[var(--color-muted)]"
                      )}
                    >
                      {mins <= 0 ? "expiring now" : `${mins} min left`}
                    </Mono>
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    busy={release.busy}
                    onClick={() => void doRelease(h.id)}
                  >
                    Release
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { getBackend } from "@/lib/backend";
import { useEnvironment } from "@/lib/hooks/useEnvironment";
import { useAsync, useAction } from "@/lib/hooks/useAsync";
import { useNow } from "@/lib/hooks/useNow";
import type { Hold, ProductSku, StickerDesign } from "@/lib/domain/types";
import { Banner, Button, EmptyState, Field, Mono, Panel, Sheet, Skeleton } from "@/components/ui";
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
  const create = useAction();
  const now = useNow(15_000);

  const [reserving, setReserving] = useState(false);
  const [itemKey, setItemKey] = useState(""); // "product:<id>" or "sticker:<id>"
  const [qty, setQty] = useState("1");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

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

  async function doReserve() {
    if (!environment || !itemKey || !customerName.trim()) return;
    const [type, id] = itemKey.split(":");
    const res = await create.run(() =>
      getBackend().createHold({
        environment_id: environment.id,
        product_sku_id: type === "product" ? id : null,
        sticker_id: type === "sticker" ? id : null,
        qty: Number(qty) || 1,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim() || null,
      })
    );
    if (res !== null) {
      setReserving(false);
      setItemKey("");
      setQty("1");
      setCustomerName("");
      setCustomerPhone("");
      void holds.reload();
    }
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

      <Panel
        title={`Active holds${holds.data ? ` (${holds.data.length})` : ""}`}
        action={
          <Button size="md" variant="primary" onClick={() => setReserving(true)}>
            Reserve for a customer
          </Button>
        }
      >
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
                    {h.customer_name && (
                      <span className="text-sm">
                        {h.customer_name}
                        {h.customer_phone && <span className="text-[var(--color-muted)]"> · {h.customer_phone}</span>}
                      </span>
                    )}
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
                    size="md"
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

      <Sheet
        open={reserving}
        onClose={() => setReserving(false)}
        title="Reserve for a customer"
        footer={
          <Button
            variant="primary"
            size="lg"
            block
            busy={create.busy}
            disabled={!itemKey || !customerName.trim()}
            onClick={() => void doReserve()}
          >
            Reserve
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          <div>
            <label htmlFor="hold-item" className="text-sm font-semibold">
              Item
            </label>
            <select
              id="hold-item"
              value={itemKey}
              onChange={(e) => setItemKey(e.target.value)}
              className="mt-1.5 min-h-[48px] w-full rounded-lg border-2 border-[var(--color-line)] bg-white px-3.5 text-base"
            >
              <option value="">Select an item…</option>
              {catalogue.data?.skus.map((s: ProductSku) => (
                <option key={s.id} value={`product:${s.id}`}>
                  {s.sku_code}
                </option>
              ))}
              {catalogue.data?.designs.map((d: StickerDesign) => (
                <option key={d.id} value={`sticker:${d.id}`}>
                  {d.code}
                </option>
              ))}
            </select>
          </div>
          <Field label="Qty" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} inputMode="numeric" />
          <Field label="Customer name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          <Field
            label="Customer phone (optional)"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            inputMode="tel"
          />
          <Banner tone="info">Holds for a named customer expire in 2 hours by default.</Banner>
        </div>
      </Sheet>
    </div>
  );
}

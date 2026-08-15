"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBackend } from "@/lib/backend";
import { useEnvironment } from "@/lib/hooks/useEnvironment";
import { useAsync, useAction } from "@/lib/hooks/useAsync";
import { useNow } from "@/lib/hooks/useNow";
import type { Hold, ProductSku, StickerDesign } from "@/lib/domain/types";
import {
  Badge,
  Banner,
  Button,
  ConfirmAction,
  EmptyState,
  Field,
  Mono,
  PosScreen,
  Sheet,
  Skeleton,
  Text,
  Select,
} from "@/components/ui";

/** Active holds at this stall.
 *
 *  A hold reserves an item for a customer without pulling it off the shelf —
 *  it stops anyone else selling it while it counts against available stock.
 *  Holds expire on their own (30 min in the mock, see `reserveSticker`), so
 *  this screen polls rather than loading once: a hold that ages out must
 *  visibly drop off without a manual refresh, or a volunteer will believe an
 *  item is still spoken for after it isn't.
 *
 *  Sky is the held state across the product, so the countdown badge carries
 *  it — and turns to signal only when the hold is about to lapse, which is the
 *  one moment somebody has to act. */
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
      <PosScreen>
        <PosScreen.Body>
          <Banner tone="warn" title="Assign this phone to a stall first">
            Holds are per stall, so we need to know which one you&apos;re at.
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

  const list = holds.data ?? [];

  return (
    <PosScreen>
      <PosScreen.Body>
        {holds.error && <Banner tone="danger" title="Couldn't load holds">{holds.error}</Banner>}
        {release.error && <Banner tone="danger" title="Couldn't release that hold">{release.error}</Banner>}

        {holds.loading || catalogue.loading ? (
          <>
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </>
        ) : list.length === 0 ? (
          <EmptyState
            headline="No active holds"
            teach="A hold reserves an item for a customer who says they'll come back. It still counts as stock, but stops anyone else buying it. Holds expire on their own — release one early only if the customer isn't coming back."
          />
        ) : (
          <ul className="stagger flex flex-col gap-[var(--space-3)]">
            {list.map((h) => {
              const mins = minutesLeft(h);
              const urgent = mins <= 5;
              return (
                <li
                  key={h.id}
                  className="rounded-[var(--radius-lg)] border-[3px] border-[var(--color-ink)] bg-white p-[var(--space-3)]"
                >
                  <div className="flex items-start justify-between gap-[var(--space-3)]">
                    <div className="min-w-0">
                      <p>
                        <Mono className="t-md font-bold">{label(h)}</Mono>
                        <span className="ml-2 t-base text-[var(--color-muted)]">× {h.qty}</span>
                      </p>
                      {h.customer_name && (
                        <Text className="truncate">
                          {h.customer_name}
                          {h.customer_phone && (
                            <span className="text-[var(--color-muted)]"> · {h.customer_phone}</span>
                          )}
                        </Text>
                      )}
                    </div>
                    {/* Never colour alone: the badge says the minutes too. */}
                    <Badge tone={urgent ? "signal" : "sky"}>
                      <Mono>{mins <= 0 ? "expiring now" : `${mins} min left`}</Mono>
                    </Badge>
                  </div>

                  <ConfirmAction
                    className="mt-[var(--space-3)]"
                    variant="secondary"
                    block
                    busy={release.busy}
                    label="Release this hold"
                    confirmLabel={`Release ${label(h)} back to stock?`}
                    onConfirm={() => void doRelease(h.id)}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </PosScreen.Body>

      <PosScreen.Foot className="flex flex-col gap-[var(--space-2)]">
        <div className="flex items-end justify-between gap-[var(--space-3)]">
          <span className="t-label text-white/80">Held right now</span>
          <Mono className="t-xl">{list.length}</Mono>
        </div>
        <Button variant="primary" size="xl" block onClick={() => setReserving(true)}>
          Reserve for a customer
        </Button>
      </PosScreen.Foot>

      <Sheet
        open={reserving}
        onClose={() => setReserving(false)}
        title="Reserve for a customer"
        footer={
          <Button
            variant="primary"
            size="xl"
            block
            busy={create.busy}
            disabled={!itemKey || !customerName.trim()}
            onClick={() => void doReserve()}
          >
            Reserve
          </Button>
        }
      >
        <div className="flex flex-col gap-[var(--space-3)]">
          <Select label="Item" value={itemKey} onChange={(e) => setItemKey(e.target.value)}>
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
          </Select>
          <Field label="Qty" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} inputMode="numeric" />
          <Field label="Customer name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          <Field
            label="Customer phone (optional)"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            inputMode="tel"
          />
          <Banner tone="info">Holds for a named customer expire in 2 hours by default.</Banner>
          {create.error && <Banner tone="danger">{create.error}</Banner>}
        </div>
      </Sheet>
    </PosScreen>
  );
}

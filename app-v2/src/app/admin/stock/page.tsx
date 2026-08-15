"use client";

/** Stock allocation.
 *
 *  This is the operational face of the per-environment stock decision. Stock
 *  is not one org-wide number any more; it is a number per (transfer,
 *  location), where locations are the warehouse plus one per stall. Moving
 *  stock between them is a real, logged transfer — the same operation whether
 *  you're sending transfers out to a stall in the morning, rebalancing when
 *  Stall A runs dry and Stall B has twelve, or bringing everything back at
 *  close.
 *
 *  The matrix view is the point. A per-stall list would answer "what does
 *  Stall A have" but not "who has the M-001s", and the second question is the
 *  one you ask when a stall runs out mid-event.
 *
 *  Colour budget: orange marks a location about to run dry, cobalt is the one
 *  primary action. The matrix itself is a single neutral tone — two hundred
 *  cells in six colours is a heat map nobody asked for. */

import { useMemo, useState } from "react";
import { getBackend } from "@/lib/backend";
import { useAction, useAsync } from "@/lib/hooks/useAsync";
import type { StockRow } from "@/lib/domain/types";
import { AdminShell, NumHead } from "@/features/admin/AdminShell";
import {
  Badge,
  Banner,
  Button,
  EmptyState,
  Field,
  Nudge,
  Panel,
  Sheet,
  Select,
  Skeleton,
  Table,
  Td,
  Text,
  Th,
} from "@/components/ui";
import { clsx } from "@/components/clsx";

/** A stall with one to three left will run out during the event, and nobody
 *  looks at this page again once doors open. Marked, and stated in words for
 *  anyone who can't see the colour. */
const LOW_STOCK_AT_OR_BELOW = 3;

export default function StockAllocationPage() {
  const locations = useAsync(() => getBackend().listStockLocations(), []);
  const catalogue = useAsync(() => getBackend().getCatalogue(), []);
  const [version, setVersion] = useState(0);

  const allStock = useAsync(async () => {
    const locs = await getBackend().listStockLocations();
    if (!locs.ok) return locs;
    const rows: StockRow[] = [];
    for (const l of locs.data) {
      const r = await getBackend().getStock(l.id);
      if (r.ok) rows.push(...r.data);
    }
    return { ok: true as const, data: rows };
  }, [version]);

  const { run, busy, error, clearError } = useAction();
  const [moving, setMoving] = useState<{ skuType: "product" | "sticker"; skuId: string; code: string } | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [qty, setQty] = useState("1");

  const byKey = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of allStock.data ?? []) m.set(`${r.location_id}|${r.sku_id}`, r.qty);
    return m;
  }, [allStock.data]);

  const locs = locations.data ?? [];

  // Both transfer types (stickers) and product SKUs (apparel) live on the
  // same per-location stall_stock table — the matrix has to show both, or an
  // admin has no way to move apparel between the warehouse and a stall at all.
  const items = useMemo(() => {
    const colorById = new Map((catalogue.data?.colors ?? []).map((c) => [c.id, c.name]));
    const fitById = new Map((catalogue.data?.fits ?? []).map((f) => [f.id, f.name]));
    const designItems = (catalogue.data?.designs ?? []).map((d) => ({
      id: d.id,
      type: "sticker" as const,
      code: d.code,
      name: d.name,
    }));
    const skuItems = (catalogue.data?.skus ?? []).map((s) => ({
      id: s.id,
      type: "product" as const,
      code: s.sku_code,
      name: [colorById.get(s.color_id), fitById.get(s.fit_id), s.size].filter(Boolean).join(" · "),
    }));
    return [...skuItems, ...designItems];
  }, [catalogue.data]);

  const doTransfer = async () => {
    if (!moving) return;
    const res = await run(() =>
      getBackend().transferStock({
        from_location_id: from,
        to_location_id: to,
        sku_type: moving.skuType,
        sku_id: moving.skuId,
        qty: Number(qty) || 0,
        actor: "admin",
      })
    );
    if (res) {
      setMoving(null);
      setVersion((v) => v + 1);
    }
  };

  /** What the source location actually holds of the thing being moved. Shown
   *  next to the field, because "not enough stock" arriving from the server
   *  after a tap is a worse way to learn it. */
  const availableAtSource = moving ? (byKey.get(`${from}|${moving.skuId}`) ?? 0) : 0;
  const wanted = Number(qty) || 0;
  const overdrawn = wanted > availableAtSource;
  const sameLocation = from === to && from !== "";

  return (
    <AdminShell
      title="Stock allocation"
      lede="Each stall sells from its own allocation. Stock sitting in the warehouse cannot be sold by anyone — send it to a stall first."
    >
      {error && (
        <Banner
          tone="danger"
          title="Couldn't move that"
          action={
            <Button size="sm" surface="admin" variant="ghost" onClick={clearError}>
              Dismiss
            </Button>
          }
        >
          {error}
        </Banner>
      )}

      {allStock.error && (
        <Banner tone="danger" title="Couldn't load stock levels">
          {allStock.error}
        </Banner>
      )}

      {allStock.loading || catalogue.loading ? (
        <Skeleton className="h-72" />
      ) : items.length === 0 ? (
        <EmptyState
          headline="Nothing in the catalogue yet"
          teach="Stock is counted per transfer, per location. Add transfers or product SKUs on the Catalogue page and they appear here with a column for every stall."
        />
      ) : (
        <Panel title="Everything, by location" className="animate-rise">
          <Table
            className="min-w-[900px]"
            caption="Stock held at each location for every transfer and product SKU"
            head={[
              "Item",
              "Type",
              ...locs.map((l) => (
                <NumHead key={l.id}>{l.is_warehouse ? "Warehouse" : l.name.replace(/ —.*/, "")}</NumHead>
              )),
              <NumHead key="total">Total</NumHead>,
              <span key="act" className="sr-only">
                Move stock
              </span>,
            ]}
          >
            {items.map((item) => {
              const total = locs.reduce((n, l) => n + (byKey.get(`${l.id}|${item.id}`) ?? 0), 0);
              return (
                <tr key={`${item.type}:${item.id}`}>
                  <Th>
                    <span className="font-[family-name:var(--font-mono)]">{item.code}</span>
                    <span className="ml-2 font-normal text-[var(--color-muted)]">{item.name}</span>
                  </Th>
                  <Td className="text-[var(--color-muted)]">{item.type === "product" ? "Apparel" : "Transfer"}</Td>
                  {locs.map((l) => {
                    const q = byKey.get(`${l.id}|${item.id}`) ?? 0;
                    const low = !l.is_warehouse && q > 0 && q <= LOW_STOCK_AT_OR_BELOW;
                    return (
                      <Td key={l.id} mono className="text-right">
                        {q < 0 ? (
                          <span className="font-bold text-[var(--color-signal)]">
                            {q}
                            <span className="sr-only"> — negative, this needs reconciling</span>
                          </span>
                        ) : low ? (
                          <Badge tone="orange">
                            {q} left
                          </Badge>
                        ) : (
                          <span className={clsx(q === 0 && "text-[var(--color-muted)]")}>{q}</span>
                        )}
                      </Td>
                    );
                  })}
                  <Td mono className="text-right font-bold">
                    {total}
                  </Td>
                  <Td className="text-right">
                    <Button
                      size="sm"
                      surface="admin"
                      variant="secondary"
                      onClick={() => {
                        setMoving({ skuType: item.type, skuId: item.id, code: item.code });
                        setFrom(locs.find((l) => l.is_warehouse)?.id ?? "");
                        setTo(locs.find((l) => !l.is_warehouse)?.id ?? "");
                        setQty("1");
                      }}
                    >
                      Move…
                      <span className="sr-only"> {item.code}</span>
                    </Button>
                  </Td>
                </tr>
              );
            })}
          </Table>
        </Panel>
      )}

      <Sheet
        open={Boolean(moving)}
        onClose={() => setMoving(null)}
        title={`Move ${moving?.code ?? ""}`}
        footer={
          <Button
            variant="primary"
            size="lg"
            block
            busy={busy}
            disabled={!from || !to || sameLocation || wanted < 1 || overdrawn}
            onClick={doTransfer}
          >
            Move {wanted}
          </Button>
        }
      >
        <div className="flex flex-col gap-[var(--space-4)]">
          <Text step="sm" muted>
            Moving stock is logged as a real transfer. It changes what each stall can sell right now, so the physical
            box needs to move too.
          </Text>

          <Select surface="admin" id="stock-from" label="From" value={from} onChange={(e) => setFrom(e.target.value)}>
            {locs.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} — has {byKey.get(`${l.id}|${moving?.skuId}`) ?? 0}
              </option>
            ))}
          </Select>

          <Select surface="admin" id="stock-to" label="To" value={to} onChange={(e) => setTo(e.target.value)}>
            {locs.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} — has {byKey.get(`${l.id}|${moving?.skuId}`) ?? 0}
              </option>
            ))}
          </Select>

          <Field
            surface="admin"
            label="How many"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            inputMode="numeric"
            hint={`${availableAtSource} available where you're moving from.`}
            error={
              overdrawn
                ? `Only ${availableAtSource} there. Moving more would leave that location negative.`
                : undefined
            }
          />

          {sameLocation && <Nudge>Pick two different locations — a transfer from a place to itself does nothing.</Nudge>}
        </div>
      </Sheet>
    </AdminShell>
  );
}

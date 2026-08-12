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
 *  one you ask when a stall runs out mid-event. */

import { useMemo, useState } from "react";
import { getBackend } from "@/lib/backend";
import { useAction, useAsync } from "@/lib/hooks/useAsync";
import type { StockRow } from "@/lib/domain/types";
import { AdminShell, ScrollX } from "@/features/admin/AdminShell";
import { Banner, Button, EmptyState, Field, Panel, Sheet, Skeleton } from "@/components/ui";
import { clsx } from "@/components/clsx";

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

  return (
    <AdminShell title="Stock allocation">
      <Banner tone="info" className="mb-4">
        Each stall sells from its own allocation. A transfer sitting in the warehouse cannot be sold by anyone — send
        it to a stall first. Two stalls will legitimately show different catalogues to customers, because they
        genuinely have different boxes.
      </Banner>

      {error && (
        <Banner tone="danger" className="mb-4" action={<Button size="sm" variant="ghost" onClick={clearError}>Dismiss</Button>}>
          {error}
        </Banner>
      )}

      {allStock.loading || catalogue.loading ? (
        <Skeleton className="h-72" />
      ) : items.length === 0 ? (
        <EmptyState headline="Nothing in the catalogue yet" teach="Add transfers or product SKUs on the Catalogue page before allocating stock." />
      ) : (
        <Panel title="Transfers by location">
          <ScrollX>
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-[var(--color-ink)] text-left">
                  <th scope="col" className="py-2 pr-4 font-bold">
                    Transfer
                  </th>
                  {locs.map((l) => (
                    <th key={l.id} scope="col" className="px-3 py-2 text-right font-bold">
                      {l.is_warehouse ? "Warehouse" : l.name.replace(/ —.*/, "")}
                    </th>
                  ))}
                  <th scope="col" className="px-3 py-2 text-right font-bold">
                    Total
                  </th>
                  <th scope="col" className="py-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const total = locs.reduce((n, l) => n + (byKey.get(`${l.id}|${item.id}`) ?? 0), 0);
                  return (
                    <tr key={`${item.type}:${item.id}`} className="border-b border-[var(--color-line)]">
                      <th scope="row" className="py-2.5 pr-4 text-left font-normal">
                        <span className="font-[family-name:var(--font-mono)] font-bold">{item.code}</span>
                        <span className="ml-2 text-[var(--color-muted)]">{item.name}</span>
                        <span className="ml-2 rounded bg-[var(--color-cream)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--color-muted)]">
                          {item.type === "product" ? "Apparel" : "Transfer"}
                        </span>
                      </th>
                      {locs.map((l) => {
                        const q = byKey.get(`${l.id}|${item.id}`) ?? 0;
                        return (
                          <td
                            key={l.id}
                            className={clsx(
                              "px-3 py-2.5 text-right font-[family-name:var(--font-mono)] tnum",
                              q === 0 && !l.is_warehouse && "text-[var(--color-muted)]"
                            )}
                          >
                            {q}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2.5 text-right font-[family-name:var(--font-mono)] font-bold tnum">
                        {total}
                      </td>
                      <td className="py-2.5 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setMoving({ skuType: item.type, skuId: item.id, code: item.code });
                            setFrom(locs.find((l) => l.is_warehouse)?.id ?? "");
                            setTo(locs.find((l) => !l.is_warehouse)?.id ?? "");
                            setQty("1");
                          }}
                        >
                          Move
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollX>
        </Panel>
      )}

      <Sheet
        open={Boolean(moving)}
        onClose={() => setMoving(null)}
        title={`Move ${moving?.code ?? ""}`}
        footer={
          <Button variant="primary" size="lg" block busy={busy} disabled={!from || !to || from === to} onClick={doTransfer}>
            Move {qty || 0}
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="from" className="text-sm font-semibold">
              From
            </label>
            <select
              id="from"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1.5 min-h-[52px] w-full rounded-lg border-2 border-[var(--color-line)] bg-white px-3 text-base"
            >
              {locs.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({byKey.get(`${l.id}|${moving?.skuId}`) ?? 0})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="to" className="text-sm font-semibold">
              To
            </label>
            <select
              id="to"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1.5 min-h-[52px] w-full rounded-lg border-2 border-[var(--color-line)] bg-white px-3 text-base"
            >
              {locs.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({byKey.get(`${l.id}|${moving?.skuId}`) ?? 0})
                </option>
              ))}
            </select>
          </div>
          <Field label="How many" value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric" />
          {from === to && from !== "" && (
            <p className="text-sm font-semibold text-[var(--color-signal)]">Pick two different locations.</p>
          )}
        </div>
      </Sheet>
    </AdminShell>
  );
}

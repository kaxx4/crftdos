"use client";

/** Pricing.
 *
 *  Prices SNAPSHOT onto order lines at sale time — editing here never rewrites
 *  history. Every save below only changes what the NEXT sale charges; past
 *  orders keep whatever price they were charged at checkout. */

import { useState } from "react";
import { getBackend } from "@/lib/backend";
import { useAction, useAsync } from "@/lib/hooks/useAsync";
import { money } from "@/lib/money";
import { AdminShell, ScrollX } from "@/features/admin/AdminShell";
import { Banner, Button, Field, Panel, Skeleton } from "@/components/ui";

function PriceCostCell({
  value,
  onSave,
  busy,
}: {
  value: number;
  onSave: (n: number) => void;
  busy: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(value);

  const commit = () => {
    const n = Number(draft);
    if (draft != null && draft !== "" && Number.isFinite(n)) onSave(n);
    setDraft(null);
  };

  return (
    <input
      value={shown}
      disabled={busy}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      inputMode="decimal"
      className="min-h-[40px] w-24 rounded-md border-2 border-[var(--color-line)] bg-white px-2 text-sm font-[family-name:var(--font-mono)] tnum focus:border-[var(--color-blue)]"
    />
  );
}

export default function AdminPricingPage() {
  const catalogue = useAsync(() => getBackend().getCatalogue(), []);
  const { run, busy, error, clearError } = useAction();

  const [bulkFit, setBulkFit] = useState("");
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkCost, setBulkCost] = useState("");
  const [bulkDone, setBulkDone] = useState<string | null>(null);

  const fits = catalogue.data?.fits ?? [];
  const skus = catalogue.data?.skus ?? [];
  const designs = catalogue.data?.designs ?? [];

  async function saveSku(id: string, field: "unit_price" | "unit_cost", n: number) {
    setBulkDone(null);
    const updated = await run(() => getBackend().setSkuPricing({ type: "product", id, [field]: n }));
    if (updated) {
      catalogue.setData((prev) =>
        prev ? { ...prev, skus: prev.skus.map((s) => (s.id === id ? { ...s, ...updated } : s)) } : prev
      );
    }
  }

  async function saveDesign(id: string, field: "unit_price" | "unit_cost", n: number) {
    setBulkDone(null);
    const updated = await run(() => getBackend().setSkuPricing({ type: "sticker", id, [field]: n }));
    if (updated) {
      catalogue.setData((prev) =>
        prev ? { ...prev, designs: prev.designs.map((d) => (d.id === id ? { ...d, ...updated } : d)) } : prev
      );
    }
  }

  async function bulkSet() {
    setBulkDone(null);
    if (!bulkFit) return;
    const price = bulkPrice.trim() === "" ? undefined : Number(bulkPrice);
    const cost = bulkCost.trim() === "" ? undefined : Number(bulkCost);
    if (price === undefined && cost === undefined) return;
    const result = await run(() =>
      getBackend().bulkSetPricingByFit({ fit_name: bulkFit, unit_price: price, unit_cost: cost })
    );
    if (result !== null) {
      setBulkDone(bulkFit);
      void catalogue.reload();
    }
  }

  const fitName = (fitId: string) => fits.find((f) => f.id === fitId)?.name ?? fitId;

  return (
    <AdminShell title="Pricing">
      <Banner tone="info" className="mb-5">
        Changing a price here never touches past orders — it only sets what the <strong>next</strong> sale charges.
        Order lines snapshot the price at checkout, so history stays exactly as it was charged.
      </Banner>

      {error && (
        <Banner tone="danger" title="Couldn't save that" className="mb-5" action={<Button size="sm" variant="ghost" onClick={clearError}>Dismiss</Button>}>
          {error}
        </Banner>
      )}

      <Panel title="Bulk set by fit" className="mb-5">
        <p className="mb-3 max-w-[70ch] text-sm text-[var(--color-muted)]">
          Applies to every product SKU with the chosen fit. Leave price or cost blank to leave it unchanged.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="bulk-fit" className="text-sm font-semibold text-[var(--color-ink)]">
              Fit
            </label>
            <select
              id="bulk-fit"
              value={bulkFit}
              onChange={(e) => {
                setBulkFit(e.target.value);
                setBulkDone(null);
              }}
              className="min-h-[52px] rounded-lg border-2 border-[var(--color-line)] bg-white px-3.5 text-base focus:border-[var(--color-blue)]"
            >
              <option value="">Select a fit…</option>
              {fits.map((f) => (
                <option key={f.id} value={f.name}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <Field
            label="Price"
            value={bulkPrice}
            onChange={(e) => {
              setBulkPrice(e.target.value);
              setBulkDone(null);
            }}
            inputMode="decimal"
            placeholder="399"
            className="w-32"
          />
          <Field
            label="Cost"
            value={bulkCost}
            onChange={(e) => {
              setBulkCost(e.target.value);
              setBulkDone(null);
            }}
            inputMode="decimal"
            placeholder="150"
            className="w-32"
          />
          <Button variant="primary" busy={busy} disabled={!bulkFit} onClick={bulkSet}>
            Set all
          </Button>
          {bulkDone && (
            <span className="text-sm font-semibold text-[var(--color-teal)]">Applied to {bulkDone}.</span>
          )}
        </div>
      </Panel>

      <Panel title="Product SKUs" className="mb-5">
        {catalogue.loading ? (
          <Skeleton className="h-64" />
        ) : skus.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">No product SKUs yet.</p>
        ) : (
          <ScrollX>
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-[var(--color-ink)] text-left">
                  {["SKU", "Fit", "Size", "Cost", "Price", "Margin"].map((h) => (
                    <th key={h} scope="col" className="py-2 pr-4 font-bold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {skus.map((s) => (
                  <tr key={s.id} className="border-b border-[var(--color-line)]">
                    <th scope="row" className="py-2.5 pr-4 text-left font-[family-name:var(--font-mono)] font-bold">
                      {s.sku_code}
                    </th>
                    <td className="py-2.5 pr-4">{fitName(s.fit_id)}</td>
                    <td className="py-2.5 pr-4">{s.size}</td>
                    <td className="py-2.5 pr-4">
                      <PriceCostCell value={s.unit_cost} busy={busy} onSave={(n) => saveSku(s.id, "unit_cost", n)} />
                    </td>
                    <td className="py-2.5 pr-4">
                      <PriceCostCell value={s.unit_price} busy={busy} onSave={(n) => saveSku(s.id, "unit_price", n)} />
                    </td>
                    <td className="py-2.5 pr-4 font-[family-name:var(--font-mono)] font-bold tnum">
                      {money(s.unit_price - s.unit_cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollX>
        )}
      </Panel>

      <Panel title="Sticker designs">
        {catalogue.loading ? (
          <Skeleton className="h-64" />
        ) : designs.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">No sticker designs yet.</p>
        ) : (
          <ScrollX>
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-[var(--color-ink)] text-left">
                  {["Code", "Name", "Cost", "Price", "Margin"].map((h) => (
                    <th key={h} scope="col" className="py-2 pr-4 font-bold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {designs.map((d) => (
                  <tr key={d.id} className="border-b border-[var(--color-line)]">
                    <th scope="row" className="py-2.5 pr-4 text-left font-[family-name:var(--font-mono)] font-bold">
                      {d.code}
                    </th>
                    <td className="py-2.5 pr-4">{d.name}</td>
                    <td className="py-2.5 pr-4">
                      <PriceCostCell value={d.unit_cost} busy={busy} onSave={(n) => saveDesign(d.id, "unit_cost", n)} />
                    </td>
                    <td className="py-2.5 pr-4">
                      <PriceCostCell value={d.unit_price} busy={busy} onSave={(n) => saveDesign(d.id, "unit_price", n)} />
                    </td>
                    <td className="py-2.5 pr-4 font-[family-name:var(--font-mono)] font-bold tnum">
                      {money(d.unit_price - d.unit_cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollX>
        )}
      </Panel>
    </AdminShell>
  );
}

"use client";

/** Pricing.
 *
 *  Prices SNAPSHOT onto order lines at sale time — editing here never rewrites
 *  history. Every save below only changes what the NEXT sale charges; past
 *  orders keep whatever price they were charged at checkout.
 *
 *  Two edit surfaces with very different blast radii sit on one page, so they
 *  are guarded differently: a single cell needs a deliberate second tap, and
 *  the bulk-by-fit control — which can rewrite dozens of SKUs from one click —
 *  is armed by `ConfirmAction` and states the count before it commits.
 *
 *  Colour budget: sky on the standing explanation, cobalt on the two save
 *  actions. Signal appears only on a negative margin, which is a real "stop". */

import { useState } from "react";
import { getBackend } from "@/lib/backend";
import { useAction, useAsync } from "@/lib/hooks/useAsync";
import { money } from "@/lib/money";
import { AdminShell, AdminSelect, NumHead } from "@/features/admin/AdminShell";
import {
  Badge,
  Banner,
  Button,
  ConfirmAction,
  EmptyState,
  Field,
  Panel,
  Skeleton,
  Table,
  Td,
  Text,
  Th,
} from "@/components/ui";

/** An editable money cell.
 *
 *  The visible label for this control is its column head — `aria-label`
 *  carries the row identity that a column head alone cannot ("Price for
 *  TR-M-BLK"), which is the one case where a labelled `Field` would be worse:
 *  a hundred repeated visible labels down a table column is noise, not help. */
function PriceCostCell({
  value,
  onSave,
  busy,
  label,
}: {
  value: number;
  onSave: (n: number) => void;
  busy: boolean;
  label: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(value);
  const n = draft != null ? Number(draft) : null;
  const dirty = draft != null && draft !== "" && Number.isFinite(n) && n !== value;

  const cancel = () => setDraft(null);
  const commit = () => {
    if (dirty && n != null) onSave(n);
    setDraft(null);
  };

  return (
    <div className="flex items-center gap-[var(--space-2)]">
      <input
        value={shown}
        disabled={busy}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") cancel();
        }}
        inputMode="decimal"
        aria-label={label}
        className={cellInputClass(dirty)}
      />
      {/* No auto-commit on blur: a stray tap while scrolling this table used to
          silently rewrite what the next sale charges. Saving now needs a
          deliberate second tap. The slot is reserved at a fixed width so an
          appearing button never shunts the column sideways mid-edit. */}
      <span className="inline-flex w-[136px] shrink-0">
        {dirty && (
          <ConfirmAction
            size="sm"
            surface="admin"
            variant="primary"
            busy={busy}
            block
            label="Save"
            confirmLabel={`Charge ${money(Number(n))}?`}
            onConfirm={commit}
          />
        )}
      </span>
    </div>
  );
}

function cellInputClass(dirty: boolean) {
  return [
    "w-24 min-h-[var(--tap-admin)] rounded-[var(--radius-sm)] border-[3px] bg-white px-2",
    "t-sm font-[family-name:var(--font-mono)] tnum font-bold",
    "transition-[background-color,border-color] duration-[var(--dur-fast)] ease-[var(--ease-out)]",
    dirty ? "border-[var(--color-cobalt)] bg-[var(--color-yellow-wash)]" : "border-[var(--color-ink)]",
  ].join(" ");
}

function MarginCell({ price, cost }: { price: number; cost: number }) {
  const m = price - cost;
  if (m < 0) {
    return (
      <span className="inline-flex items-center gap-[var(--space-2)]">
        <Badge tone="signal">Loss</Badge>
        <span className="font-[family-name:var(--font-mono)] tnum font-bold text-[var(--color-signal)]">
          {money(m)}
        </span>
      </span>
    );
  }
  return <span className="font-[family-name:var(--font-mono)] tnum font-bold">{money(m)}</span>;
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

  /** How many SKUs the bulk control is actually about to rewrite. Stating the
   *  number is the difference between friction and theatre. */
  const bulkCount = bulkFit ? skus.filter((s) => fitName(s.fit_id) === bulkFit).length : 0;
  const bulkReady = Boolean(bulkFit) && (bulkPrice.trim() !== "" || bulkCost.trim() !== "");

  return (
    <AdminShell
      title="Pricing"
      lede="What the next sale charges. Past orders keep the price they were charged at checkout — nothing here rewrites history."
    >
      {error && (
        <Banner
          tone="danger"
          title="Couldn't save that"
          action={
            <Button size="sm" surface="admin" variant="ghost" onClick={clearError}>
              Dismiss
            </Button>
          }
        >
          {error}
        </Banner>
      )}

      {catalogue.error && (
        <Banner tone="danger" title="Couldn't load the catalogue">
          {catalogue.error}
        </Banner>
      )}

      <Panel title="Bulk set by fit">
        <Text step="sm" muted className="mb-[var(--space-3)] max-w-[70ch]">
          Applies to every product SKU with the chosen fit at once. Leave price or cost blank to leave it unchanged.
        </Text>
        <div className="flex flex-wrap items-end gap-[var(--space-3)]">
          <AdminSelect
            id="bulk-fit"
            label="Fit"
            className="w-56"
            value={bulkFit}
            onChange={(e) => {
              setBulkFit(e.target.value);
              setBulkDone(null);
            }}
          >
            <option value="">Select a fit…</option>
            {fits.map((f) => (
              <option key={f.id} value={f.name}>
                {f.name}
              </option>
            ))}
          </AdminSelect>
          <Field
            surface="admin"
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
            surface="admin"
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
          {/* One click here can rewrite dozens of prices. It is armed, and the
              armed label says how many. */}
          <ConfirmAction
            size="sm"
            surface="admin"
            variant="primary"
            busy={busy}
            disabled={!bulkReady}
            label="Set all"
            confirmLabel={`Rewrite ${bulkCount} SKU${bulkCount === 1 ? "" : "s"}?`}
            onConfirm={bulkSet}
          />
        </div>
        {bulkDone && (
          <p role="status" className="mt-[var(--space-3)] t-sm font-extrabold text-[var(--color-acid-deep)]">
            Applied to every {bulkDone} SKU.
          </p>
        )}
      </Panel>

      <Panel title="Product SKUs">
        {catalogue.loading ? (
          <Skeleton className="h-64" />
        ) : skus.length === 0 ? (
          <EmptyState
            headline="No product SKUs yet"
            teach="A product SKU is one colour, fit and size of garment. Until one exists there is nothing for a transfer to be pressed onto."
          />
        ) : (
          <Table
            className="min-w-[820px]"
            caption="Product SKU cost and price, editable in place"
            head={["SKU", "Fit", "Size", "Cost", "Price", <NumHead key="m">Margin</NumHead>]}
          >
            {skus.map((s) => (
              <tr key={s.id}>
                <Th className="font-[family-name:var(--font-mono)]">{s.sku_code}</Th>
                <Td>{fitName(s.fit_id)}</Td>
                <Td>{s.size}</Td>
                <Td>
                  <PriceCostCell
                    value={s.unit_cost}
                    busy={busy}
                    label={`Cost for ${s.sku_code}`}
                    onSave={(n) => saveSku(s.id, "unit_cost", n)}
                  />
                </Td>
                <Td>
                  <PriceCostCell
                    value={s.unit_price}
                    busy={busy}
                    label={`Price for ${s.sku_code}`}
                    onSave={(n) => saveSku(s.id, "unit_price", n)}
                  />
                </Td>
                <Td className="text-right">
                  <MarginCell price={s.unit_price} cost={s.unit_cost} />
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>

      <Panel title="Sticker designs">
        {catalogue.loading ? (
          <Skeleton className="h-64" />
        ) : designs.length === 0 ? (
          <EmptyState
            headline="No sticker designs yet"
            teach="Designs are the transfers themselves. Add them on the Catalogue page and their cost and price become editable here."
          />
        ) : (
          <Table
            className="min-w-[760px]"
            caption="Sticker design cost and price, editable in place"
            head={["Code", "Name", "Cost", "Price", <NumHead key="m">Margin</NumHead>]}
          >
            {designs.map((d) => (
              <tr key={d.id}>
                <Th className="font-[family-name:var(--font-mono)]">{d.code}</Th>
                <Td>{d.name}</Td>
                <Td>
                  <PriceCostCell
                    value={d.unit_cost}
                    busy={busy}
                    label={`Cost for ${d.code}`}
                    onSave={(n) => saveDesign(d.id, "unit_cost", n)}
                  />
                </Td>
                <Td>
                  <PriceCostCell
                    value={d.unit_price}
                    busy={busy}
                    label={`Price for ${d.code}`}
                    onSave={(n) => saveDesign(d.id, "unit_price", n)}
                  />
                </Td>
                <Td className="text-right">
                  <MarginCell price={d.unit_price} cost={d.unit_cost} />
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>

      <Banner tone="info">
        Changing a price here never touches past orders — it only sets what the <strong>next</strong> sale charges.
        Order lines snapshot the price at checkout, so history stays exactly as it was charged.
      </Banner>
    </AdminShell>
  );
}

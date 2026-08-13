"use client";

/** Bulk one-off entry.
 *
 *  Retrospective admin-entered orders — a DM sale, a forgotten till entry.
 *  Creates a single admin order from a short list of lines. Stock can refuse
 *  a line without failing the whole order; the response's `failed` array says
 *  which SKUs ran short, and that's surfaced rather than hidden.
 *
 *  The lines are a table, not a stack of form rows: they are columns of the
 *  same three things repeated, the column heads are the labels, and the money
 *  column lines up on its right edge so the total is checkable by eye before
 *  anyone commits it.
 *
 *  Colour budget: cobalt on the one primary action; acid or yellow on the
 *  single transient result banner. */

import { useState } from "react";
import { getBackend } from "@/lib/backend";
import { useAsync, useAction } from "@/lib/hooks/useAsync";
import type { PaymentMethod } from "@/lib/domain/types";
import { AdminShell, NumHead } from "@/features/admin/AdminShell";
import {
  Banner,
  Button,
  ConfirmAction,
  EmptyState,
  Field,
  Mono,
  Panel,
  Select,
  Skeleton,
  Table,
  Td,
  Text,
} from "@/components/ui";
import { money } from "@/lib/money";

type Line = { product_sku_id: string; qty: string };

const PAYMENT_METHODS: PaymentMethod[] = ["cash", "upi", "split", "pending"];

export default function BulkEntryPage() {
  const catalogue = useAsync(() => getBackend().getCatalogue(), []);
  const { run, busy, error, clearError } = useAction();

  const [lines, setLines] = useState<Line[]>([{ product_sku_id: "", qty: "1" }]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [note, setNote] = useState("Bulk one-off entry");
  const [result, setResult] = useState<{ receipt: string; warning?: string; failed?: string[] } | null>(null);

  const skus = catalogue.data?.skus.filter((s) => s.is_active) ?? [];

  const updateLine = (i: number, patch: Partial<Line>) => {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  };

  const removeLine = (i: number) => {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  };

  const submit = async () => {
    setResult(null);
    const items = lines
      .filter((l) => l.product_sku_id && Number(l.qty) > 0)
      .map((l) => {
        const sku = skus.find((s) => s.id === l.product_sku_id)!;
        return { product_sku_id: sku.id, qty: Number(l.qty), unit_price: sku.unit_price, unit_cost: sku.unit_cost };
      });
    if (!items.length) return;

    const res = await run(() =>
      getBackend().createBulkOrder({ items, payment_method: paymentMethod, note: note || null })
    );
    if (res) {
      setResult({ receipt: res.order.receipt_no ?? res.order.id, warning: res.warning, failed: res.failed });
      setLines([{ product_sku_id: "", qty: "1" }]);
    }
  };

  const total = lines.reduce((n, l) => {
    const sku = skus.find((s) => s.id === l.product_sku_id);
    return n + (sku ? sku.unit_price * (Number(l.qty) || 0) : 0);
  }, 0);

  const filledLines = lines.filter((l) => l.product_sku_id && Number(l.qty) > 0).length;

  return (
    <AdminShell
      title="Bulk one-off entry"
      lede="For a sale that happened away from the till — a DM order, a forgotten entry. It creates one real order and takes the stock with it."
    >
      {error && (
        <Banner
          tone="danger"
          title="Couldn't create that order"
          action={
            <Button size="sm" surface="admin" variant="ghost" onClick={clearError}>
              Dismiss
            </Button>
          }
        >
          {error}
        </Banner>
      )}

      {result && (
        <Banner tone={result.failed?.length ? "warn" : "success"} title={`Order ${result.receipt} created.`}>
          {result.warning && <p>{result.warning}</p>}
          {result.failed && result.failed.length > 0 && (
            <p>Short on stock for: {result.failed.join(", ")}. Those lines did not take stock.</p>
          )}
          {!result.warning && !result.failed?.length && <p>Stock has been taken for every line.</p>}
        </Banner>
      )}

      {catalogue.loading ? (
        <Skeleton className="h-72" />
      ) : skus.length === 0 ? (
        <EmptyState
          headline="No active product SKUs"
          teach="A bulk entry sells the same SKUs the till sells. Activate at least one product SKU on the Catalogue page and it becomes selectable here."
        />
      ) : (
        <>
          <Panel title="Lines">
            <Table
              className="min-w-[720px]"
              caption="Lines in this bulk order"
              head={[
                "Product SKU",
                <NumHead key="q">Qty</NumHead>,
                <NumHead key="t">Line total</NumHead>,
                <span key="r" className="sr-only">
                  Remove
                </span>,
              ]}
            >
              {lines.map((l, i) => {
                const sku = skus.find((s) => s.id === l.product_sku_id);
                return (
                  <tr key={i}>
                    <Td>
                      <Select surface="admin"
                        id={`sku-${i}`}
                        label={`Product SKU for line ${i + 1}`}
                        labelHidden
                        value={l.product_sku_id}
                        onChange={(e) => updateLine(i, { product_sku_id: e.target.value })}
                      >
                        <option value="">Select SKU…</option>
                        {skus.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.sku_code} ({money(s.unit_price)})
                          </option>
                        ))}
                      </Select>
                    </Td>
                    <Td>
                      <input
                        value={l.qty}
                        onChange={(e) => updateLine(i, { qty: e.target.value })}
                        inputMode="numeric"
                        aria-label={`Quantity for line ${i + 1}`}
                        className="ml-auto block w-20 min-h-[var(--tap-admin)] rounded-[var(--radius-sm)] border-[3px] border-[var(--color-ink)] bg-white px-2 text-right t-sm font-[family-name:var(--font-mono)] tnum font-bold focus:bg-[var(--color-yellow-wash)]"
                      />
                    </Td>
                    <Td mono className="text-right font-bold">
                      {sku ? money(sku.unit_price * (Number(l.qty) || 0)) : "—"}
                    </Td>
                    <Td className="text-right">
                      <Button
                        size="sm"
                        surface="admin"
                        variant="ghost"
                        onClick={() => removeLine(i)}
                        disabled={lines.length === 1}
                        aria-label={`Remove line ${i + 1}`}
                      >
                        ✕
                      </Button>
                    </Td>
                  </tr>
                );
              })}
            </Table>

            <div className="mt-[var(--space-3)]">
              <Button
                surface="admin"
                size="sm"
                variant="secondary"
                onClick={() => setLines((prev) => [...prev, { product_sku_id: "", qty: "1" }])}
              >
                + Add line
              </Button>
            </div>
          </Panel>

          <Panel title="How it was paid">
            <div className="grid gap-[var(--space-3)] sm:grid-cols-2">
              <Select surface="admin"
                id="payment-method"
                label="Payment method"
                className="capitalize"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m} className="capitalize">
                    {m}
                  </option>
                ))}
              </Select>
              <Field
                surface="admin"
                label="Note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                hint="Why this order was entered by hand. It stays on the order."
              />
            </div>
          </Panel>

          {/* The commit region is ink and sits at the end of the flow, so the
              total and the button that charges it are read together. Creating
              the order takes real stock, so it is armed rather than one-tap. */}
          <div className="on-deep flex flex-wrap items-center justify-between gap-[var(--space-4)] rounded-[var(--radius-lg)] border-[3px] border-[var(--color-ink)] bg-[var(--color-ink)] p-[var(--space-4)] text-white">
            <div>
              <p className="t-label text-white/80">Order total</p>
              <p className="t-xl font-[family-name:var(--font-mono)] tnum">{money(total)}</p>
              <Text step="sm" className="mt-1 text-white/80">
                {filledLines} line{filledLines === 1 ? "" : "s"} · stock comes off the warehouse when you commit.
              </Text>
            </div>
            <ConfirmAction
              variant="primary"
              size="lg"
              surface="admin"
              busy={busy}
              disabled={filledLines === 0}
              label="Create bulk order"
              confirmLabel={<span>Commit <Mono>{money(total)}</Mono>?</span>}
              onConfirm={submit}
            />
          </div>
        </>
      )}
    </AdminShell>
  );
}

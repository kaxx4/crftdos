"use client";

/** Bulk one-off entry.
 *
 *  Retrospective admin-entered orders — a DM sale, a forgotten till entry.
 *  Creates a single admin order from a short list of lines. Stock can refuse
 *  a line without failing the whole order; the response's `failed` array says
 *  which SKUs ran short, and that's surfaced rather than hidden. */

import { useState } from "react";
import { getBackend } from "@/lib/backend";
import { useAsync, useAction } from "@/lib/hooks/useAsync";
import type { PaymentMethod } from "@/lib/domain/types";
import { AdminShell } from "@/features/admin/AdminShell";
import { Banner, Button, Field, Panel, Skeleton } from "@/components/ui";
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

    const res = await run(() => getBackend().createBulkOrder({ items, payment_method: paymentMethod, note: note || null }));
    if (res) {
      setResult({ receipt: res.order.receipt_no ?? res.order.id, warning: res.warning, failed: res.failed });
      setLines([{ product_sku_id: "", qty: "1" }]);
    }
  };

  const total = lines.reduce((n, l) => {
    const sku = skus.find((s) => s.id === l.product_sku_id);
    return n + (sku ? sku.unit_price * (Number(l.qty) || 0) : 0);
  }, 0);

  return (
    <AdminShell title="Bulk one-off entry">
      {error && (
        <Banner tone="danger" className="mb-4" action={<Button size="sm" variant="ghost" onClick={clearError}>Dismiss</Button>}>
          {error}
        </Banner>
      )}

      {result && (
        <Banner tone={result.failed?.length ? "warn" : "success"} className="mb-4">
          <p className="font-bold">Order {result.receipt} created.</p>
          {result.warning && <p className="mt-1">{result.warning}</p>}
          {result.failed && result.failed.length > 0 && (
            <p className="mt-1">Short on stock for: {result.failed.join(", ")}.</p>
          )}
        </Banner>
      )}

      {catalogue.loading ? (
        <Skeleton className="h-72" />
      ) : (
        <Panel title="Lines">
          <div className="flex flex-col gap-3">
            {lines.map((l, i) => {
              const sku = skus.find((s) => s.id === l.product_sku_id);
              return (
                <div key={i} className="flex items-end gap-2">
                  <div className="flex-1">
                    <label htmlFor={`sku-${i}`} className="text-sm font-semibold text-[var(--color-ink)]">
                      Product SKU
                    </label>
                    <select
                      id={`sku-${i}`}
                      value={l.product_sku_id}
                      onChange={(e) => updateLine(i, { product_sku_id: e.target.value })}
                      className="mt-1.5 min-h-[52px] w-full rounded-lg border-2 border-[var(--color-line)] bg-white px-3.5 text-base"
                    >
                      <option value="">Select SKU…</option>
                      {skus.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.sku_code} ({money(s.unit_price)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <Field
                    label="Qty"
                    value={l.qty}
                    onChange={(e) => updateLine(i, { qty: e.target.value })}
                    inputMode="numeric"
                    className="w-24"
                  />
                  <div className="min-h-[52px] w-28 shrink-0 rounded-lg border-2 border-[var(--color-line)] bg-white px-3.5 flex items-center justify-end font-[family-name:var(--font-mono)] tnum text-sm">
                    {sku ? money(sku.unit_price * (Number(l.qty) || 0)) : "—"}
                  </div>
                  <Button
                    size="md"
                    variant="ghost"
                    onClick={() => removeLine(i)}
                    disabled={lines.length === 1}
                    aria-label="Remove line"
                  >
                    ✕
                  </Button>
                </div>
              );
            })}
            <Button
              variant="secondary"
              onClick={() => setLines((prev) => [...prev, { product_sku_id: "", qty: "1" }])}
            >
              + Add line
            </Button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="payment-method" className="text-sm font-semibold text-[var(--color-ink)]">
                Payment method
              </label>
              <select
                id="payment-method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="mt-1.5 min-h-[52px] w-full rounded-lg border-2 border-[var(--color-line)] bg-white px-3.5 text-base capitalize"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m} className="capitalize">
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <Field label="Note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <div className="mt-5 flex items-center justify-between gap-4 border-t-2 border-[var(--color-line)] pt-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">Total</p>
              <p className="font-[family-name:var(--font-mono)] tnum text-2xl font-bold">{money(total)}</p>
            </div>
            <Button
              variant="primary"
              size="lg"
              busy={busy}
              disabled={!lines.some((l) => l.product_sku_id && Number(l.qty) > 0)}
              onClick={submit}
            >
              Create bulk order
            </Button>
          </div>
        </Panel>
      )}
    </AdminShell>
  );
}

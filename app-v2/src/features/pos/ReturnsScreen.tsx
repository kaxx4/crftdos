"use client";

/** Returns.
 *
 *  Find the original sale, log what happened to it, and — on genuine
 *  defects — get the customer sorted with a replace, refund or exchange.
 *  `createReturn` needs the environment this device is bound to, because a
 *  return is scoped to a stall exactly like an order is [PRD §3.5]. */

import { useMemo, useState } from "react";
import { getBackend } from "@/lib/backend";
import { getDeviceId } from "@/lib/device";
import { useEnvironment } from "@/lib/hooks/useEnvironment";
import { useAction, useAsync } from "@/lib/hooks/useAsync";
import type { CreateReturnInput } from "@/lib/backend";
import type { Order, ReturnAction } from "@/lib/domain/types";
import { money } from "@/lib/money";
import { Banner, Button, Chip, EmptyState, Field, Panel, Skeleton } from "@/components/ui";

const ACTIONS: { value: ReturnAction; label: string }[] = [
  { value: "refund", label: "Refund" },
  { value: "replace", label: "Replace" },
  { value: "exchange", label: "Exchange" },
  { value: "reject", label: "Reject" },
];

export function ReturnsScreen() {
  const { environment, bound } = useEnvironment();

  const orders = useAsync(
    () =>
      environment
        ? getBackend().listOrders({ environment_id: environment.id, limit: 200 })
        : Promise.resolve({ ok: true as const, data: [] as Order[] }),
    [environment?.id]
  );
  const catalogue = useAsync(() => getBackend().getCatalogue(), []);
  const returns = useAsync(
    () =>
      environment
        ? getBackend().listReturns({ environment_id: environment.id, limit: 30 })
        : Promise.resolve({ ok: true as const, data: [] }),
    [environment?.id]
  );

  const [search, setSearch] = useState("");
  const [found, setFound] = useState<Order | null>(null);
  const [reason, setReason] = useState("");
  const [action, setAction] = useState<ReturnAction>("refund");
  const [refundAmount, setRefundAmount] = useState("0");
  const [refundMethod, setRefundMethod] = useState<"cash" | "upi">("cash");
  const [resaleable, setResaleable] = useState(true);
  const [pin, setPin] = useState("");
  const [exchangeSkuId, setExchangeSkuId] = useState("");
  const [exchangeQty, setExchangeQty] = useState("1");
  const [notFound, setNotFound] = useState(false);
  const [toast, setToast] = useState("");

  const { run, busy, error, clearError } = useAction();

  const skus = useMemo(() => catalogue.data?.skus ?? [], [catalogue.data]);

  function findOrder() {
    setNotFound(false);
    setToast("");
    const q = search.trim().toLowerCase();
    if (!q) return;
    const match = (orders.data ?? []).find(
      (o) =>
        o.receipt_no?.toLowerCase() === q ||
        o.receipt_no?.toLowerCase().includes(q) ||
        String(o.order_no) === q ||
        o.customer_phone?.toLowerCase() === q
    );
    if (match) {
      setFound(match);
      clearError();
    } else {
      setFound(null);
      setNotFound(true);
    }
  }

  const exchangeSku = useMemo(() => skus.find((s) => s.id === exchangeSkuId) ?? null, [skus, exchangeSkuId]);

  async function submit() {
    if (!found || !environment) return;

    const input: CreateReturnInput = {
      environment_id: environment.id,
      original_order_id: found.id,
      reason: reason.trim(),
      action,
      approver_pin: pin,
      refund_amount: Number(refundAmount) || 0,
      refund_method: Number(refundAmount) > 0 ? refundMethod : null,
      resaleable,
      restock_items: resaleable
        ? found.items
            .filter((i) => i.product_sku_id)
            .map((i) => ({ sku_type: "product" as const, sku_id: i.product_sku_id as string, qty: i.qty }))
        : [],
      device_id: getDeviceId(),
      exchange_item:
        action === "exchange" && exchangeSku
          ? {
              product_sku_id: exchangeSku.id,
              qty: Number(exchangeQty) || 1,
              unit_price: exchangeSku.unit_price,
              unit_cost: exchangeSku.unit_cost,
            }
          : null,
    };

    const res = await run(() => getBackend().createReturn(input));
    if (res) {
      setToast(
        res.replacement_order
          ? "Return logged. A replacement order was created so stock updates correctly."
          : "Return logged."
      );
      setFound(null);
      setSearch("");
      setReason("");
      setPin("");
      setRefundAmount("0");
      setRefundMethod("cash");
      setExchangeSkuId("");
      setExchangeQty("1");
      setAction("refund");
      void returns.reload();
      void orders.reload();
    }
  }

  if (!bound) {
    return (
      <div className="p-4">
        <Banner tone="warn" title="Assign this phone to a stall first">
          Returns are logged against the stall this device is bound to.
        </Banner>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-3">
      <Banner tone="info">
        Replace or refund on genuine defects only — no change-of-mind returns. DTF is rated 10–15 washes, hand wash
        recommended. Log rejected returns too; the pattern of what we turn down is worth knowing.
      </Banner>

      {toast && <Banner tone="success">{toast}</Banner>}

      <Panel title="Find the order">
        <div className="flex flex-col gap-2">
          <Field
            label="Receipt number, order number or phone"
            placeholder="e.g. CR/SA/26-27/000101"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button variant="secondary" size="lg" onClick={findOrder} disabled={orders.loading}>
            Find order
          </Button>
          {notFound && (
            <Banner tone="warn">No order here matches that. Try the exact receipt number or the phone on file.</Banner>
          )}
          {found && (
            <div className="rounded-lg border-2 border-[var(--color-line)] p-3 text-sm">
              <p className="font-[family-name:var(--font-mono)] font-bold">
                {found.receipt_no ?? `#${found.order_no}`}
              </p>
              <p className="text-[var(--color-muted)]">
                {found.customer_name ?? "Walk-up"} · {found.items.length} item{found.items.length === 1 ? "" : "s"} ·{" "}
                {money(found.total)}
              </p>
            </div>
          )}
        </div>
      </Panel>

      {found && (
        <Panel title="Log the return">
          <div className="flex flex-col gap-3">
            <Field
              label="Reason for return"
              placeholder="What went wrong?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />

            <div>
              <p className="mb-1.5 text-sm font-semibold">Action</p>
              <div className="flex flex-wrap gap-1.5">
                {ACTIONS.map((a) => (
                  <Chip key={a.value} selected={action === a.value} onClick={() => setAction(a.value)}>
                    {a.label}
                  </Chip>
                ))}
              </div>
            </div>

            {action === "exchange" && (
              <div className="flex flex-col gap-2 rounded-lg border-2 border-[var(--color-line)] p-3">
                <p className="text-sm font-semibold">Exchange for</p>
                <select
                  aria-label="Exchange item"
                  value={exchangeSkuId}
                  onChange={(e) => setExchangeSkuId(e.target.value)}
                  className="min-h-[52px] rounded-lg border-2 border-[var(--color-line)] bg-white px-3.5 text-base focus:border-[var(--color-blue)]"
                >
                  <option value="">Choose a product…</option>
                  {skus.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.sku_code} — {money(s.unit_price)}
                    </option>
                  ))}
                </select>
                <Field
                  label="Quantity"
                  type="number"
                  min={1}
                  value={exchangeQty}
                  onChange={(e) => setExchangeQty(e.target.value)}
                />
              </div>
            )}

            <Field
              label="Refund amount (₹)"
              type="number"
              min={0}
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
            />

            {Number(refundAmount) > 0 && (
              <fieldset>
                <legend className="mb-2 text-sm font-semibold">
                  How was it refunded?
                </legend>
                <div className="flex gap-2">
                  {(["cash", "upi"] as const).map((m) => (
                    <Chip key={m} selected={refundMethod === m} onClick={() => setRefundMethod(m)}>
                      {m.toUpperCase()}
                    </Chip>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-[var(--color-muted)]">
                  A cash refund is subtracted from what&apos;s expected when this shift closes, so the till still
                  balances.
                </p>
              </fieldset>
            )}

            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={resaleable}
                onChange={(e) => setResaleable(e.target.checked)}
                className="size-5"
              />
              Resaleable — restock the returned item(s)
            </label>

            <Field
              label="Approver admin PIN"
              type="password"
              placeholder="Approver admin PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />

            {error && <Banner tone="danger">{error}</Banner>}

            <Button variant="primary" size="lg" block busy={busy} disabled={!reason.trim() || pin.length < 4} onClick={submit}>
              Log return
            </Button>
          </div>
        </Panel>
      )}

      <Panel title="Recent returns">
        {returns.loading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : !returns.data?.length ? (
          <EmptyState
            headline="No returns logged here yet"
            teach="Every return filed for this stall — replace, refund, exchange or reject — shows up here."
          />
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--color-line)]">
            {returns.data.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div>
                  <p className="font-bold uppercase">{r.action}</p>
                  <p className="text-[var(--color-muted)]">{r.reason || "No reason given"}</p>
                </div>
                <div className="text-right">
                  <p className="font-[family-name:var(--font-mono)] tnum font-bold">{money(r.refund_amount)}</p>
                  <p className="text-xs text-[var(--color-muted)]">
                    {new Date(r.created_at).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

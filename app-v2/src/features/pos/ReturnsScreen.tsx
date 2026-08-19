"use client";

/** Returns.
 *
 *  Find the original sale, log what happened to it, and — on genuine
 *  defects — get the customer sorted with a replace, refund or exchange.
 *  `createReturn` needs the environment this device is bound to, because a
 *  return is scoped to a stall exactly like an order is [PRD §3.5].
 *
 *  The screen is a single funnel: find → decide → confirm. The confirm sits in
 *  the pinned foot and names the money it moves, because a return is the one
 *  thing on this surface that hands cash back. Until an order is found the
 *  foot says so rather than offering a dead button.
 *
 *  Colour budget: none — no real per-return status is worth a colour here,
 *  only the shared info/success/error banners every screen carries. */

import { useMemo, useState } from "react";
import Link from "next/link";
import { getBackend } from "@/lib/backend";
import { getDeviceId } from "@/lib/device";
import { useEnvironment } from "@/lib/hooks/useEnvironment";
import { useAction, useAsync } from "@/lib/hooks/useAsync";
import type { CreateReturnInput } from "@/lib/backend";
import type { Order, ReturnAction } from "@/lib/domain/types";
import { money } from "@/lib/money";
import {
  Badge,
  Banner,
  Button,
  Chip,
  ConfirmAction,
  EmptyState,
  Field,
  Mono,
  Panel,
  PosScreen,
  Skeleton,
  Text,
  Checkbox,
  Select,
} from "@/components/ui";

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
  const [approvedBy, setApprovedBy] = useState("");
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
      approved_by: approvedBy,
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
      setApprovedBy("");
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
      <PosScreen>
        <PosScreen.Body>
          <Banner tone="warn" title="Assign this phone to a stall first">
            Returns are logged against the stall this device is bound to.
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

  const ready = Boolean(found) && reason.trim().length > 0 && approvedBy.trim().length > 0;
  const refunding = Number(refundAmount) > 0;

  return (
    <PosScreen>
      <PosScreen.Body className="stagger">
        <Banner tone="info">
          Replace or refund on genuine defects only — no change-of-mind returns. DTF is rated 10–15 washes, hand
          wash recommended. Log rejected returns too; the pattern of what we turn down is worth knowing.
        </Banner>

        {toast && <Banner tone="success">{toast}</Banner>}

        <Panel title="1 · Find the order">
          <div className="flex flex-col gap-[var(--space-3)]">
            <Field
              label="Receipt number, order number or phone"
              placeholder="e.g. CR/SA/26-27/000101"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              hint="Part of the receipt number is enough."
            />
            <Button variant="secondary" size="lg" block onClick={findOrder} disabled={orders.loading}>
              Find order
            </Button>
            {notFound && (
              <Banner tone="warn">No order here matches that. Try the exact receipt number or the phone on file.</Banner>
            )}
            {found && (
              <div className="animate-rise rounded-[var(--radius-lg)] border-[3px] border-[var(--color-ink)] bg-white p-[var(--space-3)]">
                <Mono className="t-md font-bold">{found.receipt_no ?? `#${found.order_no}`}</Mono>
                <Text muted>
                  {found.customer_name ?? "Walk-up"} · {found.items.length} item
                  {found.items.length === 1 ? "" : "s"} · {money(found.total)}
                </Text>
              </div>
            )}
          </div>
        </Panel>

        {found && (
          <Panel title="2 · Log the return">
            <div className="flex flex-col gap-[var(--space-3)]">
              <Field
                label="Reason for return"
                placeholder="What went wrong?"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />

              <div className="flex flex-col gap-[var(--space-1)]">
                <span className="t-label">Action</span>
                <div className="flex flex-wrap gap-[var(--space-2)]">
                  {ACTIONS.map((a) => (
                    <Chip key={a.value} selected={action === a.value} onClick={() => setAction(a.value)}>
                      {a.label}
                    </Chip>
                  ))}
                </div>
              </div>

              {action === "exchange" && (
                <div className="flex flex-col gap-[var(--space-3)] rounded-[var(--radius-lg)] border-[3px] border-[var(--color-ink)] p-[var(--space-3)]">
                  <Select
                    label="Exchange for"
                    value={exchangeSkuId}
                    onChange={(e) => setExchangeSkuId(e.target.value)}
                  >
                    <option value="">Choose a product…</option>
                    {skus.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.sku_code} — {money(s.unit_price)}
                      </option>
                    ))}
                  </Select>
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
                hint="Leave at 0 for a replace, exchange or reject."
              />

              {refunding && (
                <div className="flex flex-col gap-[var(--space-1)]">
                  <span className="t-label">How was it refunded?</span>
                  <div className="flex gap-[var(--space-2)]">
                    {(["cash", "upi"] as const).map((m) => (
                      <Chip
                        key={m}
                        selected={refundMethod === m}
                        onClick={() => setRefundMethod(m)}
                        className="flex-1 justify-center"
                      >
                        {m.toUpperCase()}
                      </Chip>
                    ))}
                  </div>
                  <Text muted>
                    A cash refund is subtracted from what&apos;s expected when this shift closes, so the till still
                    balances.
                  </Text>
                </div>
              )}

              <Checkbox
                checked={resaleable}
                onChange={(e) => setResaleable(e.target.checked)}
                label="Resaleable — put the returned item(s) back into stock"
              />

              <Field
                label="Approver name"
                placeholder="Who's signing off on this?"
                value={approvedBy}
                onChange={(e) => setApprovedBy(e.target.value)}
              />

              {error && <Banner tone="danger">{error}</Banner>}
            </div>
          </Panel>
        )}

        <Panel title="Recent returns">
          {returns.loading ? (
            <div className="flex flex-col gap-[var(--space-2)]">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ) : !returns.data?.length ? (
            <EmptyState
              headline="No returns logged here yet"
              teach="Every return filed for this stall — replace, refund, exchange or reject — shows up here, so the next volunteer can see what's already been decided."
            />
          ) : (
            <ul className="stagger flex flex-col divide-y-2 divide-[var(--color-line-soft)]">
              {returns.data.map((r) => (
                <li
                  key={r.id}
                  className="flex items-start justify-between gap-[var(--space-3)] py-[var(--space-3)]"
                >
                  <div className="min-w-0">
                    {/* One tone for the whole list — the action is read from
                        the word, not from a colour code. */}
                    <Badge tone="white">{r.action}</Badge>
                    <Text muted className="mt-[var(--space-1)]">
                      {r.reason || "No reason given"}
                    </Text>
                  </div>
                  <div className="shrink-0 text-right">
                    <Mono className="t-md font-bold">{money(r.refund_amount)}</Mono>
                    <Text muted className="tnum">
                      {new Date(r.created_at).toLocaleString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "2-digit",
                        month: "short",
                      })}
                    </Text>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </PosScreen.Body>

      {/* Two-tap on purpose: this moves stock and, on a refund, money. Not
          authorization — anyone can tap it twice — just a guard against
          logging a return by mis-tap. */}
      <PosScreen.Foot className="flex flex-col gap-[var(--space-2)]">
        <div className="flex items-end justify-between gap-[var(--space-3)]">
          <span className="t-label text-white/80">{found ? `${action} · ${found.receipt_no ?? `#${found.order_no}`}` : "No order found yet"}</span>
          {refunding && <Mono className="t-xl">−{money(Number(refundAmount))}</Mono>}
        </div>
        <ConfirmAction
          variant="primary"
          size="xl"
          block
          busy={busy}
          disabled={!ready}
          label={found ? "Log return" : "Find an order first"}
          confirmLabel={refunding ? `Confirm ${action} — refund ${money(Number(refundAmount))}?` : `Confirm ${action}?`}
          onConfirm={submit}
        />
      </PosScreen.Foot>
    </PosScreen>
  );
}

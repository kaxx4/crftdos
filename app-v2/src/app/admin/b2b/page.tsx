"use client";

/** B2B enquiries and deals.
 *
 *  Org-wide, not environment-scoped (migration 004.2) — a corporate order is
 *  not tied to any single stall. The margin gate (D17) is enforced twice: here
 *  client-side as the operator types, so they see the warning before they
 *  submit, and again server-side, which is the one that actually matters.
 *
 *  Colour budget: acid on the one emphasised Stat, cobalt on the primary
 *  actions. The margin readout uses washes, not blocks — it changes as you
 *  type, and a panel that strobes between three saturated fills while someone
 *  is entering a price is not information, it is noise. */

import { useMemo, useState } from "react";
import { getBackend } from "@/lib/backend";
import { useAsync, useAction } from "@/lib/hooks/useAsync";
import type { B2bOrder, B2bStage, PaymentMethod } from "@/lib/domain/types";
import { AdminShell, NumHead } from "@/features/admin/AdminShell";
import {
  Badge,
  Banner,
  Button,
  EmptyState,
  Field,
  Heading,
  Panel,
  Ring,
  Sheet,
  Select,
  Skeleton,
  Stat,
  Table,
  Td,
  Text,
  Th,
} from "@/components/ui";
import { money } from "@/lib/money";
import { clsx } from "@/components/clsx";

const STAGES: B2bStage[] = ["enquiry", "quoted", "confirmed", "in_production", "dispatched", "delivered", "lost"];
// "lost" is a terminal branch, not a further step — it never counts toward
// the dot-slider's position, so it gets its own list rather than reusing
// STAGES (which drives the Select and needs "lost" as a pickable option).
const FORWARD_STAGES: B2bStage[] = ["enquiry", "quoted", "confirmed", "in_production", "dispatched", "delivered"];
const PAYMENT_METHODS: PaymentMethod[] = ["upi", "cash", "split", "pending"];

const stageLabel = (s: B2bStage) => s.replace("_", " ");

/** The margin gate, as one function instead of four ternaries that all
 *  returned the same class — the old version rendered "under 10%" and "under
 *  15%" identically, so the operator got no signal that they had crossed from
 *  "needs a PIN" into "just worth a look". */
type MarginVerdict = { key: "loss" | "gated" | "thin" | "ok"; wash: string; note: string };

function marginVerdict(margin: number): MarginVerdict {
  if (margin < 0)
    return {
      key: "loss",
      wash: "border-[var(--color-signal)] bg-[var(--color-signal-wash)]",
      note: "This deal sells at a loss.",
    };
  if (margin < 10)
    return {
      key: "gated",
      wash: "border-[var(--color-ink)] bg-[var(--color-yellow-wash)]",
      note: "Under 10% — needs an admin PIN.",
    };
  if (margin < 15)
    return {
      key: "thin",
      wash: "border-[var(--color-ink)] bg-[var(--color-yellow-wash)]",
      note: "Under 15% — thin, but allowed.",
    };
  return { key: "ok", wash: "border-[var(--color-ink)] bg-[var(--color-acid-wash)]", note: "Healthy margin." };
}

export default function B2bPage() {
  const list = useAsync(() => getBackend().listB2bOrders(), []);
  const { run, busy, error, clearError } = useAction();

  const [creating, setCreating] = useState(false);
  const [clientOrg, setClientOrg] = useState("");
  const [accountOwner, setAccountOwner] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [quantity, setQuantity] = useState("100");
  const [unitPrice, setUnitPrice] = useState("400");
  const [unitCost, setUnitCost] = useState("360");
  const [adminPin, setAdminPin] = useState("");

  const [editing, setEditing] = useState<B2bOrder | null>(null);
  const [editDepositAmount, setEditDepositAmount] = useState("");
  const [editDepositDate, setEditDepositDate] = useState("");
  const [editDepositMethod, setEditDepositMethod] = useState<PaymentMethod>("upi");
  const [editBalanceAmount, setEditBalanceAmount] = useState("");
  const [editBalanceDate, setEditBalanceDate] = useState("");
  const [editBalanceMethod, setEditBalanceMethod] = useState<PaymentMethod>("upi");
  const [editNotes, setEditNotes] = useState("");

  const margin = useMemo(() => {
    const p = Number(unitPrice);
    const c = Number(unitCost);
    return p > 0 ? ((p - c) / p) * 100 : 0;
  }, [unitPrice, unitCost]);

  const verdict = marginVerdict(margin);

  const volunteers = list.data?.volunteers ?? [];
  const orders = list.data?.orders ?? [];

  const resetForm = () => {
    setClientOrg("");
    setAccountOwner("");
    setContactName("");
    setContactPhone("");
    setContactEmail("");
    setQuantity("100");
    setUnitPrice("400");
    setUnitCost("360");
    setAdminPin("");
  };

  const create = async () => {
    const res = await run(() =>
      getBackend().createB2bOrder({
        client_org: clientOrg,
        account_owner: accountOwner,
        contact_name: contactName || null,
        contact_phone: contactPhone || null,
        contact_email: contactEmail || null,
        quantity: Number(quantity) || 0,
        unit_price: Number(unitPrice) || 0,
        unit_cost: Number(unitCost) || 0,
        admin_pin: adminPin || undefined,
      })
    );
    if (res) {
      setCreating(false);
      resetForm();
      void list.reload();
    }
  };

  const setStage = async (id: string, stage: B2bStage) => {
    const res = await run(() => getBackend().updateB2bOrder(id, { stage }));
    if (res) void list.reload();
  };

  const openEdit = (o: B2bOrder) => {
    setEditing(o);
    setEditDepositAmount(String(o.deposit_amount || ""));
    setEditDepositDate(o.deposit_date ?? "");
    setEditDepositMethod(o.deposit_method ?? "upi");
    setEditBalanceAmount(String(o.balance_amount || ""));
    setEditBalanceDate(o.balance_date ?? "");
    setEditBalanceMethod(o.balance_method ?? "upi");
    setEditNotes(o.notes ?? "");
  };

  const saveEdit = async () => {
    if (!editing) return;
    const res = await run(() =>
      getBackend().updateB2bOrder(editing.id, {
        deposit_amount: Number(editDepositAmount) || 0,
        deposit_date: editDepositDate || null,
        deposit_method: editDepositAmount ? editDepositMethod : null,
        balance_amount: Number(editBalanceAmount) || 0,
        balance_date: editBalanceDate || null,
        balance_method: editBalanceAmount ? editBalanceMethod : null,
        notes: editNotes || null,
      })
    );
    if (res) {
      setEditing(null);
      void list.reload();
    }
  };

  return (
    <AdminShell
      title="B2B"
      lede="Corporate orders, org-wide. These are not tied to a stall, and every one of them has a named person accountable for it."
      action={
        <Button surface="admin" size="sm" variant="primary" onClick={() => setCreating(true)}>
          New enquiry
        </Button>
      }
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

      {list.error && (
        <Banner tone="danger" title="Couldn't load enquiries">
          {list.error}
        </Banner>
      )}

      <div className="grid gap-[var(--space-3)] sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Committed value"
          value={money(list.data?.committed ?? 0)}
          sub="Confirmed deals and later"
          emphasis
        />
        <Stat label="Collected so far" value={money(list.data?.collected ?? 0)} sub="Deposits and balances" />
        <Stat
          label="Still to collect"
          value={money(Math.max(0, (list.data?.committed ?? 0) - (list.data?.collected ?? 0)))}
          sub="Committed minus collected"
        />
        <Stat label="Open enquiries" value={orders.filter((o) => o.stage !== "delivered" && o.stage !== "lost").length} sub="Not delivered or lost" />
      </div>

      {list.loading ? (
        <Skeleton className="h-72" />
      ) : orders.length === 0 ? (
        <EmptyState
          headline="No enquiries yet"
          teach="When a company asks about a bulk order, log it here with a quantity and a price. The margin gate checks it as you type, and the deal then tracks through to delivery."
          action={
            <Button surface="admin" size="sm" variant="primary" onClick={() => setCreating(true)}>
              New enquiry
            </Button>
          }
        />
      ) : (
        <Panel title="Enquiries">
          <Table
            className="min-w-[980px]"
            caption="B2B enquiries with value, payments received and current stage"
            head={[
              "Client",
              "Owner",
              <NumHead key="q">Qty × price</NumHead>,
              <NumHead key="g">Gross</NumHead>,
              <NumHead key="d">Deposit</NumHead>,
              <NumHead key="b">Balance</NumHead>,
              "Stage",
              <span key="a" className="sr-only">
                Payments
              </span>,
            ]}
          >
            {orders.map((o) => {
              const owner = volunteers.find((v) => v.id === o.account_owner)?.name ?? o.account_owner;
              const outstanding = o.gross_value - o.deposit_amount - o.balance_amount;
              return (
                <tr key={o.id}>
                  <Th>
                    {o.client_org}
                    {o.contact_name && (
                      <span className="ml-2 font-normal text-[var(--color-muted)]">{o.contact_name}</span>
                    )}
                  </Th>
                  <Td>{owner}</Td>
                  <Td mono className="text-right">
                    {o.quantity} × {money(o.unit_price)}
                  </Td>
                  <Td mono className="text-right font-bold">
                    {money(o.gross_value)}
                  </Td>
                  <Td mono className="text-right">
                    {money(o.deposit_amount)}
                  </Td>
                  <Td mono className="text-right">
                    {money(o.balance_amount)}
                    {outstanding > 0 && o.stage === "delivered" && (
                      <span className="ml-2 align-middle">
                        <Badge tone="orange">Owed</Badge>
                      </span>
                    )}
                  </Td>
                  <Td>
                    <div className="flex items-center gap-[var(--space-3)]">
                      {/* Monochrome dot-slider — state shape, not a colour
                          per row, so it doesn't reopen the one-tone-per-
                          collection question the way per-row colour would.
                          "lost" has exited the forward pipeline rather than
                          stalled partway through it, so it gets no dots at
                          all instead of a misleading position. */}
                      {o.stage !== "lost" && (
                        <Ring
                          variant="dots"
                          value={FORWARD_STAGES.indexOf(o.stage) + 1}
                          max={FORWARD_STAGES.length}
                          tone="cobalt"
                        />
                      )}
                      <Select surface="admin"
                        id={`stage-${o.id}`}
                        label={`Stage for ${o.client_org}`}
                        labelHidden
                        className="w-40 capitalize"
                        value={o.stage}
                        disabled={busy}
                        onChange={(e) => setStage(o.id, e.target.value as B2bStage)}
                      >
                        {STAGES.map((s) => (
                          <option key={s} value={s} className="capitalize">
                            {stageLabel(s)}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </Td>
                  <Td className="text-right">
                    <Button size="sm" surface="admin" variant="secondary" onClick={() => openEdit(o)}>
                      Payments
                      <span className="sr-only"> for {o.client_org}</span>
                    </Button>
                  </Td>
                </tr>
              );
            })}
          </Table>
        </Panel>
      )}

      <Sheet
        open={creating}
        onClose={() => setCreating(false)}
        title="New enquiry"
        footer={
          <Button
            variant="primary"
            size="lg"
            block
            busy={busy}
            disabled={!clientOrg.trim() || !accountOwner || margin < 0 || (margin < 10 && !adminPin.trim())}
            onClick={create}
          >
            Save enquiry
          </Button>
        }
      >
        <div className="flex flex-col gap-[var(--space-4)]">
          <Field
            surface="admin"
            label="Client organisation"
            value={clientOrg}
            onChange={(e) => setClientOrg(e.target.value)}
          />

          <Select surface="admin"
            id="account-owner"
            label="Account owner"
            value={accountOwner}
            onChange={(e) => setAccountOwner(e.target.value)}
            hint="Every B2B deal needs one person accountable for it."
          >
            <option value="">Select owner (required)…</option>
            {volunteers
              .filter((v) => v.is_active)
              .map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
          </Select>

          <div className="grid grid-cols-2 gap-[var(--space-3)]">
            <Field
              surface="admin"
              label="Contact name"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
            />
            <Field
              surface="admin"
              label="Contact phone"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              inputMode="tel"
            />
          </div>
          <Field
            surface="admin"
            label="Contact email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            inputMode="email"
          />

          <div className="grid grid-cols-3 gap-[var(--space-3)]">
            <Field
              surface="admin"
              label="Qty"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              inputMode="numeric"
            />
            <Field
              surface="admin"
              label="Unit price"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              inputMode="decimal"
            />
            <Field
              surface="admin"
              label="Unit cost"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              inputMode="decimal"
            />
          </div>

          <div
            aria-live="polite"
            className={clsx(
              "flex items-baseline justify-between gap-[var(--space-3)] rounded-[var(--radius-md)] border-[3px] p-[var(--space-3)]",
              verdict.wash
            )}
          >
            <span className="t-lg font-[family-name:var(--font-mono)] tnum">{margin.toFixed(1)}% margin</span>
            <span className="t-sm font-extrabold">{verdict.note}</span>
          </div>

          {verdict.key === "loss" && (
            <Banner tone="danger">
              Can&apos;t save — this deal would sell at a loss. Raise the price or lower the cost.
            </Banner>
          )}
          {verdict.key === "gated" && (
            <Field
              surface="admin"
              label="Admin PIN"
              type="password"
              value={adminPin}
              onChange={(e) => setAdminPin(e.target.value)}
              hint="Required below 10% margin."
            />
          )}
        </div>
      </Sheet>

      <Sheet
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? `Payments — ${editing.client_org}` : ""}
        footer={
          <Button variant="primary" size="lg" block busy={busy} onClick={saveEdit}>
            Save payments
          </Button>
        }
      >
        {editing && (
          <div className="flex flex-col gap-[var(--space-5)]">
            <Text step="sm" muted>
              Gross value {money(editing.gross_value)}. Record what has actually landed — this is what the
              &ldquo;collected&rdquo; total on the page above counts.
            </Text>

            <section className="flex flex-col gap-[var(--space-3)]">
              <Heading level={3} step="lg">
                Deposit
              </Heading>
              <div className="grid grid-cols-2 gap-[var(--space-3)]">
                <Field
                  surface="admin"
                  label="Amount"
                  value={editDepositAmount}
                  onChange={(e) => setEditDepositAmount(e.target.value)}
                  inputMode="decimal"
                />
                <Field
                  surface="admin"
                  label="Date"
                  type="date"
                  value={editDepositDate}
                  onChange={(e) => setEditDepositDate(e.target.value)}
                />
              </div>
              <Select surface="admin"
                id="deposit-method"
                label="Paid by"
                className="capitalize"
                value={editDepositMethod}
                onChange={(e) => setEditDepositMethod(e.target.value as PaymentMethod)}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m} className="capitalize">
                    {m}
                  </option>
                ))}
              </Select>
            </section>

            <section className="flex flex-col gap-[var(--space-3)]">
              <Heading level={3} step="lg">
                Balance
              </Heading>
              <div className="grid grid-cols-2 gap-[var(--space-3)]">
                <Field
                  surface="admin"
                  label="Amount"
                  value={editBalanceAmount}
                  onChange={(e) => setEditBalanceAmount(e.target.value)}
                  inputMode="decimal"
                />
                <Field
                  surface="admin"
                  label="Date"
                  type="date"
                  value={editBalanceDate}
                  onChange={(e) => setEditBalanceDate(e.target.value)}
                />
              </div>
              <Select surface="admin"
                id="balance-method"
                label="Paid by"
                className="capitalize"
                value={editBalanceMethod}
                onChange={(e) => setEditBalanceMethod(e.target.value as PaymentMethod)}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m} className="capitalize">
                    {m}
                  </option>
                ))}
              </Select>
            </section>

            <Field
              surface="admin"
              label="Notes"
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              hint="Anything the next person picking this up would need to know."
            />
          </div>
        )}
      </Sheet>
    </AdminShell>
  );
}

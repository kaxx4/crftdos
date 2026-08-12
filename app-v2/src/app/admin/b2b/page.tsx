"use client";

/** B2B enquiries and deals.
 *
 *  Org-wide, not environment-scoped (migration 004.2) — a corporate order is
 *  not tied to any single stall. The margin gate (D17) is enforced twice: here
 *  client-side as the operator types, so they see the warning before they
 *  submit, and again server-side, which is the one that actually matters. */

import { useMemo, useState } from "react";
import { getBackend } from "@/lib/backend";
import { useAsync, useAction } from "@/lib/hooks/useAsync";
import type { B2bOrder, B2bStage, PaymentMethod } from "@/lib/domain/types";
import { AdminShell, ScrollX } from "@/features/admin/AdminShell";
import { Banner, Button, Field, Panel, Sheet, Skeleton, Stat } from "@/components/ui";
import { money } from "@/lib/money";
import { clsx } from "@/components/clsx";

const STAGES: B2bStage[] = ["enquiry", "quoted", "confirmed", "in_production", "dispatched", "delivered", "lost"];
const PAYMENT_METHODS: PaymentMethod[] = ["upi", "cash", "split", "pending"];

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

  const marginTone =
    margin < 0
      ? "border-[var(--color-signal)] bg-[var(--color-signal-wash)]"
      : margin < 10
        ? "border-[var(--color-signal)] bg-[var(--color-signal-wash)]"
        : margin < 15
          ? "border-[var(--color-signal)] bg-[var(--color-signal-wash)]"
          : "border-[var(--color-teal)] bg-[color-mix(in_srgb,var(--color-teal)_10%,white)]";

  return (
    <AdminShell title="B2B">
      {error && (
        <Banner tone="danger" className="mb-4" action={<Button size="sm" variant="ghost" onClick={clearError}>Dismiss</Button>}>
          {error}
        </Banner>
      )}

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <Stat label="Committed value" value={money(list.data?.committed ?? 0)} sub="Confirmed deals and later" emphasis />
        <Stat label="Collected so far" value={money(list.data?.collected ?? 0)} sub="Deposits and balances" />
      </div>

      <div className="mb-4 flex justify-end">
        <Button variant="primary" onClick={() => setCreating(true)}>
          New enquiry
        </Button>
      </div>

      {list.loading ? (
        <Skeleton className="h-72" />
      ) : orders.length === 0 ? (
        <Panel>
          <p className="py-6 text-center text-[var(--color-muted)]">
            No enquiries yet. New ones you save will show up here.
          </p>
        </Panel>
      ) : (
        <Panel title="Enquiries">
          <ScrollX>
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-[var(--color-ink)] text-left">
                  <th className="py-2 pr-4 font-bold">Client</th>
                  <th className="px-3 py-2 font-bold">Owner</th>
                  <th className="px-3 py-2 text-right font-bold">Qty × price</th>
                  <th className="px-3 py-2 text-right font-bold">Gross</th>
                  <th className="px-3 py-2 text-right font-bold">Deposit</th>
                  <th className="px-3 py-2 text-right font-bold">Balance</th>
                  <th className="px-3 py-2 font-bold">Stage</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const owner = volunteers.find((v) => v.id === o.account_owner)?.name ?? o.account_owner;
                  return (
                    <tr key={o.id} className="border-b border-[var(--color-line)]">
                      <th scope="row" className="py-2.5 pr-4 text-left font-normal">
                        <span className="font-bold">{o.client_org}</span>
                        {o.contact_name && <span className="ml-2 text-[var(--color-muted)]">{o.contact_name}</span>}
                      </th>
                      <td className="px-3 py-2.5">{owner}</td>
                      <td className="px-3 py-2.5 text-right font-[family-name:var(--font-mono)] tnum">
                        {o.quantity} × {money(o.unit_price)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-[family-name:var(--font-mono)] font-bold tnum">
                        {money(o.gross_value)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-[family-name:var(--font-mono)] tnum">
                        {money(o.deposit_amount)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-[family-name:var(--font-mono)] tnum">
                        {money(o.balance_amount)}
                      </td>
                      <td className="px-3 py-2.5">
                        <select
                          value={o.stage}
                          onChange={(e) => setStage(o.id, e.target.value as B2bStage)}
                          disabled={busy}
                          className="min-h-[40px] rounded-md border-2 border-[var(--color-line)] bg-white px-2 text-sm capitalize"
                        >
                          {STAGES.map((s) => (
                            <option key={s} value={s} className="capitalize">
                              {s.replace("_", " ")}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2.5 text-right">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(o)}>
                          Payments
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
        <div className="flex flex-col gap-4">
          <Field label="Client organisation" value={clientOrg} onChange={(e) => setClientOrg(e.target.value)} />
          <div>
            <label htmlFor="account-owner" className="text-sm font-semibold text-[var(--color-ink)]">
              Account owner
            </label>
            <select
              id="account-owner"
              value={accountOwner}
              onChange={(e) => setAccountOwner(e.target.value)}
              className="mt-1.5 min-h-[52px] w-full rounded-lg border-2 border-[var(--color-line)] bg-white px-3.5 text-base"
            >
              <option value="">Select owner (required)…</option>
              {volunteers
                .filter((v) => v.is_active)
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
            </select>
            <p className="mt-1.5 text-sm text-[var(--color-muted)]">
              Every B2B deal needs one person accountable for it.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Contact name" value={contactName} onChange={(e) => setContactName(e.target.value)} />
            <Field label="Contact phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} inputMode="tel" />
          </div>
          <Field label="Contact email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} inputMode="email" />
          <div className="grid grid-cols-3 gap-3">
            <Field label="Qty" value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="numeric" />
            <Field label="Unit price" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} inputMode="decimal" />
            <Field label="Unit cost" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} inputMode="decimal" />
          </div>
          <div className={clsx("rounded-lg border-2 p-3 text-sm font-bold", marginTone)}>{margin.toFixed(1)}% margin</div>
          {margin < 0 && (
            <Banner tone="danger">
              Can&apos;t save — this deal would sell at a loss. Raise the price or lower the cost.
            </Banner>
          )}
          {margin >= 0 && margin < 10 && (
            <Field
              label="Admin PIN"
              type="password"
              value={adminPin}
              onChange={(e) => setAdminPin(e.target.value)}
              hint="Required below 10% margin."
            />
          )}
          {margin >= 10 && margin < 15 && (
            <Banner tone="warn">This margin is under 15% — worth a second look before you commit.</Banner>
          )}
        </div>
      </Sheet>

      <Sheet
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? `Payments — ${editing.client_org}` : ""}
        footer={
          <Button variant="primary" size="lg" block busy={busy} onClick={saveEdit}>
            Save
          </Button>
        }
      >
        {editing && (
          <div className="flex flex-col gap-5">
            <div>
              <p className="mb-2 text-sm font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">Deposit</p>
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Amount"
                  value={editDepositAmount}
                  onChange={(e) => setEditDepositAmount(e.target.value)}
                  inputMode="decimal"
                />
                <Field
                  label="Date"
                  type="date"
                  value={editDepositDate}
                  onChange={(e) => setEditDepositDate(e.target.value)}
                />
              </div>
              <select
                value={editDepositMethod}
                onChange={(e) => setEditDepositMethod(e.target.value as PaymentMethod)}
                className="mt-2 min-h-[48px] w-full rounded-lg border-2 border-[var(--color-line)] bg-white px-3 text-base capitalize"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m} className="capitalize">
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="mb-2 text-sm font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">Balance</p>
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Amount"
                  value={editBalanceAmount}
                  onChange={(e) => setEditBalanceAmount(e.target.value)}
                  inputMode="decimal"
                />
                <Field
                  label="Date"
                  type="date"
                  value={editBalanceDate}
                  onChange={(e) => setEditBalanceDate(e.target.value)}
                />
              </div>
              <select
                value={editBalanceMethod}
                onChange={(e) => setEditBalanceMethod(e.target.value as PaymentMethod)}
                className="mt-2 min-h-[48px] w-full rounded-lg border-2 border-[var(--color-line)] bg-white px-3 text-base capitalize"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m} className="capitalize">
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <Field label="Notes" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
          </div>
        )}
      </Sheet>
    </AdminShell>
  );
}

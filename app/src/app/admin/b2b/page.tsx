"use client";
import { useEffect, useMemo, useState } from "react";
import { BigButton, Card, Field } from "@/components/ui";

type Volunteer = { id: string; name: string };
type B2BOrder = {
  id: string;
  client_org: string;
  stage: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  gross_value: number;
  deposit_amount: number | null;
  balance_amount: number | null;
  account_owner: string;
};

const STAGES = ["enquiry", "quoted", "confirmed", "production", "ready", "dispatched", "closed", "lost"];

function KpiLabel({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-xs text-muted uppercase tracking-[0.06em]">{children}</div>;
}
function KpiValue({ children }: { children: React.ReactNode }) {
  return <div className="font-extrabold text-2xl">{children}</div>;
}

export default function B2BPage() {
  const [orders, setOrders] = useState<B2BOrder[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [committed, setCommitted] = useState(0);
  const [collected, setCollected] = useState(0);

  const [clientOrg, setClientOrg] = useState("");
  const [accountOwner, setAccountOwner] = useState("");
  const [quantity, setQuantity] = useState("100");
  const [unitPrice, setUnitPrice] = useState("400");
  const [unitCost, setUnitCost] = useState("360");
  const [adminPin, setAdminPin] = useState("");
  const [err, setErr] = useState("");

  const margin = useMemo(() => {
    const p = Number(unitPrice);
    const c = Number(unitCost);
    return p > 0 ? ((p - c) / p) * 100 : 0;
  }, [unitPrice, unitCost]);

  async function load() {
    const j = await fetch("/api/admin/b2b").then((r) => r.json());
    setOrders(j.orders || []);
    setVolunteers(j.volunteers || []);
    setCommitted(j.committed || 0);
    setCollected(j.collected || 0);
  }
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const j = await fetch("/api/admin/b2b").then((r) => r.json());
      if (cancelled) return;
      setOrders(j.orders || []);
      setVolunteers(j.volunteers || []);
      setCommitted(j.committed || 0);
      setCollected(j.collected || 0);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function create() {
    setErr("");
    if (!accountOwner) return setErr("Account owner is required — every B2B deal needs one person accountable for it.");
    const res = await fetch("/api/admin/b2b", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientOrg, accountOwner, quantity, unitPrice, unitCost, adminPin }),
    });
    const j = await res.json();
    if (!res.ok) {
      setErr(j.error);
      return;
    }
    setClientOrg("");
    setAdminPin("");
    load();
  }

  async function setStage(id: string, stage: string) {
    await fetch(`/api/admin/b2b/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    load();
  }

  return (
    <div className="min-h-dvh bg-cream text-ink p-4 md:p-8 w-full max-w-[1400px] mx-auto flex flex-col gap-6">
      <h1 className="font-extrabold text-2xl tracking-wide">B2B</h1>

      {/* Hero KPI — the committed pipeline value is the one number that matters most on this page. */}
      <div className="bg-blue text-cream p-6 border-2 border-ink rounded-[var(--radius-pos-md)]">
        <div className="font-extrabold text-xs tracking-[0.14em] opacity-80">COMMITTED PIPELINE VALUE</div>
        <div className="font-extrabold text-5xl mt-1">₹{committed}</div>
        <div className="font-mono text-xs opacity-70 mt-1">Confirmed deals and later stages, all time</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card>
          <KpiLabel>Committed value (confirmed deals and later)</KpiLabel>
          <KpiValue>₹{committed}</KpiValue>
        </Card>
        <Card>
          <KpiLabel>Collected so far (deposits and balances)</KpiLabel>
          <KpiValue>₹{collected}</KpiValue>
        </Card>
      </div>

      <Card className="p-4 gap-2">
        <div className="font-extrabold">New enquiry</div>
        <Field label="Client organisation" placeholder="Client organisation" value={clientOrg} onChange={(e) => setClientOrg(e.target.value)} />
        <select
          value={accountOwner}
          onChange={(e) => setAccountOwner(e.target.value)}
          className="border-2 border-ink p-3 min-h-[48px] rounded-[var(--radius-pos-sm)] bg-white"
        >
          <option value="">Account owner (required)</option>
          {volunteers.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-2">
          <Field label="Quantity" placeholder="Qty" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-24" />
          <Field label="Unit price" placeholder="Unit price" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className="w-28" />
          <Field label="Unit cost" placeholder="Unit cost" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className="w-28" />
          <div
            className={`px-3 py-2 min-h-[48px] flex items-center font-extrabold text-sm rounded-[var(--radius-pos-sm)] ${
              margin < 0 ? "bg-signal text-cream" : margin < 10 ? "bg-signal/70 text-cream" : margin < 15 ? "bg-warn text-cream" : "bg-ok text-cream"
            }`}
          >
            {margin.toFixed(1)}% margin
          </div>
        </div>
        {margin < 10 && margin >= 0 && (
          <Field
            label="Admin PIN"
            type="password"
            placeholder="Admin PIN (required below 10% margin)"
            value={adminPin}
            onChange={(e) => setAdminPin(e.target.value)}
          />
        )}
        {margin < 0 && (
          <div className="bg-signal text-cream p-2 font-extrabold text-xs rounded-[var(--radius-pos-sm)]">
            Can&apos;t save — this deal would sell at a loss. Raise the price or lower the cost.
          </div>
        )}
        {err && <div className="bg-signal text-cream p-2 font-extrabold text-xs rounded-[var(--radius-pos-sm)]">{err}</div>}
        <BigButton variant="blue" onClick={create} disabled={margin < 0} className="w-full">
          SAVE ENQUIRY
        </BigButton>
      </Card>

      <div className="flex flex-col gap-2">
        {orders.map((o) => (
          <Card key={o.id} className="!flex-row flex-wrap justify-between items-center gap-2">
            <div>
              <div className="font-extrabold">{o.client_org}</div>
              <div className="font-mono text-xs text-muted">
                {o.quantity} × ₹{o.unit_price} = ₹{o.gross_value}
              </div>
            </div>
            <select
              value={o.stage}
              onChange={(e) => setStage(o.id, e.target.value)}
              className="border-2 border-ink p-2 min-h-[44px] text-sm rounded-[var(--radius-pos-sm)] bg-white"
            >
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Card>
        ))}
        {orders.length === 0 && (
          <div className="text-center text-sm text-muted py-6">No enquiries yet. New ones you save will show up here.</div>
        )}
      </div>
    </div>
  );
}

"use client";
import { useEffect, useMemo, useState } from "react";

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
    if (!accountOwner) return setErr("Account owner is required — this is intentional friction per PRD §7.");
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
    <div className="min-h-dvh bg-cream text-ink p-6 max-w-4xl mx-auto flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3">
        <div className="border-2 border-ink bg-white p-3">
          <div className="font-mono text-xs text-neutral-500">Committed value (confirmed+)</div>
          <div className="font-extrabold text-2xl">₹{committed}</div>
        </div>
        <div className="border-2 border-ink bg-white p-3">
          <div className="font-mono text-xs text-neutral-500">Collected (deposits + balances)</div>
          <div className="font-extrabold text-2xl">₹{collected}</div>
        </div>
      </div>

      <div className="border-2 border-ink bg-white p-4 flex flex-col gap-2">
        <div className="font-extrabold">New enquiry</div>
        <input placeholder="Client organisation" value={clientOrg} onChange={(e) => setClientOrg(e.target.value)} className="border-2 border-ink p-2" />
        <select value={accountOwner} onChange={(e) => setAccountOwner(e.target.value)} className="border-2 border-ink p-2">
          <option value="">Account owner (required)</option>
          {volunteers.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <input placeholder="Qty" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="border-2 border-ink p-2 w-24" />
          <input placeholder="Unit price" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className="border-2 border-ink p-2 w-28" />
          <input placeholder="Unit cost" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className="border-2 border-ink p-2 w-28" />
          <div
            className={`px-3 py-2 font-extrabold text-sm ${
              margin < 0 ? "bg-signal text-cream" : margin < 10 ? "bg-signal/70 text-cream" : margin < 15 ? "bg-amber-200 text-ink" : "bg-green-200 text-ink"
            }`}
          >
            {margin.toFixed(1)}% margin
          </div>
        </div>
        {margin < 10 && margin >= 0 && (
          <input
            type="password"
            placeholder="Admin PIN (required below 10% margin)"
            value={adminPin}
            onChange={(e) => setAdminPin(e.target.value)}
            className="border-2 border-ink p-2"
          />
        )}
        {margin < 0 && <div className="bg-signal text-cream p-2 font-extrabold text-xs">HARD BLOCKED — cannot save below 0% margin.</div>}
        {err && <div className="bg-signal text-cream p-2 font-extrabold text-xs">{err}</div>}
        <button onClick={create} disabled={margin < 0} className="bg-blue text-cream py-2 font-extrabold disabled:opacity-40">
          SAVE ENQUIRY
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {orders.map((o) => (
          <div key={o.id} className="border-2 border-ink bg-white p-3 flex justify-between items-center gap-2">
            <div>
              <div className="font-extrabold">{o.client_org}</div>
              <div className="font-mono text-xs text-neutral-500">
                {o.quantity} × ₹{o.unit_price} = ₹{o.gross_value}
              </div>
            </div>
            <select value={o.stage} onChange={(e) => setStage(o.id, e.target.value)} className="border-2 border-ink p-1.5 text-sm">
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        ))}
        {orders.length === 0 && <div className="text-center text-sm text-neutral-500 py-6">No B2B enquiries yet.</div>}
      </div>
    </div>
  );
}

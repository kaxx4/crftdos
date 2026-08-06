"use client";
import { useEffect, useState } from "react";

type Sku = { id: string; sku_code: string; unit_price: number; unit_cost: number };
type Line = { sku_id: string; qty: number };

export default function BulkEntryPage() {
  const [skus, setSkus] = useState<Sku[]>([]);
  const [lines, setLines] = useState<Line[]>([{ sku_id: "", qty: 1 }]);
  const [result, setResult] = useState("");

  useEffect(() => {
    fetch("/api/admin/pricing")
      .then((r) => r.json())
      .then((j) => setSkus(j.skus || []));
  }, []);

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function submit() {
    const items = lines
      .filter((l) => l.sku_id)
      .map((l) => {
        const sku = skus.find((s) => s.id === l.sku_id)!;
        return { product_sku_id: sku.id, qty: l.qty, unit_price: sku.unit_price, unit_cost: sku.unit_cost };
      });
    if (!items.length) return;
    const res = await fetch("/api/admin/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, paymentMethod: "pending", note: "Bulk one-off entry" }),
    });
    const j = await res.json();
    setResult(res.ok ? `Order ${j.order.receipt_no} created.` : j.error);
    if (res.ok) setLines([{ sku_id: "", qty: 1 }]);
  }

  return (
    <div className="min-h-dvh bg-cream text-ink p-6 max-w-xl mx-auto flex flex-col gap-3">
      <div className="font-extrabold text-lg">Bulk one-off entry</div>
      {lines.map((l, i) => (
        <div key={i} className="flex gap-2">
          <select value={l.sku_id} onChange={(e) => updateLine(i, { sku_id: e.target.value })} className="border-2 border-ink p-2 flex-1">
            <option value="">Select SKU…</option>
            {skus.map((s) => (
              <option key={s.id} value={s.id}>
                {s.sku_code} (₹{s.unit_price})
              </option>
            ))}
          </select>
          <input
            type="number"
            value={l.qty}
            onChange={(e) => updateLine(i, { qty: Number(e.target.value) })}
            className="border-2 border-ink p-2 w-20"
          />
        </div>
      ))}
      <button onClick={() => setLines((prev) => [...prev, { sku_id: "", qty: 1 }])} className="border-2 border-dashed border-ink py-2 font-bold text-sm">
        + ADD LINE
      </button>
      <button onClick={submit} className="bg-blue text-cream py-3 font-extrabold">
        CREATE BULK ORDER
      </button>
      {result && <div className="font-mono text-xs">{result}</div>}
    </div>
  );
}

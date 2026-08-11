"use client";
import { useEffect, useState } from "react";

type Sku = { id: string; sku_code: string; unit_price: number; unit_cost: number };
type Design = { id: string; code: string; unit_price: number; unit_cost: number };

export default function AdminPricingPage() {
  const [skus, setSkus] = useState<Sku[]>([]);
  const [designs, setDesigns] = useState<Design[]>([]);
  const [bulkFit, setBulkFit] = useState("crop");
  const [bulkPrice, setBulkPrice] = useState("399");

  async function load() {
    const j = await fetch("/api/admin/pricing").then((r) => r.json());
    setSkus(j.skus || []);
    setDesigns(j.designs || []);
  }
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const j = await fetch("/api/admin/pricing").then((r) => r.json());
      if (cancelled) return;
      setSkus(j.skus || []);
      setDesigns(j.designs || []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveCell(type: "product" | "sticker", id: string, field: "unit_price" | "unit_cost", value: string) {
    await fetch("/api/admin/pricing", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, id, [field]: Number(value) }),
    });
    load();
  }

  async function bulkSet() {
    await fetch("/api/admin/pricing", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bulk: { fitName: bulkFit, unit_price: Number(bulkPrice) } }),
    });
    load();
  }

  return (
    <div className="min-h-dvh bg-cream text-ink p-4 md:p-8 flex flex-col gap-6 w-full max-w-[1600px] mx-auto">
      <h1 className="font-extrabold text-2xl tracking-wide">Pricing</h1>
      <div className="bg-signal text-cream p-3 font-extrabold text-xs tracking-wide">
        These prices are starting defaults, not signed off yet — replace them before treating this as real
        invoicing data. Once you change a price, it only affects new sales; past orders keep whatever price
        they were charged.
      </div>

      <div>
        <div className="font-extrabold text-lg mb-2">Bulk set (products by fit)</div>
        <div className="flex flex-wrap gap-2">
          <select value={bulkFit} onChange={(e) => setBulkFit(e.target.value)} className="border-2 border-ink p-2">
            <option value="oversized">Oversized</option>
            <option value="regular">Regular</option>
            <option value="crop">Crop</option>
          </select>
          <input value={bulkPrice} onChange={(e) => setBulkPrice(e.target.value)} className="border-2 border-ink p-2 w-24" />
          <button onClick={bulkSet} className="bg-blue text-cream px-4 font-extrabold text-sm">
            SET ALL
          </button>
        </div>
      </div>

      <div>
        <div className="font-extrabold text-lg mb-2">Tees</div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm border-2 border-ink min-w-[720px]">
          <thead>
            <tr className="bg-ink text-cream">
              <th className="p-1.5 text-left">SKU</th>
              <th className="p-1.5">Price</th>
              <th className="p-1.5">Cost</th>
            </tr>
          </thead>
          <tbody>
            {skus.map((s) => (
              <tr key={s.id} className="border-t border-ink">
                <td className="p-1.5 font-mono text-xs">{s.sku_code}</td>
                <td className="p-1.5">
                  <input
                    defaultValue={s.unit_price}
                    onBlur={(e) => saveCell("product", s.id, "unit_price", e.target.value)}
                    className="border border-ink w-20 p-1"
                  />
                </td>
                <td className="p-1.5">
                  <input
                    defaultValue={s.unit_cost}
                    onBlur={(e) => saveCell("product", s.id, "unit_cost", e.target.value)}
                    className="border border-ink w-20 p-1"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      <div>
        <div className="font-extrabold text-lg mb-2">Stickers</div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm border-2 border-ink min-w-[720px]">
          <thead>
            <tr className="bg-ink text-cream">
              <th className="p-1.5 text-left">Code</th>
              <th className="p-1.5">Price</th>
              <th className="p-1.5">Cost</th>
            </tr>
          </thead>
          <tbody>
            {designs.map((d) => (
              <tr key={d.id} className="border-t border-ink">
                <td className="p-1.5 font-mono text-xs">{d.code}</td>
                <td className="p-1.5">
                  <input
                    defaultValue={d.unit_price}
                    onBlur={(e) => saveCell("sticker", d.id, "unit_price", e.target.value)}
                    className="border border-ink w-20 p-1"
                  />
                </td>
                <td className="p-1.5">
                  <input
                    defaultValue={d.unit_cost}
                    onBlur={(e) => saveCell("sticker", d.id, "unit_cost", e.target.value)}
                    className="border border-ink w-20 p-1"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

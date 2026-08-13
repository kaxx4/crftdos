"use client";
import { useEffect, useState } from "react";
import { BigButton, Banner, Card, Field, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui";

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
      <Banner tone="signal">
        <span>
          These prices are starting defaults, not signed off yet — replace them before treating this as real
          invoicing data. Once you change a price, it only affects new sales; past orders keep whatever price
          they were charged.
        </span>
      </Banner>

      <Card className="gap-3">
        <div className="font-extrabold text-lg">Bulk set (products by fit)</div>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={bulkFit}
            onChange={(e) => setBulkFit(e.target.value)}
            className="border-2 border-ink p-3 min-h-[48px] rounded-[var(--radius-pos-sm)] bg-white"
          >
            <option value="oversized">Oversized</option>
            <option value="regular">Regular</option>
            <option value="crop">Crop</option>
          </select>
          <Field label="Bulk price" value={bulkPrice} onChange={(e) => setBulkPrice(e.target.value)} className="w-24" />
          <BigButton variant="blue" onClick={bulkSet} className="px-4">
            SET ALL
          </BigButton>
        </div>
      </Card>

      <div>
        <div className="font-extrabold text-lg mb-2">Tees</div>
        <div className="overflow-x-auto">
          <Table className="min-w-[720px]">
            <TableHead>
              <TableHeaderCell>SKU</TableHeaderCell>
              <TableHeaderCell>Price</TableHeaderCell>
              <TableHeaderCell>Cost</TableHeaderCell>
            </TableHead>
            <TableBody>
              {skus.map((s) => (
                <TableRow key={s.id}>
                  <TableCell mono>{s.sku_code}</TableCell>
                  <TableCell>
                    <Field
                      label={`Price for ${s.sku_code}`}
                      defaultValue={s.unit_price}
                      onBlur={(e) => saveCell("product", s.id, "unit_price", e.target.value)}
                      className="w-24 min-h-[40px] p-2"
                    />
                  </TableCell>
                  <TableCell>
                    <Field
                      label={`Cost for ${s.sku_code}`}
                      defaultValue={s.unit_cost}
                      onBlur={(e) => saveCell("product", s.id, "unit_cost", e.target.value)}
                      className="w-24 min-h-[40px] p-2"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div>
        <div className="font-extrabold text-lg mb-2">Stickers</div>
        <div className="overflow-x-auto">
          <Table className="min-w-[720px]">
            <TableHead>
              <TableHeaderCell>Code</TableHeaderCell>
              <TableHeaderCell>Price</TableHeaderCell>
              <TableHeaderCell>Cost</TableHeaderCell>
            </TableHead>
            <TableBody>
              {designs.map((d) => (
                <TableRow key={d.id}>
                  <TableCell mono>{d.code}</TableCell>
                  <TableCell>
                    <Field
                      label={`Price for ${d.code}`}
                      defaultValue={d.unit_price}
                      onBlur={(e) => saveCell("sticker", d.id, "unit_price", e.target.value)}
                      className="w-24 min-h-[40px] p-2"
                    />
                  </TableCell>
                  <TableCell>
                    <Field
                      label={`Cost for ${d.code}`}
                      defaultValue={d.unit_cost}
                      onBlur={(e) => saveCell("sticker", d.id, "unit_cost", e.target.value)}
                      className="w-24 min-h-[40px] p-2"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

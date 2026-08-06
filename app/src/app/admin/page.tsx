"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type Analytics = {
  gross: number;
  cogs: number;
  discounts: number;
  raisedForAquaterra: number;
  orderCount: number;
  wasteCount: number;
  wasteCost: number;
  returnCount: number;
  returnRate: number;
};

export default function AdminHome() {
  const [a, setA] = useState<Analytics | null>(null);

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then((r) => r.json())
      .then(setA);
  }, []);

  return (
    <div className="min-h-dvh bg-cream text-ink p-6 flex flex-col gap-6 max-w-3xl mx-auto">
      <div className="flex gap-3">
        <Link href="/admin/pricing" className="border-2 border-ink px-3 py-2 font-extrabold text-sm bg-white">
          Pricing
        </Link>
        <Link href="/admin/b2b" className="border-2 border-ink px-3 py-2 font-extrabold text-sm bg-white">
          B2B
        </Link>
        <Link href="/admin/bulk" className="border-2 border-ink px-3 py-2 font-extrabold text-sm bg-white">
          Bulk entry
        </Link>
        <Link href="/admin/catalogue" className="border-2 border-ink px-3 py-2 font-extrabold text-sm bg-white">
          QR labels
        </Link>
      </div>

      <div className="bg-blue text-cream p-6 border-2 border-ink">
        <div className="font-extrabold text-xs tracking-[0.14em] opacity-80">RAISED FOR AQUATERRA</div>
        <div className="font-extrabold text-5xl mt-1">₹{a?.raisedForAquaterra ?? "…"}</div>
        <div className="font-mono text-xs opacity-70 mt-1">Net profit after COGS, all-time, non-voided orders</div>
      </div>

      {a && (
        <div className="grid grid-cols-2 gap-3">
          <div className="border-2 border-ink bg-white p-3">
            <div className="font-mono text-xs text-neutral-500">Gross</div>
            <div className="font-extrabold text-2xl">₹{a.gross}</div>
          </div>
          <div className="border-2 border-ink bg-white p-3">
            <div className="font-mono text-xs text-neutral-500">COGS</div>
            <div className="font-extrabold text-2xl">₹{a.cogs}</div>
          </div>
          <div className="border-2 border-ink bg-white p-3">
            <div className="font-mono text-xs text-neutral-500">Discounts given</div>
            <div className="font-extrabold text-2xl">₹{a.discounts}</div>
          </div>
          <div className="border-2 border-ink bg-white p-3">
            <div className="font-mono text-xs text-neutral-500">Orders</div>
            <div className="font-extrabold text-2xl">{a.orderCount}</div>
          </div>
          <div className="border-2 border-signal bg-white p-3">
            <div className="font-mono text-xs text-neutral-500">Waste cost</div>
            <div className="font-extrabold text-2xl">
              ₹{a.wasteCost} <span className="text-xs font-normal">({a.wasteCount} entries)</span>
            </div>
          </div>
          <div className="border-2 border-signal bg-white p-3">
            <div className="font-mono text-xs text-neutral-500">Return rate</div>
            <div className="font-extrabold text-2xl">{a.returnRate.toFixed(1)}%</div>
          </div>
        </div>
      )}

      <div className="font-mono text-[11px] text-neutral-500 border border-dashed border-neutral-400 p-2.5">
        This is headline + waste + returns only, per the current build pass. Full §13 analytics (kiosk conversion,
        fulfilment timing, holds conversion, B2B pipeline value) is a later pass.
      </div>
    </div>
  );
}

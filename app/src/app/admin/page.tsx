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
type EmailStatus = { configured: boolean; reachable?: boolean; verifiedCount?: number; message: string };

export default function AdminHome() {
  const [a, setA] = useState<Analytics | null>(null);
  const [email, setEmail] = useState<EmailStatus | null>(null);

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then((r) => r.json())
      .then(setA);
    fetch("/api/admin/email-status")
      .then((r) => r.json())
      .then(setEmail);
  }, []);

  return (
    <div className="min-h-dvh bg-cream text-ink p-4 md:p-8 flex flex-col gap-6 w-full max-w-[1400px] mx-auto">
      <h1 className="font-extrabold text-2xl tracking-wide">Admin dashboard</h1>
      <div className="flex flex-wrap gap-3">
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
        <Link href="/admin/mockups" className="border-2 border-ink px-3 py-2 font-extrabold text-sm bg-white">
          Mockups
        </Link>
      </div>

      <div className="bg-blue text-cream p-6 border-2 border-ink">
        <div className="font-extrabold text-xs tracking-[0.14em] opacity-80">RAISED FOR AQUATERRA</div>
        <div className="font-extrabold text-5xl mt-1">₹{a?.raisedForAquaterra ?? "…"}</div>
        <div className="font-mono text-xs opacity-70 mt-1">Net profit after cost, all time, excludes voided sales</div>
      </div>

      {a && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="border-2 border-ink bg-white p-3">
            <div className="font-mono text-xs text-muted">Gross</div>
            <div className="font-extrabold text-2xl">₹{a.gross}</div>
          </div>
          <div className="border-2 border-ink bg-white p-3">
            <div className="font-mono text-xs text-muted">Cost</div>
            <div className="font-extrabold text-2xl">₹{a.cogs}</div>
          </div>
          <div className="border-2 border-ink bg-white p-3">
            <div className="font-mono text-xs text-muted">Discounts given</div>
            <div className="font-extrabold text-2xl">₹{a.discounts}</div>
          </div>
          <div className="border-2 border-ink bg-white p-3">
            <div className="font-mono text-xs text-muted">Orders</div>
            <div className="font-extrabold text-2xl">{a.orderCount}</div>
          </div>
          <div className="border-2 border-signal bg-white p-3">
            <div className="font-mono text-xs text-muted">Waste cost</div>
            <div className="font-extrabold text-2xl">
              ₹{a.wasteCost} <span className="text-xs font-normal">({a.wasteCount} entries)</span>
            </div>
          </div>
          <div className="border-2 border-signal bg-white p-3">
            <div className="font-mono text-xs text-muted">Return rate</div>
            <div className="font-extrabold text-2xl">{a.returnRate.toFixed(1)}%</div>
          </div>
        </div>
      )}

      <div className="font-mono text-[13px] text-muted border border-dashed border-hairline p-2.5">
        This dashboard currently shows totals, waste and returns only. Kiosk conversion, fulfilment timing,
        holds and B2B pipeline numbers are coming in a future update.
      </div>

      {email && (
        <div
          className={`border-2 p-3 flex flex-col gap-1 ${
            email.verifiedCount && email.verifiedCount > 0 ? "border-ok" : "border-signal"
          } bg-white`}
        >
          <div className="font-extrabold text-xs tracking-[0.1em]">EMAIL DELIVERY</div>
          <div className="font-mono text-xs text-muted">{email.message}</div>
        </div>
      )}
    </div>
  );
}

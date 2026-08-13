"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BigButton, Card } from "@/components/ui";

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

/** Tier-3 label: the smallest text on the page, identifying what a value is. */
function KpiLabel({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-xs text-muted uppercase tracking-[0.06em]">{children}</div>;
}

/** Tier-2 value: a regular stat-card number. */
function KpiValue({ children }: { children: React.ReactNode }) {
  return <div className="font-extrabold text-2xl">{children}</div>;
}

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
        {[
          { href: "/admin/pricing", label: "Pricing" },
          { href: "/admin/b2b", label: "B2B" },
          { href: "/admin/bulk", label: "Bulk entry" },
          { href: "/admin/catalogue", label: "QR labels" },
          { href: "/admin/mockups", label: "Mockups" },
        ].map((l) => (
          <Link key={l.href} href={l.href}>
            <BigButton variant="cream" className="min-h-[44px] px-4">
              {l.label}
            </BigButton>
          </Link>
        ))}
      </div>

      {/* Hero KPI — the one authored, full-width blue tile per page. */}
      <div className="bg-blue text-cream p-6 border-2 border-ink rounded-[var(--radius-pos-md)]">
        <div className="font-extrabold text-xs tracking-[0.14em] opacity-80">RAISED FOR AQUATERRA</div>
        <div className="font-extrabold text-5xl mt-1">₹{a?.raisedForAquaterra ?? "…"}</div>
        <div className="font-mono text-xs opacity-70 mt-1">Net profit after cost, all time, excludes voided sales</div>
      </div>

      {a && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Card>
            <KpiLabel>Gross</KpiLabel>
            <KpiValue>₹{a.gross}</KpiValue>
          </Card>
          <Card>
            <KpiLabel>Cost</KpiLabel>
            <KpiValue>₹{a.cogs}</KpiValue>
          </Card>
          <Card>
            <KpiLabel>Discounts given</KpiLabel>
            <KpiValue>₹{a.discounts}</KpiValue>
          </Card>
          <Card>
            <KpiLabel>Orders</KpiLabel>
            <KpiValue>{a.orderCount}</KpiValue>
          </Card>
          <Card className="border-signal">
            <KpiLabel>Waste cost</KpiLabel>
            <KpiValue>
              ₹{a.wasteCost} <span className="text-xs font-normal">({a.wasteCount} entries)</span>
            </KpiValue>
          </Card>
          <Card className="border-signal">
            <KpiLabel>Return rate</KpiLabel>
            <KpiValue>{a.returnRate.toFixed(1)}%</KpiValue>
          </Card>
        </div>
      )}

      <div className="font-mono text-[13px] text-muted border border-dashed border-hairline p-2.5 rounded-[var(--radius-pos-sm)]">
        This dashboard currently shows totals, waste and returns only. Kiosk conversion, fulfilment timing,
        holds and B2B pipeline numbers are coming in a future update.
      </div>

      {email && (
        <Card className={email.verifiedCount && email.verifiedCount > 0 ? "border-ok" : "border-signal"}>
          <div className="font-extrabold text-xs tracking-[0.1em]">EMAIL DELIVERY</div>
          <div className="font-mono text-xs text-muted">{email.message}</div>
        </Card>
      )}
    </div>
  );
}

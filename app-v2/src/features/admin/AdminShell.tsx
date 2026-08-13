"use client";

/** Admin chrome.
 *
 *  Desktop-first and genuinely dense, which is the third distinct register in
 *  the system. The audit's first P1 finding against the old build was that the
 *  admin surface was built at mobile widths — a pricing table that needs
 *  horizontal page scroll on a 1440px monitor is a table nobody reconciles
 *  against. So: a real sidebar, real information density, and tables that
 *  scroll inside their own container rather than pushing the page sideways. */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { EnvironmentChip } from "@/components/EnvironmentChip";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { getBackend } from "@/lib/backend";
import { clsx } from "@/components/clsx";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/environments", label: "Stalls" },
  { href: "/admin/stock", label: "Stock allocation" },
  { href: "/admin/templates", label: "Templates" },
  { href: "/admin/catalogue", label: "Catalogue" },
  { href: "/admin/pricing", label: "Pricing" },
  { href: "/admin/b2b", label: "B2B" },
  { href: "/admin/bulk", label: "Bulk entry" },
  { href: "/admin/discounts", label: "Discounts" },
];

export function AdminShell({ children, title }: { children: React.ReactNode; title: string }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--color-cream)] lg:flex-row">
      <aside className="shrink-0 border-b-2 border-[var(--color-ink)] bg-white lg:w-60 lg:border-b-0 lg:border-r-2">
        <div className="flex items-center gap-3 p-4">
          <span className="font-[family-name:var(--font-mono)] font-bold tracking-[0.2em]">CRFTD★</span>
        </div>
        <nav aria-label="Admin sections" className="flex gap-1 overflow-x-auto p-2 lg:flex-col lg:overflow-visible">
          {NAV.map((n) => {
            const active = pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "tap-target flex shrink-0 items-center rounded-md px-3 text-sm font-semibold",
                  "transition-colors duration-[var(--dur-fast)]",
                  active ? "bg-[var(--color-ink)] text-[var(--color-cream)]" : "hover:bg-black/5"
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[var(--color-line)] bg-white px-5 py-3">
          <EnvironmentChip />
          <h1 className="text-lg font-extrabold tracking-tight">{title}</h1>
          <RoleSwitcher />
        </header>

        {getBackend().isMock && (
          <div className="mock-hatch border-b-2 border-[var(--color-signal)] px-4 py-2 text-center text-sm font-bold">
            DEMO DATA — these are not real figures
          </div>
        )}

        <main className="min-w-0 flex-1 p-5">{children}</main>
      </div>
    </div>
  );
}

/** Wide content scrolls INSIDE its own container. The page body must never
 *  scroll horizontally — that was a P2 audit finding and it makes a table
 *  impossible to read against a fixed header. */
export function ScrollX({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto">{children}</div>;
}

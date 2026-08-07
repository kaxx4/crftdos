"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Sell" },
  { href: "/stock/products", label: "Stock" },
  { href: "/orders", label: "Orders" },
  { href: "/restock", label: "Restock" },
  { href: "/more", label: "More" },
];

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="sticky bottom-0 bg-ink border-t-2 border-ink flex">
      {TABS.map((t) => {
        const active = pathname === t.href || (t.href === "/stock/products" && pathname.startsWith("/stock"));
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`flex-1 text-center py-2.5 min-h-[44px] flex items-center justify-center font-extrabold text-[11px] tracking-wide ${
              active ? "text-blue bg-cream" : "text-cream"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

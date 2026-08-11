"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/sell", label: "Sell" },
  { href: "/stock/products", label: "Stock" },
  { href: "/orders", label: "Orders" },
  { href: "/restock", label: "Restock" },
  { href: "/more", label: "More" },
];

/** Primary volunteer navigation. Rendered *inside* PosFrame via its `nav`
 *  slot — see the layout contract in PosFrame. It no longer needs `sticky`,
 *  because it is now a fixed-height row of a full-height flex column rather
 *  than an element floating after one. */
export function TabBar() {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="bg-ink border-t-2 border-ink flex">
      {TABS.map((t) => {
        const active =
          pathname === t.href || (t.href === "/stock/products" && pathname.startsWith("/stock"));
        return (
          <Link
            key={t.href}
            href={t.href}
            // aria-current is how a screen reader learns which tab is the
            // current page. Colour alone was carrying that before.
            aria-current={active ? "page" : undefined}
            // Colour settle, no scale. A volunteer switches screens dozens of
            // times a shift, so the active swap gets a short transition — but
            // scale-press is reserved for primary actions, not navigation.
            className={`flex-1 text-center py-2.5 min-h-[52px] flex items-center justify-center font-extrabold text-[13px] tracking-wide touch-manipulation transition-[color,background-color] duration-[var(--dur-fast)] ease-out focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-signal ${
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

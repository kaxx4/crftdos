"use client";

/** Admin chrome.
 *
 *  Desktop-first and genuinely dense, which is the third distinct register in
 *  the system. The audit's first P1 finding against the old build was that the
 *  admin surface was built at mobile widths — a pricing table that needs
 *  horizontal page scroll on a 1440px monitor is a table nobody reconciles
 *  against. So: a real sidebar, real information density, and tables that
 *  scroll inside their own container rather than pushing the page sideways.
 *
 *  Colour budget (DESIGN-SPEC §2.3): the chrome spends NOTHING. Sidebar and
 *  header are white and ink; the active nav item is an ink fill. That leaves
 *  every page its full two-block allowance, which is what keeps ten dense
 *  screens from turning into ten different-coloured screens.
 *
 *  The one display-face appearance on this surface is the wordmark below — it
 *  is chrome, so it renders exactly once per screen and no page has to spend
 *  its own budget on identity.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { EnvironmentChip } from "@/components/EnvironmentChip";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { getBackend } from "@/lib/backend";
import { clsx } from "@/components/clsx";

/** Grouped, because ten flat links is a list you read rather than a map you
 *  scan. The groups match how the job splits: what happened, what we sell,
 *  what we're running, what we're owed. */
const NAV: { group: string; items: { href: string; label: string }[] }[] = [
  {
    group: "Overview",
    items: [
      { href: "/admin", label: "Dashboard" },
      { href: "/admin/analytics", label: "Analytics" },
    ],
  },
  {
    group: "Catalogue",
    items: [
      { href: "/admin/catalogue", label: "Catalogue" },
      { href: "/admin/pricing", label: "Pricing" },
      { href: "/admin/templates", label: "Templates" },
    ],
  },
  {
    group: "Operations",
    items: [
      { href: "/admin/environments", label: "Stalls" },
      { href: "/admin/stock", label: "Stock allocation" },
      { href: "/admin/bulk", label: "Bulk entry" },
    ],
  },
  {
    group: "Money",
    items: [
      { href: "/admin/b2b", label: "B2B" },
      { href: "/admin/discounts", label: "Discounts" },
    ],
  },
];

export function AdminShell({
  children,
  title,
  lede,
  action,
}: {
  children: React.ReactNode;
  title: string;
  /** One sentence under the title. Admin screens are dense; the sentence that
   *  says what the numbers mean belongs at the top, not buried mid-page. */
  lede?: string;
  /** The page's primary action, pinned in the header rather than floating
   *  somewhere down the page where a long table hides it. */
  action?: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh min-w-0 flex-col bg-[var(--color-paper)] lg:flex-row">
      <aside
        className={clsx(
          // min-w-0 is load-bearing: a flex item defaults to min-width:auto,
          // so without it the aside sizes to the nav's max-content and the
          // nav's own overflow-x-auto never gets to clip anything. Below lg
          // that pushed the whole page 544px sideways on a phone.
          "w-full min-w-0 shrink-0 border-b-[3px] border-[var(--color-ink)] bg-white",
          "lg:h-dvh lg:w-64 lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-r-[3px]",
          "lg:sticky lg:top-0"
        )}
      >
        <div className="flex items-center justify-between gap-[var(--space-3)] border-b-[3px] border-[var(--color-ink)] bg-[var(--color-ink)] px-[var(--space-4)] py-[var(--space-3)] text-white">
          <span className="t-xl t-display">crftd</span>
          <span className="t-label text-white/80">Stall OS</span>
        </div>

        <nav
          aria-label="Admin sections"
          className="flex gap-[var(--space-4)] overflow-x-auto p-[var(--space-3)] lg:flex-col lg:gap-[var(--space-4)] lg:overflow-visible"
        >
          {NAV.map((section) => (
            <div key={section.group} className="flex shrink-0 flex-col gap-1 lg:shrink">
              <p className="hidden px-2 text-[var(--color-muted)] t-label lg:block">{section.group}</p>
              <div className="flex gap-1 lg:flex-col">
                {section.items.map((n) => {
                  const active = pathname === n.href;
                  return (
                    <Link
                      key={n.href}
                      href={n.href}
                      aria-current={active ? "page" : undefined}
                      className={clsx(
                        "flex min-h-[var(--tap-admin)] shrink-0 items-center rounded-[var(--radius-sm)] px-3 t-sm font-extrabold",
                        "transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)]",
                        active
                          ? "on-deep bg-[var(--color-ink)] text-white"
                          : "text-[var(--color-ink)] hover:bg-[var(--color-paper-2)]"
                      )}
                    >
                      {n.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b-[3px] border-[var(--color-ink)] bg-white px-[var(--space-5)] py-[var(--space-3)]">
          <div className="flex flex-wrap items-center justify-end gap-[var(--space-3)]">
            <div className="mr-auto min-w-0">
              <h1 className="t-xl">{title}</h1>
              {lede && <p className="mt-1 max-w-[70ch] t-sm text-[var(--color-muted)]">{lede}</p>}
            </div>
            <EnvironmentChip />
            <RoleSwitcher />
            {action}
          </div>
        </header>

        {/* An operator must never be unsure whether a number on screen is real.
            This is the one legitimate decorative-looking use of signal: the
            data itself is not trustworthy. */}
        {getBackend().isMock && (
          <div
            role="status"
            className="mock-hatch border-b-[3px] border-[var(--color-signal)] bg-[var(--color-signal-wash)] px-[var(--space-4)] py-[var(--space-2)] text-center t-label text-[var(--color-ink)]"
          >
            Demo data — these are not real figures
          </div>
        )}

        <main className="flex min-w-0 flex-1 flex-col gap-[var(--space-5)] p-[var(--space-5)]">
          {children}
        </main>
      </div>
    </div>
  );
}

/* `ScrollX` used to live here, wrapping hand-rolled `<table>` elements so the
   page body never scrolled sideways. Every admin table is now the `Table`
   primitive, which owns that container itself — so the helper is gone rather
   than left around as a second, weaker way to do the same thing. */

/** A right-aligned column head, for the numeric columns.
 *
 *  `Table`'s head cells are left-aligned, which is right for names and wrong
 *  for money — a column of figures that does not share a right edge cannot be
 *  compared down the page, and comparing down the page is the entire job of
 *  this surface. Pair with `<Td mono className="text-right">`. */
export function NumHead({ children }: { children: React.ReactNode }) {
  return <span className="block text-right">{children}</span>;
}


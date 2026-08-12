"use client";

/** The volunteer chrome.
 *
 *  Restrained by design (PRD D19). Somebody is squinting at a 6" phone in
 *  direct sunlight with a queue in front of them; the collision layout that
 *  makes the kiosk photogenic would be actively hostile here. Blue header
 *  band, cream ground, huge targets, maximum contrast, and nothing decorative
 *  competing for attention with the numbers.
 *
 *  The connectivity state is deliberately unmissable rather than tasteful.
 *  iOS Safari has no Background Sync, so queued sales only flush while the app
 *  is foregrounded — meaning "a volunteer must open the app for queued sales
 *  to sync" is a human process dependency. A subtle indicator would make that
 *  dependency invisible, which is how a day's offline sales get lost. */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { EnvironmentChip } from "@/components/EnvironmentChip";
import { onOutboxChange, outboxCount, wireOutboxFlush } from "@/lib/outbox";
import { clsx } from "@/components/clsx";
import { getBackend } from "@/lib/backend";

const TABS = [
  { href: "/pos", label: "Board" },
  { href: "/pos/sell", label: "Sell" },
  { href: "/pos/orders", label: "Orders" },
  { href: "/pos/stock", label: "Stock" },
  { href: "/pos/more", label: "More" },
];

export function PosShell({ children, title }: { children: React.ReactNode; title: string }) {
  const pathname = usePathname();
  const [queued, setQueued] = useState(0);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const refresh = () => void outboxCount().then(setQueued);
    refresh();
    const stopOutbox = onOutboxChange(refresh);
    const stopFlush = wireOutboxFlush();

    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      stopOutbox();
      stopFlush();
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  // Capped to phone width even on a wide viewport (a volunteer's phone in
  // landscape, or the same route opened on a laptop while testing). PosShell
  // is documented as "restrained by design... nothing decorative competing
  // for attention" — a full-bleed layout on a wide screen is exactly that
  // competing decoration, just accidental instead of deliberate.
  return (
    <div className="flex min-h-dvh flex-col items-center bg-[var(--color-cream)]">
      <div className="flex w-full max-w-md flex-1 flex-col">
        <header className="crop-marks sticky top-0 z-30 bg-[var(--color-blue)] px-3 py-2.5 text-white">
          <div className="flex items-center justify-between gap-3">
            <EnvironmentChip tone="dark" />
            <h1 className="truncate text-sm font-bold uppercase tracking-[0.14em]">{title}</h1>
          </div>
        </header>

        {(!online || queued > 0) && (
          <div
            role="status"
            aria-live="polite"
            className={clsx(
              "px-3 py-2 text-center text-sm font-bold",
              online ? "bg-[var(--color-blue-wash)] text-[var(--color-ink)]" : "bg-[var(--color-signal)] text-white"
            )}
          >
            {online
              ? `${queued} sale${queued === 1 ? "" : "s"} still syncing — keep this app open until it clears.`
              : `Offline. Sales are being saved on this phone${queued ? ` (${queued} waiting)` : ""} and will send when you're back.`}
          </div>
        )}

        {getBackend().isMock && (
          <div className="mock-hatch border-b-2 border-[var(--color-signal)] px-3 py-1.5 text-center text-xs font-bold">
            DEMO DATA — nothing here is a real sale
          </div>
        )}

        <main className="flex-1 pb-24">{children}</main>
      </div>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 mx-auto grid w-full max-w-md grid-cols-5 border-t-2 border-x-2 border-[var(--color-ink)] bg-[var(--color-cream)]"
      >
        {TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "tap-target flex flex-col items-center justify-center px-1 py-2 text-xs font-bold",
                "transition-colors duration-[var(--dur-fast)]",
                active ? "bg-[var(--color-ink)] text-[var(--color-cream)]" : "text-[var(--color-ink)]"
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

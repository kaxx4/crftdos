"use client";

/** The volunteer chrome.
 *
 *  Somebody is squinting at a 6" phone in direct sunlight with a queue in
 *  front of them. Per DESIGN-SPEC §0 the POS register is "instrument": loud
 *  chrome, calm workspace. So the colour lives HERE — one cobalt band at the
 *  top, one ink bar at the bottom — and the screens between them stay mostly
 *  white and paper with a single accent each.
 *
 *  Structurally this is the fixed frame the spec's three-region POS layout
 *  needs: the shell owns the viewport height and never scrolls, `main` is a
 *  flex column that a `PosScreen` fills, and the tab bar is a real element at
 *  the end of the column rather than a fixed overlay — an overlay is what
 *  forced the old `pb-24` guesswork and let a charge button hide behind it.
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
import { RoleSwitcher } from "@/components/RoleSwitcher";
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
  // landscape, or the same route opened on a laptop while testing).
  return (
    <div className="flex h-dvh flex-col items-center overflow-hidden bg-[var(--color-paper)]">
      <div className="flex min-h-0 w-full max-w-md flex-1 flex-col border-x-[3px] border-[var(--color-ink)]">
        <header className="crop-marks on-deep shrink-0 border-b-[3px] border-[var(--color-ink)] bg-[var(--color-cobalt)] px-[var(--space-3)] py-[var(--space-3)] text-white">
          <div className="flex items-center justify-between gap-[var(--space-3)]">
            <h1 className="t-lg min-w-0 flex-1 truncate">{title}</h1>
            <RoleSwitcher tone="dark" />
          </div>
          <EnvironmentChip tone="dark" className="mt-[var(--space-2)] w-full" />
        </header>

        {(!online || queued > 0) && (
          <div
            role="status"
            aria-live="polite"
            className={clsx(
              "shrink-0 border-b-[3px] border-[var(--color-ink)] px-[var(--space-3)] py-[var(--space-2)] t-base font-bold",
              online
                ? "bg-[var(--color-yellow)] text-[var(--color-ink)]"
                : "on-deep bg-[var(--color-signal)] text-white"
            )}
          >
            {online
              ? `${queued} sale${queued === 1 ? "" : "s"} still syncing — keep this app open until it clears.`
              : `Offline. Sales are being saved on this phone${queued ? ` (${queued} waiting)` : ""} and will send when you're back.`}
          </div>
        )}

        {getBackend().isMock && (
          <div className="mock-hatch shrink-0 border-b-[3px] border-[var(--color-signal)] px-[var(--space-3)] py-[var(--space-2)] text-center t-label">
            Demo data — nothing here is a real sale
          </div>
        )}

        <main className="flex min-h-0 flex-1 flex-col">{children}</main>

        <nav
          aria-label="Primary"
          className="on-deep grid shrink-0 grid-cols-5 border-t-[3px] border-[var(--color-ink)] bg-[var(--color-ink)] pb-[env(safe-area-inset-bottom)]"
        >
          {TABS.map((t) => {
            const active = pathname === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "flex min-h-[var(--tap-pos)] items-center justify-center px-1 t-base font-extrabold",
                  "transition-colors duration-[var(--dur-fast)]",
                  // Neutral, not a block colour: the chrome already spends the
                  // screen's cobalt, so the tab bar stays ink/white and every
                  // screen keeps a block colour of its own to spend.
                  active ? "bg-white text-[var(--color-ink)]" : "text-white/80 hover:text-white"
                )}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

"use client";

/** The kiosk subtree.
 *
 *  This layout exists to give the composition — and the live stock holds
 *  behind it — a lifetime that spans the whole customer journey while each
 *  step stays a real route. See `_lib/session.tsx` for why that matters.
 *
 *  It is also the only place Fraunces is worn: the display face was declared
 *  in the root layout deliberately unscoped so the volunteer surfaces could
 *  not inherit a display serif they have no business wearing. */

import { KioskSessionProvider } from "./_lib/session";

export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return (
    <KioskSessionProvider>
      <div className="min-h-dvh bg-[var(--color-paper)] text-[var(--color-ink)]">{children}</div>
    </KioskSessionProvider>
  );
}

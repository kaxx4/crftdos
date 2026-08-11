"use client";
import { ReactNode } from "react";
import Link from "next/link";
import { CropCorner } from "./ui";

/** The volunteer POS shell.
 *
 *  LAYOUT CONTRACT — this got broken once and is worth stating.
 *
 *  The frame owns exactly one viewport of height and never more. The header,
 *  banner and nav are fixed-height rows; `main` is the only thing that
 *  scrolls. That is what keeps the tab bar on screen at all times.
 *
 *  Previously the frame was `min-h-dvh` nested inside another `min-h-dvh`
 *  wrapper, with `<TabBar/>` rendered as a *sibling after* it. The nav
 *  therefore began one full viewport down the page — `sticky bottom-0` cannot
 *  help, because sticky pins inside the parent's box and that box was already
 *  taller than the screen. With `main` scrolling internally the page often
 *  would not scroll at all, so navigation was simply unreachable.
 *
 *  Two rules keep it fixed:
 *    1. `h-dvh` (a fixed height), not `min-h-dvh`, on the frame and column.
 *    2. `min-h-0` on the scrolling `main` — without it a flex child refuses to
 *       shrink below its content and pushes the nav back off-screen.
 *
 *  Pass the tab bar as `nav`; do not render it after the frame. */
export function PosFrame({
  kicker,
  title,
  meta,
  children,
  banner,
  footer,
  nav,
  helpTopic,
}: {
  kicker: string;
  title: string;
  meta?: ReactNode;
  children: ReactNode;
  banner?: ReactNode;
  footer?: ReactNode;
  nav?: ReactNode;
  /** Guide section id in /help. Renders a "?" in the header that opens that
   *  screen's steps already expanded. Without this a volunteer has to know to
   *  go More → How to use this, which is exactly what a first-timer doesn't
   *  know. Omit only where there is genuinely no guidance to point at. */
  helpTopic?: string;
}) {
  return (
    // svh, not dvh: the *small* viewport height is the size with browser
    // chrome VISIBLE. dvh resolves to the chrome-hidden height, which left the
    // tab bar sitting under the URL bar until the user scrolled. A till's
    // navigation must never require a scroll to reach. overflow-hidden then
    // makes `main` provably the only scroll container.
    <div className="h-[100svh] overflow-hidden flex justify-center bg-ink">
      {/* The volunteer surface is designed at phone width, but a stall runs on
          whatever hardware turns up — a spare tablet, a laptop at the admin
          table. Rather than a 480px column marooned in black, the frame grows
          with the viewport and the content inside it reflows. */}
      <div className="w-full max-w-[480px] md:max-w-[720px] lg:max-w-[960px] h-[100svh] bg-cream text-ink flex flex-col shadow-[0_0_0_1px_#000]">
        <header className="relative bg-blue text-cream px-3.5 pt-3 pb-2.5 shrink-0">
          <CropCorner />
          <div className="flex justify-between items-start gap-2">
            <div>
              {/* Was 9px at opacity-75, which measured ~4.5:1 on the blue band
                  — fine indoors, unreadable in the direct sunlight PRD §11
                  names as a design constraint. Full opacity at 11px clears
                  the 7:1 target the same section asks for. */}
              <div className="font-extrabold text-[13px] tracking-[0.18em]">{kicker}</div>
              <h1 className="font-extrabold text-2xl leading-tight tracking-wide">{title}</h1>
            </div>
            <div className="flex items-start gap-2 shrink-0">
              {meta && <div className="text-right font-mono text-[12px] leading-relaxed">{meta}</div>}
              {helpTopic && (
                <Link
                  href={`/help#${helpTopic}`}
                  aria-label="How to use this screen"
                  title="How to use this screen"
                  className="shrink-0 w-11 h-11 -mt-0.5 flex items-center justify-center border-2 border-cream/70 text-cream font-extrabold text-[17px] rounded-[var(--radius-pos-md)] touch-manipulation transition-transform duration-[var(--dur-press)] ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-signal"
                >
                  ?
                </Link>
              )}
            </div>
          </div>
        </header>

        {banner && <div className="shrink-0">{banner}</div>}

        {/* min-h-0 is load-bearing: see the layout contract above. */}
        <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3.5 flex flex-col gap-3.5">
          {children}
        </main>

        {/* Persistent action bar (the Sell screen's Charge control). A real
            row rather than a `sticky` child of `main`: sticky inside a flex
            scroll container was escaping the scrollport and covering the tab
            bar. Rows cannot overlap each other. */}
        {footer && <div className="shrink-0">{footer}</div>}

        {nav && <div className="shrink-0">{nav}</div>}
      </div>
    </div>
  );
}

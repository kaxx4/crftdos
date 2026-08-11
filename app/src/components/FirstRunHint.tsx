"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

/** A dismissible, once-per-device orientation card.
 *
 *  The gap this closes: a volunteer is handed a phone minutes before the
 *  stall opens and the app said nothing on first open. `/help` existed but you
 *  had to already know to go More → How to use this, which is exactly the
 *  knowledge a first-timer doesn't have.
 *
 *  Deliberately NOT a modal or a coach-mark tour. A blocking overlay in front
 *  of someone with a customer already waiting is hostile; this sits inline at
 *  the top of the screen, is fully skippable in one tap, and never returns
 *  once dismissed. Keyed per screen so Sell and Orders can each say their own
 *  thing without one dismissal silencing the other.
 *
 *  Storage is localStorage, so it is per-device — which is right, because the
 *  device is what gets handed to a new person, not an account. */
export function FirstRunHint({
  id,
  title,
  points,
}: {
  /** Stable key. Changing it re-shows the hint to everyone. */
  id: string;
  title: string;
  points: string[];
}) {
  const storageKey = `stallos_hint_${id}`;
  // Start hidden and reveal after the effect reads storage — rendering it
  // first and hiding it would flash the card at people who dismissed it.
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(storageKey)) setShow(true);
    } catch {
      // Private mode or storage disabled: showing it every time is the safe
      // failure, since the cost is a card someone taps away.
      setShow(true);
    }
  }, [storageKey]);

  if (!show) return null;

  function dismiss() {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      /* nothing to do — hide it for this session at least */
    }
    setShow(false);
  }

  return (
    <section
      aria-label={title}
      className="border-2 border-blue bg-blue text-cream p-3 flex flex-col gap-2 rounded-[var(--radius-pos-md)] motion-safe:animate-[pos-enter_var(--dur-pos)_var(--ease-out-strong)_both]"
    >
      <h2 className="font-extrabold text-[13px] tracking-[0.14em] uppercase">{title}</h2>
      <ol className="flex flex-col gap-1.5">
        {points.map((p, i) => (
          <li key={i} className="flex gap-2.5 text-[15px] leading-snug">
            <span
              aria-hidden="true"
              className="shrink-0 w-6 h-6 bg-cream text-blue font-extrabold text-[13px] flex items-center justify-center rounded-[var(--radius-pos-sm)]"
            >
              {i + 1}
            </span>
            <span>{p}</span>
          </li>
        ))}
      </ol>
      <div className="flex gap-2 pt-1">
        <button
          onClick={dismiss}
          className="flex-1 bg-cream text-ink font-extrabold text-[13px] tracking-wide min-h-[48px] rounded-[var(--radius-pos-md)] touch-manipulation transition-transform duration-[var(--dur-press)] ease-out active:scale-[0.97]"
        >
          GOT IT
        </button>
        <Link
          href="/help"
          className="flex-1 border-2 border-cream text-cream font-extrabold text-[13px] tracking-wide min-h-[48px] flex items-center justify-center rounded-[var(--radius-pos-md)] touch-manipulation transition-transform duration-[var(--dur-press)] ease-out active:scale-[0.97]"
        >
          FULL GUIDE
        </Link>
      </div>
    </section>
  );
}

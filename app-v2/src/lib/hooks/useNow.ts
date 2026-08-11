"use client";

import { useEffect, useState } from "react";

/** A clock that ticks, for anything showing elapsed time.
 *
 *  Reading `Date.now()` during render is impure — the value changes between
 *  renders for reasons React can't see, so the displayed number only updates
 *  when something *else* happens to re-render the component. On the POS board
 *  that means "waiting 3m" stays at 3m while a customer stands there for
 *  fifteen, which is exactly backwards: the longer someone waits, the more the
 *  number matters and the staler it gets.
 *
 *  Ticking on an interval makes elapsed time a real, updating value. Default
 *  30s — fine for minute-resolution display, and cheap. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** Minutes elapsed since an ISO timestamp, against a ticking clock. */
export function minutesSince(iso: string, now: number): number {
  return Math.floor((now - new Date(iso).getTime()) / 60_000);
}

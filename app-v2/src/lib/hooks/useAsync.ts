"use client";

/* eslint-disable react-hooks/set-state-in-effect --
   These hooks synchronise React with external systems (the backend seam,
   localStorage, a realtime subscription), which is what effects exist for.
   The rule guards against cascading re-render loops; a one-shot load that
   settles into loading/data/error is the canonical pattern, not that bug. */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Result } from "../backend";

/** Loading / error / data, once, correctly.
 *
 *  Every screen in the old build hand-rolled this and most got it slightly
 *  wrong — the common failure being `if (res.ok)` with no `else`, which made a
 *  failed tap indistinguishable from no tap on patchy stall data. Routing
 *  every read through one hook means the error branch cannot be forgotten,
 *  because there is nowhere to forget it. */
export function useAsync<T>(fn: () => Promise<Result<T>>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const alive = useRef(true);

  /** Deps are collapsed to a string signature rather than spread into the
   *  dependency array. Two reasons, and the second is the real one:
   *
   *  1. A generic hook cannot give the lint rule a literal array.
   *  2. It compares BY VALUE, not by reference. Call sites here pass things
   *     like `[environment?.id]` and `[opts.shift_id]`, and a caller that
   *     passes an inline object or array would otherwise refetch on every
   *     single render — a silent, permanent request loop that looks like the
   *     network being slow rather than like a bug. */
  const signature = JSON.stringify(deps ?? []);

  /** Held in a ref so a caller passing an inline arrow (all of them do) does
   *  not invalidate `run` on every render. The signature above is the only
   *  thing that decides when to re-run. */
  const fnRef = useRef(fn);
  // Updated in an effect, not during render — a ref write during render is a
  // side effect, and under concurrent rendering a discarded render would leave
  // the ref pointing at a closure that was never committed. Effects run in
  // declaration order, so this lands before the effect below calls `run`.
  useEffect(() => {
    fnRef.current = fn;
  });

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fnRef.current();
      if (!alive.current) return;
      if (res.ok) setData(res.data);
      else setError(res.error);
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      if (alive.current) setLoading(false);
    }
    // `signature` is the whole point: it is the cache key that decides when to
    // re-run. The rule can't see that because the fetcher lives in a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  useEffect(() => {
    alive.current = true;
    void run();
    return () => {
      alive.current = false;
    };
  }, [run]);

  return { data, error, loading, reload: run, setData };
}

/** The write counterpart. Tracks in-flight and last-error so a button can show
 *  busy and a failure can be surfaced rather than swallowed. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async <T,>(fn: () => Promise<Result<T>>): Promise<T | null> => {
    setBusy(true);
    setError(null);
    try {
      const res = await fn();
      if (res.ok) return res.data;
      setError(res.error);
      return null;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  return { run, busy, error, clearError: () => setError(null) };
}

"use client";

/* eslint-disable react-hooks/set-state-in-effect --
   These hooks synchronise React with external systems (the backend seam,
   localStorage, a realtime subscription), which is what effects exist for.
   The rule guards against cascading re-render loops; a one-shot load that
   settles into loading/data/error is the canonical pattern, not that bug. */

import { useCallback, useEffect, useState } from "react";
import { getBackend } from "../backend";
import type { Environment } from "../domain/types";
import { getBoundEnvironmentId, setBoundEnvironmentId } from "../device";

/** Resolves this device's environment binding into the actual environment.
 *
 *  `bound === false` is a first-class state that surfaces must handle, not an
 *  edge case to default away. A device that has never been through Settings
 *  has no business writing an order anywhere. */
export function useEnvironment() {
  const [environment, setEnvironment] = useState<Environment | null>(null);
  const [all, setAll] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(true);
  const [bound, setBoundState] = useState(false);

  const load = useCallback(async () => {
    const res = await getBackend().listEnvironments();
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const id = getBoundEnvironmentId();
    const match = id ? res.data.find((e) => e.id === id) ?? null : null;
    setAll(res.data);
    setEnvironment(match);
    // A binding that points at a closed or deleted environment counts as
    // unbound. Better a loud "set this up" than a silent write into a stall
    // that packed up an hour ago.
    setBoundState(Boolean(match && match.is_active));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const onChange = () => void load();
    window.addEventListener("stallos:environment", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("stallos:environment", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [load]);

  const bind = useCallback(
    (id: string) => {
      setBoundEnvironmentId(id);
      void load();
    },
    [load]
  );

  return { environment, environments: all, loading, bound, bind, reload: load };
}

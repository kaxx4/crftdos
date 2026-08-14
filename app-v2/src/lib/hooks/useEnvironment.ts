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
 *  A device that has NEVER been through Settings auto-binds to the cloud
 *  environment rather than blocking — Cloud (HQ) is the safe general-purpose
 *  bucket every deployment has, so a fresh tablet is immediately usable and
 *  Settings is a "change where this writes to" control, not a "turn this
 *  device on" gate.
 *
 *  A device that WAS explicitly bound and whose environment has since closed
 *  or been deleted does NOT fall back silently, though — that binding was a
 *  deliberate choice, and re-pointing it without telling anyone is how a
 *  day's sales land in the wrong bucket. That case still surfaces as unbound
 *  and sends the operator to Settings. */
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
    let match = id ? res.data.find((e) => e.id === id) ?? null : null;

    if (!id) {
      const cloud = res.data.find((e) => e.kind === "cloud" && e.is_active) ?? null;
      if (cloud) {
        setBoundEnvironmentId(cloud.id);
        match = cloud;
      }
    }

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

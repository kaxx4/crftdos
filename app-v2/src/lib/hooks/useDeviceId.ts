"use client";

/* eslint-disable react-hooks/set-state-in-effect --
   These hooks synchronise React with external systems (the backend seam,
   localStorage, a realtime subscription), which is what effects exist for.
   The rule guards against cascading re-render loops; a one-shot load that
   settles into loading/data/error is the canonical pattern, not that bug. */

import { useEffect, useState } from "react";
import { getDeviceId } from "../device";

/** The device id read safely for RENDER.
 *
 *  `getDeviceId()` touches localStorage and mints an id on first call, so it
 *  returns "server" during prerender and a real id after hydration. Rendering
 *  it directly is a hydration mismatch (React #418) — the server HTML and the
 *  first client render disagree, React discards the server markup, and in
 *  development it's a console error nobody reads.
 *
 *  Returning null until mounted makes the two renders agree, at the cost of
 *  one frame where the diagnostic line is blank. That is the right trade: this
 *  value is only ever shown as diagnostics, never used to make a decision.
 *  Call `getDeviceId()` directly in event handlers and effects, where there is
 *  no server render to disagree with. */
export function useDeviceId(): string | null {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => setId(getDeviceId()), []);
  return id;
}

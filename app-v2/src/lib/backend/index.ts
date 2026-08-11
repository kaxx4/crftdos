/** Backend factory — the one place the mock/live choice is made.
 *
 *  Today this always returns the mock. When the migrations in
 *  `Backend Requirements - Rework 2026-08.md` have landed and Supabase
 *  credentials exist, add the live implementation and flip on the env var.
 *  Nothing else in the app changes, because nothing else in the app imports
 *  anything other than `getBackend()` and the domain types. */

import type { Backend } from "./contract";
import { MockBackend } from "./mock";
import { LiveBackend } from "./live";

let instance: Backend | null = null;

export function getBackend(): Backend {
  if (instance) return instance;
  instance = process.env.NEXT_PUBLIC_BACKEND === "live" ? new LiveBackend() : new MockBackend();
  return instance;
}

export * from "./contract";

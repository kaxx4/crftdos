"use client";

/** Kiosk interaction analytics [008].
 *
 *  Batched and throttled, deliberately and non-negotiably. The live version of
 *  this is a publicly-writable, unauthenticated insert on a database shared
 *  with another production application — a naive client that logs at
 *  pointer-move frequency would be a self-inflicted denial of service. See the
 *  volume warning in `Backend Requirements - Rework 2026-08.md`, open question 5.
 *
 *  So: semantic events only (`sticker_placed`, never `pointer_moved`), buffered
 *  and flushed on an interval, on page hide, or when the buffer fills. */

import { getBackend } from "./backend";
import type { KioskEvent, KioskEventName } from "./domain/types";
import { getKioskSessionId } from "./device";

const FLUSH_MS = 5000;
const MAX_BUFFER = 25;

let buffer: KioskEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let wired = false;

function flush() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!buffer.length) return;
  const batch = buffer;
  buffer = [];
  // Fire and forget. Analytics must never block, retry into, or fail a
  // customer's flow — a lost batch costs a chart, a blocked flow costs a sale.
  void getBackend().logEvents(batch);
}

function wire() {
  if (wired || typeof window === "undefined") return;
  wired = true;
  // `visibilitychange` rather than `beforeunload`: iOS Safari does not fire
  // unload reliably, and this is the same constraint that shapes the outbox.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}

export function track(environmentId: string, event: KioskEventName, detail?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  wire();
  buffer.push({
    session_id: getKioskSessionId(),
    environment_id: environmentId,
    event,
    detail,
    created_at: new Date().toISOString(),
  });
  if (buffer.length >= MAX_BUFFER) return flush();
  if (!timer) timer = setTimeout(flush, FLUSH_MS);
}

export function flushAnalytics() {
  flush();
}

"use client";

/** The offline outbox.
 *
 *  Unchanged in intent from the verified implementation, because the stall runs
 *  on mobile data at a school festival and this is the component that assumes
 *  the network is absent. Carried forward rather than re-derived — re-typing
 *  this from memory is the one avoidable way to lose real money at a stall.
 *
 *  The client-generated order UUID is the idempotency key at both ends: it is
 *  the order's primary key, and `createOrder` returns the existing row if it
 *  already exists. A retry therefore CANNOT double-charge. Every change to this
 *  file has to preserve that property.
 *
 *  Note this is separate from the catalogue cache on purpose: this store holds
 *  money, that one holds disposable derived data. They must never share a
 *  database, because clearing one must never be able to clear the other. */

import { openDB, type IDBPDatabase } from "idb";
import { getBackend } from "./backend";
import type { CreateOrderInput, ErrorCode } from "./backend/contract";

// Codes that mean "the server looked at this and said no" rather than "try
// again later" — retrying these forever just replays the same rejection, so
// they go straight to `failed` without waiting out MAX_FAILED_RETRIES.
const PERMANENT_ERROR_CODES: ErrorCode[] = [
  "out_of_stock",
  "no_receipt_numbers",
  "already_redeemed",
  "environment_closed",
  "unauthorised",
];

export type OutboxOrder = {
  /** Client uuid. The idempotency key. */
  id: string;
  payload: CreateOrderInput;
  queuedAt: string;
  status: "queued" | "syncing" | "failed";
  lastError?: string;
  attempts?: number;
};

/** A "failed" item is a server rejection (out of stock, exhausted block), not a
 *  transient blip — retrying it unattended forever just replays the same
 *  rejection. Past this many attempts it stops auto-retrying and needs a human,
 *  but it still counts toward `outboxCount()` so shift close correctly blocks
 *  on it rather than letting a volunteer walk away from an unsynced sale. */
export const MAX_FAILED_RETRIES = 5;

const DB_NAME = "stallos-outbox";
const STORE = "orders";
let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
      },
    });
  }
  return dbPromise;
}

export async function enqueueOrder(item: OutboxOrder) {
  const db = await getDb();
  await db.put(STORE, item);
  notify();
}

export async function listOutbox(): Promise<OutboxOrder[]> {
  const db = await getDb();
  return db.getAll(STORE);
}

export async function outboxCount(): Promise<number> {
  const db = await getDb();
  return db.count(STORE);
}

export async function removeFromOutbox(id: string) {
  const db = await getDb();
  await db.delete(STORE, id);
  notify();
}

export async function markOutbox(id: string, patch: Partial<OutboxOrder>) {
  const db = await getDb();
  const existing = await db.get(STORE, id);
  if (existing) await db.put(STORE, { ...existing, ...patch });
  notify();
}

/** Discard a poisoned item. The old build had no way to inspect or drop one,
 *  so a permanently-rejected order retried forever with no UI acknowledging
 *  it existed. Shift close blocks on the outbox, so "no way to discard" meant
 *  "cannot close the shift". */
export async function discardOutboxItem(id: string) {
  await removeFromOutbox(id);
}

const listeners = new Set<() => void>();
function notify() {
  for (const l of listeners) l();
}
export function onOutboxChange(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Reentrancy guard. `visibilitychange` and `online` can fire near
 *  simultaneously; a second caller must await the first run rather than
 *  starting a concurrent pass that races on the device's receipt block. */
let inFlight: Promise<void> | null = null;

export async function flushOutbox(): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = flushInner().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function flushInner() {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  const items = await listOutbox();
  const backend = getBackend();

  // Serial, deliberately. Parallel flushes would race on the device's receipt
  // block and hand two orders the same number.
  for (const item of items) {
    if (item.status === "syncing") continue;
    if (item.status === "failed" && (item.attempts ?? 0) >= MAX_FAILED_RETRIES) continue;

    const attempts = (item.attempts ?? 0) + 1;
    await markOutbox(item.id, { status: "syncing", attempts });
    try {
      const res = await backend.createOrder(item.payload);
      if (res.ok) await removeFromOutbox(item.id);
      else {
        const permanent = res.code ? PERMANENT_ERROR_CODES.includes(res.code) : false;
        await markOutbox(item.id, {
          status: "failed",
          lastError: permanent ? res.error : `${res.error} (will retry)`,
          attempts: permanent ? MAX_FAILED_RETRIES : attempts,
        });
      }
    } catch (e) {
      await markOutbox(item.id, {
        status: "queued",
        lastError: e instanceof Error ? e.message : "network error",
        attempts,
      });
    }
  }
}

/** iOS Safari does not implement Background Sync, so flushing can only happen
 *  while the app is foregrounded. That is a human process dependency, not a
 *  technical one — it is precisely why the connectivity indicator must be
 *  unmissable and why shift close blocks on a non-empty outbox. */
export function wireOutboxFlush(): () => void {
  if (typeof window === "undefined") return () => {};
  const onWake = () => {
    if (document.visibilityState === "visible") void flushOutbox();
  };
  document.addEventListener("visibilitychange", onWake);
  window.addEventListener("online", onWake);
  void flushOutbox();
  return () => {
    document.removeEventListener("visibilitychange", onWake);
    window.removeEventListener("online", onWake);
  };
}

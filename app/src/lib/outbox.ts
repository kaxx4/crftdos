"use client";
import { openDB, IDBPDatabase } from "idb";

export type OutboxOrder = {
  id: string; // client uuid, idempotency key
  payload: Record<string, unknown>;
  queuedAt: string;
  status: "queued" | "syncing" | "failed";
  lastError?: string;
};

const DB_NAME = "stallos-outbox";
const STORE = "orders";
let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

export async function enqueueOrder(order: OutboxOrder) {
  const db = await getDb();
  await db.put(STORE, order);
}

export async function listOutbox(): Promise<OutboxOrder[]> {
  const db = await getDb();
  return db.getAll(STORE);
}

export async function removeFromOutbox(id: string) {
  const db = await getDb();
  await db.delete(STORE, id);
}

export async function markOutbox(id: string, patch: Partial<OutboxOrder>) {
  const db = await getDb();
  const existing = await db.get(STORE, id);
  if (existing) await db.put(STORE, { ...existing, ...patch });
}

export async function outboxCount(): Promise<number> {
  const db = await getDb();
  return db.count(STORE);
}

/** Attempts to flush every queued order to the server, in order. Idempotent
 * on the server via the client-generated order id, so retries are safe.
 * Reentrancy-guarded: if 'online' and 'visibilitychange' both fire a flush
 * near-simultaneously, the second call awaits the first run instead of
 * starting a concurrent pass that could double-POST the same item. */
let inFlightFlush: Promise<void> | null = null;

export async function flushOutbox(onProgress?: (remaining: number) => void) {
  if (inFlightFlush) return inFlightFlush;
  inFlightFlush = flushOutboxInner(onProgress).finally(() => {
    inFlightFlush = null;
  });
  return inFlightFlush;
}

async function flushOutboxInner(onProgress?: (remaining: number) => void) {
  if (!navigator.onLine) return;
  const items = await listOutbox();
  for (const item of items) {
    if (item.status === "syncing") continue;
    await markOutbox(item.id, { status: "syncing" });
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.payload),
      });
      if (res.ok) {
        await removeFromOutbox(item.id);
      } else {
        const j = await res.json().catch(() => ({}));
        await markOutbox(item.id, { status: "failed", lastError: j.error || res.statusText });
      }
    } catch (e) {
      await markOutbox(item.id, {
        status: "queued",
        lastError: e instanceof Error ? e.message : "network error",
      });
    }
    onProgress?.(await outboxCount());
  }
}

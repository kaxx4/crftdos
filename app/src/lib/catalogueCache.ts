"use client";
import { openDB, IDBPDatabase } from "idb";

/** Offline catalogue cache (PRD §10).
 *
 *  The Sell screen used to fetch colours, fits, SKUs and designs from Supabase
 *  on every boot with no fallback, so a volunteer who lost signal and reloaded
 *  got an empty screen — no products, no stickers, nothing to sell. The outbox
 *  protected orders already composed in a live tab; it could not help a cold
 *  start.
 *
 *  Kept separate from the outbox database on purpose: this is disposable
 *  derived data that can always be refetched, and the outbox holds money that
 *  cannot. They should never share a version number or a clear() call. */

const DB_NAME = "stallos-catalogue";
const STORE = "snapshots";

export type CatalogueSnapshot<T = unknown> = {
  key: string;
  data: T;
  cachedAt: string;
};

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
}

export async function putCatalogue<T>(key: string, data: T): Promise<void> {
  try {
    const db = await getDb();
    await db.put(STORE, { key, data, cachedAt: new Date().toISOString() });
  } catch {
    // A full or unavailable IndexedDB must never break a sale. Losing the
    // cache degrades the offline story; throwing here would break the online
    // one too.
  }
}

export async function getCatalogue<T>(key: string): Promise<CatalogueSnapshot<T> | null> {
  try {
    const db = await getDb();
    return (await db.get(STORE, key)) ?? null;
  } catch {
    return null;
  }
}

/** Fetch fresh and cache it; on any failure fall back to the last snapshot.
 *  Returns the data plus whether it came from cache and how old it is, so the
 *  UI can tell the volunteer the stock numbers might have moved. */
export async function loadWithCache<T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<{ data: T | null; stale: boolean; cachedAt: string | null }> {
  try {
    const fresh = await fetcher();
    void putCatalogue(key, fresh);
    return { data: fresh, stale: false, cachedAt: null };
  } catch {
    const hit = await getCatalogue<T>(key);
    if (!hit) return { data: null, stale: true, cachedAt: null };
    return { data: hit.data, stale: true, cachedAt: hit.cachedAt };
  }
}

export function describeAge(iso: string | null): string {
  if (!iso) return "";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)} d ago`;
}

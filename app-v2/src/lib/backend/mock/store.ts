/** Persistence + change notification for the mock backend.
 *
 *  State lives in localStorage under one key so a reload keeps a stall's
 *  trading day, and a `storage` event fans changes across tabs. That last part
 *  is not a gimmick: the POS board has to show a kiosk order appearing without
 *  a refresh, and the only honest way to build that UI before Supabase
 *  Realtime exists is to have a real cross-tab signal driving it. Open the
 *  kiosk in one tab and the POS in another and it behaves as it will in
 *  production. */

import type {
  B2bActivity,
  B2bOrder,
  Environment,
  Hold,
  KioskEvent,
  Order,
  ReceiptBlock,
  Return,
  Shift,
  StockRow,
  Template,
  Volunteer,
  WasteEntry,
} from "../../domain/types";
import { designs, environments, skus, stockLocations, stockSplit, templates } from "./seed";

const KEY = "stallos.mock.v1";
const CHANNEL = "stallos.mock.changed";

/** Stored form — `available_qty` (on-hand minus active holds) is derived at
 *  read time, not stored, since it changes as holds come and go without any
 *  write to the stock row itself. */
export type StockCell = Omit<StockRow, "available_qty">;

export type MockState = {
  environments: Environment[];
  templates: Template[];
  stock: Record<string, StockCell>;
  orders: Order[];
  shifts: Shift[];
  blocks: ReceiptBlock[];
  holds: Hold[];
  events: KioskEvent[];
  returns: Return[];
  waste: WasteEntry[];
  b2bOrders: B2bOrder[];
  b2bActivity: B2bActivity[];
  volunteers: Volunteer[];
  settings: Record<string, unknown>;
  /** Per-environment order sequence, so receipt numbers are environment-scoped
   *  off that environment's prefix — the mechanism that guarantees uniqueness
   *  across environments without runtime collision resolution. */
  seq: Record<string, number>;
};

function stockKey(locationId: string, skuType: "product" | "sticker", skuId: string) {
  return `${locationId}|${skuType}|${skuId}`;
}
export { stockKey };

function initialState(): MockState {
  const stock: Record<string, StockCell> = {};
  for (const loc of stockLocations) {
    const share = stockSplit[loc.id] ?? 0;
    for (const d of designs) {
      stock[stockKey(loc.id, "sticker", d.id)] = {
        location_id: loc.id,
        sku_type: "sticker",
        sku_id: d.id,
        qty: Math.floor(d.stock_qty * share),
        par_level: loc.is_warehouse ? d.par_level : Math.ceil(d.par_level * share),
      };
    }
    for (const s of skus) {
      stock[stockKey(loc.id, "product", s.id)] = {
        location_id: loc.id,
        sku_type: "product",
        sku_id: s.id,
        qty: Math.floor(s.stock_qty * share),
        par_level: loc.is_warehouse ? s.par_level : Math.ceil(s.par_level * share),
      };
    }
  }
  return {
    environments: [...environments],
    templates: [...templates],
    stock,
    orders: [],
    shifts: [],
    blocks: [],
    holds: [],
    events: [],
    returns: [],
    waste: [],
    b2bOrders: [],
    b2bActivity: [],
    volunteers: [
      { id: "vol-1", name: "Aanya", is_active: true },
      { id: "vol-2", name: "Rohan", is_active: true },
      { id: "vol-3", name: "Meera", is_active: true },
    ],
    settings: {
      upi_vpa: "terraroots@okhdfcbank",
      upi_payee_name: "TerraRoots Foundation",
      org_legal_name: "TERRAROOTS FOUNDATION",
    },
    seq: {},
  };
}

let memory: MockState | null = null;
const listeners = new Set<() => void>();

function isBrowser() {
  return typeof window !== "undefined";
}

export function getState(): MockState {
  if (memory) return memory;
  if (isBrowser()) {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        memory = JSON.parse(raw) as MockState;
        return memory;
      }
    } catch {
      // Corrupt or unavailable storage falls through to a fresh seed rather
      // than throwing — a broken demo state must never be a white screen.
    }
  }
  memory = initialState();
  return memory;
}

/** Mutate + persist + notify. Every write in the mock goes through here so
 *  there is exactly one place that can fan out a change. */
export function mutate<T>(fn: (s: MockState) => T): T {
  const state = getState();
  const result = fn(state);
  if (isBrowser()) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      // Same-tab listeners don't receive `storage`, so signal them directly.
      localStorage.setItem(CHANNEL, String(Date.now()));
    } catch {
      /* quota or private mode — in-memory state is still correct */
    }
  }
  for (const l of listeners) l();
  return result;
}

export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== CHANNEL && e.key !== KEY) return;
    // Another tab wrote. Drop the cached copy so the next read re-hydrates.
    memory = null;
    cb();
  };
  if (isBrowser()) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    if (isBrowser()) window.removeEventListener("storage", onStorage);
  };
}

export function resetState() {
  memory = initialState();
  if (isBrowser()) {
    localStorage.setItem(KEY, JSON.stringify(memory));
    localStorage.setItem(CHANNEL, String(Date.now()));
  }
  for (const l of listeners) l();
}

/** Simulated latency. Real enough that a loading state which was never built
 *  shows up as a flash of nothing during development rather than in a stall. */
export function latency(ms = 90): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

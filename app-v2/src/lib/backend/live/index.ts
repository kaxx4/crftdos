/** Live implementation of the `Backend` contract: fetch() against the
 *  `/api/*` route handlers, which are the only things in this app allowed to
 *  import Supabase. Every guard and every ordering this file's methods rely
 *  on (idempotency-first, tally-before-commit, zero-rows-means-refused) is
 *  enforced server-side in the route/RPC — this file's job is purely to call
 *  the right endpoint and translate the response into the same `Result<T>`
 *  shape the mock produces, so no call site can tell which backend it has. */

import {
  type AnalyticsSummary,
  type Backend,
  type BulkOrderItem,
  type Catalogue,
  type CreateB2bOrderInput,
  type CreateOrderInput,
  type CreateReturnInput,
  type ErrorCode,
  type InteractionAnalytics,
  type LogWasteInput,
  type Result,
  type SetPricingInput,
  type BulkSetPricingInput,
  type ShiftContext,
  type UpdateB2bOrderInput,
  err,
  ok,
} from "../contract";
import type {
  B2bOrder,
  Environment,
  Hold,
  KioskDesign,
  KioskEvent,
  Order,
  ProductSku,
  Return,
  Shift,
  StickerDesign,
  StockLocation,
  StockRow,
  Template,
  Volunteer,
  WasteEntry,
} from "../../domain/types";

const KNOWN_CODES = new Set<ErrorCode>([
  "out_of_stock",
  "no_receipt_numbers",
  "not_found",
  "expired",
  "already_redeemed",
  "conflict",
  "offline",
  "unauthorised",
  "environment_closed",
  "unknown",
]);

function codeFor(status: number, raw: unknown): ErrorCode {
  if (typeof raw === "string" && KNOWN_CODES.has(raw as ErrorCode)) return raw as ErrorCode;
  if (status === 401 || status === 403) return "unauthorised";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  return "unknown";
}

async function call<T>(path: string, init?: RequestInit): Promise<Result<T>> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      credentials: "same-origin",
    });
  } catch {
    return err("You're offline. This will retry automatically.", "offline");
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // no body
  }

  if (!res.ok) {
    const b = (body ?? {}) as { error?: string; code?: string };
    return err(b.error ?? `Request failed (${res.status})`, codeFor(res.status, b.code));
  }
  return ok(body as T);
}

function lineTotal(unitPrice: number, stickers: { unit_price: number }[]): number {
  return unitPrice + stickers.reduce((n, s) => n + s.unit_price, 0);
}

export class LiveBackend implements Backend {
  readonly isMock = false;

  // ── Environments ─────────────────────────────────────────────────────────

  async listEnvironments(): Promise<Result<Environment[]>> {
    const r = await call<{ environments: Environment[] }>("/api/environments");
    return r.ok ? ok(r.data.environments) : r;
  }

  async createEnvironment(input: { name: string; prefix: string; kind: Environment["kind"] }): Promise<Result<Environment>> {
    const r = await call<{ environment: Environment }>("/api/environments", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return r.ok ? ok(r.data.environment) : r;
  }

  async closeEnvironment(id: string): Promise<Result<Environment>> {
    const r = await call<{ environment: Environment }>(`/api/environments/${id}/close`, { method: "POST" });
    return r.ok ? ok(r.data.environment) : r;
  }

  // ── Stock ────────────────────────────────────────────────────────────────

  async listStockLocations(): Promise<Result<StockLocation[]>> {
    const r = await call<{ locations: StockLocation[] }>("/api/stock/locations");
    return r.ok ? ok(r.data.locations) : r;
  }

  async getStock(locationId: string): Promise<Result<StockRow[]>> {
    const r = await call<{ stock: StockRow[] }>(`/api/stock/${locationId}`);
    return r.ok ? ok(r.data.stock) : r;
  }

  async transferStock(input: {
    from_location_id: string;
    to_location_id: string;
    sku_type: "product" | "sticker";
    sku_id: string;
    qty: number;
    actor: string;
  }): Promise<Result<{ from: StockRow; to: StockRow }>> {
    return call("/api/stock/transfer", { method: "POST", body: JSON.stringify(input) });
  }

  // ── Catalogue ────────────────────────────────────────────────────────────

  async getCatalogue(): Promise<Result<Catalogue>> {
    return call<Catalogue>("/api/catalogue");
  }

  async getKioskCatalogue(environmentId: string): Promise<Result<KioskDesign[]>> {
    const r = await call<{ designs: KioskDesign[] }>(`/api/kiosk/catalogue?environmentId=${encodeURIComponent(environmentId)}`);
    return r.ok ? ok(r.data.designs) : r;
  }

  // ── Templates ────────────────────────────────────────────────────────────

  async listTemplates(opts?: { includeInactive?: boolean }): Promise<Result<Template[]>> {
    const qs = opts?.includeInactive ? "?includeInactive=1" : "";
    const r = await call<{ templates: Template[] }>(`/api/templates${qs}`);
    return r.ok ? ok(r.data.templates) : r;
  }

  async saveTemplate(t: Partial<Template> & { name: string; payload: Template["payload"] }): Promise<Result<Template>> {
    const r = await call<{ template: Template }>("/api/templates", { method: "POST", body: JSON.stringify(t) });
    return r.ok ? ok(r.data.template) : r;
  }

  async deleteTemplate(id: string): Promise<Result<void>> {
    const r = await call<{ ok: true }>(`/api/templates?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    return r.ok ? ok(undefined) : r;
  }

  async noteTemplateOpened(id: string): Promise<Result<void>> {
    const r = await call<{ ok: true }>("/api/templates/note-opened", { method: "POST", body: JSON.stringify({ id }) });
    return r.ok ? ok(undefined) : r;
  }

  // ── Holds ────────────────────────────────────────────────────────────────

  async reserveSticker(input: {
    sticker_id: string;
    environment_id: string;
    session_id: string;
    qty: number;
  }): Promise<Result<Hold>> {
    const r = await call<{ hold: Hold }>("/api/holds/reserve", { method: "POST", body: JSON.stringify(input) });
    return r.ok ? ok(r.data.hold) : r;
  }

  async releaseHold(id: string): Promise<Result<void>> {
    const r = await call<{ ok: true }>(`/api/holds/${id}/release`, { method: "POST" });
    return r.ok ? ok(undefined) : r;
  }

  // ── Shift ────────────────────────────────────────────────────────────────

  async getShiftContext(environmentId: string, deviceId: string): Promise<Result<ShiftContext>> {
    return call<ShiftContext>(
      `/api/shift?environmentId=${encodeURIComponent(environmentId)}&deviceId=${encodeURIComponent(deviceId)}`
    );
  }

  async openShift(input: {
    environment_id: string;
    device_id: string;
    name: string;
    type: Shift["type"];
    venue: string | null;
    press_on_site: boolean;
    opening_float: number;
  }): Promise<Result<ShiftContext>> {
    return call<ShiftContext>("/api/shift/open", { method: "POST", body: JSON.stringify(input) });
  }

  async closeShift(input: { shift_id: string; counted_cash: number }): Promise<Result<Shift>> {
    const r = await call<{ shift: Shift }>("/api/shift/close", { method: "POST", body: JSON.stringify(input) });
    return r.ok ? ok(r.data.shift) : r;
  }

  // ── Orders ───────────────────────────────────────────────────────────────

  async createOrder(input: CreateOrderInput): Promise<Result<Order>> {
    const items = input.designs.map((d) => {
      const stickers = d.placements.map((p) => ({
        sticker_design_id: p.sticker_design_id,
        side: p.side,
        pos_x: p.pos_x,
        pos_y: p.pos_y,
        rotation: p.rotation,
        unit_price: p.unit_price,
        unit_cost: p.unit_cost,
      }));
      return {
        product_sku_id: d.product_sku_id,
        qty: 1,
        unit_price: d.unit_price,
        unit_cost: d.unit_cost,
        stickers,
      };
    });

    const subtotal = input.designs.reduce((n, d) => n + lineTotal(d.unit_price, d.placements), 0);
    const costTotal = input.designs.reduce(
      (n, d) => n + d.unit_cost + d.placements.reduce((m, p) => m + p.unit_cost, 0),
      0
    );
    const total = Math.max(0, subtotal - input.discount_amount);

    const payload: Record<string, unknown> = {
      id: input.id,
      environmentId: input.environment_id,
      shiftId: input.shift_id,
      deviceId: input.device_id,
      channel: input.channel,
      designTicket: null,
      soldBy: null,
      customer: {
        phone: input.customer_phone,
        name: input.customer_name,
        email: null,
        consent_marketing: false,
      },
      subtotal,
      discountAmount: input.discount_amount,
      discountReason: input.discount_reason,
      discountNote: input.discount_note,
      total,
      costTotal,
      manualOverride: input.manual_override,
      paymentMethod: input.payment_method,
      paidCash: input.paid_cash,
      paidUpi: input.paid_upi,
      paymentRef: null,
      fulfillmentStatus: "pending_press",
      promisedDate: null,
      clientCreatedAt: input.client_created_at,
      items,
    };
    if (input.channel === "kiosk") payload.origin = "kiosk";

    const r = await call<{ order: Order; alreadyExisted: boolean }>("/api/orders", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return r.ok ? ok(r.data.order) : r;
  }

  async listOrders(opts: { environment_id?: string; shift_id?: string; limit?: number }): Promise<Result<Order[]>> {
    const qs = new URLSearchParams();
    if (opts.environment_id) qs.set("environment_id", opts.environment_id);
    if (opts.shift_id) qs.set("shift_id", opts.shift_id);
    if (opts.limit) qs.set("limit", String(opts.limit));
    const r = await call<{ orders: Order[] }>(`/api/orders?${qs.toString()}`);
    return r.ok ? ok(r.data.orders) : r;
  }

  async getOrder(id: string): Promise<Result<Order>> {
    const r = await call<{ order: Order }>(`/api/orders/${id}`);
    return r.ok ? ok(r.data.order) : r;
  }

  async markPrepped(id: string, actor: string): Promise<Result<Order>> {
    const r = await call<{ order: Order }>(`/api/orders/${id}/prep`, { method: "POST", body: JSON.stringify({ actor }) });
    return r.ok ? ok(r.data.order) : r;
  }

  async markPrinted(id: string, actor: string): Promise<Result<Order>> {
    const r = await call<{ order: Order }>(`/api/orders/${id}/print`, { method: "POST", body: JSON.stringify({ actor }) });
    return r.ok ? ok(r.data.order) : r;
  }

  async markHandedOver(id: string, actor: string): Promise<Result<Order>> {
    const r = await call<{ order: Order }>(`/api/orders/${id}/handover`, { method: "POST", body: JSON.stringify({ actor }) });
    return r.ok ? ok(r.data.order) : r;
  }

  async voidOrder(id: string, reason: string, actor: string): Promise<Result<Order>> {
    const r = await call<{ order: Order }>(`/api/orders/${id}/void`, {
      method: "POST",
      body: JSON.stringify({ reason, actor }),
    });
    return r.ok ? ok(r.data.order) : r;
  }

  // ── Analytics ────────────────────────────────────────────────────────────

  async getAnalytics(opts: { environment_id?: string; from?: string; to?: string }): Promise<Result<AnalyticsSummary>> {
    const qs = new URLSearchParams();
    if (opts.environment_id) qs.set("environment_id", opts.environment_id);
    if (opts.from) qs.set("from", opts.from);
    if (opts.to) qs.set("to", opts.to);
    return call<AnalyticsSummary>(`/api/analytics?${qs.toString()}`);
  }

  async getInteractionAnalytics(opts: { environment_id?: string }): Promise<Result<InteractionAnalytics>> {
    const qs = new URLSearchParams();
    if (opts.environment_id) qs.set("environment_id", opts.environment_id);
    return call<InteractionAnalytics>(`/api/analytics/interactions?${qs.toString()}`);
  }

  async logEvents(events: KioskEvent[]): Promise<Result<void>> {
    if (!events.length) return ok(undefined);
    const r = await call<{ ok: true }>("/api/events", { method: "POST", body: JSON.stringify({ events }) });
    return r.ok ? ok(undefined) : r;
  }

  // ── Returns ──────────────────────────────────────────────────────────────

  async listReturns(opts?: { environment_id?: string; limit?: number }): Promise<Result<Return[]>> {
    const qs = new URLSearchParams();
    if (opts?.environment_id) qs.set("environment_id", opts.environment_id);
    if (opts?.limit) qs.set("limit", String(opts.limit));
    const r = await call<{ returns: Return[] }>(`/api/returns?${qs.toString()}`);
    return r.ok ? ok(r.data.returns) : r;
  }

  async createReturn(input: CreateReturnInput): Promise<Result<Return>> {
    const r = await call<{ return: Return }>("/api/returns", { method: "POST", body: JSON.stringify(input) });
    return r.ok ? ok(r.data.return) : r;
  }

  // ── Waste ────────────────────────────────────────────────────────────────

  async listWaste(opts?: { environment_id?: string; limit?: number }): Promise<Result<WasteEntry[]>> {
    const qs = new URLSearchParams();
    if (opts?.environment_id) qs.set("environment_id", opts.environment_id);
    if (opts?.limit) qs.set("limit", String(opts.limit));
    const r = await call<{ waste: WasteEntry[] }>(`/api/waste?${qs.toString()}`);
    return r.ok ? ok(r.data.waste) : r;
  }

  async logWaste(input: LogWasteInput): Promise<Result<WasteEntry>> {
    const r = await call<{ log: WasteEntry }>("/api/waste", { method: "POST", body: JSON.stringify(input) });
    return r.ok ? ok(r.data.log) : r;
  }

  // ── Holds management ─────────────────────────────────────────────────────

  async listHolds(environmentId: string): Promise<Result<Hold[]>> {
    const r = await call<{ holds: Hold[] }>(`/api/holds?environment_id=${encodeURIComponent(environmentId)}`);
    return r.ok ? ok(r.data.holds) : r;
  }

  async createHold(input: {
    environment_id: string;
    product_sku_id?: string | null;
    sticker_id?: string | null;
    qty: number;
    customer_name: string;
    customer_phone?: string | null;
    shift_id?: string | null;
    hours?: number;
  }): Promise<Result<Hold>> {
    const r = await call<{ hold: Hold }>("/api/holds", { method: "POST", body: JSON.stringify(input) });
    return r.ok ? ok(r.data.hold) : r;
  }

  // ── B2B [org-wide, not environment-scoped] ──────────────────────────────

  async listB2bOrders(): Promise<
    Result<{ orders: B2bOrder[]; volunteers: Volunteer[]; committed: number; collected: number }>
  > {
    return call("/api/admin/b2b");
  }

  async createB2bOrder(input: CreateB2bOrderInput): Promise<Result<{ order: B2bOrder; margin: number }>> {
    return call("/api/admin/b2b", { method: "POST", body: JSON.stringify(input) });
  }

  async updateB2bOrder(id: string, patch: UpdateB2bOrderInput): Promise<Result<B2bOrder>> {
    const r = await call<{ order: B2bOrder }>(`/api/admin/b2b/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    return r.ok ? ok(r.data.order) : r;
  }

  // ── Bulk entry ───────────────────────────────────────────────────────────

  async createBulkOrder(input: {
    items: BulkOrderItem[];
    payment_method?: import("../../domain/types").PaymentMethod;
    note?: string | null;
  }): Promise<Result<{ order: Order; warning?: string; failed?: string[] }>> {
    return call("/api/admin/bulk", { method: "POST", body: JSON.stringify(input) });
  }

  // ── Admin pricing ────────────────────────────────────────────────────────

  async setSkuPricing(input: SetPricingInput): Promise<Result<ProductSku | StickerDesign>> {
    const r = await call<{ row: ProductSku | StickerDesign }>("/api/admin/pricing", {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    return r.ok ? ok(r.data.row) : r;
  }

  async bulkSetPricingByFit(input: BulkSetPricingInput): Promise<Result<void>> {
    const r = await call<{ ok: true }>("/api/admin/pricing/bulk", { method: "PATCH", body: JSON.stringify(input) });
    return r.ok ? ok(undefined) : r;
  }

  // ── Press queue ──────────────────────────────────────────────────────────

  async getPressQueue(environmentId?: string): Promise<Result<Order[]>> {
    const qs = environmentId ? `?environment_id=${encodeURIComponent(environmentId)}` : "";
    const r = await call<{ orders: Order[] }>(`/api/orders/press-queue${qs}`);
    return r.ok ? ok(r.data.orders) : r;
  }

  // ── Settings ─────────────────────────────────────────────────────────────

  async getSettings(): Promise<Result<Record<string, unknown>>> {
    return call<Record<string, unknown>>("/api/settings");
  }

  async setSetting(key: string, value: unknown): Promise<Result<void>> {
    const r = await call<{ ok: true }>("/api/settings", { method: "POST", body: JSON.stringify({ key, value }) });
    return r.ok ? ok(undefined) : r;
  }

  // ── Realtime ─────────────────────────────────────────────────────────────

  /** Polls the authenticated `/api/orders` list rather than subscribing to
   *  Postgres realtime. `stall_orders` deliberately has RLS enabled with zero
   *  policies (sale data is not meant to be anon-readable — see migration
   *  004.4's RLS notes), so an anon-key realtime channel would silently
   *  receive nothing at all: not an error, just permanent silence. Polling
   *  through the same session-checked route every other read uses keeps the
   *  POS board's "a kiosk order appears here automatically" property true
   *  without opening a new anon-readable surface on order data. */
  subscribeOrders(environmentId: string, cb: (o: Order) => void): () => void {
    let seen = new Set<string>();
    let cancelled = false;

    const poll = async () => {
      const r = await this.listOrders({ environment_id: environmentId, limit: 50 });
      if (!cancelled && r.ok) {
        for (const o of r.data) {
          if (!seen.has(o.id)) cb(o);
        }
        seen = new Set(r.data.map((o) => o.id));
      }
    };

    void poll();
    const interval = setInterval(poll, 4000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }
}

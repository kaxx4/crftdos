/** The backend seam.
 *
 *  Every surface talks to this interface and nothing else. There are two
 *  implementations:
 *
 *    - `mock/`     in-memory + localStorage, used today. Deterministic seed,
 *                  simulated latency, simulated failures you can trigger.
 *    - `live/`     fetch() against /api/* route handlers, used once the
 *                  migrations in `Backend Requirements - Rework 2026-08.md`
 *                  have landed and Supabase credentials exist.
 *
 *  The point of the seam is that Phase 2-5 of the rework can be built,
 *  reviewed and demoed in full without a database, and the swap is one
 *  factory function rather than a rewrite of every call site.
 *
 *  RULES FOR THIS FILE
 *  1. Nothing here may return a Supabase type or a Postgres error. Domain
 *     types and `Result` only.
 *  2. Every method that writes must be idempotent on a client-supplied id, so
 *     the offline outbox can retry it safely. This is not optional — it is the
 *     property that makes a retry incapable of double-charging.
 *  3. Anything that guards stock must be able to REFUSE. The live database
 *     signals refusal by returning zero rows (see `Database Functions.md`:
 *     "a successful call with zero rows means refused, not fine"), so the mock
 *     models refusal explicitly rather than letting it be an absent value. */

import type {
  B2bOrder,
  Lead,
  B2bStage,
  Color,
  DesignPayload,
  Environment,
  Fit,
  Hold,
  KioskEvent,
  KioskDesign,
  Order,
  PaymentMethod,
  ProductSku,
  ReceiptBlock,
  RestockItem,
  Return,
  ReturnAction,
  Shift,
  StickerDesign,
  StockLocation,
  StockRow,
  Template,
  Volunteer,
  WasteEntry,
  WasteReason,
} from "../domain/types";

/** Explicit success/failure rather than throwing. A stock refusal is an
 *  expected outcome on the money path, not an exception — modelling it as one
 *  is how callers end up with an empty `catch` that silently drops a sale. */
export type Result<T> = { ok: true; data: T } | { ok: false; error: string; code?: ErrorCode };

export type ErrorCode =
  | "out_of_stock"
  | "no_receipt_numbers"
  | "not_found"
  | "expired"
  | "already_redeemed"
  | "conflict"
  | "offline"
  | "unauthorised"
  | "environment_closed"
  | "unknown";

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}
export function err<T = never>(error: string, code: ErrorCode = "unknown"): Result<T> {
  return { ok: false, error, code };
}

// ────────────────────────────────────────────────────────────────────────────

export type Catalogue = {
  colors: Color[];
  fits: Fit[];
  skus: ProductSku[];
  designs: StickerDesign[];
  fetchedAt: string;
};

export type CreateOrderInput = {
  /** Client-generated. THE idempotency key. Must be stable across retries. */
  id: string;
  environment_id: string;
  channel: "kiosk" | "stall";
  shift_id: string | null;
  device_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  payment_method: PaymentMethod;
  paid_cash: number;
  paid_upi: number;
  discount_amount: number;
  discount_reason: import("../domain/types").DiscountReason | null;
  discount_note: string | null;
  manual_override: boolean;
  designs: DesignPayload[];
  client_created_at: string;
  notes?: string | null;
};

export type ShiftContext = { shift: Shift | null; block: ReceiptBlock | null };

export type AnalyticsSummary = {
  gross: number;
  discounts: number;
  cogs: number;
  /** gross - cogs. The one number that matters. PRD D23 makes it first-class
   *  deliberately: it is the reason the organisation exists. */
  raisedForAquaterra: number;
  orders: number;
  units: number;
  byEnvironment: { environment_id: string; name: string; gross: number; raised: number; orders: number }[];
  topDesigns: { code: string; name: string; units: number }[];
};

export type FunnelStep = { stage: string; sessions: number };

export type CreateReturnInput = {
  environment_id: string;
  original_order_id: string;
  reason: string;
  action: ReturnAction;
  /** Required — any return needs a named approver (PRD's "approved_by" intent).
   *  Free text, not a credential — PIN step-up was removed app-wide; this is
   *  an accountability record, not an authorization check. */
  approved_by: string;
  refund_amount?: number;
  /** How refund_amount left the till — required whenever refund_amount > 0,
   *  so shift close can subtract a cash refund from expected cash. */
  refund_method?: PaymentMethod | null;
  /** Items coming back into stock, restocked only when `resaleable` is set. */
  resaleable?: boolean;
  restock_items?: RestockItem[];
  note?: string | null;
  shift_id?: string | null;
  device_id?: string;
  /** For action:'exchange' — the replacement item. Creates a linked
   *  zero-value order so inventory moves without inflating revenue. */
  exchange_item?: { product_sku_id: string; qty: number; unit_price: number; unit_cost: number } | null;
};

export type LogWasteInput = {
  environment_id: string;
  shift_id?: string | null;
  sticker_id?: string | null;
  sticker_qty?: number;
  product_sku_id?: string | null;
  product_qty?: number;
  reason: WasteReason;
  note?: string | null;
};

export type CreateB2bOrderInput = {
  client_org: string;
  /** A `stall_volunteers.id` — every B2B deal needs one accountable person,
   *  picked from the volunteer roster, not typed free text. */
  account_owner: string;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  /** Required only when the computed margin is below 10% (D17). */
  admin_pin?: string;
};

export type UpdateB2bOrderInput = Partial<{
  stage: B2bStage;
  deposit_amount: number;
  deposit_date: string | null;
  deposit_method: PaymentMethod | null;
  balance_amount: number;
  balance_date: string | null;
  balance_method: PaymentMethod | null;
  promised_date: string | null;
  dispatched_date: string | null;
  lost_reason: string | null;
  notes: string | null;
}>;

export type BulkOrderItem = { product_sku_id?: string | null; qty: number; unit_price: number; unit_cost: number };

export type SetPricingInput = { type: "product" | "sticker"; id: string; unit_price?: number; unit_cost?: number };
export type BulkSetPricingInput = { fit_name: string; unit_price?: number; unit_cost?: number };

export type InteractionAnalytics = {
  sessions: number;
  completed: number;
  abandoned: number;
  funnel: FunnelStep[];
  topPicked: { code: string; name: string; picks: number }[];
  topTemplates: { name: string; opens: number; conversions: number }[];
  overlapBlocks: number;
};

// ────────────────────────────────────────────────────────────────────────────

export interface Backend {
  /** True when this implementation is not talking to a real database. Surfaces
   *  use it to render the "demo data" banner — an operator must never be
   *  unsure whether a number on screen is real. */
  readonly isMock: boolean;

  // Environments [004]
  listEnvironments(): Promise<Result<Environment[]>>;
  createEnvironment(input: { name: string; prefix: string; kind: Environment["kind"] }): Promise<Result<Environment>>;
  closeEnvironment(id: string): Promise<Result<Environment>>;

  // Stock locations + allocation [009]
  listStockLocations(): Promise<Result<StockLocation[]>>;
  getStock(locationId: string): Promise<Result<StockRow[]>>;
  transferStock(input: {
    from_location_id: string;
    to_location_id: string;
    sku_type: "product" | "sticker";
    sku_id: string;
    qty: number;
    actor: string;
  }): Promise<Result<{ from: StockRow; to: StockRow }>>;

  // Catalogue
  getCatalogue(): Promise<Result<Catalogue>>;
  /** Kiosk-facing, environment-scoped and pre-filtered: only designs with real
   *  print dimensions, a cutout, and availability AT THIS ENVIRONMENT. */
  getKioskCatalogue(environmentId: string): Promise<Result<KioskDesign[]>>;

  // Templates [006]
  listTemplates(opts?: { includeInactive?: boolean }): Promise<Result<Template[]>>;
  saveTemplate(t: Partial<Template> & { name: string; payload: DesignPayload }): Promise<Result<Template>>;
  deleteTemplate(id: string): Promise<Result<void>>;
  noteTemplateOpened(id: string): Promise<Result<void>>;

  // Holds — the mechanism that keeps two kiosks from composing with the last M-014
  reserveSticker(input: {
    sticker_id: string;
    environment_id: string;
    session_id: string;
    qty: number;
  }): Promise<Result<Hold>>;
  releaseHold(id: string): Promise<Result<void>>;

  // Shift
  getShiftContext(environmentId: string, deviceId: string): Promise<Result<ShiftContext>>;
  openShift(input: {
    environment_id: string;
    device_id: string;
    name: string;
    type: Shift["type"];
    venue: string | null;
    press_on_site: boolean;
    opening_float: number;
  }): Promise<Result<ShiftContext>>;
  closeShift(input: { shift_id: string; counted_cash: number }): Promise<Result<Shift>>;

  // Orders
  createOrder(input: CreateOrderInput): Promise<Result<Order>>;
  listOrders(opts: { environment_id?: string; shift_id?: string; limit?: number }): Promise<Result<Order[]>>;
  getOrder(id: string): Promise<Result<Order>>;
  /** [005] Not a timestamp stamp — this is where stock actually moves, so it
   *  can refuse. Mirrors the `stall_prep_order` RPC in the requirements doc. */
  markPrepped(id: string, actor: string): Promise<Result<Order>>;
  markPrinted(id: string, actor: string): Promise<Result<Order>>;
  markHandedOver(id: string, actor: string): Promise<Result<Order>>;
  voidOrder(id: string, reason: string, actor: string): Promise<Result<Order>>;

  // Analytics
  getAnalytics(opts: { environment_id?: string; from?: string; to?: string }): Promise<Result<AnalyticsSummary>>;
  getInteractionAnalytics(opts: { environment_id?: string }): Promise<Result<InteractionAnalytics>>;

  // [008] Batched, never per-pointer-move. See the volume warning in the
  // requirements doc — this is a publicly-writable unauthenticated insert.
  logEvents(events: KioskEvent[]): Promise<Result<void>>;

  // Returns [PRD §3.5]
  listReturns(opts?: { environment_id?: string; limit?: number }): Promise<Result<Return[]>>;
  createReturn(input: CreateReturnInput): Promise<Result<Return>>;

  // Waste
  listWaste(opts?: { environment_id?: string; limit?: number }): Promise<Result<WasteEntry[]>>;
  logWaste(input: LogWasteInput): Promise<Result<WasteEntry>>;

  // Holds management. Anonymous kiosk soft-holds are `reserveSticker`/
  // `releaseHold` above; these are the volunteer-facing named-hold flow —
  // reserving stock for a specific customer by name.
  listHolds(environmentId: string): Promise<Result<Hold[]>>;
  createHold(input: {
    environment_id: string;
    product_sku_id?: string | null;
    sticker_id?: string | null;
    qty: number;
    customer_name: string;
    customer_phone?: string | null;
    shift_id?: string | null;
    hours?: number;
  }): Promise<Result<Hold>>;

  // B2B [org-wide — NOT environment-scoped, migration 004.2]
  listB2bOrders(): Promise<Result<{ orders: B2bOrder[]; volunteers: Volunteer[]; committed: number; collected: number }>>;
  /** D17 margin gate: <10% requires `admin_pin`, <0% is hard-blocked. */
  createB2bOrder(input: CreateB2bOrderInput): Promise<Result<{ order: B2bOrder; margin: number }>>;
  updateB2bOrder(id: string, patch: UpdateB2bOrderInput): Promise<Result<B2bOrder>>;

  // Bulk entry — retrospective admin-entered orders (DM sales, forgotten till entries)
  createBulkOrder(input: {
    items: BulkOrderItem[];
    payment_method?: PaymentMethod;
    note?: string | null;
  }): Promise<Result<{ order: Order; warning?: string; failed?: string[] }>>;

  // Admin pricing — prices SNAPSHOT onto order lines at sale time, so editing
  // here never rewrites history, only what future sales charge.
  setSkuPricing(input: SetPricingInput): Promise<Result<ProductSku | StickerDesign>>;
  bulkSetPricingByFit(input: BulkSetPricingInput): Promise<Result<void>>;

  // Press queue — PRD §4.4's multi-order batch view: everything prepped and
  // not yet pressed, oldest first, with the item/sticker relations the press
  // sheet render needs.
  getPressQueue(environmentId?: string): Promise<Result<Order[]>>;

  // Leads [org-wide, not environment-scoped]
  listLeads(): Promise<Result<Lead[]>>;
  createLead(input: { name: string; phone?: string | null; notes?: string | null }): Promise<Result<Lead>>;
  updateLead(id: string, patch: { name?: string; phone?: string | null; notes?: string | null }): Promise<Result<Lead>>;

  // Settings
  getSettings(): Promise<Result<Record<string, unknown>>>;
  setSetting(key: string, value: unknown): Promise<Result<void>>;

  /** Realtime. Returns an unsubscribe. The mock drives this off a local
   *  event bus so the POS board genuinely updates when the kiosk writes an
   *  order in another tab, which is the behaviour that needs designing for. */
  subscribeOrders(environmentId: string, cb: (o: Order) => void): () => void;
}

/** The domain model for crftd Stall OS.
 *
 *  This file is the contract between the three surfaces and the backend. It is
 *  written against the schema documented in `CrftdOS/Database Tables.md` plus
 *  the additive migrations 004-009 specced in
 *  `CrftdOS/Backend Requirements - Rework 2026-08.md`.
 *
 *  Fields that DO NOT EXIST in the live database yet are marked `// [004]`
 *  through `// [009]` against the migration that introduces them. Until those
 *  land, they are served by the mock backend. Nothing else in the app should
 *  need to know which half is real. */

// ─── Enums, mirroring the 13 live Postgres enums ────────────────────────────

export type ProductType = "tee" | "hoodie" | "jacket" | "jersey" | "uniform" | "other";
export type ProductSize = "XS" | "S" | "M" | "L" | "XL" | "XXL" | "XXXL";
export type StickerSize = "S" | "M" | "L";
export type OrderChannel = "stall" | "event" | "kiosk" | "bulk" | "b2b" | "dm" | "other";
export type PaymentMethod = "upi" | "cash" | "split" | "pending";
export type PrintSide = "front" | "back";

/** `prepped` is added by migration 005. Order matters: it sits between
 *  pending_press and the pressed state, matching `add value ... after`. */
export type Fulfillment =
  | "pending_press"
  | "prepped" // [005]
  | "handed_over"
  | "collect_later"
  | "collected";

export type MovementReason =
  | "sale"
  | "void"
  | "restock"
  | "recount"
  | "damage"
  | "sample"
  | "gift"
  | "return_restock"
  | "correction"
  | "transfer_in" // [009]
  | "transfer_out"; // [009]

export type DiscountReason =
  | "volunteer_discretion"
  | "freebie"
  | "bulk"
  | "damaged_item"
  | "price_match"
  | "other";

export type WasteReason =
  | "misalignment"
  | "peel_failure"
  | "temperature"
  | "print_defect"
  | "garment_defect"
  | "other";

export type ReturnAction = "replace" | "refund" | "exchange" | "reject";
export type ShiftType = "stall" | "event" | "popup" | "other";

/** [004] */
export type EnvironmentKind = "cloud" | "stall" | "online";

// ─── Environments ───────────────────────────────────────────────────────────

/** [004] A scope tag on live shared data — NOT a local store. Every device
 *  writes directly to the one database in real time; the environment id is
 *  what makes a write attributable to a stall. There is no sync engine and
 *  there must never be one. See Fresh Plan §7. */
export type Environment = {
  id: string;
  name: string;
  /** Basis for this environment's generated ids. Unique across environments,
   *  which is what removes the need for runtime collision resolution. */
  prefix: string;
  kind: EnvironmentKind;
  is_active: boolean;
  opened_at: string;
  closed_at: string | null;
  notes?: string | null;
};

/** [009] Stock is per (sku, location). Exactly one location is the warehouse
 *  (environment_id null); every other maps 1:1 to an environment. */
export type StockLocation = {
  id: string;
  environment_id: string | null;
  name: string;
  is_warehouse: boolean;
};

/** [009] */
export type StockRow = {
  location_id: string;
  sku_type: "product" | "sticker";
  sku_id: string;
  qty: number;
  par_level: number;
};

// ─── Catalogue ──────────────────────────────────────────────────────────────

export type Color = { id: string; name: string; hex: string; sort: number; is_active: boolean };
export type Fit = { id: string; name: string; applies_to: ProductType; sort: number; is_active: boolean };

/** The printable rectangle on a mockup. x/y/w/h are fractions of the mockup
 *  image; cm_w/cm_h are that rectangle's real-world size. Together they give
 *  the px-per-cm that makes true-scale rendering possible. */
export type PrintArea = { x: number; y: number; w: number; h: number; cm_w: number; cm_h: number };

export type ProductSku = {
  id: string;
  product_type: ProductType;
  color_id: string;
  fit_id: string;
  size: ProductSize;
  sku_code: string;
  /** Derived total across all locations once [009] lands. Never write to it. */
  stock_qty: number;
  par_level: number;
  unit_cost: number;
  unit_price: number;
  mockup_front: string | null;
  mockup_back: string | null;
  print_area: { front?: PrintArea; back?: PrintArea } | null;
  is_active: boolean;
};

export type StickerDesign = {
  id: string;
  code: string;
  size_class: StickerSize;
  name: string;
  artwork_group: string | null;
  tags: string[];
  auto_tags: string[];
  cutout_path: string | null;
  /** Nullable in the schema, and a null here yields NaN geometry on the
   *  canvas. The kiosk catalogue query MUST filter these out — see
   *  `Flow - Kiosk Design.md`, "null yields NaN geometry". */
  print_w_cm: number | null;
  print_h_cm: number | null;
  stock_qty: number;
  par_level: number;
  bin_location: string | null;
  unit_cost: number;
  unit_price: number;
  is_active: boolean;
  kiosk_visible: boolean;
};

/** A design that has passed the kiosk's fulfillability filter: real print
 *  dimensions, a cutout to render, and availability at this device's
 *  environment. The non-null print dims are the whole point of the type —
 *  the canvas can consume it without null checks. */
export type KioskDesign = Omit<StickerDesign, "print_w_cm" | "print_h_cm"> & {
  print_w_cm: number;
  print_h_cm: number;
  available_qty: number;
};

// ─── Templates [006] ────────────────────────────────────────────────────────

/** Genuinely distinct from `stall_presets`. Presets are the existing editable
 *  starting points ("starting noise"); templates are admin-managed and
 *  merchandised on the kiosk storefront. Payload shape is deliberately
 *  identical to a design ticket's, so opening a template into the canvas is
 *  the same code path as redeeming a ticket. */
export type Template = {
  id: string;
  name: string;
  slug: string;
  blurb: string | null;
  payload: DesignPayload;
  preview_path: string | null;
  is_featured: boolean;
  is_active: boolean;
  sort: number;
  times_used: number;
};

// ─── The composed design ────────────────────────────────────────────────────

/** A sticker placed on a garment. pos_x/pos_y are PERCENTAGES OF THE PRINT
 *  AREA, not pixels, so they survive any mockup resize. This is the press
 *  sheet's machine-readable form. */
export type Placement = {
  sticker_design_id: string;
  code: string;
  side: PrintSide;
  pos_x: number;
  pos_y: number;
  rotation: number;
  print_w_cm: number;
  print_h_cm: number;
  cutout_path: string | null;
  unit_price: number;
  unit_cost: number;
  /** Soft-hold reserved at placement time. Released if the placement is
   *  removed; expires on its own if the customer wanders off. */
  hold_id?: string;
};

export type DesignPayload = {
  product_sku_id: string;
  sku_code: string;
  unit_price: number;
  unit_cost: number;
  placements: Placement[];
};

// ─── Orders ─────────────────────────────────────────────────────────────────

export type OrderSticker = {
  id: string;
  sticker_design_id: string | null;
  custom_sticker_id: string | null;
  code: string;
  side: PrintSide;
  pos_x: number | null;
  pos_y: number | null;
  rotation: number | null;
  unit_price: number;
  unit_cost: number;
  bin_location: string | null;
};

export type OrderItem = {
  id: string;
  product_sku_id: string | null;
  sku_code: string | null;
  size: ProductSize | null;
  color_name: string | null;
  fit_name: string | null;
  qty: number;
  unit_price: number;
  unit_cost: number;
  line_total: number;
  stickers: OrderSticker[];
};

export type Order = {
  /** Client-generated. Doubles as the outbox idempotency key AND the primary
   *  key in Postgres, which is what makes a retry incapable of double-charging. */
  id: string;
  order_no: number;
  receipt_no: string | null;
  shift_id: string | null;
  environment_id: string; // [004]
  channel: OrderChannel;
  design_ticket: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  subtotal: number;
  discount_amount: number;
  discount_reason: DiscountReason | null;
  discount_note: string | null;
  total: number;
  cost_total: number;
  manual_override: boolean;
  payment_method: PaymentMethod;
  paid_cash: number;
  paid_upi: number;
  payment_ref: string | null;
  fulfillment_status: Fulfillment;
  promised_date: string | null;
  prepped_at: string | null; // [005]
  pressed_at: string | null;
  collected_at: string | null;
  affects_inventory: boolean;
  notes: string | null;
  /** When the volunteer actually charged, vs `created_at` when the row reached
   *  Postgres. They differ by hours on an offline sale. REPORT ON THIS ONE. */
  client_created_at: string;
  created_at: string;
  device_id: string | null;
  voided_at: string | null;
  void_reason: string | null;
  items: OrderItem[];
};

/** The three POS board modes, derived from timestamps rather than stored, so
 *  a ticket can never be in two stages at once. See migration 005. */
export type BoardStage = "prep" | "print" | "handover";

export function stageOf(o: Order): BoardStage | null {
  if (o.voided_at) return null;
  if (o.collected_at) return null;
  if (o.pressed_at) return "handover";
  if (o.prepped_at) return "print";
  if (o.fulfillment_status === "pending_press" || o.fulfillment_status === "collect_later") return "prep";
  return null;
}

// ─── Shifts, receipts, holds ────────────────────────────────────────────────

export type Shift = {
  id: string;
  name: string;
  event_name: string | null;
  type: ShiftType;
  venue: string | null;
  environment_id: string; // [004]
  shift_date: string;
  press_on_site: boolean;
  opening_float: number;
  counted_cash: number | null;
  expected_cash: number | null;
  variance: number | null;
  opened_at: string;
  closed_at: string | null;
};

export type ReceiptBlock = {
  id: string;
  shift_id: string;
  environment_id: string; // [004]
  device_id: string;
  fy: string;
  start_no: number;
  end_no: number;
  next_no: number;
  closed_at: string | null;
};

export type Hold = {
  id: string;
  sticker_id: string | null;
  product_sku_id: string | null;
  environment_id: string; // [004]
  qty: number;
  session_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  expires_at: string;
  released_at: string | null;
  converted_order: string | null;
};

// ─── Analytics [008] ────────────────────────────────────────────────────────

/** Deliberately a closed union in TypeScript rather than a Postgres enum: an
 *  analytics vocabulary changes weekly and `alter type` on the highest-volume
 *  table in the schema is not worth it. Never log raw pointer-move — see the
 *  volume warning in the requirements doc. */
export type KioskEventName =
  | "session_started"
  | "stage_entered"
  | "template_opened"
  | "template_customised"
  | "blank_started"
  | "design_picked"
  | "sticker_placed"
  | "sticker_removed"
  | "sticker_rotated"
  | "side_switched"
  | "garment_changed"
  | "order_started"
  | "order_completed"
  | "order_abandoned"
  | "overlap_blocked"
  | "out_of_stock_seen";

export type KioskEvent = {
  session_id: string;
  environment_id: string;
  event: KioskEventName;
  detail?: Record<string, unknown>;
  created_at: string;
};

// ─── Returns ────────────────────────────────────────────────────────────────

/** Mirrors `stall_returns`. `replace`/`exchange` create a linked ZERO-VALUE
 *  replacement order so inventory moves correctly without inflating revenue
 *  (PRD §3.5) — `exchange` additionally charges any price difference through
 *  the linked order, `replace` is a straight like-for-like swap. */
export type Return = {
  id: string;
  environment_id: string;
  original_order: string;
  replacement_order: string | null;
  reason: string;
  action: ReturnAction;
  refund_amount: number;
  restocked: boolean;
  note: string | null;
  created_at: string;
};

export type RestockItem = { sku_type: "product" | "sticker"; sku_id: string; qty: number };

// ─── Waste ──────────────────────────────────────────────────────────────────

/** Mirrors `stall_waste_log`. Exactly one of sticker/product is populated. */
export type WasteEntry = {
  id: string;
  environment_id: string;
  shift_id: string | null;
  sticker_id: string | null;
  sticker_qty: number;
  product_sku_id: string | null;
  product_qty: number;
  reason: WasteReason;
  note: string | null;
  created_at: string;
};

// ─── B2B [org-wide, NOT environment-scoped — migration 004.2] ──────────────

export type B2bStage = "enquiry" | "quoted" | "confirmed" | "in_production" | "dispatched" | "delivered" | "lost";

export type B2bOrder = {
  id: string;
  client_org: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  account_owner: string;
  stage: B2bStage;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  /** Denormalised at write time (`quantity * unit_price`) — see live route. */
  gross_value: number;
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
  created_at: string;
  updated_at: string;
};

/** Mirrors `stall_volunteers`. `account_owner` on a `B2bOrder` is one of
 *  these `id`s — every B2B deal needs one accountable person from the roster,
 *  not a free-text name. */
export type Volunteer = {
  id: string;
  name: string;
  is_active: boolean;
};

export type B2bActivity = {
  id: string;
  b2b_id: string;
  event: string;
  detail: Record<string, unknown> | null;
  created_at: string;
};

// ─── Money ──────────────────────────────────────────────────────────────────

/** Every rupee amount in this app is a NUMBER OF RUPEES, not paise, matching
 *  the numeric(10,2) columns. Formatting lives in lib/money.ts — never inline
 *  a `toFixed` or a ₹ in a component. */
export type Rupees = number;

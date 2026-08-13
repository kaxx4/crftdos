---
type: reference
updated: 2026-08-13
---

# Database Tables

Full column reference. Part of [[Database Map]]. All names are prefixed `stall_` so the app can coexist with `paradox_*` in the same schema — see [[Deployment and Environments]].

> [!info] 13 Aug update
> Everything below this note through "Sequences" describes the schema as of 10 Aug (23 tables, no environment scoping). `_import/migrations/` was reconciled with the live database on 13 Aug (migrations 007–041) and the schema has grown substantially since — environments, per-location stock, templates, leads, kiosk analytics, named holds, exchanges. The original sections are left as-is since they're still accurate for the tables they describe (columns didn't change, just gained a few — see inline notes where they did); **new tables added since 10 Aug are listed in the "Added 13 Aug" section near the bottom.** Treat `_import/migrations/`, not this doc or `schema.sql`, as the source of truth going forward.

Legend: **PK** primary key · *FK* foreign key · `!` not null

---

## Lookups

### stall_colors
`id` **PK** uuid · `name` text `!` unique · `hex` text · `sort` int · `is_active` bool
Anon-readable. Colour is a settings-managed list, not an enum — PRD D18, because hoodies will not be black-and-white only.

### stall_fits
`id` **PK** · `name` text `!` · `applies_to` *stall_product_type* `!` default `tee` · `sort` · `is_active`
Unique on `(name, applies_to)`. Seeded: oversized, regular, crop.

---

## Catalogue

### stall_sticker_designs
`id` **PK** · `code` text `!` unique (`M-014`) · `size_class` *stall_sticker_size* `!` · `name` · `artwork_group` · `tags` text[] · `auto_tags` text[] · `image_path` · `thumb_path` · `cutout_path` · `print_w_cm` numeric(5,2) · `print_h_cm` · `stock_qty` int `!` default 0 · `par_level` int `!` default 10 · `bin_location` · `unit_cost` · `unit_price` · `is_active` `!` · `kiosk_visible` `!` · `created_at`

- Numbering is **independent per size class** (PRD D22) — `S-014` and `M-014` are unrelated unless linked via `artwork_group`.
- `cutout_path` is the transparent PNG the kiosk canvas renders. Without it the canvas draws a white box. See [[Sticker Catalogue]].
- `print_w_cm` / `print_h_cm` drive true-scale rendering. **Null here means the kiosk canvas cannot size the sticker correctly** — PRD §5 calls print size "required, not optional".
- `tags` and `auto_tags` are separate so an operator edit never gets clobbered by a re-run of the auto-tagger. Both GIN-indexed.

### stall_product_skus
`id` **PK** · `product_type` *stall_product_type* `!` default `tee` · `color_id` *FK colors* · `fit_id` *FK fits* · `size` *stall_product_size* `!` · `sku_code` text `!` unique · `stock_qty` `!` · `par_level` `!` default 5 · `unit_cost` · `unit_price` · `mockup_front` · `mockup_back` · `print_area` jsonb · `is_active` `!`

Unique on `(product_type, color_id, fit_id, size)`. `print_area` shape: `{front:{x,y,w,h,cm_w,cm_h}, back:{...}}` — the printable rectangle the kiosk clamps drags to. See [[Product SKUs]].

### stall_product_availability (view)
Every `stall_product_skus` column plus `available_qty = stock_qty - sum(active holds)`. "Active" = `released_at is null and converted_order is null and expires_at > now()`. See [[Holds]].

---

## People

### stall_volunteers
`id` **PK** · `name` `!` · `phone` · `commission_rate` numeric(5,4) default 0.05 · `is_active`

### stall_customers
`id` **PK** · `name` · `phone_e164` · `email` · `consent_marketing` bool `!` default **false** · `created_at`
Indexed on `phone_e164` but **not unique** — and the order route never looks up before inserting, so repeat buyers become duplicate rows. See [[Known Issues]].

---

## Trading

### stall_shifts
`id` **PK** · `name` `!` · `event_name` · `type` *stall_shift_type* `!` · `venue` · `shift_date` date `!` · `volunteer_ids` uuid[] · `press_on_site` bool `!` default true · `opening_float` · `counted_cash` · `expected_cash` · `variance` · `notes` · `opened_at` · `closed_at`

`stall_one_open_shift` unique index guarantees at most one row with `closed_at is null`. `press_on_site` is the shift-level toggle from PRD D16 that switches the whole fulfilment flow. See [[Shifts and Receipt Blocks]].

### stall_receipt_blocks
`id` **PK** · `shift_id` *FK shifts* · `device_id` text `!` · `fy` text `!` (`26-27`) · `start_no` int `!` · `end_no` int `!` · `next_no` int `!` · `closed_at`
Unique on `(fy, start_no)`. See [[Receipt Numbering]].

### stall_orders
`id` **PK** uuid — **client-generated**, doubles as the outbox idempotency key · `order_no` int `!` from `stall_order_no_seq` · `receipt_no` text unique · `shift_id` *FK* · `channel` *stall_order_channel* `!` · `design_ticket` text · `sold_by` *FK volunteers* · `customer_id` *FK customers* · `subtotal` · `discount_amount` · `discount_reason` *enum* · `discount_note` · `total` · `cost_total` · `manual_override` bool `!` · `payment_method` *enum* `!` · `paid_cash` · `paid_upi` · `payment_ref` · `fulfillment_status` *stall_fulfillment* `!` · `promised_date` date · `pressed_at` · `collected_at` · `affects_inventory` bool `!` · `notes` · `created_at` `!` · `client_created_at` · `device_id` · `voided_at` · `voided_by` · `void_reason`

`client_created_at` vs `created_at` is the offline story: the former is when the volunteer actually charged, the latter when the row reached Postgres. They can differ by hours. **Report on `client_created_at`.** Voids are soft — the row and its receipt number survive.

### stall_order_items
`id` **PK** · `order_id` *FK orders* `!` **on delete cascade** · `product_sku_id` *FK skus* (null = sticker-only line) · `qty` int `!` · `unit_price` · `unit_cost` · `line_total`
Prices are snapshots, never joins. See [[Pricing]].

### stall_order_item_stickers
`id` **PK** · `order_item_id` *FK order_items* `!` cascade · `sticker_design_id` *FK designs* · `custom_sticker_id` *FK custom* · `side` *stall_print_side* default `front` · `pos_x` numeric(6,3) · `pos_y` · `rotation` numeric(6,2) · `unit_price` · `unit_cost`
`check (num_nonnulls(sticker_design_id, custom_sticker_id) = 1)` — exactly one kind. `pos_x`/`pos_y` are **percentages of the print area**, not pixels, so they survive any mockup resize. This is the press sheet's machine-readable form. See [[Kiosk Handoff]].

### stall_custom_stickers
`id` **PK** · `code` text `!` unique (`C-0001`) · `size_class` `!` · `description` text `!` · `image_path` · `unit_price` · `order_id` *FK* · `created_at`
Codes come from `stall_custom_sticker_seq` via [[Database Functions#stall_next_custom_sticker_no]].

---

## Kiosk

### stall_design_tickets
`id` **PK** · `code` text `!` unique (`A7K2`) · `device_id` · `payload` jsonb `!` · `composite_path` · `quoted_total` · `status` text `!` default `open` · `order_id` *FK* · `created_at` · `expires_at` `!`

`status` is a bare text column with values `open | redeemed | expired` — **not an enum**, unlike everything else in this schema. A typo will not be caught. The ticket is a quote, not a sale: nothing decrements until the till charges. See [[Kiosk Handoff]].

### stall_presets
`id` **PK** · `name` `!` · `payload` jsonb `!` · `preview_path` · `sort` · `is_active`
Anon-readable. Pre-composed best sellers — the three-tap path that should carry most kiosk volume.

---

## Operations

### stall_holds
`id` **PK** · `shift_id` *FK* · `product_sku_id` *FK* · `sticker_id` *FK* · `qty` int `!` default 1 · `customer_name` · `customer_phone` · `created_by` *FK volunteers* · `expires_at` `!` · `released_at` · `converted_order` *FK orders* · `created_at`
Serves double duty: volunteer-facing reservations **and** kiosk session soft-holds. See [[Holds]].

### stall_waste_log
`id` **PK** · `shift_id` · `sticker_id` · `sticker_qty` · `product_sku_id` · `product_qty` · `reason` *stall_waste_reason* `!` · `note` · `photo_path` · `logged_by` · `created_at`

### stall_returns
`id` **PK** · `original_order` *FK* · `replacement_order` *FK* · `reason` text `!` · `action` *stall_return_action* `!` · `refund_amount` · `restocked` bool · `approved_by` *FK* · `note` · `created_at`
Exchanges create a linked zero-value replacement order so inventory moves without inflating revenue.

---

## B2B

### stall_b2b_orders
`id` **PK** · `client_org` text `!` · `contact_name` · `contact_phone` · `contact_email` · `account_owner` *FK volunteers* **not null** · `stage` *stall_b2b_stage* `!` · `product_type` · `quantity` int `!` · `size_breakdown` jsonb · `design_ref` · `artwork_path` · `unit_price` · `unit_cost` · **`gross_value` numeric(12,2) generated always as `(quantity * unit_price)` stored** · `deposit_amount/date/method` · `balance_amount/date/method` · `promised_date` · `dispatched_date` · `affects_inventory` bool default **false** · `lost_reason` · `notes` · `created_at` · `updated_at`

`account_owner` is `not null` **on purpose** (PRD §7) — the form cannot save without a name against it. Deposit and balance are tracked separately so committed value and collected value stay distinguishable. `updated_at` has a default but **no trigger** — nothing maintains it. See [[Known Issues]].

### stall_b2b_activity
`id` **PK** · `b2b_id` *FK* cascade · `actor` · `event` text `!` · `detail` jsonb · `created_at`

---

## Infrastructure

### stall_inventory_movements
`id` **PK** · `sku_type` text `!` check in (`product`,`sticker`) · `sku_id` uuid `!` · `delta` int `!` · `reason` *stall_movement_reason* `!` · `ref_order` *FK orders* · `actor` · `note` · `created_at`

The append-only ledger. Note `sku_id` is a **polymorphic reference with no FK** — it points at either table depending on `sku_type`, so nothing stops an orphan. Indexed on `(sku_type, sku_id, created_at desc)`. See [[Stock and Inventory]].

### stall_settings
`key` text **PK** · `value` jsonb `!` · `updated_at`

### stall_message_log
`id` **PK** · `order_id` *FK* · `channel` text `!` check in (`email`,`whatsapp`) · `status` text `!` · `error` · `sent_at` · `created_at`

### stall_admin_audit
`id` **PK** · `actor` · `action` text `!` · `detail` jsonb · `created_at`
Written on price edits, bulk price sets, and hold-release failures.

---

## Added 13 Aug — environment scoping, per-location stock, and more

Everything below was introduced in migrations `007`–`041` (see [[Database Map]]) and confirmed live via `_import/migrations/` reconciliation on 13 Aug.

### stall_environments
`id` **PK** · `name` text `!` · `prefix` text `!` unique (matches `^[A-Z][A-Z0-9]{1,5}$`) · `kind` *stall_environment_kind* `!` default `stall` (`cloud`/`stall`/`online`) · `is_active` `!` · `opened_at` `!` · `closed_at` · `created_by` · `notes`
Anon-readable. Seeded with one row, `HQ Cloud` (`HQ`), as the default/general environment that pre-existing rows backfill to. This is the core new concept: stock, shifts, receipt blocks, and holds are now scoped per physical stall/kiosk instance, not shared org-wide — a real product decision from the 11–12 Aug session, not incidental schema growth. Almost every trading table below gained an `environment_id` column pointing here (`stall_orders`, `stall_shifts`, `stall_holds`, `stall_design_tickets`, `stall_receipt_blocks`, and more — check a given table's migration if you need the exact list).

### stall_stock_locations
`id` **PK** · `environment_id` *FK environments* unique · `name` `!` · `is_warehouse` bool `!` default false
Unique partial index ensures at most one `is_warehouse = true` row. One location per environment, plus one shared warehouse.

### stall_stock
`location_id` *FK stock_locations* · `sku_type` text `!` check in (`product`,`sticker`) · `sku_id` uuid `!` · `qty` int `!` default 0 check `>= 0` · `par_level` int `!` default 0 — **composite PK** `(location_id, sku_type, sku_id)`
This is what `stall_product_skus.stock_qty` / `stall_sticker_designs.stock_qty` became: stock is now per-`(sku, location)`, not a scalar on the catalogue row. `stall_inventory_movements` gained a `location_id` column (nullable, FK here) to match. `stall_movement_reason` gained two new enum values: `transfer_in`, `transfer_out`.

### stall_templates
`id` **PK** · `name` `!` · `slug` text `!` unique · `payload` jsonb `!` · `preview_path` · `blurb` · `is_featured` bool `!` · `is_active` `!` · `sort` `!` · `times_used` int `!` default 0 · `created_at` · `updated_at`
Anon-readable where `is_active`. Kiosk preset designs, editable from `/admin/templates`.

### stall_leads
`id` **PK** · `name` text `!` · `phone` · `notes` · `logged_by` · `created_at` `!` · `updated_at` `!`
Org-wide, not environment-scoped (a lead isn't tied to a physical stall — same reasoning as B2B). Distinct from `stall_b2b_orders`: a lead is "someone worth following up with," not a committed deal with a margin gate. Captured from `/pos/leads`.

### stall_kiosk_events
`id` **PK** bigint identity · `environment_id` *FK environments* `!` · `session_id` uuid `!` · `event` text `!` · `detail` jsonb · `created_at` `!`
Anon-insert allowed (public kiosk analytics stream), rate-limited per session via a trigger (`stall_kiosk_events_rate_limit`, migration 019) rather than app-level throttling — the honest enforcement point given serverless instances can't share an in-process limiter. Purged by `stall_purge_kiosk_events(interval)` (default 90 days), which as of migration 040 is **`service_role`-only** — it was previously reachable more broadly, which was a real gap, now closed. See [[HANDOFF - Backend Session]].

### stall_rate_limits
`key` text **PK** · `count` int `!` default 0 · `reset_at` timestamptz `!` · `updated_at` `!`
Migration 004. A real database-backed rate limit (via `stall_rate_limit_hit()`), replacing an in-process `Map` that didn't work across Vercel serverless instances. Originally built for PIN-login attempts; that use case is gone (see [[Auth and Sessions]]) but the table/function remain in use for the kiosk-events insert budget above.

### Existing tables, notable additions
- **`stall_holds`** — gained `environment_id`; the named-hold flow (`stall_reserve_named_hold`, migration 035) locks the stock row (`select … for update`) before checking availability, closing the same TOCTOU class of bug `stall_reserve_sticker_hold` already closed for kiosk soft-holds.
- **`stall_shifts`** — the "one open shift" constraint is now **per environment** (migration 037: `stall_one_open_shift_per_env` replaces the old global `stall_one_open_shift` index), matching the environment-scoping model.
- **`stall_orders`** — `stall_create_order` (migration 038, "price trust") was rewritten to source prices server-side rather than trust client-submitted amounts; check that migration if you need the exact trust boundary.
- **`stall_returns`** — gained a `refund_method` column (migration 034) and an atomic `stall_create_exchange()` RPC (migration 033).
- **Discount guard + sticker ceiling** (migration 039) — added a server-side cap on discount percentage and a price ceiling for custom stickers; check that migration for the exact bounds if building against them.
- **`stall_customers`** — now has a retention purge, `stall_purge_stale_customers()` (migration 041), `SECURITY DEFINER`, scheduled via `pg_cron` daily at 03:30, deleting customers older than 24 months (PRD §12) with no order in that window. This closes the "customer retention purge unbuilt" item that used to be in [[Known Issues]].

## Sequences

`stall_custom_sticker_seq` · `stall_order_no_seq`
(PRD §8 also lists `receipt_block_seq`; it was not built — blocks derive `start_no` from `max(end_no)+1` instead. See [[Receipt Numbering]].)

## Not built

`stall_keepalive` from PRD §8 does not exist. PRD Appendix A item 1 asks volunteers to verify a keep-alive ping before every stall; there is nothing to verify against. See [[Known Issues]].

## Related
[[Database Enums]] · [[Database Indexes]] · [[Database Functions]] · [[Row Level Security]]

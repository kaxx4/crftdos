---
type: requirements
updated: 2026-08-11
status: draft — for execution in a separate Supabase-connected session
---

# Backend Requirements — Frontend Rework

Phase 0 deliverable of [[Rework - Fresh Plan 2026-08-11]]. Part of [[crftd Stall OS]].

**This document is not executed in the frontend track.** It is the handoff to a dedicated session connected to Supabase project `drvucogrjphctwfealxd`. The frontend build proceeds against typed mocks at every boundary described here, and swaps the mocks for real calls once these migrations land.

**Everything here is additive.** No column is dropped, no enum value removed, no existing function signature changed in a breaking way. The verified money path — `stall_create_order`, `stall_void_order`, `stall_reserve_sticker_hold`, the receipt-block consumption, the stock floor guards — keeps working unchanged for callers that don't pass the new fields. That is a hard requirement, not a preference: the current behaviour was verified against the live database (see [[Changelog 2026-08-10]]) and a rework that re-opens it trades tested behaviour for design gain.

Migrations continue the existing numbering from [[Database Map]] (`003_fk_indexes.sql` is the last applied), so these are **004** through **008**.

> ⚠️ The project is shared with 38 `paradox_*` tables from an unrelated application. Every statement in these migrations must be schema-qualified and prefix-scoped. Nothing here may run an unqualified `drop`, `alter schema`, or catalogue-wide operation.

---

## Migration 004 — Environments

Implements [[Rework - Fresh Plan 2026-08-11]] §7. This is the one that touches the most tables, so it goes first.

**The model, restated so the executing session doesn't over-build it:** an environment is a **scope tag on live shared data**. There is no local store, no sync engine, no reconciliation, no conflict resolution. Every device writes directly to this database in real time exactly as it does today; the only change is that its writes carry an `environment_id`. Admin can already see everything the instant it happens because nothing was ever unsynced.

### 004.1 New table

```sql
create table stall_environments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  prefix      text not null unique,
  kind        stall_environment_kind not null default 'stall',
  is_active   boolean not null default true,
  opened_at   timestamptz not null default now(),
  closed_at   timestamptz,
  created_by  text,
  notes       text
);

create type stall_environment_kind as enum ('cloud', 'stall', 'online');
```

- `prefix` is the admin-supplied preset from §7 — the basis for that environment's generated identifiers. **Unique, and immutable after first use.** Constrain the format: `check (prefix ~ '^[A-Z][A-Z0-9]{1,5}$')`. Uniqueness at creation is what guarantees id uniqueness across environments at runtime, with no collision resolution needed.
- `kind`: `cloud` is the default/general environment (the one that must exist before any device can bind), `stall` is a physical stall, `online` is a shareable-link session pool.
- Seed exactly one `cloud` row as part of this migration, prefix `HQ`. Existing rows backfill to it.

### 004.2 Scoping column

Add `environment_id uuid references stall_environments(id)` to:

| Table | Why |
|---|---|
| `stall_orders` | the aggregate rolls up from here |
| `stall_shifts` | a shift belongs to one environment |
| `stall_receipt_blocks` | numbering is per-environment (see 004.3) |
| `stall_holds` | a stall's reservations shouldn't gate another stall |
| `stall_inventory_movements` | ledger attribution |
| `stall_waste_log` | per-stall waste reporting |
| `stall_returns` | per-stall returns reporting |
| `stall_design_tickets` | a ticket belongs to the environment that issued it |

**Backfill then constrain.** `update ... set environment_id = <cloud id> where environment_id is null;` then `alter table ... alter column environment_id set not null;`. Doing it in that order means no existing row is orphaned and no write path can omit it afterward.

Index every one of these — they are all filter columns for the admin single-environment view, and per [[Database Indexes]] this project has a history of unindexed FKs. Composite where the query shape is known: `(environment_id, created_at desc)` on `stall_orders`.

**Do not add it to** the catalogue tables (`stall_sticker_designs`, `stall_product_skus`, `stall_colors`, `stall_fits`, `stall_presets`) or to `stall_customers`, `stall_b2b_*`, `stall_settings`. The catalogue is org-wide by definition — a sticker design is the same design at every stall, and stock is one physical pool.

**Stock is allocated per environment** — resolved 11 Aug, see migration 009. This is the one decision in this document that is not purely additive, and it is specced separately because it reaches into the money path.

### 004.3 Environment-scoped receipt numbering

Currently `stall_receipt_blocks` is unique on `(fy, start_no)` and `POST /api/shift/open` derives `start_no` from `max(end_no)+1` for the FY — a read-then-insert with **no lock**, where two devices racing produce a duplicate and the loser gets a 500 rather than a retry ([[API Routes]], [[Receipt Numbering]]).

This migration should fix both things at once, because it has to touch the constraint anyway:

1. Change the unique constraint to `(environment_id, fy, start_no)`.
2. Prefix the rendered receipt number with the environment prefix, so `CR/26-27/000202` becomes environment-distinguishable. **Decide where this lives** — the prefix is currently assembled in application code, not the database. Preference: assemble in `stall_create_order` so it can never drift between the online and outbox-replay paths.
3. Replace the read-then-insert with a guarded allocation function, `stall_allocate_receipt_block(p_environment_id uuid, p_shift_id uuid, p_device_id text, p_fy text)`, doing the `max(end_no)+1` computation inside a `select … for update` on the environment row — the same pattern `stall_reserve_sticker_hold` already uses successfully. This removes the existing race rather than carrying it into a schema where it is now more likely (more environments, more concurrent opens).

### 004.4 RLS

`stall_environments` needs an anon `SELECT` policy — the kiosk settings page must list environments to bind to, and the kiosk is unauthenticated by design ([[Auth and Sessions]]). This makes it the **sixth** anon-readable table, joining the five in [[Row Level Security]].

What leaks: environment names and prefixes. Acceptable. Nothing else about this table is sensitive.

Every other table keeps RLS on with zero policies. Environment scoping is **not** a security boundary — it is a reporting/attribution one. A device bound to Stall B is trusted not to write Stall A's data because it is already trusted with a service-role write path behind a PIN. Do not attempt to enforce environment isolation in RLS; the service-role client bypasses RLS entirely, so it would be theatre.

---

## Migration 005 — Prep → Print → Handover

Implements [[Rework - Fresh Plan 2026-08-11]] §2.2. Today's schema tracks two fulfilment stages (`pressed_at`, `collected_at`) plus the `stall_fulfillment` enum (`handed_over · pending_press · collect_later · collected`). The new POS board needs three.

```sql
alter table stall_orders add column prepped_at timestamptz;
alter type stall_fulfillment add value 'prepped' after 'pending_press';
```

- `alter type ... add value` cannot run inside a transaction block with other statements in older Postgres; on 17.6 it can, but **it cannot be used in the same transaction that then references the new value**. Split this into its own migration file if the executing session hits that.
- Adding an enum value is cheap and non-breaking. Existing rows and existing code paths that never set `prepped` continue to work — this is what keeps walk-up sales (confirmed still in scope) working unchanged.

**Stage semantics to encode in the board's queries:**

| Board mode | Predicate |
|---|---|
| Prep | `fulfillment_status = 'pending_press' and prepped_at is null` |
| Print | `prepped_at is not null and pressed_at is null` |
| Handover | `pressed_at is not null and collected_at is null` |

Add a partial index for each. The existing `stall_orders_fulfillment_status_idx ... where fulfillment_status <> 'handed_over'` already covers the tail well; extend rather than duplicate.

**New route needed:** `POST /api/orders/[id]/prep`. Note this is **not** a single-column update like the existing `/press` route. Per the resolved stock-timing decision in migration 007, prep is the moment stock actually moves, so this route must call `stall_prep_order(p_order_id, p_actor)` — decrement, ledger row, hold conversion, and timestamp in one transaction, guarded so a double-tap is idempotent. An out-of-stock line rolls the whole call back and leaves the ticket in the prep queue with an actionable error.

> **Open question 2.** Does marking Prepped need to be reversible? A volunteer taps Prepped on the wrong ticket in a queue. This was cheap when it was a timestamp; it is no longer, because reversing it means restocking. If built, it goes through an RPC that mirrors `stall_void_order`'s restock-plus-ledger shape. Still recommend building it — a stuck ticket mid-queue is worse — but it is a real feature now, not a one-line un-stamp.

---

## Migration 006 — Templates

Implements [[Rework - Fresh Plan 2026-08-11]] §2.1. Confirmed distinct from `stall_presets`: presets are the existing editable starting points ("starting noise"), templates are a new admin-managed, merchandisable set for the kiosk home page.

```sql
create table stall_templates (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  payload       jsonb not null,
  preview_path  text,
  blurb         text,
  is_featured   boolean not null default false,
  is_active     boolean not null default true,
  sort          int not null default 0,
  times_used    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
```

- `payload` must use **the same shape as `stall_design_tickets.payload`** — garment SKU, side, placements with `pos_x`/`pos_y` as percentages of the print area and `rotation` in degrees. Reusing the shape means opening a template into the canvas is the same code path as redeeming a ticket, and the "customer picks one and can still edit it" requirement is free.
- Anon `SELECT` policy required — the kiosk home page is unauthenticated. Seventh anon-readable table.
- `times_used` supports the "most popular" merchandising slot without a query over orders. Increment it from the kiosk when a template is opened into the canvas, not when an order completes — the home page is merchandising, not analytics, and the analytics stream in 008 carries the accurate version.
- `updated_at` needs an actual trigger. [[Database Tables]] notes `stall_b2b_orders.updated_at` has a default but no trigger and nothing maintains it — don't repeat that.

**Validation the frontend cannot be trusted with:** a template's payload references sticker design ids and a product SKU. If an admin deactivates a design that a featured template uses, the kiosk home page offers a template that will fail on open. Either validate on write (a trigger checking every referenced id is `is_active`) or filter on read (the kiosk template query joins through and excludes broken ones). **Prefer filter-on-read** — it degrades gracefully instead of blocking an admin's catalogue edit.

---

## Migration 007 — Kiosk-time order creation with payment

Implements [[Rework - Fresh Plan 2026-08-11]] §2.1. This is the highest-risk item in the document, because it touches `stall_create_order` — the one function the whole app's correctness rests on.

### What changes

Today an order is created at POS charge time. The new kiosk flow creates it at the kiosk's order step, with name + phone + payment method captured there. The ticket then references a real order rather than being a quote redeemed later.

### What must not change

`stall_create_order(p_payload jsonb)` keeps its signature and all its current guarantees: idempotency on the client-generated uuid, atomic receipt-number consumption, customer upsert, stock floor guards that roll the entire order back on any out-of-stock line, ledger rows. **Walk-up sales at the POS continue to call it exactly as they do today.** The kiosk path is additive.

### Recommended shape

Add optional keys to the existing `p_payload` jsonb rather than adding parameters:

- `environment_id` (required once 004 lands, in practice)
- `origin`: `'kiosk' | 'pos'` — maps onto the existing `stall_order_channel` enum, which already carries `kiosk` as a value. **Use the existing enum; do not add a parallel field.**
- `payment_method`: the existing `stall_payment_method` enum already carries `upi · cash · split · pending`. A kiosk UPI order is `upi`; a kiosk cash order is `pending` until settled at handover, then updated to `cash`.

### Stock timing — resolved

**A kiosk order does not decrement stock.** The existing soft-hold mechanism ([[Holds]], `stall_reserve_sticker_hold`) keeps doing exactly what it does today to prevent double-booking, and the stock movement happens at the **prep** stage.

This preserves the property that makes the current design safe — nothing decrements until someone commits — and reuses a function already verified against the live database. A customer who completes the order step and wanders off costs nothing but an expired hold. The order row exists earlier purely for pipeline visibility.

Consequence for migration 005: the prep-stage route is **no longer** a single-column update. Stamping `prepped_at` is the moment stock moves, so it must go through an RPC that decrements, writes the ledger row, converts the hold, and stamps the timestamp atomically — `stall_prep_order(p_order_id uuid, p_actor text)`. If a line is out of stock at prep time, the whole call rolls back and the ticket stays in the prep queue with an error the volunteer can act on. Model it on `stall_void_order`, which already does restock + ledger + status in one transaction.

### UPI — resolved

**Dynamic, amount-embedded deep link**, QR generated per order at the kiosk: `upi://pay?pa=<vpa>&pn=<payee>&am=<total>&tn=<order code>&cu=INR`. The kiosk already generates QR codes for the ticket handoff, so this reuses existing capability. The order code in `tn` makes bank-statement reconciliation automatic rather than manual.

Admin config lives in `stall_settings` — `upi_vpa`, `upi_payee_name`. No new table, and **no QR image upload needed**, which removes a file-upload surface from the admin build.

> **Note, unresolved and out of scope:** this is not payment *confirmation*. Nothing tells the app the customer actually paid — a UPI deep link is fire-and-forget. Either a volunteer visually confirms the customer's payment screen at handover, or this needs a real payment gateway. Assume volunteer confirmation; the order carries `payment_method = 'upi'` and a `paid_upi` amount that a human asserted, exactly as the POS does today.

---

## Migration 008 — Interaction analytics event stream

Implements [[Rework - Fresh Plan 2026-08-11]] §2.1 / §2.3. New data category: granular kiosk UI events, live, surfaced in admin.

```sql
create table stall_kiosk_events (
  id             bigint generated always as identity primary key,
  environment_id uuid not null references stall_environments(id),
  session_id     uuid not null,
  event          text not null,
  detail         jsonb,
  created_at     timestamptz not null default now()
);
```

- `bigint identity`, not uuid — this is the highest-volume table in the schema by an order of magnitude and does not need a client-generated key.
- `session_id` is the existing `sessionStorage["kiosk_session_id"]` from [[Flow - Kiosk Design]]. Already exists; no new mechanism.
- `event` as text, not an enum. Enums are right for the money schema; an analytics event vocabulary changes weekly and `alter type` on a hot table is not worth it. Constrain in the client's TypeScript union instead.
- Anon `INSERT` policy required, and this is the **only write policy anon gets anywhere in this schema.** Scope it tightly: `with check (true)` on insert only, no select, no update, no delete. An anon that can read this table can read customer session behaviour; an anon that can only append cannot.

> **Open question 5 — volume and abuse.** This is a publicly-writable, unauthenticated, unrate-limited insert endpoint on a database shared with another production application ([[Database Map]]). A single kiosk session dragging a sticker generates events at pointer-move frequency if the client is naive. Before this ships:
>
> 1. **Client-side batching and throttling is mandatory, not optional.** Buffer events, flush every ~5s or 25 events. Never log raw pointer-move; log `sticker_placed`, `sticker_removed`, `template_opened`, `stage_entered`, `order_abandoned`.
> 2. **Retention.** Decide now: 90 days, then a scheduled purge. Note there is currently **no cron/scheduled-job infrastructure in this repo at all** ([[Known Issues]] item 2 — the customer retention purge is unbuilt for the same reason). Either this migration ships with a `pg_cron` job or it ships with a documented manual purge and an admin button. Don't ship it with neither.
> 3. **A rate limit that actually works.** [[Auth and Sessions]] notes the existing in-process `Map` rate limiter is per-serverless-instance and therefore largely unenforced in production. Don't rely on it here. A per-session insert budget enforced in the policy or a trigger is more honest.

---

## Migration 009 — Per-environment stock allocation

Resolved 11 Aug: each environment draws from its own allocation, not a shared org-wide pool. **This is the only part of this document that is not purely additive, and it is the only part that changes the money path.** It is specced last and should be executed last, after 004–008 are in and the existing end-to-end flow has been re-verified.

### What this actually is

It is not "a column on environments". Adding an allocation dimension to stock means stock stops being a scalar on the catalogue row and becomes a value per `(sku, location)`. That is a stock-location model, and the schema currently has no such concept — `stall_sticker_designs.stock_qty` and `stall_product_skus.stock_qty` are single integers, and every guard, every ledger row, the `stall_product_availability` view and both `stall_adjust_*_stock` functions are built on that assumption.

Naming it accurately matters because the cheap-looking version of this — an `allocated_qty` column that sits alongside `stock_qty` — creates two sources of truth for the same physical object and will silently drift the first time someone adjusts one without the other. Don't build that.

### The model

```sql
create table stall_stock_locations (
  id             uuid primary key default gen_random_uuid(),
  environment_id uuid unique references stall_environments(id),
  name           text not null,
  is_warehouse   boolean not null default false
);

create table stall_stock (
  location_id  uuid not null references stall_stock_locations(id),
  sku_type     text not null check (sku_type in ('product','sticker')),
  sku_id       uuid not null,
  qty          int  not null default 0 check (qty >= 0),
  par_level    int  not null default 0,
  primary key (location_id, sku_type, sku_id)
);
```

- Exactly one `is_warehouse` row, with `environment_id is null` — this is unallocated stock that hasn't been sent to a stall. Enforce with a partial unique index, the same trick `stall_one_open_shift` already uses.
- Every other location maps 1:1 to an environment.
- **`qty >= 0` as a table constraint** rather than only in the `where` clause of the adjust functions. The current floor guard lives in `where stock_qty + p_delta >= 0`, which returns zero rows on refusal and relies on every caller checking for an empty result ([[Database Functions]] is explicit that "a successful call with zero rows means refused, not fine"). That has held so far because every caller does check — but with more call sites arriving, a hard constraint that raises is the safer belt.

### Migrating the existing data

1. Create the warehouse location.
2. `insert into stall_stock (location_id, sku_type, sku_id, qty, par_level) select <warehouse>, 'sticker', id, stock_qty, par_level from stall_sticker_designs;` and the same for `stall_product_skus`.
3. **Keep `stock_qty` on the catalogue tables**, but redefine it as a *derived total* maintained by trigger — `sum(qty) over all locations`. It is read by existing code in places this rework will not touch, and breaking those reads to save a denormalised integer is a bad trade. Document it as derived so nobody writes to it directly.
4. Rewrite `stall_product_availability` to compute from `stall_stock` for a given location, minus active holds at that location.

### Function changes

| Function | Change |
|---|---|
| `stall_adjust_product_stock` / `stall_adjust_sticker_stock` | Gain a `p_location_id` parameter. **Add an overload, keep the old signature** resolving to the warehouse, so no existing caller breaks mid-migration. |
| `stall_create_order` | Must resolve the order's `environment_id` → location and guard against *that* location's qty. This is the risky edit. |
| `stall_void_order` | Restock must return to the location the order drew from, not the warehouse. |
| `stall_reserve_sticker_hold` | Availability computed inside the lock must be location-scoped. |
| `stall_prep_order` (new, from 007) | Decrements at the order's location. |
| `stall_restock_signals` | Below-par is now per-location; returns a location dimension. |

### New operations the frontend needs

- **Allocate** — move qty from warehouse to an environment. One transactional function, `stall_transfer_stock(p_from, p_to, p_sku_type, p_sku_id, p_qty)`, writing two ledger rows.
- **Transfer between stalls** — the same function. Stall A runs out of `M-014`, Stall B has twelve.
- **Return to warehouse at close** — the same function, called for everything remaining when an environment closes. **Closing an environment with non-zero allocated stock must be blocked or must auto-return**; otherwise stock silently disappears from the sellable pool. Recommend blocking with a clear count, because auto-returning hides a physical reconciliation the operator should be doing anyway.
- `stall_inventory_movements` gains `location_id`, and `stall_movement_reason` gains `transfer_in` / `transfer_out`.

### Gate

This migration's verification bar is higher than the others'. The existing end-to-end flow passing is necessary but not sufficient — it must also be shown that:

- an oversell at one location is refused while the same sku remains sellable at another,
- a void returns stock to the originating location,
- warehouse + all allocations still equals the pre-migration `stock_qty` for every sku.

> **Open question 6 (new, from this decision).** Does the kiosk's catalogue filter — which today hides any design with `available_qty <= 0` ([[Flow - Kiosk Design]]) — now hide designs unavailable *at that kiosk's environment*? Almost certainly yes, and it means two kiosks at the same event legitimately show different catalogues. Worth confirming that's understood as intended, because it will look like a bug to whoever sees it first.

## Not in this document

Deliberately excluded, with reasons:

- **A sync engine.** There isn't one and there must not be one. Confirmed in [[Rework - Fresh Plan 2026-08-11]] §7: Supabase *is* the real-time layer, and "sync" means nothing more than a shared `environment_id` on rows in one live database. The existing IndexedDB outbox stays exactly what it is — connectivity-loss resilience, unrelated to environments. If any part of the executing session starts designing merge semantics, something has been misread.
- **A payment gateway.** See migration 007. UPI is a fire-and-forget deep link with human confirmation.
- **Shareable-link session identity for online mode.** The kiosk is already fully unauthenticated; an online link is the same surface at a different URL, bound to an `online`-kind environment via the same settings mechanism. No new auth primitive needed. If a link needs to expire or be revoked, that is a `stall_environments.is_active` check, nothing more.

## Ordering and gates

004 → 005 → 006 → 007 → 008 → **009**. 004 first because 005–008 all reference `stall_environments`. 009 last and separately, because it is the only one that rewrites verified money-path functions — everything else should be in and proven before it starts.

Migrations 004–008 gate on: the existing end-to-end flow still passes in a browser — kiosk → ticket → till redemption → charge → receipt → press sheet — with **no new fields supplied**. That flow is already proven to work ([[Rework - Master Plan]] records it passing with receipt `CR/26-27/000202`). If it breaks, the migration was not additive and must be revised, not patched around.

009 has its own, higher bar — see that section.

## Decisions taken (11 Aug 2026)

| # | Question | Decision |
|---|---|---|
| 1 | Is stock shared across environments? | **No — allocated per environment.** Becomes migration 009, a stock-location model. |
| 3 | Does a kiosk order decrement stock immediately? | **No.** Holds as today; stock moves at prep, via a new `stall_prep_order` RPC. |
| 4 | UPI: amount-embedded link or fixed QR? | **Amount-embedded dynamic link**, order code as `tn`. No QR upload needed. |

## Open questions — remaining

| # | Question | Recommendation | Blocking? |
|---|---|---|---|
| 2 | Is "Mark Prepped" reversible? | Yes, guarded un-stamp — but note it now reverses a *stock movement*, so it must go through the RPC too | No, but larger than it was |
| 5 | Analytics volume, retention, rate limiting | Batch client-side, 90-day purge, real limit | Yes — don't ship 008 without answers |
| 6 | Does the kiosk catalogue filter by the device's environment stock? | Yes — accept that two kiosks at one event show different catalogues | Yes for 009 |

## Related
[[Rework - Fresh Plan 2026-08-11]] · [[Database Map]] · [[Database Tables]] · [[Database Functions]] · [[Row Level Security]] · [[API Routes]] · [[Known Issues]]

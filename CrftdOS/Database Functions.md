---
type: reference
updated: 2026-08-13
---

# Database Functions

Part of [[Database Map]]. **13 Aug: this list is stale below — 27 functions are live now, not 8.** `_import/migrations/` (007–041) was reconciled against the live database on 13 Aug and is the source of truth; the original "eight functions" section is kept for the functions it already documented (still accurate for those), with the rest listed in the "Added since 10 Aug" section below rather than rewriting the whole doc from scratch.

Security posture also changed: migration 040 set `SET search_path = public, pg_temp` on every `stall_*` function (closing a search-path-hijack class of bug), and locked `stall_purge_kiosk_events` down to `service_role` only after finding it reachable more broadly than intended. New functions added since 10 Aug include the first `SECURITY DEFINER` function in this schema, `stall_purge_stale_customers()` — deliberately so, since it needs to delete rows `anon`/`authenticated` can't otherwise touch, and it's locked to `service_role` execute-only with an explicit `search_path` set, same as the hardening pass applied everywhere else.

The original "eight functions, all `SECURITY INVOKER`" framing below no longer holds as a blanket statement — most functions are still invoker, but not all, and the count is wrong. Read it as historical.

Four came from `_import/migrations/001_atomicity_and_indexes.sql`, whose whole purpose was to kill read-then-write races. Two more — `stall_create_order` and `stall_void_order` — came from `002_atomic_order_creation.sql` (see [[Changelog 2026-08-10]]), closing the transaction gap this doc used to describe below. `stall_next_custom_sticker_no` is undocumented drift.

---

## stall_adjust_product_stock(p_id uuid, p_delta int) → setof stall_product_skus

```sql
update stall_product_skus
set stock_qty = stock_qty + p_delta
where id = p_id and stock_qty + p_delta >= 0
returning *;
```

The floor guard is in the `where`, so an oversell simply matches no rows and returns nothing. **Callers must check for an empty result** — a successful call with zero rows means "refused", not "fine". Every caller currently does.

## stall_adjust_sticker_stock(p_id uuid, p_delta int) → setof stall_sticker_designs
Identical, against [[Database Tables#stall_sticker_designs]].

## stall_consume_receipt_no(p_block_id uuid) → table(consumed_no int, fy text)

```sql
update stall_receipt_blocks
set next_no = next_no + 1
where id = p_block_id and next_no <= end_no
returning next_no - 1 as consumed_no, fy;
```

One guarded `UPDATE ... RETURNING`, so two concurrent charges on the same device can never be handed the same number. Returns no rows when the block is exhausted. See [[Receipt Numbering]].

## stall_reserve_sticker_hold(p_sticker_id, p_shift_id, p_qty, p_expires_at, p_customer_name, p_customer_phone, p_created_by) → setof stall_holds

The only plpgsql one. Takes `select ... for update` on the design row, so concurrent reservations for the same design serialise; computes `stock - active_holds` **inside** that lock; inserts only if capacity remains. This closes the TOCTOU window where two kiosks could both reserve the last `M-014`. See [[Holds]].

## stall_next_custom_sticker_no() → int

Wraps `stall_custom_sticker_seq` for the `C-####` sequence. **This function is not in `schema.sql` and not in migration 001** — it exists live but has no source of truth in the repo. A rebuild from the SQL files would produce a database where `/api/orders` fails on every custom sticker. See [[Known Issues]]. (Per [[Database Map]], migration `002_atomic_order_creation.sql` recreates it, so a rebuild that applies 002 is fine — only a rebuild from `schema.sql` + 001 alone would be broken.)

## stall_create_order(p_payload jsonb) → jsonb

The whole charge — idempotency check, receipt-number consumption, customer upsert, order insert, ticket redemption, every line, every sticker, every stock guard, every ledger row — in one call inside one transaction. Added in `002_atomic_order_creation.sql`, wired into `POST /api/orders` as of [[Changelog 2026-08-10]]. An out-of-stock line rolls the entire attempt back rather than leaving partial state. See [[API Routes]].

## stall_void_order(p_order_id uuid, p_reason text, p_actor text) → jsonb

Restocks every line, writes the ledger, and soft-voids the order atomically. Added alongside `stall_create_order` in migration 002; replaced a per-line read-modify-write that had the same lost-update race migration 001 had already removed from the sale path. See [[Changelog 2026-08-10]].

---

## Formerly "the gap"

Until [[Changelog 2026-08-10]], there was no function that created an order — `/api/orders` orchestrated ~30 sequential statements from the Node process, not inside a transaction, so a mid-loop failure left stock already decremented with no rollback. `stall_create_order` closed this; it is no longer an open item. See [[API Routes]].

## Added since 10 Aug (migrations 007–041)

Grouped by what they serve. See the referenced migration file for exact signatures/bodies — not reproduced here in full.

**Environments / per-location stock** (migrations 021–031): `stall_location_for_environment(uuid)`, `stall_warehouse_location()`, `stall_product_availability_at(uuid)`, `stall_sync_derived_stock_qty()` (trigger, keeps a derived total in sync with per-location rows), `stall_transfer_stock(...)`, `stall_set_product_stock(uuid,int)`. `stall_adjust_product_stock` / `stall_adjust_sticker_stock` both gained location-aware overloads (`(uuid,int,uuid)`) alongside the original org-wide signature.

**Holds and orders** (migrations 035, 038, 039, 033–034): `stall_reserve_named_hold(...)` — atomic volunteer-facing hold, `select … for update` before checking availability, same TOCTOU-closing pattern as `stall_reserve_sticker_hold`. `stall_create_exchange(...)` — atomic return/exchange. `stall_prep_order(uuid,text)` — moves stock at prep time rather than at sale, per the decision recorded in [[HANDOFF - Backend Session]] §3. `stall_create_order` was revised for "price trust" (migration 038) to source prices server-side. `stall_analytics_summary(timestamptz,timestamptz)`.

**Rate limiting and kiosk analytics** (migrations 004, 019): `stall_rate_limit_hit(...)`, `stall_rate_limit_clear(text)` — the database-backed replacement for the old in-process `Map`. `stall_kiosk_events_rate_limit()` (trigger) and `stall_purge_kiosk_events(interval default '90 days')`.

**Templates** (migration 013): `stall_template_is_valid(jsonb)`, `stall_set_updated_at()` (generic `updated_at`-maintenance trigger, also usable elsewhere).

**Receipt allocation** (migration 010): `stall_allocate_receipt_block(...)` — a guarded allocation function closing the read-then-insert race the old v1 doc flagged under "things that will bite you."

**Retention** (migration 041): `stall_purge_stale_customers(interval default '24 months')` — the first `SECURITY DEFINER` function in this schema, `service_role`-only, scheduled via `pg_cron` daily. Closes the previously-unbuilt PRD §12 customer-retention purge.

**Restock signals**: `stall_restock_signals()` still exists (below-par / dead-stock computation), now operating against per-location `stall_stock` rather than the old scalar `stock_qty`.

## Related
[[Stock and Inventory]] · [[API Routes]] · [[Order Creation RPC]] · [[Database Tables]] · [[HANDOFF - Backend Session]]

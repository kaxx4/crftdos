---
type: reference
updated: 2026-08-10
---

# Database Functions

Part of [[Database Map]]. Eight functions live, all in `public`, all `SECURITY INVOKER` (none are `security definer`), all reachable only via the service-role client.

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

## Related
[[Stock and Inventory]] · [[API Routes]] · [[Order Creation RPC]]

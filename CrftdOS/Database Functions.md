---
type: reference
updated: 2026-08-10
---

# Database Functions

Part of [[Database Map]]. Five functions live, all in `public`, all `SECURITY INVOKER` (none are `security definer`), all reachable only via the service-role client.

Four came from `_import/migrations/001_atomicity_and_indexes.sql`, whose whole purpose was to kill read-then-write races. The fifth is undocumented drift.

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

Wraps `stall_custom_sticker_seq` for the `C-####` sequence. **This function is not in `schema.sql` and not in migration 001** — it exists live but has no source of truth in the repo. A rebuild from the SQL files would produce a database where `/api/orders` fails on every custom sticker. See [[Known Issues]].

---

## The gap

There is no function that creates an order. `/api/orders` orchestrates ~30 sequential statements from the Node process instead, which means the whole charge is **not a transaction** — a mid-loop failure leaves stock already decremented and compensates by soft-voiding the order. This is the single biggest item in the [[Performance Backlog]].

## Related
[[Stock and Inventory]] · [[API Routes]]

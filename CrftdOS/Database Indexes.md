---
type: reference
updated: 2026-08-10
---

# Database Indexes

Part of [[Database Map]]. Audited live, 48 indexes across the `stall_*` tables.

## The clever ones

**`stall_one_open_shift`**
```sql
create unique index on stall_shifts ((closed_at is null)) where closed_at is null;
```
Indexes a boolean *expression* that is always `true` for open rows, over a partial set containing only open rows. Result: at most one open shift can exist, enforced by Postgres rather than by application logic. `/api/shift/open` catches the resulting `23505` and joins the existing shift instead of failing.

**The three `stall_holds` partials** (from migration 001)
```sql
on (sticker_id)  where released_at is null and converted_order is null
on (product_sku_id) where released_at is null and converted_order is null
on (expires_at)  where released_at is null and converted_order is null
```
Match the predicates in [[Kiosk Handoff]]'s catalogue and reserve endpoints exactly. Before migration 001 `stall_holds` had only a primary key, and those are the hottest queries in the kiosk.

**`stall_orders_fulfillment_status_idx ... where fulfillment_status <> 'handed_over'`**
The pending-press queue is a tiny slice of a large table. A partial index keeps it tiny.

**GIN on `tags` and `auto_tags`** — array containment search for the kiosk sticker browser.

## Redundant — drop these

| Index | Why |
|---|---|
| `stall_orders_receipt_no_idx` | `stall_orders_receipt_no_key` (unique) already covers every lookup on that column. Two B-trees maintained on every order insert, for one column, on the hottest write path. |
| `stall_design_tickets_code_idx` (partial, `where status='open'`) | `stall_design_tickets_code_key` (unique) covers it. The partial is narrower but the unique is required anyway. |

## Missing — foreign keys with no covering index

Postgres does **not** auto-index FK columns. Every one of these forces a sequential scan on the referenced-side check, and most are also queried directly.

**Hot path — fix first**
- `stall_receipt_blocks.shift_id` — read on every charge *and* every app boot (`/api/shift/current`)
- `stall_order_items.product_sku_id` — the dead-stock query
- `stall_order_item_stickers.sticker_design_id` — the dead-stock query
- `stall_orders.sold_by` — volunteer leaderboard and commission
- `stall_orders.customer_id`
- `stall_inventory_movements.ref_order`
- `stall_holds.shift_id`

**Colder but still unindexed**
`stall_b2b_activity.b2b_id` · `stall_b2b_orders.account_owner` · `stall_custom_stickers.order_id` · `stall_design_tickets.order_id` · `stall_holds.converted_order` · `stall_holds.created_by` · `stall_message_log.order_id` · `stall_order_item_stickers.custom_sticker_id` · `stall_product_skus.color_id` · `stall_product_skus.fit_id` · all four on `stall_returns` · all four on `stall_waste_log`

At current row counts (one order, twelve designs) none of this is measurable. At one real stall's worth of data — a few hundred orders, a few thousand movement rows — the dead-stock query and the leaderboard are the first to hurt.

Tracked as task **#8**, migration 003. See [[Performance Backlog]].

## Related
[[Database Tables]] · [[Database Map]]

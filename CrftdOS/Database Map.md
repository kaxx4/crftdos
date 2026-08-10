---
type: reference
updated: 2026-08-10
source: live introspection of Supabase project drvucogrjphctwfealxd
---

# Database Map

Part of [[crftd Stall OS]]. Describes what is **actually deployed**, read from the live database, not from `schema.sql`.

## Where it lives

| | |
|---|---|
| Project | `paradox-2026` · ref `drvucogrjphctwfealxd` |
| Region | `ap-south-1` (Mumbai) |
| Postgres | 17.6 |

> [!warning] The project is shared
> This Postgres also hosts **38 `paradox_*` tables** belonging to a separate event-management application, some with real data (`paradox_audit_log` ~7.5k rows, `paradox_admin_sessions` ~5.4k). Stall OS owns the **23 `stall_*` tables** and one view. They share a connection pool and a maintenance window. Nothing enforces the separation but the prefix — a careless `drop schema` or an unqualified migration touches both products.

## Migration state

| File | Applied | Contents |
|---|---|---|
| `_import/schema.sql` | yes | Base tables, enums, sequences, RLS, anon policies |
| `001_atomicity_and_indexes.sql` | yes | Guarded stock RPCs, atomic receipt consumption, hold reservation, hold indexes |
| `002_atomic_order_creation.sql` | yes | [[Order Creation RPC]], void RPC, restock signals, customer de-dupe |
| `003_fk_indexes.sql` | yes | 22 FK covering indexes, 2 redundant index drops |

`stall_next_custom_sticker_no()` existed only in the live database until 002 — it was in neither `schema.sql` nor 001, so a rebuild from the SQL files would have produced a broken database. 002 recreates it.

## Table groups

**Catalogue** — [[Sticker Catalogue]] `stall_sticker_designs` (12 rows) · [[Product SKUs]] `stall_product_skus` (32) · `stall_colors` (2) · `stall_fits` (3)

**Trading** — `stall_orders` · `stall_order_items` · `stall_order_item_stickers` · `stall_custom_stickers` — see [[Order Creation RPC]]

**Shift** — `stall_shifts` · `stall_receipt_blocks` — see [[Shifts and Receipt Blocks]] and [[Receipt Numbering]]

**Kiosk** — `stall_design_tickets` · `stall_presets` — see [[Kiosk Handoff]]

**Operations** — [[Holds]] `stall_holds` · `stall_waste_log` · `stall_returns` · `stall_inventory_movements`

**Commercial** — `stall_b2b_orders` · `stall_b2b_activity`

**Infra** — `stall_settings` · `stall_message_log` · `stall_admin_audit` · `stall_customers` · `stall_volunteers`

## Enums

13 enums, all `stall_`-prefixed. `stall_product_type` carries `hoodie/jacket/jersey/uniform` as PRD §0 "provisions added, not built" — schema-ready, seeded inactive, tee is the only active type.

## Functions

| Function | Language | Purpose |
|---|---|---|
| `stall_create_order(jsonb)` | plpgsql | Entire charge in one transaction — see [[Order Creation RPC]] |
| `stall_void_order(uuid,text,text)` | plpgsql | Restock + ledger + mark void, atomically |
| `stall_restock_signals()` | sql stable | Below-par and dead stock computed in-database |
| `stall_adjust_product_stock(uuid,int)` | sql | Floor-guarded delta; returns no rows on oversell |
| `stall_adjust_sticker_stock(uuid,int)` | sql | Same for designs |
| `stall_consume_receipt_no(uuid)` | sql | Atomic block increment (now inlined in `stall_create_order`) |
| `stall_reserve_sticker_hold(...)` | plpgsql | `SELECT … FOR UPDATE` then availability check — closes the kiosk double-booking TOCTOU |
| `stall_next_custom_sticker_no()` | sql | `C-####` sequence |

## Row Level Security

RLS is **enabled on all 23 tables**. Exactly five carry an anon `SELECT` policy, matching PRD §12 precisely:

`stall_colors` · `stall_fits` · `stall_presets` · `stall_product_skus` · `stall_sticker_designs`

Everything else has RLS on with **zero policies**, i.e. total deny to anon — reachable only through server routes using the service key. This is correct and worth not breaking. See [[Row Level Security]].

## Views

`stall_product_availability` — `stock_qty` minus active holds. See [[Holds]] for why on-hand and available are deliberately different numbers.

## Related
[[Database Tables]] · [[Database Functions]] · [[Performance Backlog]] · [[Known Issues]]

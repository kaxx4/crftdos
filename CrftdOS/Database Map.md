---
type: reference
updated: 2026-08-13
source: _import/migrations/ (007–041), reconciled against the live Supabase project drvucogrjphctwfealxd on 2026-08-13
---

# Database Map

Part of [[crftd Stall OS]]. Describes what is **actually deployed**. As of 13 Aug, `_import/migrations/` was pulled directly from `supabase_migrations.schema_migrations` on the live project and reconciled — before this, the migrations folder had drifted well behind the live schema (`stall_environments`, `stall_templates`, `stall_leads`, `stall_kiosk_events`, per-environment stock, and more existed live but nowhere in this repo). **Treat `_import/migrations/`, not `_import/schema.sql`, as the current source of truth** — `schema.sql` is a known-stale point-in-time dump. See `_import/migrations/README.md`.

> Everything below the "Migration state" table describes the **10 Aug, 23-table schema**. It is left largely as-is because it's still accurate for what it documents, with the growth since then called out inline and in [[Database Tables]] / [[Database Functions]]'s "added since 10 Aug" sections. Table/function counts in the summary paragraphs below (23 tables, 8 functions) are **stale** — see those sections for current counts.

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
| `_import/schema.sql` | yes, but stale | Base tables, enums, sequences, RLS, anon policies — a point-in-time dump, not current |
| `001_atomicity_and_indexes.sql` | yes | Guarded stock RPCs, atomic receipt consumption, hold reservation, hold indexes |
| `002_atomic_order_creation.sql` | yes | [[Order Creation RPC]], void RPC, restock signals, customer de-dupe |
| `003_fk_indexes.sql` | yes | 22 FK covering indexes, 2 redundant index drops |
| `004_rate_limit_and_analytics.sql` | yes | `stall_rate_limits` table + `stall_rate_limit_hit()`, replacing the in-process rate limiter |
| `005`–`006` | yes | Prep-enum value, price-trust/exchange atomicity groundwork |
| `007`–`032` (`stall_007`–`stall_012`) | yes | **Environments** (`stall_environments`), **per-location stock** (`stall_stock_locations`, `stall_stock`), **templates** (`stall_templates`), **kiosk analytics stream** (`stall_kiosk_events`), stock transfer/adjust location-aware overloads, RLS lockdown pass |
| `033`–`039` | yes | Exchanges, return refund method, named holds, leads (`stall_leads`), per-environment open-shift constraint, price trust, discount guard + sticker price ceiling |
| `040_security_hardening_search_path_and_definer.sql` | yes | `search_path` hardening on every `stall_*` function, locked down `stall_purge_kiosk_events` to `service_role`, `stall_product_availability` set to `security_invoker` |
| `041_stall_purge_stale_customers.sql` | yes | Customer-retention purge, `SECURITY DEFINER`, scheduled via `pg_cron` — closes the PRD §12 gap |

41 migrations total, reconciled against the live schema on 13 Aug — see `_import/migrations/README.md` for exactly what changed in that reconciliation.

`stall_next_custom_sticker_no()` existed only in the live database until 002 — it was in neither `schema.sql` nor 001, so a rebuild from the SQL files would have produced a broken database. 002 recreates it.

## Table groups

**Catalogue** — [[Sticker Catalogue]] `stall_sticker_designs` (12 rows as of 10 Aug, unverified since) · [[Product SKUs]] `stall_product_skus` (32) · `stall_colors` (2) · `stall_fits` (3)

**Trading** — `stall_orders` · `stall_order_items` · `stall_order_item_stickers` · `stall_custom_stickers` — see [[Order Creation RPC]]

**Shift** — `stall_shifts` · `stall_receipt_blocks` — see [[Shifts and Receipt Blocks]] and [[Receipt Numbering]]

**Kiosk** — `stall_design_tickets` · `stall_presets` · `stall_templates` · `stall_kiosk_events` — see [[Kiosk Handoff]]

**Operations** — [[Holds]] `stall_holds` · `stall_waste_log` · `stall_returns` · `stall_inventory_movements`

**Commercial** — `stall_b2b_orders` · `stall_b2b_activity` · `stall_leads`

**Environments / locations** (added since 10 Aug) — `stall_environments` · `stall_stock_locations` · `stall_stock` — see [[Database Tables]] "Added 13 Aug"

**Infra** — `stall_settings` · `stall_message_log` · `stall_admin_audit` · `stall_customers` · `stall_volunteers` · `stall_rate_limits`

Total live `stall_*` object count has grown from 23 tables + 1 view (10 Aug) to at least 30 tables + 1 view (13 Aug) — not re-counted exhaustively against the live database in this pass; `_import/migrations/` is the thing to count against if an exact figure is needed.

## Enums

13 enums as of 10 Aug, all `stall_`-prefixed. `stall_product_type` carries `hoodie/jacket/jersey/uniform` as PRD §0 "provisions added, not built" — schema-ready, seeded inactive, tee is the only active type. Since 10 Aug: `stall_environment_kind` was added (`cloud`/`stall`/`online`, migration 007), and `stall_movement_reason` gained two new values (`transfer_in`, `transfer_out`, migration 021). Not re-audited exhaustively for other additions in this pass.

## Functions

**27 functions live as of 13 Aug, up from 8 on 10 Aug.** Full current list in [[Database Functions]] — the table below is the original 10 Aug list, kept for what it documents, not the current count.

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

As of migration 040 (13 Aug), every `stall_*` function has `search_path` explicitly set (`public, pg_temp`) as a hardening pass, and `stall_purge_kiosk_events` was locked down from a broader grant to `service_role`-only after being found reachable more widely than intended. See [[Database Functions]] and [[HANDOFF - Backend Session]].

## Row Level Security

RLS was **enabled on all 23 tables** as of 10 Aug, with exactly five carrying an anon `SELECT` policy, matching PRD §12 precisely:

`stall_colors` · `stall_fits` · `stall_presets` · `stall_product_skus` · `stall_sticker_designs`

Everything else had RLS on with **zero policies**, i.e. total deny to anon — reachable only through server routes using the service key. Since 10 Aug, at least three more tables gained anon `SELECT` policies for kiosk-facing reads: `stall_environments`, `stall_templates` (where `is_active`), and `stall_kiosk_events` gained an anon **insert** policy (not select — see [[Database Tables]] "Added 13 Aug"). Migration 032 ("RLS lockdown") also ran as part of the environments/stock-locations work — check that migration directly if you need the exact current policy set; this section was not re-derived from a full live RLS audit in this pass. See [[Row Level Security]].

## Views

`stall_product_availability` — `stock_qty` minus active holds. See [[Holds]] for why on-hand and available are deliberately different numbers.

## Related
[[Database Tables]] · [[Database Functions]] · [[Performance Backlog]] · [[Known Issues]]

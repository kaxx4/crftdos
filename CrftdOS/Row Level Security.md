---
type: note
updated: 2026-08-10
---

# Row Level Security

Part of [[Database Map]]. Implements PRD §12.

## The model

RLS is **enabled on all 23** `stall_*` tables. Only five carry a policy:

| Table | Policy | Grant |
|---|---|---|
| `stall_colors` | `stall_anon_read_colors` | `SELECT` to `anon`, `using (true)` |
| `stall_fits` | `stall_anon_read_fits` | same |
| `stall_sticker_designs` | `stall_anon_read_stickers` | same |
| `stall_product_skus` | `stall_anon_read_products` | same |
| `stall_presets` | `stall_anon_read_presets` | same |

The other eighteen have RLS on and **zero policies**, which in Postgres means *deny everything* to any non-superuser role. Orders, customers, holds, receipt blocks, settings and the audit log are unreachable with the anon key, full stop.

This matches the spec exactly.

## Why anon gets those five

The browser needs a direct Postgres connection for two things:

1. **Catalogue hydration** — the Sell screen and the kiosk read designs, SKUs, colours and fits straight from the anon client rather than proxying through a route handler. See [[Frontend Map]].
2. **Realtime stock** — a Realtime subscription needs the subscribing role to be able to `SELECT` the rows it is watching.

What leaks: design codes, names, tags, image paths, stock counts, prices, costs, bin locations. `unit_cost` is arguably the only sensitive one — it lets anyone with the anon key compute margin. Low stakes for a charity stall, worth knowing.

## Everything else goes through the service role

`supabaseAdmin()` in `src/lib/supabase/server.ts` builds a `service_role` client, which **bypasses RLS entirely**. It:

- throws if `SUPABASE_SERVICE_ROLE_KEY` is missing or still a `REPLACE_` placeholder
- sets `persistSession: false, autoRefreshToken: false`
- is only ever imported by files under `src/app/api/`

Because RLS is bypassed, **the route handler's own PIN check is the entire authorisation boundary** for every write in this app. Each handler re-verifies its cookie independently — see [[Auth and Sessions]]. `middleware.ts` deliberately passes `/api/*` straight through with a comment saying so, so there is no belt-and-braces second gate at the edge.

The practical consequence: a route handler that forgets its `verifySession` call is a fully open door to the whole database. Worth a lint rule.

## Related
[[Auth and Sessions]] · [[API Routes]] · [[Known Issues]]

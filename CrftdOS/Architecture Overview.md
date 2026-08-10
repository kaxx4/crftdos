---
type: note
updated: 2026-08-10
---

# Architecture Overview

Part of [[crftd Stall OS]].

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js **16.3.0**, App Router, TypeScript |
| UI | React 19.2, Tailwind v4 (`@tailwindcss/postcss`) |
| Database | Supabase Postgres 17.6 — project `paradox-2026` (`drvucogrjphctwfealxd`), region `ap-south-1` |
| Auth | Home-grown PIN + JWT cookie (`jose`), **not** Supabase Auth. See [[Auth and Sessions]] |
| Password hashing | `@node-rs/argon2` |
| Offline store | IndexedDB via `idb`. See [[Offline and Sync]] |
| Hosting | Vercel |

## Shape of the thing

```
Browser (all pages are "use client")
   │
   ├── anon Supabase client ──► Postgres  [read-only catalogue, RLS-enforced, Realtime]
   │
   └── fetch /api/*  ──► Next route handler ──► service-role client ──► Postgres [everything else]
                            ▲
                            └── middleware.ts gates every non-API page on a PIN cookie
```

Two distinct database access paths, and the split is deliberate:

1. **Anon browser client** (`src/lib/supabase/client.ts`) reads the catalogue directly, so the Sell screen and kiosk can hydrate fast and subscribe to Realtime stock. RLS restricts anon to `SELECT` on five lookup tables — see [[Row Level Security]].
2. **Service-role client** (`src/lib/supabase/server.ts`, `supabaseAdmin()`) bypasses RLS entirely and is only ever constructed inside route handlers. Every write goes through here.

There is a third helper, `supabaseServer()`, that builds a cookie-scoped server client. **It is currently unused** — no route imports it. See [[Known Issues]].

## Rendering model

Every single `page.tsx` in the app carries `"use client"`. There is no server-side data fetching in any page, and no route segment exports `dynamic` / `revalidate` / `runtime`. Consequence:

- Page HTML is a static prerendered shell, built once. Nothing is re-rendered per visitor.
- All data arrives via client-side `fetch` / Supabase calls after hydration.
- The cost is a **request waterfall on boot** rather than a server-render cost. See [[Performance Backlog]].

`middleware.ts` runs per-request on every non-static path and does the PIN gating; that is the only per-request server work on a page load.

## Shared database, two applications

The Supabase project hosts **two unrelated apps** in the same `public` schema, separated only by table prefix:

- `paradox_*` — 38 tables, an event-management system (registrations, judging, runbooks, ledger). ~7.5k rows in `paradox_audit_log`, ~5.4k in `paradox_admin_sessions`.
- `stall_*` — 23 tables + 1 view, this app.

They share a connection pool, a CPU budget, and a blast radius. Worth knowing before load-testing or before running anything destructive. See [[Deployment and Environments]].

## Directory layout

```
app/src/
  app/
    page.tsx              Sell — the main POS screen (880 lines)
    kiosk/                Customer Design Studio (758 lines)
    orders/ holds/ waste/ returns/ restock/ stock/ more/
    shift-open/ receipt/ pin/
    admin/                dashboard, analytics, pricing, b2b, bulk, catalogue
    api/                  all route handlers — see [[API Routes]]
  components/             PosFrame, TabBar, ui.tsx
  lib/                    session, outbox, deviceId, fy, rateLimit, types, supabase/
  middleware.ts
_import/
  schema.sql              base schema
  migrations/001_atomicity_and_indexes.sql
```

## Related

- [[Database Map]]
- [[Frontend Map]]
- [[API Routes]]
- [[Known Issues]]

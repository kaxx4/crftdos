---
type: note
updated: 2026-08-13
---

# Architecture Overview

Part of [[crftd Stall OS]]. Describes **`app-v2`**, the current live app (`NEXT_PUBLIC_BACKEND=live`, wired to the real Supabase backend as of the 13 Aug session). `app/` is the earlier v1 build; it still exists in the repo but is superseded — treat anything below as describing `app-v2` unless stated otherwise.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js **16.3.0**, App Router, TypeScript |
| UI | React 19.2, Tailwind v4 (`@tailwindcss/postcss`) |
| Database | Supabase Postgres 17.6 — project `paradox-2026` (`drvucogrjphctwfealxd`), region `ap-south-1` |
| Auth | **None.** A credential-free role toggle, not a security boundary. See [[Auth and Sessions]] |
| Offline store | IndexedDB via `idb` (outbox pattern carried forward from v1). See [[Offline and Sync]] |
| Hosting | Vercel |

## Shape of the thing

```
Browser (all pages are "use client")
   │
   ├── anon Supabase client ──► Postgres  [read-only catalogue, RLS-enforced, Realtime]
   │
   └── fetch /api/*  ──► Next route handler ──► service-role client ──► Postgres [everything else]
                            ▲
                            └── middleware.ts passes every route through unconditionally —
                                no cookie, no gate. See [[Auth and Sessions]] for why.
```

Two distinct database access paths, and the split is deliberate:

1. **Anon browser client** reads the catalogue directly, so the Sell screen and kiosk can hydrate fast and subscribe to Realtime stock. RLS restricts anon to `SELECT` on a handful of lookup tables — see [[Row Level Security]] (not yet re-audited against the current live table list, see [[Database Map]]).
2. **Service-role client** bypasses RLS entirely and is only ever constructed inside route handlers (36 `route.ts` files under `app-v2/src/app/api`). Every write goes through here. **This is now the only access-control boundary in the app** — see [[Auth and Sessions]] for what that means in practice.

## Rendering model

Every single `page.tsx` in the app carries `"use client"`. There is no server-side data fetching in any page, and no route segment exports `dynamic` / `revalidate` / `runtime`. Consequence:

- Page HTML is a static prerendered shell, built once. Nothing is re-rendered per visitor.
- All data arrives via client-side `fetch` / Supabase calls after hydration.
- The cost is a **request waterfall on boot** rather than a server-render cost. See [[Performance Backlog]].

`middleware.ts` runs per-request on every non-static path but does nothing except `NextResponse.next()` — there is no per-request server work on a page load anymore. It's kept as a file mainly so a future gate has somewhere to go without inventing new plumbing; see [[Auth and Sessions]] for why it's empty on purpose.

## Shared database, two applications

The Supabase project hosts **two unrelated apps** in the same `public` schema, separated only by table prefix:

- `paradox_*` — 38 tables, an event-management system (registrations, judging, runbooks, ledger). ~7.5k rows in `paradox_audit_log`, ~5.4k in `paradox_admin_sessions`.
- `stall_*` — 23 tables + 1 view, this app.

They share a connection pool, a CPU budget, and a blast radius. Worth knowing before load-testing or before running anything destructive. See [[Deployment and Environments]].

## Directory layout

```
app-v2/src/
  app/
    page.tsx               Kiosk — public customer Design Studio, site root
    pos/                    Volunteer POS — sell, orders, holds, waste, returns,
                            stock, more, press, receipt (all open, role-toggle only)
    admin/                  dashboard, analytics, pricing, b2b, bulk, catalogue,
                            stock, environments, templates, discounts
    settings/
    api/                    36 route handlers — see [[API Routes]]
  components/               RoleSwitcher, ui.tsx, shared primitives
  features/
    kiosk/  pos/  admin/    surface-specific components (KioskApp, AdminShell, ...)
  lib/
    backend/                the contract seam — mock/ and live/ implementations,
                             switched by NEXT_PUBLIC_BACKEND
    domain/  hooks/  supabase/
  middleware.ts             no-op pass-through — see [[Auth and Sessions]]
_import/
  schema.sql                stale point-in-time dump — do NOT treat as source of truth
  migrations/                001–041, reconciled with the live schema 13 Aug.
                             This is the source of truth for current schema.
                             See migrations/README.md.
app/                        the old v1 build — untouched, not the current app
```

## Related

- [[Database Map]]
- [[Frontend Map]]
- [[API Routes]]
- [[Known Issues]]
- [[Auth and Sessions]]

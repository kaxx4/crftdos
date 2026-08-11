---
type: handoff
updated: 2026-08-11
for: a session with live Supabase access to project drvucogrjphctwfealxd
---

# HANDOFF — Backend Session

You are picking up a frontend rebuild that is complete and verified against a mock backend. Your job is to make it talk to the real database.

Read these three, in this order, before touching anything:

1. **[[Backend Requirements - Rework 2026-08]]** — the migrations to apply. This is your spec.
2. **[[Rework - Build Log 2026-08-11]]** — what was built, what was deliberately left out, and why.
3. **[[Rework - Fresh Plan 2026-08-11]]** — the product direction the whole thing serves.

---

## 1. Where things are

| | |
|---|---|
| **`app-v2/`** | The rebuild. Complete, builds clean, browser-verified. **This is what you're wiring up.** |
| `app/` | The v1 build. Untouched, still runs, still the reference for verified behaviour. Do not delete it. |
| `CrftdOS/` | The Obsidian doc vault. Reference notes describe **v1** unless they say otherwise. |
| `crftd_Stall_OS_PRD_v2.md` | Repo root. The authoritative product spec. |

Supabase project `drvucogrjphctwfealxd` (`paradox-2026`), region `ap-south-1`, Postgres 17.6.

> [!warning] The project is shared
> This Postgres also hosts **38 `paradox_*` tables** from a completely separate event-management application, some with real data. Stall OS owns the 23 `stall_*` tables and one view. Nothing enforces the separation but the prefix.
>
> **Every statement you run must be prefix-scoped and schema-qualified.** No unqualified `drop`, no `alter schema`, no catalogue-wide operation. A careless migration takes out two products.

## 2. What you're actually doing

Three things, in order. Do not start the second before the first is verified.

### Step 1 — Apply migrations 004–009

They're specced with DDL in [[Backend Requirements - Rework 2026-08]]. Summary:

| # | What | Risk |
|---|---|---|
| 004 | `stall_environments` + `environment_id` on 8 tables; environment-scoped receipt numbering | Medium — touches many tables, but additive |
| 005 | `prepped_at` + `prepped` enum value | Low |
| 006 | `stall_templates` | Low — new table |
| 007 | Kiosk-time order creation, UPI settings | Medium — touches `stall_create_order` |
| 008 | `stall_kiosk_events` analytics stream | Low table, **real operational risk** — see §4 |
| 009 | **Per-environment stock allocation** | **High. Rewrites the money path.** |

**004–008 are additive.** Their gate: the existing v1 end-to-end flow still passes in a browser with no new fields supplied — kiosk → ticket → till → charge → receipt → press sheet. That flow is proven to work (receipt `CR/26-27/000202` in the log). If it breaks, the migration wasn't additive; revise it, don't patch around it.

**009 is not additive and must go last**, after everything else is in and proven. It converts `stock_qty` from a scalar on the catalogue row into a value per `(sku, location)`, which means every stock guard, `stall_create_order`, `stall_void_order`, `stall_reserve_sticker_hold`, `stall_product_availability` and `stall_restock_signals` become location-scoped. Its verification bar is higher and is written out in that section — do not skip it.

### Step 2 — Write `app-v2/src/lib/backend/live/`

This is the whole reason the frontend was built the way it was.

Everything in `app-v2` talks to **one interface** — `src/lib/backend/contract.ts` — and nothing else. There are no Supabase imports anywhere in the UI. Implement that interface against real route handlers, then flip one factory function in `src/lib/backend/index.ts`:

```ts
instance = process.env.NEXT_PUBLIC_BACKEND === "live" ? new LiveBackend() : new MockBackend();
```

**No call site changes.** If you find yourself editing a component to make the backend work, stop — the seam is wrong, not the component.

Read `src/lib/backend/mock/index.ts` as your behavioural spec. It is not a stub: it already enforces the invariants the real thing must (refuse-don't-go-negative stock guards, whole-order rollback on any out-of-stock line, environment-scoped availability, hold reservation, idempotency on the client-supplied order id, per-device receipt blocks). Where it is deliberately weaker than production, it says so inline — in particular `reserveSticker` notes that its check-then-insert is only safe because JS is single-threaded, and the real one **must** use `select … for update` like `stall_reserve_sticker_hold` already does.

### Step 3 — Write the route handlers

`app-v2` has **no `/api/*` routes at all** yet. Every write in this app goes through a route handler with a service-role client.

Rebuild them against [[API Routes]] and the v1 source in `app/src/app/api/`. Two things that are non-negotiable:

1. **Every handler re-verifies its own session.** `middleware.ts` passes `/api/*` straight through by design, so the handler's `verifySession` call is the *entire* authorisation boundary between the internet and a service-role client that bypasses RLS. A handler that forgets it is a full database breach. Worth a lint rule; there isn't one.
2. **`POST /api/orders/[id]/prep` is not a timestamp stamp.** Per the resolved decision, prep is where stock actually moves, so it calls `stall_prep_order` — decrement, ledger, hold conversion, timestamp, one transaction, able to refuse.

## 3. Decisions already taken — do not relitigate

Settled with the user on 11 Aug. All three are load-bearing:

1. **Stock is allocated per environment**, not shared org-wide. This is migration 009. A consequence you will see and might mistake for a bug: **two kiosks at the same event legitimately show different catalogues**, because they genuinely have different boxes of transfers.
2. **A kiosk order does not decrement stock.** The existing soft-hold mechanism keeps doing its job; stock moves at prep. A customer who orders and wanders off costs an expired hold and nothing else.
3. **UPI is a per-order dynamic deep link** — `upi://pay?pa=…&am=…&tn=<order code>&cu=INR` — with the amount embedded and the order code as the transaction note. No static QR upload. Admin config is two `stall_settings` keys.

## 4. Open questions you must answer before shipping

| # | Question | Recommendation | Blocks |
|---|---|---|---|
| 2 | Is "Mark Prepped" reversible? | Yes, but it now reverses a *stock movement*, so it goes through an RPC mirroring `stall_void_order` | Nothing, but it's bigger than it looks |
| 5 | Analytics retention, volume, rate limiting | Batch client-side (already done), 90-day purge, a real limit | **Migration 008** |
| 6 | Does the kiosk catalogue filter by the device's environment stock? | Yes — accept that two kiosks show different catalogues | **Migration 009** |

**Question 5 deserves your attention specifically.** `stall_kiosk_events` is a publicly-writable, unauthenticated insert on a database shared with another production application. Three things must be true before it ships:

- Client-side batching (done — `src/lib/analytics.ts`, semantic events only, never pointer-move).
- A retention purge. **This repo has no cron/scheduled-job infrastructure at all** — that's also why the PRD §12 customer-retention purge is unbuilt. Either ship 008 with `pg_cron` or ship it with a documented manual purge and an admin button. Do not ship it with neither.
- A rate limit that works. The existing one is an in-process `Map`, so on Vercel it's per-instance and largely unenforced in production. Don't rely on it here.

## 5. What is NOT built in app-v2

This is the honest scope gap. `app-v2` is a complete implementation of the **new** flows, not yet a replacement for everything v1 does.

**Required before any real stall use:**
- Route handlers (§2 step 3)
- PIN gating + `middleware.ts` — v1's three-PIN model is not in v2 at all. **Every surface is currently open.**
- PWA / service worker / catalogue cache. The offline **outbox is carried forward** and works; the offline *shell* is not.

**Exists in v1, not rebuilt in v2:**
returns · waste · holds UI · B2B · bulk · pricing editor · receipt screen · press sheet

Decide with the user whether these get rebuilt in v2 or whether v2 is merged into v1 surface by surface. That's a product call, not a technical one, and nobody has made it.

## 6. Things that will bite you

- **`stall_design_tickets.status` is bare text**, not an enum — `open | redeemed | expired`. The one inconsistency in an otherwise strictly-typed schema. A typo will not be caught.
- **`stall_next_custom_sticker_no()`** exists live but is in neither `schema.sql` nor migration 001. A rebuild from those two alone produces a database where custom stickers fail on every order. Migration 002 recreates it.
- **Report on `client_created_at`, not `created_at`.** The former is when the volunteer actually charged; the latter is when the row reached Postgres. On an offline sale they differ by hours.
- **`stall_adjust_*_stock` signal refusal by returning zero rows**, not by raising. A successful call with no rows means *refused*, not *fine*. Every existing caller checks; yours must too.
- **Receipt block allocation in v1 is a read-then-insert with no lock.** Two devices opening simultaneously compute the same `start_no`; the unique constraint catches it but the loser gets a 500 rather than a retry. Migration 004 fixes this with a guarded allocation function — don't carry the race forward.
- **`stall_orders` `id` is client-generated** and doubles as the outbox idempotency key. `createOrder` must check for an existing row *first*, before any guard or mutation. That ordering is what makes a retry incapable of double-charging.

## 7. How to verify you're done

Run the same gate the frontend was held to. Two scripts exist and both pass against the mock — point them at the live build:

- **End-to-end**, 26 assertions: unbound device blocks → bind → open a template → placements load → a full side refuses with an explanation → the same transfer places on the empty back → blank order form refused per-field → UPI QR with amount → order placed → ticket → **appears in the POS prep queue at the correct total with a nudge naming each transfer and its bin** → prepped → printed → handed over → admin shows *Raised for AquaTerra* attributed to the right stall.
- **Responsive sweep**, 14 route/viewport combinations at 360/768/1280/1440: zero horizontal overflow, zero text under 12px, zero sub-44px targets on kiosk and POS.

Plus, for migration 009 specifically: an oversell at one location is refused while the same sku stays sellable at another; a void returns stock to the originating location; and warehouse + all allocations still equals the pre-migration `stock_qty` for every sku.

## Related
[[Backend Requirements - Rework 2026-08]] · [[Rework - Build Log 2026-08-11]] · [[Rework - Fresh Plan 2026-08-11]] · [[Database Map]] · [[API Routes]] · [[Row Level Security]] · [[Known Issues]]

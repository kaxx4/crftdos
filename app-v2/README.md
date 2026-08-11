# crftd Stall OS — v2

From-scratch rebuild of the frontend, per `CrftdOS/Rework - Fresh Plan 2026-08-11.md`.
Execution record and honest scope gaps: `CrftdOS/Rework - Build Log 2026-08-11.md`.

`../app` (v1) is untouched and still runs. Nothing has been swapped.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
npm run typecheck
npm run build
node scripts/gen-assets.mjs   # regenerate placeholder artwork
```

**Open `/settings` first.** Every device must be bound to an environment before
it can do anything — that is the design, not a missing default. A sale written
into the wrong environment is not recoverable from the UI, so an unbound device
blocks with an explanation instead of silently picking one.

Then: `/` is the kiosk, `/pos` the volunteer board, `/admin` the console.

To see the pipeline as it actually behaves, open the kiosk and `/pos` in two
tabs. An order placed in one appears on the board in the other without a
refresh.

## This build has no database

Everything runs against a **mock backend** (`src/lib/backend/mock/`) that lives
in localStorage. Every surface shows a "DEMO DATA" band so nobody mistakes a
figure on screen for a real one.

The mock is a genuine implementation, not a stub — it enforces the same
invariants the live database does (stock floor guards that refuse, whole-order
rollback, environment-scoped availability, hold reservation, idempotency on the
client-supplied order id, per-device receipt blocks). A UI built against a
permissive fake is a UI with no error states.

**To reset the demo data:** clear the site's localStorage.

## Going live

1. Apply migrations 004–009 from `CrftdOS/Backend Requirements - Rework 2026-08.md`.
2. Write `src/lib/backend/live/` against the same `Backend` interface in
   `src/lib/backend/contract.ts`.
3. Flip the factory in `src/lib/backend/index.ts`.

No call site changes. That is the entire point of the seam.

Still required before any real stall use, and not built here: route handlers,
PIN gating, the PWA/offline shell, and the v1 screens that were not part of the
new flows (returns, waste, holds, B2B, bulk, pricing, receipt, press sheet).

## Layout

```
src/
  lib/
    domain/types.ts     the contract; fields not yet in the DB are marked [004]-[009]
    backend/            contract.ts + mock/ (live/ goes here)
    geometry.ts         the four constraints that keep orders fulfillable
    outbox.ts           offline queue, idempotent on the client order id
    money.ts            all formatting + receipt numbering + the UPI link
    hooks/              scoped state: environment, canvas, board, async
  features/kiosk|pos|admin/
  components/           shared primitives, one set with three skins
```

Three things in here are load-bearing and commented as such — change them only
deliberately: `geometry.ts` (no scaling, bounds, no overlap), `outbox.ts`
(retry cannot double-charge), and the stock guards in the mock backend.

---
type: changelog
updated: 2026-08-10
---

# Changes — 10 August 2026

Part of [[crftd Stall OS]]. Backend order path plus the P1s from [[Frontend Audit 2026-08]].

## The headline: the charge was never a transaction

`/api/orders` POST issued roughly **30 sequential PostgREST round trips** for a two-garment, six-sticker order — one insert per line, one stock call per line, one ledger row per line, times every sticker. Each paid full network latency from the Vercel function to Mumbai.

That was the visible problem. The invisible one mattered more: **those statements were not a transaction.** If the fourth sticker was out of stock, the first three had already been decremented and committed. The route compensated by soft-voiding the order — which does not return stock. Every failed charge silently leaked inventory, and the stock count drifted from the crate in a way nobody would notice until a recount.

`stall_create_order(jsonb)` now does the whole charge — idempotency, receipt number, customer, order, ticket redemption, every line, every sticker, every stock guard, every ledger row — in **one round trip inside one transaction**.

Verified against the live database before wiring, with rollback asserted explicitly:

| Assertion | Result |
|---|---|
| Receipt numbers sequential | `CR/26-27/000001`, `000002` |
| Placements persisted | `side`/`x`/`y`/`rotation` round-trip intact |
| Custom sticker allocated | `C-0002`, correct exclusive-or against catalogue design |
| Stock decremented | 12→11, 8→7, 10→9, 9→8 |
| Idempotent replay | returns `alreadyExisted: true`, no double charge |
| Customer de-duplicated | 1 row across 2 orders; email merged, consent latched |
| **Out-of-stock mid-order** | `P0101` — stock, receipt number, order, movements **and** customer all rolled back |

## Also fixed

**`stall_void_order`** — voiding did the same read-modify-write per line (`SELECT stock_qty` into Node, write back a computed value). That is the lost-update race migration 001 removed from the sale path but never from this one. Now one atomic RPC. The receipt number is deliberately kept: gapless numbering means a void retains its number and is flagged, never reused.

**`stall_restock_signals()`** — `/api/restock` used to `SELECT` *every row* of `stall_order_items` and `stall_order_item_stickers` purely to build two id sets in JavaScript. Its payload grew with lifetime sales forever. Now computed in Postgres; only the answer crosses the wire.

**`/api/admin/bulk`** — batched the per-line inserts and moved stock onto the guarded RPC, closing the last read-modify-write oversell race. Insufficient-stock lines are now *reported* rather than silently miscounted.

**Boot waterfall** — the Sell screen awaited `/api/shift/current` and only then fetched the catalogue, though the catalogue does not depend on the shift. Both legs now go out together, removing a full round trip before the screen is usable.

**Kiosk placements were being thrown away.** The kiosk sends `side`/`pos_x`/`pos_y`/`rotation` into the ticket payload, the columns exist on `stall_order_item_stickers` — and `page.tsx` mapped only id and price at redemption. Every kiosk order reached the heat press with no coordinates, which is the entire justification for the Design Studio. Now carried end to end.

**22 foreign-key indexes** added (migration 003); 2 indexes dropped that merely duplicated existing UNIQUE constraints.

## Frontend P1s

**Primitives now enforce accessibility instead of asking for it.** The previous sweep fixed instances; the primitives still permitted the same gaps to reappear.

- `PanelLabel` renders a real `h2`. `PosFrame`'s `h1` had been the **only heading element in all 17 pages**.
- `Field` requires a `label` prop — rendered as `aria-label` with no wrapper, so all 25 call sites keep their exact layout. Several sit in flex rows passing width via `className`; a wrapper div would have quietly broken them.
- `Banner` gets `role="alert"` / `role="status"`. It carries "*N sales not yet synced*", the one message in this app that must not be missed.
- One `focus-visible` ring across all three primitives. There had been **no `focus:` rule anywhere in `src/`**.

**Type** — the header kicker was 9 px at `opacity-75` on blue, about 4.5:1: fine indoors, unreadable in the sunlight PRD §11 names as a constraint. Now 11 px at full opacity. `Mono` — which renders bin locations, the text that sends a volunteer to the right box — went 11 px → 13 px on a token.

**Colour** — 56 off-token Tailwind defaults swept to four new tokens (`muted`, `hairline`, `ok`, `warn`). `--color-muted` is 7.4:1 on white, hitting the PRD's sunlight target rather than merely WCAG AA. The summary-card canvas — the most widely-seen artefact this app produces — now reads `src/lib/tokens.ts` instead of re-typing hexes, one of which (`#777`) matched no token at all.

**Admin** — was capped between 576 px and 896 px against a spec that says desktop-first, 1280+. Widened, with the pricing matrix given 1600 px and both tables wrapped so the *table* scrolls rather than the page.

## Second pass — clearing [[Known Issues]]

**Security.** `src/lib/rateLimit.ts` was a per-process `Map`; on Vercel each instance had its own, so PRD §12's five-attempts rule was unenforced — trip it and get routed to a cold instance. Now `stall_rate_limit_hit`, one atomic check-and-count in Postgres, **failing closed** if the limiter is unreachable. Verified against the live sequence the routes actually run: 5 attempts allowed, blocked on the 6th.

`/api/auth/verify` had *no* limiting at all, not even the per-process kind, while validating the same admin PIN — the softer of two doors. Now on the same limiter and the same key scope, so failures on either count against one budget. Two more callers turned up mid-change (`/api/admin/b2b`, `/api/returns`) and were converted too. A lockout now says so rather than reporting "Incorrect admin PIN", which would have had a volunteer retyping a correct PIN with a queue building.

**Kiosk correctness.** Overlap detection compared axis-aligned boxes and silently ignored `rotation` — two rotated transfers could be accepted and be impossible to press, the exact order PRD §4.3 exists to prevent. Replaced with a Separating Axis Theorem test over true oriented corners. Rendering still uses an unrotated rect, since CSS spins the element about its own centre.

Designs with null `print_w_cm`/`print_h_cm` were rendering at zero size or `NaN` position with no error. They are now filtered out of the kiosk catalogue: true-scale is the constraint the canvas rests on, so a design that cannot be drawn honestly should not be offered.

**Offline — the big one.** There was no PWA at all. Added a manifest, an SVG icon, and a hand-written service worker with three rules, the first of which is *never cache `/api/*`* — a cached stock count causes an oversell and a cached receipt block causes duplicate receipt numbers. Navigations are network-first with a cached shell; static assets are cache-first.

Added `src/lib/catalogueCache.ts` so the Sell screen boots from an IndexedDB snapshot when the network is gone. It previously showed an empty screen — no products, no stickers, nothing to sell. Kept in a separate database from the outbox on purpose: this is disposable derived data, the outbox holds money. Selling from a stale catalogue is fine; not knowing you are is not, so a banner names the snapshot's age. A failed shift lookup no longer bounces a mid-shift volunteer to `/shift-open`, which needs the network anyway.

**The kiosk QR now carries the whole cart.** PRD §10 is explicit that the QR must encode the full compressed payload, not a lookup code, so the handoff is network-independent — and the kiosk and till are two phones on mobile data that cannot reach each other. It was emitting only the 4-character code, which is the *online-only fallback*. Now JSON → `deflate-raw` → base64url under a `crftd:t:` prefix, with one- and two-character keys because QR capacity is the binding constraint. The till's single field accepts either a scan or a typed code.

**Analytics** moved into `stall_analytics_summary()`; the route was pulling every order, every waste row and both catalogues' cost columns to reduce in Node.

**Payload trimming.** `select("*")` replaced with explicit projections on both hot catalogue paths. On `/api/kiosk/catalogue` this also stopped shipping `unit_cost`, par levels and bin locations to a **customer-facing tablet**.

**Polish.** Touch-target floor unified at 48px (four different values existed). The selected-garment marker — which decides *which shirt gets pressed* — went from a 10% tint to a solid blue rail.

## Third pass — the press sheet

PRD §4.4's press sheet now exists: `src/lib/pressSheet.ts` composites the mockup, draws each cutout at its `pos_x`/`pos_y`/`rotation`, and marks the print-area boundary and a centre crosshair on each placement — the operator aligns to the crosshair, not to the eyeballed middle of the artwork. A missing cutout draws its footprint and code in signal red rather than vanishing.

Rendered on-device on demand rather than uploaded, so it works offline: the press table is the same stall with the same signal. The machine-readable placement list beside it is not a fallback for the image but the other half of the spec — the image says where, the table gives exact numbers when "about a third across" will not do.

This also turned the pending queue from a red count banner into a real queue: oldest first, live wait timer, sheet per garment per side. It surfaced a gap rather than closing one — there are still no **Pressed** / **Handed Over** controls, logged in [[Known Issues]].

## Fourth pass — press queue state transitions

Closed the last open code item in [[Known Issues]]. `PressQueue` was pure display — no controls, no route, `stall_orders.pressed_at`/`collected_at` never written after order creation.

Three new routes, each a plain guarded `update` rather than an RPC — single row, single column, no stock or ledger side effect to protect:

- `POST /api/orders/[id]/press` — stamps `pressed_at`, order stays in the queue.
- `POST /api/orders/[id]/handover` — sets `fulfillment_status = 'handed_over'`, backfilling `pressed_at` if it was skipped.
- `POST /api/orders/[id]/collect` — the collect-later exit: `fulfillment_status = 'collected'` + `collected_at`.

`PressQueue` gained a **MARK PRESSED** / **HANDED OVER** button row per order, disabling the first once pressed. A new `Collections` component groups `collect_later` orders by `promised_date`, oldest first, with a one-tap **COLLECTED**. `/orders` now has a two-way tab (`PressQueue` / `Collections`) above the order list, counts in each chip, only shown once either queue is non-empty.

Also closed the PWA-icon watch-list item: `sharp` was already a dependency, so the SVG icon is now rasterised to `public/icon-192.png` and `public/icon-512.png`, both registered in `manifest.webmanifest` and the 192 wired as `apple-touch-icon` in `layout.tsx` (iOS ignores SVG apple icons on many versions; the manifest's SVG entry stays as the `any`-size source of truth). No manual asset was needed — "no image converter was available" was wrong; one was already in `node_modules`.

## Fifth pass — kiosk becomes the site root

Product decision: the home page should be the kiosk showcase, not a PIN wall. Previously `/` *was* Sell — a volunteer-only screen nobody could reach without a PIN, and the kiosk lived at `/kiosk` behind its own PIN.

- `app/page.tsx` (Sell, 880 lines) moved to `app/sell/page.tsx`.
- `app/kiosk/page.tsx` (758 lines) moved to `app/page.tsx` — the kiosk is now the site root.
- `next.config.ts` 308-redirects `/kiosk` → `/` for anything printed or bookmarked before the move.
- `middleware.ts`: `/` is now in an exact-match public-paths list (not prefix-match — `pathname.startsWith("/")` would have publicised every route). Everything else keeps the PIN gate it had; `/sell` inherits the same stall-session gate `/` used to carry.
- **The kiosk PIN is gone.** `/api/kiosk/reserve` and `/api/kiosk/ticket` no longer check a kiosk session — the kiosk is a public, unauthenticated customer surface by design now, not a staff-unlocked device. Abuse surface is bounded by hold TTL (15 min) and ticket expiry (30 min), not a login. `/api/kiosk/catalogue` was already unauthenticated.
- Attract screen gained a small "Staff passcode" link to `/pin` — unobtrusive, bottom-left, `opacity-40` at rest, since this is a customer-facing showcase and the passcode entry is a staff affordance, not the headline.
- `/pin`'s post-login default destination for `kind=stall` changed from `/` to `/sell`.
- Every internal redirect that assumed root-equals-Sell now points at `/sell`: `shift-open`'s already-open-shift check, `receipt`'s missing-data guard and "Next customer" button, `TabBar`'s Sell tab.
- `more/page.tsx`'s kiosk link now points at `/` with a "public" note instead of "Kiosk (PIN)".
- `sw.js`'s hand-maintained offline precache list gained `/sell` (was only precaching `/`, which is now the kiosk).
- Verified live in dev: `/` → 200, `/kiosk` → 308 → `/`, `/sell` and `/admin` → 307 → `/pin` when unauthenticated, and both kiosk POST routes return 400 on a bad body with no cookie at all (previously 401).

**Demo PINs, dev-only** (`pin/page.tsx`, hidden outside `NODE_ENV=production`): stall `1111` · admin `1234` · kiosk `2222` (the kiosk PIN kind still exists in the auth system, just unused now). Production PINs are argon2 hashes in `stall_settings` — one-way, not recoverable from code or here.

## Sixth pass — Admin responsive pass

Closed the last "Responsive is still barely engaged" item. POS pages needed no change — `PosFrame` already centers every volunteer screen at `max-w-[480px]`, so they were never actually stretching edge-to-edge on a wider device. Kiosk already had the most breakpoint engagement of any surface. Admin was the real gap: five pages, each with at least one fixed-column grid or flex row that didn't step down.

- `admin/page.tsx` — dashboard stat grid `grid-cols-2` → `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`; top nav row gained `flex-wrap`.
- `admin/b2b/page.tsx` — summary grid `grid-cols-2` → `grid-cols-1 sm:grid-cols-2`; the new-enquiry input row and each order row gained `flex-wrap`.
- `admin/pricing/page.tsx` — bulk-set row gained `flex-wrap` (tables already scrolled independently from the earlier pass).
- `admin/catalogue/page.tsx` — already `grid-cols-2 sm:grid-cols-3 md:grid-cols-4`; no change needed, an earlier audit had this wrong.
- `admin/bulk/page.tsx` — already a narrow single-column form; no change needed.

## Seventh pass — PRD audit

Three parallel reads of the codebase against `crftd_Stall_OS_PRD_v2.md` §3–4, §10, §12 — Sell flow, kiosk canvas constraints, offline/security — each reporting MATCHES / DIVERGES / NOT IMPLEMENTED per requirement rather than a general impression. One finding was load-bearing enough to fix before anything else: **`app/sell/page.tsx` never sent `fulfillmentStatus`, `promisedDate`, or `customer` in the order payload.** The RPC defaults `fulfillmentStatus` to `'handed_over'` when absent — so every order ever charged through Sell landed there regardless of press mode or item contents, meaning the `PressQueue`/`Collections` UI built earlier today ([[Changelog 2026-08-10]] fourth pass) had no real order that would ever appear in it. Also missing entirely: the customer-contact sheet (PRD §3.1) — no name/phone/email capture existed anywhere in Sell.

Fixed, in `app/src/app/sell/page.tsx`:
- A cart is flagged `cartHasFulfillmentTrigger` when it contains a custom sticker or a canvas (kiosk-ticket) placement — the two PRD calls "custom or canvas item." Charging maps that to `fulfillmentStatus: 'pending_press'` when `shift.press_on_site`, else `'collect_later'`.
- A customer-details sheet now gates Charge (moved from *after* charge, where the PRD describes it, to *before* — `stall_create_order` sets `customer_id` at insert time, so there's no later moment in an atomic RPC to attach a name to an order that already exists). Skippable in one tap unless the cart is `collect_later` with a fulfillment trigger, in which case phone and a promised date are required and the SKIP button doesn't render at all.
- **Recent stickers** was a recency stack (last 8 added) reset on every remount, not PRD §3.1's "8 most-used this shift." Now a frequency count persisted to `sessionStorage` keyed by shift id, so it survives navigating away and actually reflects usage across the shift.

Also fixed, closing gaps the security/offline audit found:
- **`/api/orders` had no server-side re-check of the >10% discount → admin PIN rule.** The Sell screen enforced it client-side; the RPC accepted whatever `discountAmount` the payload carried regardless. A hand-crafted POST bypassed the gate entirely. The route now re-verifies the PIN against the same `pin_admin` hash `/api/auth/verify` checks, and writes a `stall_admin_audit` row (`discount_override`) — one of PRD §12's four audited-action categories that had zero coverage before this pass.
- **Shift close didn't check the offline outbox.** PRD §10's iOS caveat exists specifically because Safari has no Background Sync — a volunteer could close a shift with sales still queued in IndexedDB and nothing would say so. `orders/page.tsx` `closeShift()` now flushes the outbox, blocks the close, and shows "N sales not yet synced — connect to wifi and try again" if anything remains.
- **Kiosk `resetAll()` didn't release outstanding sticker holds** when a session ended without reaching "Get Ticket" — they sat depressing availability until the 15-minute TTL. Now released explicitly.
- **Kiosk drag-end didn't check print-area bounds for rotated placements**, only unrotated `clampCenterPct` (which clamps by center, correct only pre-rotation). A rotated sticker's true corners (the same oriented-rectangle math the overlap check already used) could sit outside the printable rectangle with no revert. Drag-end now reverts on out-of-bounds the same way it already reverted on overlap. Left open: rotating a *placed* sticker via its slider still checks neither overlap nor bounds live — logged in [[Known Issues]] rather than fixed here, since a slider needs a different UX for the revert than a drag does.

Confirmed correct and left alone: split-payment total validation, the 8-second undo toast, sticker fuzzy search (`14`/`m14`), no-scaling/overlap-blocked/stock-aware kiosk constraints, the 15-minute hold and 30-minute ticket TTLs, "nothing decrements until charge" (ticket creation never touches `stock_qty`), rate limiting at 5/15min, and RLS's five-table anon grant list.

Not fixed, logged in [[Known Issues]]: stock adjustments and PIN changes don't write `stall_admin_audit` (stock writes `stall_inventory_movements` instead — a real ledger, just a different one); customer retention purge (PRD §12, needs scheduled-job infra this repo doesn't have); and a note that every `/api/*` route's entire auth boundary is its own `verifySession` call, not exhaustively re-checked this pass.

## Eighth pass — the bug the audit's static reading couldn't see

Everything above was read, not run. This pass actually drove the app in a real Chromium browser (Playwright, headless) against the live database — login, shift open, add garment, add custom sticker, discount, admin PIN, charge, and the resulting order in the press queue — and found one bug no amount of reading the code would have surfaced.

**A second device joining an already-open shift got no receipt block, forever, with zero error shown.** `/shift-open` only runs when *no* shift is open at all; a device that logs into Sell while a shift someone else started is already running just gets `block: null` back from `/api/shift/current` and stays that way — nothing ever calls `/api/shift/open` for it. `charge()`'s `if (!shift || !block) return` (present since before today) then silently no-ops on every Charge tap. On an 8-device stall this is the second, third, fourth… device through the door. Fixed: Sell's boot now auto-joins — POSTs `/api/shift/open` with the *existing* shift's own settings when `block` comes back null, so a joining device never sees a form for a shift someone else already configured. A `blockJoinFailed` banner covers the case where even that fails, closing the silent-no-op path for good.

Fixing it live surfaced a second, sharper bug: the auto-join POST, called twice in quick succession (React StrictMode's dev-only double-effect reproduced it every time; two tabs on one physical device could hit the identical race in production), let two open receipt blocks exist for one device — the existing-block check and the insert weren't atomic. `stall_create_order`'s block-consuming `UPDATE ... RETURNING ... INTO` assumed exactly one match and threw `P0003` (`too_many_rows`, unmapped by the route, so every charge from that device failed with a bare 500) the moment two existed. **Migration 005** adds a partial unique index — `(shift_id, device_id) where closed_at is null`, the same pattern `stall_one_open_shift` already uses for shifts — and changes the block-consuming update to lock and pick one row explicitly rather than trust its own WHERE clause. `/api/shift/open` catches the resulting `23505` on the losing insert and re-selects the winner instead of surfacing a 500. Applied directly to the live database; a stray real order from 7 Aug (`smoke-device-1`, predates this session) was left alone, and this session's own test shifts, blocks, and orders were deleted and their stock movements reversed after each run.

With both fixed, the full loop was re-verified live: charge → order lands in the press queue as `PENDING PRESS` (confirming the seventh-pass fulfillment-status wiring actually reaches a real order, not just a static reading of the payload) → **MARK PRESSED** → **HANDED OVER** → order leaves the queue. All against the live database, not a mock.

**Responsive, on user request for a full-codebase pass.** A Playwright survey checked every page for horizontal overflow at its PRD-target width band — POS at 360/480, kiosk at 768/1024, admin at 1024/1280/1600 — and found none anywhere. The one real gap: kiosk's product/canvas/ticket stages render as a phone-width card (`max-w-md`) centered on the full tablet canvas, using well under half the width at 768px. Widened to `md:max-w-xl`/`lg:max-w-2xl` per stage and the sticker-browse grid to `md:grid-cols-6`, which fills noticeably more of the screen — logged in [[Known Issues]] as still not a real tablet layout (a picker/preview split), just a wider card.

## Verification

`tsc --noEmit` clean · `next build` clean · all pages still prerender as static (`/` and `/sell` replacing the old single `/`) · impeccable detector reports zero findings. Live-database verification, this session: `stall_create_order` rollback, rate-limit sequence and analytics output (earlier passes); migration 005 applied directly to `drvucogrjphctwfealxd`; the full Sell → press queue → Pressed → Handed Over loop driven end-to-end in a real headless browser against production data, order created and cleaned up afterward; every page's horizontal-overflow check across three width bands.

## Ninth pass — the last two code-only Known Issues

Closed both remaining items that were pure code (not blocked on external assets):

- **Stock-adjustment audit logging.** `/api/stock/product/[id]` and `/api/stock/sticker/[id]` already wrote a `stall_inventory_movements` row per edit; PRD §12 also asks for "stock adjustments above a threshold" in `stall_admin_audit` alongside price changes and discount overrides, which neither route did. Both now write a `stock_adjustment` audit row when `|delta| >= 10`, same threshold philosophy as the 10% discount gate.
- **Kiosk rotation slider bounds/overlap.** Dragging a placement was already checked against both on release; rotating one via its slider checked neither, live. Rotation now commits the same check dragging uses — on pointer-up, blur, and arrow-key release, not mid-drag (which would fight the user's gesture) — and reverts to the rotation the interaction started at if the end state overlaps a neighbour or leaves the printable area.

## Verification, ninth pass

`tsc --noEmit` clean · `next build` clean.

**Still not verified in a browser:** the colour sweep, the new QR on the kiosk ticket screen, the stale-catalogue banner, service-worker behaviour (disabled in dev by design, only exercises in a production deploy), void, returns, holds, waste, restock, B2B, bulk entry, and the admin pricing/catalogue screens' inline-edit interactions. The core sell → press → collect loop and routing are now real-browser-verified; the rest of the surface area is not.

## Related
[[Known Issues]] · [[Performance Backlog]] · [[Database Map]] · [[Frontend Audit 2026-08]]

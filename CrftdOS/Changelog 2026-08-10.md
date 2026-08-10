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

## Verification

`tsc --noEmit` clean · `next build` clean · all 17 pages still prerender as static · impeccable detector reports zero findings · `stall_create_order` rollback, rate-limit sequence and analytics output all asserted against the live database.

**Not verified in a browser — no dev server was run.** Specifically unviewed: the colour sweep, admin widening, the new QR on the kiosk ticket screen, the stale-catalogue banner, and service-worker behaviour (which is disabled in dev by design and so only exercises in a production deploy). Worth a pass before a real stall.

## Related
[[Known Issues]] · [[Performance Backlog]] · [[Database Map]] · [[Frontend Audit 2026-08]]

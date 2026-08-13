---
type: backlog
updated: 2026-08-13
---

# Known Issues

Part of [[crftd Stall OS]]. **Open items only.** Everything cleared on 10 Aug, including the press-queue and collections work, is in [[Changelog 2026-08-10]]. Items below dated 10 Aug or earlier describe the old `app/` build; `app-v2` is now the live app (see [[Architecture Overview]]) and several of these are resolved or no longer apply there — flagged inline.

## Open — code

A PRD audit on 10 Aug (see [[Changelog 2026-08-10]] "Seventh pass") fixed the load-bearing gaps it found, and an eighth pass the same day caught a live-traffic bug the audit's static reading couldn't see — a second device joining an already-open shift got no receipt block and could never charge, silently. What's left, in order of how much it matters:

1. **Kiosk secondary stages (product/canvas/ticket) are a phone-width card centered on a tablet-width canvas.** Eighth pass widened the max-width at `md:`/`lg:` so they use noticeably more of a 768–1024px screen, but they're still a centered panel, not a redesigned two-column tablet layout. A real fix is a layout pass (e.g. picker + live preview side by side), not a CSS width bump — this was the pragmatic version. Status against `app-v2` not re-verified in this pass.
2. **Customer retention purge — resolved 13 Aug.** `stall_purge_stale_customers()` (migration 041) is scheduled via `pg_cron`, daily. See [[HANDOFF - Backend Session]].
3. **`middleware.ts`'s only gate on every `/api/*` route is that handler's own `verifySession` call** — **no longer applicable.** As of 13 Aug there is no session gate anywhere in `app-v2`: PIN auth was removed outright (product decision, not an oversight) and replaced with a credential-free role toggle. `middleware.ts` now passes every route through unconditionally. See [[Auth and Sessions]]. The architectural note this item raised (audit every `api/**/route.ts` for a missing check) is moot — there's nothing to check for, by design.
4. **There's no PIN-change *feature*** — **moot as of 13 Aug**, PINs don't exist in `app-v2` at all. See [[Auth and Sessions]].

Closed in a ninth pass: stock adjustments ≥10 units now also write `stall_admin_audit` (`stock_adjustment`), alongside the existing per-delta `stall_inventory_movements` row — all four PRD §12 action categories with a real feature behind them now audit. Kiosk rotation now commits the same overlap/bounds check drag already had, on pointer-up, blur, or arrow-key release — a rotation that ends overlapping a neighbour or off the printable area reverts instead of silently sticking.

## Content to replace when the real numbers arrive (PRD §16)

Corrected 10 Aug: this section previously said these "block their phases," copied from the PRD's blank planning-template tables rather than checked against what's actually deployed. It doesn't block anything. Live-DB query today: all 32 active product SKUs have real pricing and a mockup image; all 12 active sticker designs have real pricing and print dimensions. The app runs a full sale end to end on this seed content right now — proven live in the eighth-pass browser test, not just asserted. What's actually true:

1. **Pricing is seed/placeholder, not AQUATERRA-approved final numbers.** `/admin/pricing` is where you replace it — inline-editable, no deploy needed, prices snapshot onto past orders so changing it never rewrites history.
2. **Tee mockups are the placeholder shown in the press-sheet screenshots** (a plain garment silhouette with "PLACEHOLDER MOCKUP" printed on it), not real product photos. Swappable per SKU whenever real photos exist.
3. **No verified Resend domain, so email delivery is off.** Not a broken feature: the receipt screen's EMAIL button already renders disabled with an explanatory tooltip rather than pretending to work (see [[Changelog 2026-08-10]]). WhatsApp (PRD's "primary path," proven live) and on-screen display are the two of three delivery paths that work today; email activates the moment a domain exists, no other code changes needed.
4. **Only 12 sticker designs are seeded**, not the eventual 200-design catalogue with real cutout PNGs — the kiosk and Sell screens both work correctly with 12, exactly as they will with 200.

Net: the software doesn't gate on any of this. Swapping seed content for real content is a normal `/admin` content-management task, the same category as updating stock counts — not a build blocker.

**Tooling to do that swap now exists** (10 Aug, tenth pass — see [[Changelog 2026-08-10]]): `/admin/catalogue` gained CSV bulk-import (upsert by code) and bulk cutout-PNG upload (matched to designs by filename) for the 200-design catalogue; `/admin/mockups` is a new page for uploading tee mockup photos and drawing the print-area rectangle per colour/fit/side; the admin dashboard shows live Resend domain-verification status instead of requiring a trip to Resend's own dashboard to check. None of this populates real business data on its own — the pricing, photos, and domain are still yours to supply — it's the on-ramp for supplying it without hand-editing the database.

## Watch list

Things that are correct now but will bite at volume or need a decision.

- **The Supabase project is shared** with 38 `paradox_*` tables from a different application. One pool, one maintenance window, nothing but a prefix keeping them apart. See [[Database Map]].
- **App-shell precache lists routes by hand** in `public/sw.js`. A new volunteer route must be added there or it will not work offline.
- **`Field` labels are `aria-label`, not visible `<label>`s.** Programmatically correct; whether each screen *should* show a visible label is a per-screen design decision nobody has made yet.
- **The kiosk QR grows with cart size.** Compressed and short-keyed, comfortable for a realistic order, but a very large cart on a scratched screen in daylight is the failure mode to watch. The 4-character code remains the fallback.

## Related
[[Changelog 2026-08-10]] · [[Frontend Audit 2026-08]] · [[Database Map]] · [[Offline and Sync]]

---
type: backlog
updated: 2026-08-10
---

# Known Issues

Part of [[crftd Stall OS]]. **Open items only.** Everything cleared on 10 Aug, including the press-queue and collections work, is in [[Changelog 2026-08-10]].

## Open — code

A PRD audit on 10 Aug (see [[Changelog 2026-08-10]] "Seventh pass") fixed the load-bearing gaps it found, and an eighth pass the same day caught a live-traffic bug the audit's static reading couldn't see — a second device joining an already-open shift got no receipt block and could never charge, silently. What's left, in order of how much it matters:

1. **Kiosk secondary stages (product/canvas/ticket) are a phone-width card centered on a tablet-width canvas.** Eighth pass widened the max-width at `md:`/`lg:` so they use noticeably more of a 768–1024px screen, but they're still a centered panel, not a redesigned two-column tablet layout. A real fix is a layout pass (e.g. picker + live preview side by side), not a CSS width bump — this was the pragmatic version.
2. **Stock adjustments and PIN changes don't write `stall_admin_audit`.** Discount overrides now do. Stock edits write `stall_inventory_movements` instead, which has `actor`/`reason`/`note` and is arguably the more correct ledger for a stock delta — but it means "stock adjustments above a threshold" per PRD §12 isn't in the same audit trail as price/discount actions, and there's no "above a threshold" distinction, everything logs. There's also no PIN-change *feature* built yet (PINs are only set at seed time), so that category has nothing to audit.
3. **Kiosk rotation slider doesn't re-check overlap or print-area bounds.** Dragging is checked against both; rotating a placed sticker via the slider checks neither, live, as the user drags it. A rotation could end a sticker overlapping its neighbour or off the printable area with no revert.
4. **Customer retention purge (PRD §12: "purge customers with no order in 24 months") is unbuilt.** No cron/scheduled-job infrastructure exists in this repo to hang it off yet.
5. **`middleware.ts`'s only gate on every `/api/*` route is that handler's own `verifySession` call** — a handler that forgot it would be a fully open door via the service-role client, which bypasses RLS entirely. Not a bug found, an architectural note: worth a pass that greps every `api/**/route.ts` for a missing session check, not done as part of this audit.

## Open — product inputs (PRD §16)

Not code problems. These block their phases and only you can supply them.

1. **Filled pricing tables, including sticker print sizes in cm.** Now doubly blocking: the kiosk hides any design without `print_w_cm`/`print_h_cm`, so with the current seed data the canvas catalogue is largely empty by design.
2. **Tee mockups and print-area measurements** — front and back per colour and fit.
3. **A verified domain for Resend**, or email is dropped and it is WhatsApp-only.
4. **The 200 cutout PNGs** with transparency, plus the CSV.

## Watch list

Things that are correct now but will bite at volume or need a decision.

- **The Supabase project is shared** with 38 `paradox_*` tables from a different application. One pool, one maintenance window, nothing but a prefix keeping them apart. See [[Database Map]].
- **App-shell precache lists routes by hand** in `public/sw.js`. A new volunteer route must be added there or it will not work offline.
- **`Field` labels are `aria-label`, not visible `<label>`s.** Programmatically correct; whether each screen *should* show a visible label is a per-screen design decision nobody has made yet.
- **The kiosk QR grows with cart size.** Compressed and short-keyed, comfortable for a realistic order, but a very large cart on a scratched screen in daylight is the failure mode to watch. The 4-character code remains the fallback.

## Related
[[Changelog 2026-08-10]] · [[Frontend Audit 2026-08]] · [[Database Map]] · [[Offline and Sync]]

---
type: backlog
updated: 2026-08-10
---

# Known Issues

Part of [[crftd Stall OS]]. **Open items only.** Everything cleared on 10 Aug is in [[Changelog 2026-08-10]].

## Open — code

### Press queue has no state transitions
PRD §3.2 requires one-tap **Pressed** and **Handed Over** on the pending queue. `PressQueue` now shows the composite sheet, the placement list and a live wait timer, but there are no controls and no route behind them — `stall_orders.pressed_at` and `collected_at` exist and are never written after creation. The collect-later **Collections tab grouped by date** from the same section is also missing.

### Responsive is still barely engaged
7 breakpoint utilities across 17 pages. Admin was widened and the pricing tables wrapped, but no page has been designed at more than one width. Not a defect anywhere specific — a gap that will keep producing them.

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
- **PWA icon is a single SVG.** Installable, but PNG icons at 192/512 would give a better install prompt on Android. No image converter was available.

## Related
[[Changelog 2026-08-10]] · [[Frontend Audit 2026-08]] · [[Database Map]] · [[Offline and Sync]]

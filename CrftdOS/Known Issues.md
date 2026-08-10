---
type: backlog
updated: 2026-08-10
---

# Known Issues

Part of [[crftd Stall OS]]. **Open items only.** Everything cleared on 10 Aug, including the press-queue and collections work, is in [[Changelog 2026-08-10]].

## Open — code

None. The responsive pass and the home-page/routing restructure that were the last open code items are both in [[Changelog 2026-08-10]].

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

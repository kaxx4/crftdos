---
type: note
updated: 2026-08-11
status: built and browser-verified against the mock backend
---

# Rework — Build Log, 11 Aug 2026

Execution record for [[Rework - Fresh Plan 2026-08-11]]. Part of [[crftd Stall OS]].

> **Read this first if you're looking at the reference docs.** [[Frontend Map]], [[Flow - Sell]], [[Flow - Kiosk Design]], [[Design System]] and [[Architecture Overview]] all describe **`app/`**, the v1 build. This rework is a from-scratch rebuild in **`app-v2/`**, and both trees exist side by side. `app/` is untouched and still runs. Nothing has been swapped; that is a deliberate, separate decision.

## What was decided, and by whom

The user directed a **true from-scratch rebuild** — every screen, every route handler, all client logic re-derived — against my recommendation of the narrower "fresh UI, keep the verified money logic" option. The stated risk of the wider choice was recorded before starting: re-typing the outbox or receipt-block consumption from memory is the one avoidable way to lose real money at a stall ([[Rework - Master Plan]] says so explicitly).

**Mitigation applied without being asked:** the fulfilment-critical and money-path logic was re-derived *reading the v1 source as a reference document*, not from memory. That keeps it a genuine from-scratch rebuild while making it impossible to silently drop a stock guard, an idempotency key, or a reentrancy guard. The four canvas invariants and the outbox semantics are carried forward deliberately and are commented as such in the new files.

Three product decisions were taken on the day and are recorded in [[Backend Requirements - Rework 2026-08]]:

1. **Stock is allocated per environment**, not shared. This was the one answer that broke the "purely additive" property of the backend plan, and it became migration 009 — a stock-location model, not a column.
2. **A kiosk order does not decrement stock.** Holds keep doing their job; stock moves at prep.
3. **UPI is a per-order dynamic deep link** with the amount embedded and the order code as the transaction note. No QR upload, automatic reconciliation.

## Architecture — the one thing worth knowing

Everything talks to a **backend seam** (`src/lib/backend/contract.ts`) and nothing else. Two implementations:

- `mock/` — in-memory + localStorage, used today. Deterministic seed matching the live cardinality (12 designs, 32 SKUs, 2 colours, 3 fits).
- `live/` — not written yet. Lands when the migrations do.

The mock is a genuine implementation, not a stub. It enforces the same invariants the live database enforces — stock floor guards that refuse rather than going negative, whole-order rollback on any out-of-stock line, environment-scoped availability, hold reservation, idempotency on the client-supplied order id, receipt numbers consumed from a per-device block. That is deliberate: **a UI built against a permissive fake is a UI with no error states.**

Cross-tab `storage` events drive the mock's realtime, so the POS board genuinely updates when the kiosk writes an order in another tab. The behaviour that needs designing for is real during development, not deferred until Supabase Realtime exists.

Swapping to live is a factory function (`src/lib/backend/index.ts`), not a rewrite of call sites.

## What was built

| Surface | Routes | Notes |
|---|---|---|
| Kiosk | `/` | One route, internal stage machine: storefront → canvas → order → done |
| POS | `/pos`, `/pos/sell`, `/pos/orders`, `/pos/stock`, `/pos/more` | Board is the landing screen |
| Admin | `/admin` + analytics, environments, stock, templates, catalogue | Desktop-first sidebar console |
| Settings | `/settings` | Same page on every surface |

**The kiosk is one route on purpose.** The canvas holds live stock reservations, and a route change would unmount the hook that owns them — orphaning holds on real stock for thirty minutes while a queue waits. Composition state and hold lifetime have to share a lifetime.

**Genuinely new:** the storefront (merchandised templates, "most popular", start-blank), the order step with name/phone/payment, the prep→print→handover board, environments + the binding chip, per-environment stock allocation, and the kiosk interaction analytics stream.

**Reframed:** "Sell" is no longer the main screen. The board is. Walk-up sales are a tab, and land in the same queue as kiosk tickets.

## Known Issues addressed

- **#1, the kiosk tablet layout.** The old build put a phone-width card on a tablet canvas; the pragmatic fix was a max-width bump and the real fix was named as a layout pass. Done: two-column at ≥1024, and on portrait tablet the canvas is **height-driven** so the transfer rail stays on screen instead of being pushed below the fold by a width-driven 4:5 preview.
- **Audit P1, admin at mobile widths.** Real sidebar console; wide tables scroll inside their own container so the page body never scrolls sideways.
- **Audit P2, no focus styling.** Global `:focus-visible`, never removed.
- **Audit P2, banners not announced.** `role="alert"` / `role="status"` by tone.
- **Audit P2, unlabelled inputs.** `Field` renders a visible `<label>`, not `aria-label`.
- **Audit P3, disabled at 40% opacity.** Now 60% — a greyed control a volunteer cannot read is indistinguishable from a bug.
- **Motion.** The approved prototype defined 8 keyframes; v1 shipped 0. v2 ships 8 with a reduced-motion blanket kill, `.animate-spin` the sole exception.
- **Outbox dead-letter.** v1 retried a permanently-rejected order forever with no UI to inspect or discard it — and shift close blocks on the outbox, so "no way to discard" meant "cannot close the shift". v2 caps retries and exposes a discard.

## Verification

`tsc --noEmit` clean. `next build` clean, 15 routes prerendered.

**End-to-end in a real browser (Chromium, headless), 26 assertions, all passing:**

unbound device blocks with an explanation → bind to Stall A → storefront renders merchandised templates → open *Tide Line* → 2 placements load onto the canvas → **a third 12cm transfer is refused with an explanation, because two already fill a 30×40cm print area** → the same transfer places successfully on the empty back → blank order form is refused with per-field reasons → UPI QR generated with the amount embedded → order placed → ticket shown and personalised → **ticket appears in the POS prep queue with the correct total (₹996) and a nudge naming each transfer and its bin** → prepped → printed → handed over → leaves the board → admin shows *Raised for AquaTerra* attributed to Stall A → interaction analytics recorded the session → stock allocation matrix renders → POS stock is scoped to the stall.

No console errors, no page errors.

**Responsive sweep**, 14 route/viewport combinations at 360, 768, 1280, 1440:

| Metric | Result |
|---|---|
| Horizontal page overflow | **0** |
| Text under 12px | **0** |
| Touch targets under 44px, kiosk + POS | **0** |
| Touch targets under 44px, admin | 12 — see below |

The admin exceptions are `size="sm"` buttons at 40px on a 1440px mouse-driven console. **Deliberate and documented in the component**: the 48px floor exists because a volunteer is thumbing a phone in sunlight with a queue waiting, and that reasoning does not transfer to a mouse. `sm` is now admin-only, and every kiosk/POS use of it was removed rather than leaving the comment lying.

### Measured against the baseline

The v1 baseline is from [[Frontend Audit 2026-08]] and [[Rework - Master Plan]]. Note these are different codebases, so this is a comparison of outcomes, not a diff.

| Metric | v1 baseline | v1 after waves 1–4 | v2 |
|---|---|---|---|
| Largest file | 1,222 | 379 | **812** (the mock backend, which is scaffolding) |
| Largest *UI* file | 1,222 | 379 | **378** |
| Components | 6 | 30 | **29** |
| `@keyframes` | 0 | 5 | **8** |
| `:active` press feedback | 0 | 8 | **16** |
| Text under 12px | 32 | 0 | **0** |
| Touch targets under 44px, kiosk + POS | 0 | 0 | **0** |
| Horizontal overflow, all routes | 0 | 0 | **0** |
| Total lines | 8,444 | 10,689 | **7,099** |

The 812-line file is `mock/index.ts` — a stand-in for a database, not a component, and it disappears when the live backend lands. Worth watching rather than fixing now.

### Bugs found and fixed during verification

- Seed templates referenced size/number combinations that don't exist (numbering is independent per size class, so `M-004` existing does not imply `S-004` does). It surfaced as a build-time crash. The lookup now throws with a message naming the template and the missing code, rather than emitting a placement with an undefined id that would only appear as a blank canvas.
- React #418 hydration mismatch from rendering `getDeviceId()` — it returns `"server"` during prerender and a real id after hydration. Now behind a `useDeviceId` hook that returns null until mounted.
- Design-rail filter chips compressed instead of scrolling, truncating every tag to three letters.

## Not built, and honestly so

- **The live backend.** By design — Phase 0 says this track produces the requirements doc, it does not execute it.
- **No route handlers exist yet.** v2 talks to the seam; the mock runs in the browser. When Supabase access lands, the `live/` implementation and its `/api/*` handlers are the next piece of work, re-derived against [[API Routes]] and the v1 source.
- **No PWA / service worker / catalogue cache.** v1 has all three ([[Offline and Sync]]). The outbox is carried forward; the offline shell is not, and must be before any real stall use.
- **No PIN gating or middleware.** v1's three-PIN model ([[Auth and Sessions]]) is not in v2 yet. Every surface is currently open.
- **Returns, waste, holds, B2B, bulk, pricing editor, receipt screen, press sheet.** Not rebuilt. All exist in v1.

That last group is the real scope gap: v2 is a complete, verified implementation of the **new** flows in the Fresh Plan, not yet a replacement for everything v1 does.

## Related
[[Rework - Fresh Plan 2026-08-11]] · [[Backend Requirements - Rework 2026-08]] · [[Rework - Master Plan]] · [[Known Issues]] · [[Frontend Audit 2026-08]]

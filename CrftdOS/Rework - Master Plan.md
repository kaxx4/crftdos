---
type: plan
updated: 2026-08-11
status: in progress
---

# Frontend Rework — Master Plan

Ground-up flow, design and UX rework of [[crftd Stall OS]]. Part of the [[crftd Stall OS]] index.

## The brief

Verbatim goals: *make it faster, technically sound, design it better, and make flows/features intuitive — "I should know what's happening where"* — while staying aligned to the PRD.

**Hard constraint: no backend changes.** The database, its functions, and everything under `app/src/app/api/` stay exactly as they are. This is a client-side rework consuming the existing contracts. That constraint is load-bearing: the backend was hardened and verified against the live database earlier (see [[Changelog 2026-08-10]]), and re-opening it would put working, tested behaviour at risk for no design gain.

## Why this is needed — the measured case

### 1. The build has drifted from the approved design

There is an executed HTML prototype in `_import/interactive-flow-build-for-web-mobile-desktop/`. Its README states it is a handoff bundle the client mocked up and exported *specifically* so a coding agent would rebuild it faithfully. The shipped app did not.

| | Prototype | Shipped |
|---|---|---|
| `@keyframes` | **8** | **0** |
| `animation:` declarations | **10** | 1 |
| `border-radius` declarations | **13** | 1 |
| `:active` feedback | `scale(.97)` on every button | **none** |
| Button transition | `transform .12s, background .14s, color .14s` | 1 `transition-colors` total |

The prototype defines a whole motion vocabulary — `stallPulse`, `stallRise`, `stallDrift`, `stallPop`, `stallWiggle`, `stallSlideIn`, `stallStamp`, `stallBand` — and *rounded* geometry. The build shipped sharp corners and a dead surface. This is what "needs a really dynamic reverb" means, and it is not a matter of taste: it is a documented divergence from the approved visual world.

> Caveat carried into the work: the prototype is not automatically right. It was drawn without a queue, sunlight, or a 6" phone in the frame. Where restraint is genuinely better for the Operate surface, the specs must defend keeping it rather than cargo-culting the mock. That judgement is explicitly delegated in each brief.

### 2. Two files are a quarter of the codebase

| File | Lines | Holds |
|---|---|---|
| `app/src/app/sell/page.tsx` | **1,222** | cart, garment picker, sticker search, custom stickers, discount + PIN step-up, payment + split validation, customer sheet, ticket redemption (typed + QR), outbox, catalogue cache, undo |
| `app/src/app/page.tsx` (kiosk) | **1,017** | 5-stage machine, SAT overlap detection, pointer drag, hold reservation, QR generation |

2,239 of 8,444 lines in two components, against **6 components total**. The practical cost showed up in this session: those files were edited five or six times for unrelated reasons and every edit risked colliding with the others, because everything shares one scope.

### 3. The app does not explain itself

No progress indication through the kiosk's five stages. No sense of sequence on the sell screen. Empty states that state a fact and teach nothing. Copy written for the codebase rather than the reader — a menu labelled "Phase 3" and "partial", an error reading *"RLS correctly blocked this direct write."* The people using this are often 16, handed a phone minutes before doors open.

## Decisions taken (11 Aug 2026)

Four questions could not be resolved from the artefacts. All four are now settled.

| # | Question | Decision |
|---|---|---|
| 1 | Route map: build has kiosk at `/`, PRD §2 says `/` is Sell | **Keep kiosk at `/`. Amend the PRD to match.** The kiosk is the only surface an unauthenticated visitor should land on. `sw.js` SHELL_ROUTES, TabBar hrefs and middleware redirects must all agree. |
| 2 | Geometry: modest rounding vs the v3 pill direction | **Modest rounding on both surfaces. No pills.** Adopt the primary POS prototype's 6–16px scale; the `999px` pill geometry in `Kiosk v3` / `Taste Engine v2` is killed. `--radius-pill` stays defined but unreferenced. |
| 3 | Wordmark: `crftd` / `CRFTD★` / `CRFTO` | **`CRFTD` with the star, as shipped.** The prototypes' `CRFTO` is treated as a typo. Kiosk hero, receipt, PWA icon and summary card must all match this. |
| 4 | Risk appetite on the working sale path | **True from-scratch rebuild of all UI.** See the note below on how this is executed without re-deriving verified money logic. |

### How decision 4 is executed safely

A from-scratch *UI* rebuild does not have to mean re-deriving *behaviour*. The offline outbox, receipt-block consumption, stock guards and ticket redemption are business logic that currently happens to live inside UI files — they are not presentation.

So the order is: **extract the verified logic into hooks and `lib/` first, then rebuild every presentation layer from scratch on top of it.** That delivers a genuine from-scratch UI while keeping the behaviour that was tested against the live database (see [[Changelog 2026-08-10]]). Re-typing the outbox or the receipt-block consumption from memory would be the one avoidable way to lose real money at a stall.

The end-to-end browser flow — kiosk → ticket → till → atomic charge → press sheet — is the gate after every wave. It is already proven to pass.

## Workstreams

Five specialists produced specs in parallel. Each is read-only and owns one deliverable file, so there are no write conflicts.

| # | Workstream | Skill | Deliverable |
|---|---|---|---|
| A | IA, wayfinding, per-flow step model | `agency-agents:design-ux-architect` | [[Rework - UX Architecture]] |
| B | Design system + motion reconciliation | `emil-design-eng`, `make-interfaces-feel-better`, `interface-details` | [[Rework - Design System and Motion]] |
| C | UX copy inventory and rewrite | `design:ux-copy` | [[Rework - UX Copy]] |
| D | Component decomposition | `agency-agents:engineering-frontend-developer` | [[Rework - Component Architecture]] |
| E | Visual direction | `frontend-design` | [[Rework - Visual Direction]] |

A final `/impeccable` audit pass validates the result against the same scoring used in [[Frontend Audit 2026-08]] (which scored **10/20**).

## Execution waves

Sequenced so each wave leaves the app building and demonstrable. File ownership is disjoint within a wave.

**Wave 1 — foundation (no visible change).**
Tokens: radius, duration, easing scales into `globals.css`. Motion primitives. No component consumes them yet. Gate: `tsc`, `next build`, visual diff = none.

**Wave 2 — decomposition (no visible change).**
Extract hooks and components from the two monoliths, in the order set by workstream D, each step individually verifiable. Gate: `tsc`, `next build`, plus the end-to-end browser flow (kiosk → ticket → till → charge → press sheet) which is already proven to work and must keep working.

**Wave 3 — feel and visual.**
Apply the motion vocabulary and visual specs surface by surface. Kiosk first (highest leverage, lowest risk — it is customer-facing and has no money path), then POS.

**Wave 4 — copy and comprehension.**
Apply the copy rewrite. Add wayfinding, progress indication, and the self-explaining cues.

**Wave 5 — verify.**
`/impeccable audit` re-score, live browser sweep at 360 / 768 / 1440, and a re-run of the full sale flow.

## Progress

**Wave 1 — foundation. Done.**
Radius / duration / easing tokens in `globals.css`, POS and kiosk scales deliberately separate. Four keyframes (`pos-enter`, `kiosk-tile-enter`, `kiosk-place`, `kiosk-rule-wipe`). Reduced-motion blanket kill with `.animate-spin` as the sole exception. Primitives rebuilt: `BigButton`/`Chip` gain `active:scale-[0.97]` and radius, `Field` a 120ms focus settle, `TabBar` a colour settle. `overscroll-behavior: none` promoted to the root.

**Wave 2 — decomposition. Kiosk done, Sell in progress.**
`app/src/app/page.tsx` is now a one-line re-export; the kiosk lives in 18 files under `src/features/kiosk/`. All four fulfilment-critical invariants verified intact after the rebuild: SAT rotated-rect overlap, true-scale `pxPerCm` rendering, `clampCenterPct` bounds, and null-print-dimension filtering. The window-listener leak was fixed first, as planned, so the extraction did not carry it forward.

**Fixed along the way, outside the wave plan:**
- Internal engineering notes were reaching customers — a PRD citation printed on receipts, an `EMAIL (PHASE 4)` button, and a build note baked into the shift-summary PNG shared to WhatsApp every close.
- Press / handover / collect all did `if (res.ok)` with no `else`. A failed tap was indistinguishable from no tap on patchy stall data. Now one handler with error and busy states.

## Result — measured after Waves 1–4

| Metric | Before | After |
|---|---|---|
| Largest file | 1,222 lines | **379** |
| Components | 6 | **30** |
| `@keyframes` | 0 | **5** |
| `:active` press feedback | 0 | **8** |
| Radius declarations | 1 | **9** |
| Text under 12px | 32 | **0** |
| `focus-visible` treatments | 17 | 17 (held) |
| `:hover` styles | 1 | **0** (correct — touch-only surface) |
| Horizontal / vertical overflow, all routes | 0 | **0** (held) |
| Touch targets under 44px | 0 | **0** (held) |
| Detector findings | 0 | **0** (held) |

`sell/page.tsx` and the kiosk `page.tsx` are now one-line re-exports over `src/features/sell/` (24 modules) and `src/features/kiosk/` (18 modules).

### End-to-end verified in a real browser after the rebuild

kiosk → canvas (₹499 → ₹648, two stickers, overlap relocation working) → ticket `WLW7` with a 512px QR → till redemption → **duplicate-load guard held** (₹648 both times, message shown) → charge → receipt `CR/26-27/000202` → press sheet rendered at 800px with placements `S-002 @ 50%/50%`, `S-004 @ 50%/25%`.

The receipt also confirmed the leak fixes live: it reads `TERRAROOTS FOUNDATION`, not the old `LEGAL NAME PENDING (PRD §16.5)`.

### Regressions the rebuild introduced, caught and fixed

- Kiosk shipped faint text: `text-cream/40` on ink (~3.4:1) on the *staff passcode* link, and an 11px `/60` ticker.
- `/restock` had ten controls under 44px — tabs at 36px, RESTOCK buttons at 81×34.
- The kiosk marquee keyframe was inlined in a `<style>` tag in the body (the agent could not touch `globals.css`); moved into the motion vocabulary with the others.

### Two probe false positives, verified not real

- 64px display type at 3.13:1 — **passes**, the large-text threshold is 3:1, not 4.5:1.
- `/help` checkboxes measure 24px, but each sits inside a **319×44** `<label>`, so the actual tap target is compliant.

## Baseline to beat

Captured before any rework, so improvement is measurable rather than asserted.

| Metric | Baseline |
|---|---|
| Audit score ([[Frontend Audit 2026-08]]) | 10/20 |
| Largest file | 1,222 lines |
| Components | 6 |
| `@keyframes` | 0 |
| `:active` feedback | 0 |
| Radius declarations | 1 |
| Responsive breakpoint utilities | 27 |
| `focus-visible` treatments | 17 |
| Contrast failures (<4.5:1), measured live on /sell | 0 |
| Touch targets under 44px, all volunteer routes | 0 |
| Horizontal overflow, all volunteer routes | 0 |

The last three are already good and are **regression guards**, not targets — the rework must not lose them.

## Related
[[crftd Stall OS]] · [[Frontend Audit 2026-08]] · [[Known Issues]] · [[Design System]] · [[User Flows]]

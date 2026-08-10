---
type: audit
updated: 2026-08-10
command: /impeccable audit
scope: app/src — 17 pages, 3 components, globals.css
---

# Frontend Audit — August 2026

Part of [[crftd Stall OS]]. Technical quality audit. Report only; no fixes applied.

## Audit Health Score

| # | Dimension | Score | Key Finding |
|---|---|---|---|
| 1 | Accessibility | **2**/4 | No heading structure below `h1`; zero focus styling; Sell-screen inputs unlabelled |
| 2 | Performance | **2**/4 | Lean bundle, but boot waterfall + no catalogue cache + no PWA |
| 3 | Theming | **2**/4 | Real token system, then 55 off-token `neutral-*` usages around it |
| 4 | Responsive | **1**/4 | 7 breakpoint utilities app-wide; admin capped at 768px against a 1280+ spec |
| 5 | Implementation Integrity | **3**/4 | Detector clean; unmistakably product-specific system |
| **Total** | | **10/20** | **Acceptable — significant work needed** |

## Implementation Integrity Verdict — **PASS**

The bundled detector returns zero findings across `globals.css`, `page.tsx`, `ui.tsx` and `kiosk/page.tsx`. That is not the usual result.

More importantly, this codebase could not be swapped onto another product. The crop-mark motif is implemented twice (a CSS pseudo-element utility and a `CropCorner` component) because it is used in two structural contexts. Fraunces is deliberately scoped to the kiosk subtree so the restrained volunteer skin cannot inherit it. The design tokens carry a comment explaining that they come from the executed `.dc.html` prototype and **supersede the PRD table where they conflict**. Two font-licensing decisions are recorded in code with reasoning. The `.kiosk-slider` rule exists because a 16 px range thumb is ungrabbable on a touchscreen.

This is a system with a point of view, and the comments explain *why* rather than *what*. The deductions below are drift around a coherent core, not absence of one.

---

## Executive Summary

- **Score: 10/20** (Acceptable)
- **Issues: 3 P1 · 6 P2 · 4 P3** *(no P0 — nothing blocks task completion)*
- **Top 4:**
  1. Admin is built at mobile widths against a desktop-first spec (P1)
  2. No heading structure — every page is one `h1` and nothing else (P1)
  3. 46 type sizes below 14 px against a 16 px minimum (P1)
  4. 55 off-token `neutral-*` colours orbiting a real token system (P2)

---

## Detailed Findings

### [P1] Admin surface is built at mobile widths
**Location** `admin/page.tsx:27` `max-w-3xl` · `admin/pricing/page.tsx:50` `max-w-3xl` · `admin/b2b/page.tsx:90` `max-w-4xl` · `admin/bulk/page.tsx:41` `max-w-xl`
**Category** Responsive
**Impact** PRD §11 is explicit: *"The admin dashboard is desktop-first; nobody reads analytics on a phone,"* target 1280+. Every admin page is a centred column capped between 576 px and 896 px. On a 1920 px monitor the pricing matrix — a 6-size × 6-row grid of editable cells — is compressed into 768 px while two-thirds of the screen sits empty. This is the surface where someone sets every price in the business.
**Recommendation** Widen admin containers, give the pricing matrix the full viewport, and add real breakpoints rather than a single `max-w`.
**Command** `/impeccable adapt`

### [P1] No heading structure below `h1`
**Location** `PosFrame.tsx:26` is the **only** heading element in the entire application
**Category** Accessibility · WCAG 2.4.6, 1.3.1
**Impact** 17 pages, one `h1` each, zero `h2`/`h3`. Panel titles render as `PanelLabel` — a `div` at 10 px. A screen reader user cannot navigate the Sell screen by heading, and the document outline conveys none of the structure the visual design clearly has.
**Recommendation** Make `PanelLabel` render a real heading (`as` prop defaulting to `h2`), preserving current styling.
**Command** `/impeccable harden`

### [P1] Type routinely below the specified minimum
**Location** App-wide: 20× `text-[11px]`, 17× `text-[10px]`, 9× `text-[9px]` — against exactly one `text-[16px]`
**Category** Accessibility
**Impact** PRD §11 sets a 16 px body floor *because these screens are used in direct sunlight*. Labels can legitimately sit below body size, but 9 px at `tracking-[0.2em]` and `opacity-75` on the header kicker is not a label choice, it is unreadable outdoors. The `Mono` component — used for stock notes and bin locations, the information that sends a volunteer to the right box — is 11 px.
**Recommendation** Raise `Mono` to 13–14 px, the kicker to 11 px at full opacity, and audit the 9 px tier out entirely.
**Command** `/impeccable typeset`

### [P2] No focus styling anywhere
**Location** No `focus:`, `focus-visible:`, or `outline` declaration exists in `src/`
**Category** Accessibility · WCAG 2.4.7
**Impact** Mitigated — nothing sets `outline: none`, so UA default rings survive. But on `bg-ink` (`#0f0f10`) controls inside the `bg-ink` TabBar, the default ring has almost nothing to contrast against. Low stakes on a touch till; real on the keyboard-driven admin surface.
**Recommendation** One `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue` in `BigButton`, `Chip`, `Field`.
**Command** `/impeccable harden`

### [P2] 55 off-token colours around a real token system
**Location** `text-neutral-500` ×21, `text-neutral-600` ×19, `text-neutral-400` ×5, plus `border-neutral-{200,300,400}`, `bg-neutral-{200,300}`, and one each of `bg-green-200` / `bg-amber-200`
**Category** Theming
**Impact** `globals.css` defines `--color-line: #333333` and it is used almost nowhere; Tailwind's default neutral ramp is used instead. The two Tailwind status colours are the only greens and ambers in the product and belong to no documented palette. A future palette change updates the tokens and misses fifty-five places.
**Recommendation** Add `--color-muted` / `--color-hairline` / `--color-ok` / `--color-warn` tokens and sweep.
**Command** `/impeccable colorize`

### [P2] Summary-card canvas re-hardcodes the palette
**Location** `orders/page.tsx:91–151` — `#F7F5F1`, `#0F0F10`, `#1B4DF5`, and `#777`
**Category** Theming
**Impact** Canvas cannot read CSS custom properties, so literals are unavoidable — but they are duplicated by hand rather than sourced from one exported constant, and `#777` corresponds to no token at all. This image is the shift summary card that goes into the team WhatsApp group; it is the most widely-seen artefact the app produces, and it will silently drift from the UI palette.
**Recommendation** Export a `TOKENS` object from a shared module; import in both CSS generation and canvas.
**Command** `/impeccable extract`

### [P2] Banners are not announced
**Location** `ui.tsx:83` — `Banner` renders a plain `div`
**Category** Accessibility · WCAG 4.1.3
**Impact** Banners carry sync state and errors — *"3 sales not yet synced"* is safety-critical per PRD §10. Content changing in a plain div is silent to assistive tech.
**Recommendation** `role="status"` for `tone="blue"`, `role="alert"` for `tone="signal"`.
**Command** `/impeccable harden`

### [P2] Pricing tables can force horizontal page scroll
**Location** `admin/pricing/page.tsx:74, 108` — two `<table className="w-full">` with no overflow wrapper
**Category** Responsive
**Impact** Seven-plus columns of editable numeric inputs inside `max-w-3xl`. Below that width the page scrolls horizontally rather than the table.
**Recommendation** Wrap each in `<div className="overflow-x-auto">`.
**Command** `/impeccable adapt`

### [P2] Unlabelled inputs on the most-used screen
**Location** `ui.tsx:27` `Field` renders a bare `<input>`; `<label>` appears only in `shift-open` and `returns`
**Category** Accessibility · WCAG 3.3.2
**Impact** The Sell screen's discount, cash, UPI, ticket-code and custom-sticker inputs have visible text nearby but no programmatic association.
**Recommendation** Give `Field` a required `label` prop rendering a bound `<label>`, visually hidden where the design does not want it.
**Command** `/impeccable harden`

### [P2] Kiosk mockup image is neither lazy nor optimised
**Location** `kiosk/page.tsx:634` — raw `<img alt="mockup">`, no `loading`, no dimensions
**Category** Performance · Accessibility
**Impact** The canvas base image is the largest asset on the kiosk and loads eagerly and unoptimised. `alt="mockup"` describes nothing. (The sticker grid at `:707` *does* set `loading="lazy"` with explicit dimensions — that one is right.)
**Recommendation** `next/image` with explicit sizes; alt describing the garment.
**Command** `/impeccable optimize`

### [P3] Touch-target floor is inconsistent
`.tap-target` = 48 px and PRD §11 says 48 px, but `TabBar` uses `min-h-[44px]` and `Chip` uses `min-h-[44px]`, while `Field` uses 48 and `BigButton` 52. Four different floors. — `/impeccable polish`

### [P3] Kiosk portrait lock is not implemented
PRD §11 specifies portrait-locked tablet. No `screen.orientation` lock, no orientation media query, no manifest `orientation` field (there is no manifest at all — see [[Offline and Sync]]). A customer rotating the tablet gets an untested landscape layout. — `/impeccable adapt`

### [P3] Disabled controls drop to 40% opacity
`BigButton` `disabled:opacity-40`. WCAG exempts disabled controls, but the disabled **Charge** button at 40 % on cream in direct sunlight is effectively invisible — and "is Charge available?" is the single most important question on the screen. — `/impeccable polish`

### [P3] Selected-garment state is a 10% tint
`page.tsx:562` `bg-blue/10` marks which garment stickers attach to. Outdoors that is nearly invisible. Saved from a WCAG 1.4.1 failure only by the `" · adding stickers here"` text, which is itself 11 px `neutral-600`. Mis-assigning a sticker means pressing the wrong shirt. — `/impeccable bolder`

---

## Patterns & Systemic Issues

1. **Responsive design was never really engaged.** Seven breakpoint utilities across seventeen pages, and no media query in `globals.css` except reduced-motion. The app was built at one width and the other two viewport bands in the spec were left to `max-w` and hope.
2. **The token system stops at colour-of-the-brand.** Brand colours are tokenised and disciplined; every *supporting* colour — greys, hairlines, status tints — fell back to Tailwind defaults. The system covers the fun 20 % and not the structural 80 %.
3. **Accessibility was done as a sweep, not as an API.** Commit `bd9eba0` fixed real things and the individual instances are good (correct `role="button"` with keyboard handler, `aria-pressed`, considered reduced-motion). But the *primitives* don't enforce anything — `Field` can be built without a label, `PanelLabel` can't be a heading. The next component added will reintroduce the same gaps.
4. **Small type is systemic, not incidental.** 46 declarations under 14 px versus one at 16 px, in a product whose spec names sunlight as a design constraint.

## Positive Findings

- **Detector: zero findings.** No generic AI-design tells anywhere.
- **`role="button"` done properly** — `tabIndex={0}`, Enter *and* Space, `preventDefault()`. Most hand-rolled ones get this wrong.
- **`prefers-reduced-motion` is thoughtful, not blunt.** It slows `.animate-spin` to 3 s rather than killing it — the "working" signal survives, the vestibular trigger doesn't. This is the correct instinct and rarer than it should be.
- **Motion restraint.** One `transition-colors` and two `animate-spin` in the whole app. For an Operate surface used under time pressure, that is a *choice*, and the right one.
- **Font licensing handled honestly** — Eina not shipped absent proof of licence, with the reasoning left in `layout.tsx` for the next person.
- **`.kiosk-slider`** — someone thought about a finger on glass, not a cursor on a screen.
- **Fraunces scoped to a subtree** to protect the asymmetric-skin decision from leaking.

---

## Recommended Actions

1. **[P1] `/impeccable adapt`** — admin to genuine desktop widths; table overflow wrappers; kiosk portrait.
2. **[P1] `/impeccable harden`** — headings via `PanelLabel`, labels via `Field`, `role="status"`/`"alert"` on `Banner`, focus-visible in the three primitives. Fix the primitives, not the call sites.
3. **[P1] `/impeccable typeset`** — retire the 9 px tier, lift `Mono` and the kicker.
4. **[P2] `/impeccable colorize`** — muted/hairline/ok/warn tokens; sweep 55 `neutral-*`.
5. **[P2] `/impeccable extract`** — one shared `TOKENS` export for CSS and canvas.
6. **[P2] `/impeccable optimize`** — kiosk mockup image.
7. **[P3] `/impeccable polish`** — unify the touch-target floor, disabled-state contrast, selected-garment affordance.

## Related
[[Design System]] · [[Frontend Map]] · [[Known Issues]] · [[Performance Backlog]]

# crftd Stall OS — Design Spec

**Status: binding.** This document is the contract between the surfaces. POS, admin
and kiosk are built in parallel; this file is the only thing keeping them one product.

Where this document and a screen disagree, the screen is wrong.

- Tokens live in `src/app/globals.css`.
- Primitives live in `src/components/ui.tsx`.
- Everything rendered in every variant: `/design` (source in `src/app/_design/page.tsx`).

---

## 0. The direction, in one paragraph

**Loud Y2K colour-block.** Flat panels of saturated colour, heavy black type, hard
ink edges (3px, never a hairline), hard offset shadows (never a blur), generous
radii, sticker/badge energy. Confident contrast, not gradients, not glassmorphism,
not soft corporate neutrals.

The direction comes from **one** reference: `UI DESIGN/e4937ebe0538890c26d1344322c6d7b6.jpg`.
The other 24 images in that folder are a contaminated moodboard containing at least
three conflicting languages (corporate lime, Swiss monochrome, soft blue gradient).
They are the documented cause of the incoherence we are fixing. **Do not open them
for inspiration.**

We borrow **language**, not **layout**. The reference is a marketing site; this is a
point of sale. Colour, type, radius, texture and badge treatment come from the
reference. **Every layout decision comes from POS ergonomics**: large targets, fixed
non-scrolling action regions, glanceable state, error-resistance for a stressed
operator in daylight.

### Register per surface

| Surface | Register | Colour load | Target floor | Body size |
|---|---|---|---|---|
| **Kiosk** | Storefront. Loudest. Carries the brand. | Up to 2 blocks, may cover ~50% | 64px | 18px |
| **POS** | Instrument. Loud chrome, calm workspace. | 1 block in chrome + 1 accent | 56px | 16px |
| **Admin** | Console. Dense, information first. | Accents only — no full-bleed blocks | 40px | 14px |

Admin being quieter is not a licence to invent a second design language for it. It
is the *same* system at a lower colour dose: same ink edges, same radii, same type
scale, same primitives.

---

## 1. Light / dark

**The app is LIGHT ONLY.** There is no dark theme, none is supported, and none is
planned. The contrast maths in §2 assumes a light ground, and a stall operates in
daylight where a dark UI is the worse choice.

Do not add `prefers-color-scheme` blocks, `dark:` variants, or a theme toggle.
`color-scheme: light` is set on `html` so form controls do not flip.

---

## 2. Colour

### 2.1 The palette

Every value is a token. **A sibling agent should never type a hex.**

#### Bright blocks — INK foreground only

| Token | Hex | Role | Contrast vs ink |
|---|---|---|---|
| `--color-pink` | `#FF8FD4` | Brand-forward accent, kiosk hero, "new" | 9.14:1 |
| `--color-acid` | `#5BE86B` | Success, paid, shift-open, positive money | 11.91:1 |
| `--color-yellow` | `#FFE24B` | Attention without alarm, warnings, focus wash | 14.65:1 |
| `--color-orange` | `#FF8A3D` | Warm accent, low stock, "hurry" | 8.08:1 |
| `--color-lilac` | `#C9A7FF` | Secondary/quiet accent, kiosk decoration | 9.44:1 |
| `--color-sky` | `#8FD3FF` | Informational, held/queued, neutral-positive | 11.67:1 |

#### Deep blocks — WHITE foreground only

| Token | Hex | Role | Contrast vs white |
|---|---|---|---|
| `--color-cobalt` | `#1B44E8` | **Primary action.** The one blue. | 6.91:1 |
| `--color-cobalt-deep` | `#0F2CA8` | Cobalt hover/pressed | 10.79:1 |
| `--color-pink-deep` | `#C4257F` | Pink as a *text/deep* colour | 5.36:1 |
| `--color-acid-deep` | `#12833A` | Green as a *text/deep* colour | 4.85:1 |
| `--color-orange-deep` | `#C43D06` | Orange as a *text/deep* colour | 5.23:1 |
| `--color-ink` | `#111014` | Type, rules, footers, pinned action bars | 18.95:1 |

#### Signal — RESERVED

| Token | Hex | Contrast vs white |
|---|---|---|
| `--color-signal` | `#D91E2A` | 5.04:1 |
| `--color-signal-deep` | `#A4141E` | 7.79:1 |
| `--color-signal-wash` | `#FDEAEA` | (background only — ink text, 15.9:1) |

**Signal means STOP.** Void, refund, negative stock, destructive confirmation,
offline-data-at-risk. It is never decorative, never a colour-block panel fill for
aesthetic reasons, never a brand accent, and it does **not** count as one of your
two permitted block colours. Its entire value is being the only thing on the screen
that means stop.

#### Neutrals

| Token | Hex | Role |
|---|---|---|
| `--color-paper` | `#FBF7F0` | App ground |
| `--color-paper-2` | `#EFE9DE` | Recessed ground, hover on white |
| `--color-paper-3` | `#E3DCCF` | Track fills, deeper recess |
| `--color-white` | `#FFFFFF` | Default panel fill |
| `--color-muted` | `#57525C` | Secondary text on paper/white (7.11:1) |
| `--color-line` | `#111014` | **Rules are ink.** Colour-block edges are black. |
| `--color-line-soft` | `#D6CFC1` | The *only* permitted soft divider — inside a white panel, between rows |

Washes (`--color-cobalt-wash`, `--color-acid-wash`, `--color-yellow-wash`) are
tinted grounds for banners and nudges, ink text only. A wash is **not** a block —
never substitute one where a block colour is wanted, and never the reverse.

Legacy aliases (`--color-cream`, `--color-blue`, `--color-teal`, …) still resolve so
existing pages compile. **Do not use them in new code.**

### 2.2 The accessibility floor — non-negotiable

Every text/background pairing meets **WCAG AA: 4.5:1 for body, 3:1 for large text
(≥24px or ≥19px bold)**. Saturated palettes fail this constantly, so the legal
pairings are enumerated rather than judged:

| Background | Legal foreground | Illegal foreground |
|---|---|---|
| pink, acid, yellow, orange, lilac, sky | `--color-ink` (and ink at ≥70% opacity) | **white — all fail, 1.3–2.4:1** |
| cobalt, cobalt-deep, pink-deep, acid-deep, orange-deep, signal, signal-deep, ink | `--color-white` (and white at ≥80%) | **ink — all fail, 1.8–3.8:1** |
| paper, paper-2, white | `--color-ink`, `--color-muted`, `--color-cobalt`, `--color-signal`, `--color-acid-deep`, `--color-pink-deep`, `--color-orange-deep` | any bright block colour as text — all fail |
| signal-wash, cobalt-wash, acid-wash, yellow-wash | `--color-ink`, `--color-muted` | white |

Consequences you must internalise:

- **Bright colours are never text on a light ground.** Yellow text on paper is
  1.21:1. If you want green text, it is `--color-acid-deep`. Pink text is
  `--color-pink-deep`. Orange text is `--color-orange-deep`.
- **On a block colour there is no grey.** To de-emphasise, dim the *legal*
  foreground: `text-[var(--color-ink)]/70` on bright, `text-white/80` on deep. The
  `toneMuted(tone)` helper returns the right one.
- **Focus rings are ink**, not chromatic — no single chromatic ring is visible on
  both yellow and cobalt. On a deep surface, add `on-deep` to flip the ring to white
  (the primitives already do this).
- **Never signal state with colour alone.** Pair it with a border weight change, a
  label, an icon, or `aria-pressed`/`aria-current`.

The `Tone` type in `ui.tsx` picks background and foreground **together**. There is
deliberately no API for setting them separately, because the illegal combinations
are exactly the ones a hand-rolled component produces.

### 2.3 The proportion rule — how not to make confetti

Colour-block means *blocks of colour*, not *everything coloured*. On any one screen:

1. **At most TWO block colours**, plus ink, plus neutrals. Not three. Not "one per
   card".
2. **Blocks cover at most ~⅓ of the visible area.** The majority of every screen is
   white and paper. The blocks are what the eye lands on; if everything is a block,
   nothing is.
3. **At most ONE `lift` (heavy offset shadow) panel per screen.** It is the hero.
4. **At most ONE `Sticker` per panel**, and at most three per screen.
5. **At most ONE primary (cobalt) action per region.** If two things look primary,
   neither is.
6. Signal is outside the count and appears only when something is actually wrong.
7. A repeating collection (list rows, catalogue tiles, table rows) is **one** tone
   for the whole collection. Never colour-cycle a list — that is the confetti
   failure mode in its purest form.

---

## 3. Type

Three faces, already wired in `layout.tsx`. **Do not add a fourth.**

- **Plus Jakarta Sans** (`--font-body`) — everything.
- **JetBrains Mono** (`--font-mono`) — money, counts, codes, timers, IDs. Always
  with `.tnum` so digits do not jitter as they update.
- **Fraunces 900 italic** (`--font-display`, `.t-display`) — display only. Kiosk
  hero and at most one admin/POS page title. Never body, never a control label,
  never below the `xl` step.

### The scale — closed set of nine steps

| Step | Class | Size | Line-height | Tracking | Weight | Role |
|---|---|---|---|---|---|---|
| mega | `.t-mega` | 56px | 0.92 | −0.03em | 800 | Kiosk hero only |
| xxl | `.t-xxl` | 40px | 0.98 | −0.025em | 800 | Page title; headline number (`Stat emphasis`) |
| xl | `.t-xl` | 30px | 1.06 | −0.02em | 800 | Section title; POS total |
| lg | `.t-lg` | 22px | 1.18 | −0.015em | 700 | Panel heading; sheet title; empty-state headline |
| md | `.t-md` | 18px | 1.35 | −0.01em | 600 | Lead paragraph; kiosk body; large control label |
| base | `.t-base` | 16px | 1.5 | 0 | 400 | Body. **The floor for any POS or kiosk text.** |
| sm | `.t-sm` | 14px | 1.45 | 0 | 400 | Secondary text; table cells; hints; admin body |
| xs | `.t-xs` | 12px | 1.35 | 0.02em | 600 | Badges; dense metadata |
| label | `.t-label` | 12px | 1.2 | 0.14em | 800 caps | Eyebrows; field labels; table heads |

Rules:

- **Use a step. Never type a `font-size`.** No `text-[17px]`, no `text-2xl` — the
  Tailwind sizes do not carry this system's tracking or line-height.
- Prefer the `Heading` / `Text` primitives, which take `step` as a prop.
- A step already sets weight, line-height and tracking. Do not override them.
- **12px never appears on a POS or kiosk screen** except inside a `Badge` or a
  `.t-label` eyebrow, both of which are ≥600 weight. Body text below 16px on those
  surfaces is a defect.
- Sentence case for everything except `.t-label`, which is the only uppercase in the
  system. No ALL-CAPS headlines.
- Measure: body copy caps at ~46–70ch. `EmptyState` already enforces this.

---

## 4. Spacing, radius, borders, shadow

All closed sets. Values between steps do not exist.

**Spacing** (`--space-1..8`): 4, 8, 12, 16, 24, 32, 48, 64.
Panel padding is `--space-4` (or `--space-3` with `tight`). Gap between stacked
panels is `--space-3` on POS, `--space-5` on admin/kiosk. Section gap `--space-7`.

**Radius** (`--radius-*`): xs 6, sm 10, md 14, lg 20, xl 28, 2xl 36, pill 999.
Admin controls use `sm`, POS uses `lg`, kiosk uses `xl`. Panels are `lg`. Chips,
badges and stickers are `pill`. Never an arbitrary radius.

**Borders**: only `--border-1` (2px), `--border-2` (3px), `--border-3` (5px).
There are **no 1px borders in this system** — a hairline is the visual language of a
different design and it is the fastest way to make a screen look off-direction.
3px ink is the default for panels, buttons and inputs. 5px is reserved for hero
panels and armed destructive controls.

**Shadow**: hard offset only.
- `--shadow-sticker` — `3px 3px 0 0 ink`. Buttons, chips, stickers.
- `--shadow-block` — `6px 6px 0 0 ink`. The one hero panel per screen.
- `--shadow-lift` — the **only** blurred shadow, and only for modal/sheet layers
  which must separate from everything behind them.

Any other `box-shadow`, and in particular any soft ambient elevation
(`shadow-md`, `shadow-lg`, coloured glows), is off-spec.

**Press feedback** is universal and shared by every control: the object travels
3px into its own shadow (`active:translate-x-[3px] active:translate-y-[3px]
active:shadow-none`). Do not invent a different press.

**Tilt**: `.sticker-tilt-l` (−2.5°) and `.sticker-tilt-r` (+2°). Two angles, that's
it. Never tilt a panel that contains an input or a table.

---

## 5. Touch targets

| Surface | Token | Floor |
|---|---|---|
| Kiosk | `--tap-kiosk` | **64px** |
| POS | `--tap-pos` | **56px** |
| Admin | `--tap-admin` | **40px** |

- Every interactive primitive takes `surface` and applies the right floor. Pass it.
- `Button size="sm"` is **admin only**. Using it on POS or kiosk is a defect.
- Adjacent destructive and non-destructive controls need ≥`--space-3` between them.
- Anything a stressed operator taps mid-transaction should be closer to 64px than
  to the floor.

---

## 6. Layout — from POS ergonomics, not from the reference

### POS screens are three fixed regions

```tsx
<PosScreen>
  <PosScreen.Head/>   {/* optional. fixed. state, not actions */}
  <PosScreen.Body/>   {/* the ONLY scrolling region */}
  <PosScreen.Foot/>   {/* the primary action. ink ground. never scrolls off */}
</PosScreen>
```

- **The primary action never lives in Body.** It must be thumb-reachable at any
  scroll position; an operator who has to scroll to find "Charge" will mis-tap.
- The total and the charge action are in `Foot`, together, always.
- `Body` uses `overscroll-contain`. The page itself never rubber-bands.
- POS content is capped at phone width even on a wide viewport.

### Admin

- Desktop-first and genuinely dense. Sidebar + content.
- **Wide content scrolls inside its own container.** The page body must never scroll
  horizontally. `Table` does this for you; so does `ScrollX` in `AdminShell`.
- Tables, not card grids, for anything reconcilable.

### Universal

- Fixed regions never scroll. Scrolling regions never contain the primary action.
- No horizontal page scroll on any surface, at any width.
- State that matters (offline, demo data, shift closed) is unmissable chrome, not a
  subtle indicator.

---

## 7. Motion

Durations `--dur-instant` 90ms · `--dur-fast` 140ms · `--dur-base` 220ms ·
`--dur-slow` 380ms · `--dur-stage` 560ms.

Easings `--ease-out` (default) · `--ease-in-out` · `--ease-place` (a single mild
overshoot, **reserved for a sticker landing on the kiosk canvas — nothing else**).

**What may animate:** entrance of a panel/list (`rise`, `pop`, `stagger`), press
feedback, a ticket arriving (`arrive`), a refusal (`refuse`), a skeleton shimmer, a
sticker placement (`place`).

**What may not:** anything that delays a number appearing, anything on a POS control
longer than `--dur-fast`, page transitions, parallax, decorative loops, anything
that moves while an operator is reading a total. On POS a volunteer experiences
animation as latency; on kiosk a customer experiences it as quality. Budget
accordingly.

`prefers-reduced-motion: reduce` is a **blanket kill** already implemented in
`globals.css` — it also straightens the sticker tilts. `.animate-spin` is the sole
exception, because a spinner that does not spin reads as a frozen app. Do not add
motion that escapes this (inline `style` animations, JS-driven transforms) without
guarding it yourself.

---

## 8. The primitives

Import from `@/components/ui`. Composing these should produce a correct screen;
hand-rolling CSS should be what produces a wrong one. **If something is missing,
extend this file — do not style in a page.**

`Button` · `ConfirmAction` · `Chip` · `Badge` · `Sticker` · `Field` · `FieldShell` ·
`Panel` / `Card` · `Table` / `Th` / `Td` · `Banner` · `Nudge` · `EmptyState` ·
`Sheet` · `Skeleton` · `Stat` · `Heading` · `Text` · `Mono` ·
`PosScreen` (+ `.Head` `.Body` `.Foot`) · `AdminPage` · `BlockGrid` · `Rail` ·
`toneMuted` · `TONE_IS_DEEP` · types `Tone`, `Surface`.

Notes that are easy to get wrong:

- `Panel` is **the signature primitive**. `tone` sets the block colour and its legal
  foreground together. `lift` = hero shadow, one per screen. `tilt` = sticker tilt,
  never on a panel containing inputs or a table.
- `Button variant="block"` + `tone` is how you get a bright colour-block button.
  `variant="primary"` is always cobalt. `variant="danger"` is always signal.
- `ConfirmAction` is friction against a mis-tap, not authorization. Use it for every
  refund, void, price change and destructive delete.
- `Banner tone="danger"` *fills* with signal. A washed-out red band is exactly what
  a stressed operator scrolls past.
- `EmptyState` requires `teach` — an empty state teaches what will happen, it never
  merely states a fact. "No open tickets" is a defect; "No open tickets yet — new
  orders from the kiosk appear here automatically" is the bar.
- `Field` renders a **visible** label. Do not replace it with `aria-label`.
- `Stat emphasis` is the headline number. One per screen.

---

## 9. DO NOT

1. **Do not put white text on a bright block, or ink text on a deep block.** Every
   one of those pairings fails WCAG AA. Use `Tone`; never set a colour and a text
   colour independently.
2. **Do not use more than two block colours on one screen**, and do not colour-cycle
   a repeating list. That is confetti, not colour-block.
3. **Do not use `--color-signal` decoratively.** It means stop. Nothing else.
4. **Do not type a raw hex, a raw px font-size, an arbitrary radius, or an
   arbitrary spacing value.** Everything is a token.
5. **Do not use 1px borders or soft/blurred shadows.** 2/3/5px ink and hard offsets
   only. `--shadow-lift` is for modals and nothing else.
6. **Do not use `Button size="sm"` on POS or kiosk**, or drop below the surface's
   target floor anywhere.
7. **Do not put a primary action inside a scrolling region.** It goes in
   `PosScreen.Foot`.
8. **Do not let any page scroll horizontally.** Wide content scrolls inside its own
   container.
9. **Do not add a dark theme, a `dark:` variant, or a theme toggle.** Light only.
10. **Do not add a font**, and do not use Fraunces below the `xl` step or for
    anything that is not display.
11. **Do not signal state with colour alone.** Always pair with weight, label or ARIA.
12. **Do not open the other 24 moodboard images.** One reference. Blending in the
    corporate-lime / Swiss-monochrome / soft-gradient languages is the exact failure
    we are correcting.
13. **Do not redesign the primitives to fit one page.** If a page needs something,
    it needs a primitive, and every surface gets it.
14. **Do not remove a visible label, an `aria-live` region, or a focus style** to
    make a screen look tidier.

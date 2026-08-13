# Rework — Visual Direction

*Working notes for the crftd Stall OS visual system. Written against the shipped code as of this commit, the PRD (§11, D19), the Design System doc, and the two approved `.dc.html` prototypes. Light mode only. ₹. Fonts in play: Plus Jakarta Sans + JetBrains Mono globally, Fraunces 900 italic scoped to the kiosk. Eina is not licensed for this deployment and is not specified anywhere below.*

---

## 0. Naming discrepancy — resolved 2026-08-13

> [!info] Resolved
> See [[Design Decision - Direction Resolved]]. Canonical spelling is **CRFTD** (five letters, star as an optional trailing decorative glyph, never fused into the word). Confirmed unanimous across every live occurrence in `app-v2`. This section is kept below as the historical record of the discrepancy that prompted the decision.

The wordmark used to be spelled three different ways across the artifacts: the PRD prose says "crftd," both `.dc.html` prototypes render "CRFT★O" in the actual markup, and the *old* `app/` kiosk (`app/src/app/page.tsx`, since superseded by `app-v2`) rendered "CRFT★D." That ambiguity is closed — see the decision doc.

---

## 1. Verdict on the current build

**It is not generic — but it is inconsistent, and inconsistency reads as indecision, which is worse than plainness on a brand-forward product.**

The good news first: the shipped code did not round the corners off. `app/src/components/ui.tsx` and `globals.css` commit to a genuinely hard-edged system — 2px solid borders everywhere, zero border-radius tokens defined, zero box-shadows, zero gradients. `Panel`, `Field`, `BigButton`, `Chip`, `Banner` all share one visual grammar: flat color fields, thick black rules, extrabold uppercase tracked labels. That's a real point of view, and it's the *correct* one — it matches the print-shop, DTF-press, market-stall material reality of the product better than any soft-UI trend would. The kiosk (`app/src/app/page.tsx`) goes further and reimplements the brief's ornament vocabulary from scratch: `Halftone`, `KioskCropMarks`, `BoxLabel`, `StarBurst` all exist as local components, and the attract screen stacks halftone + crop marks + multiple star-bursts + a rotated CTA + a skewed italic wordmark simultaneously. That is closer to the PRD's "full brutalist collision layout" than either `.dc.html` prototype achieves in a single screen.

The problems:

1. **Three different visual directions exist across the project's own history, and the old `app/` build picked pieces of two of them without reconciling.** The original POS prototype (`Stall OS Flow v1.dc.html`) is hard-edged, 2px-border, flat-color brutalism — no rounding, no shadows, `3px solid #0F0F10` on the primary CTA. `Kiosk v3.dc.html`, the later prototype, drifted somewhere else entirely: pill-shaped buttons (`border-radius:999px`), rounded cards (`border-radius: R px` with a soft radius variable), a JS theme-token color system (`t.blue`, `t.hot`, `t.ink`) instead of literal hex, a 26px signal-red slider thumb. The old `app/` kiosk sided with the *first* prototype's hard edges but never engaged with why v3 existed or what it was trying to fix.
   > [!info] Resolved 2026-08-13 — see [[Design Decision - Direction Resolved]]
   > `app-v2` (the current live build) has since settled this on its own: a modest, deliberate radius scale (4–24px) on every surface, no pills anywhere except the physical slider-thumb drag handles. Not zero-radius brutalism, not v3's pills — a third answer, already shipped, now formalised. The rest of this section is kept as the historical analysis that prompted the resolution.

2. **The kiosk's ornament, while dense, is decorative rather than structural.** Every motif in `page.tsx` — halftone, crop marks, star-burst, box label — is a small isolated component dropped onto an otherwise conventional stacked-card layout (logo, headline, CTA, centered column). That's an *illustrated* brutalist page, not a *collision* layout. True collision layout means the grid itself breaks: elements overlap, type bleeds off the module, price tags sit at an angle across a product photo, the halftone is a background field the layout fights against rather than a corner sticker. The current build has the right props on the right stage but the actors are still standing in a line. §2 below is the aggressive version of what's currently there.

3. **The `/` route is the kiosk, not a landing page** — worth stating plainly since it affects how "generic" reads. There's no throwaway marketing page diluting the system; the two screens that exist (kiosk at `/`, POS at `/sell`) are both doing real product work. That's a point in the build's favor, not against it.

4. **Minor system gaps**, cheap to fix: `TabBar` uses `min-h-[44px]` against a documented 48px floor everywhere else. The kiosk slider thumb is blue/32px in `globals.css` vs. red/26px in the v3 prototype — irrelevant now that v3 is being retired, but confirms nothing was cross-checked against it. No `Table` or `Card` primitive exists in `ui.tsx` at all — every screen that needs tabular stock data or a summary card is hand-rolling one, which is how systems drift.

**Bottom line:** the bones are right — hard edges, flat color, print-shop material logic, disciplined restraint on POS. The kiosk needs to be pushed harder into collision, not softened; the POS needs a couple of named "brand may land here" zones instead of implicit restraint; and the receipt/shift-card, which is the artefact that actually leaves the building, is under-specified relative to how hard it's currently working (§4).

---

## 2. The kiosk — Persuade surface

This is the screen someone points a phone camera at. Every design decision should be judged by whether it survives being seen as a 1080px-wide Instagram Story thumbnail for 1.5 seconds.

### Layout system: broken grid, not stacked cards

Retire the centered-column-of-cards pattern currently in `page.tsx`. Replace it with a **12-column bleed grid where every module is allowed to violate its own column** — text baselines cross card edges, the product canvas sits off-center and overlapped by a price tag rotated 4–6°, the halftone is a full-bleed background layer (not a small opacity-0.25 sticker) that later elements sit *on top of* and partially obscure. Concretely:

- **Attract screen:** wordmark large and off-axis in the upper third, NOT centered — pin it to the left edge, let it bleed past the safe margin on that side. The headline ("Build yours") runs underneath/behind it at a steeper angle, using the full viewport width so the last word clips the right edge intentionally. The CTA button breaks the grid by rotating -2° and overlapping the halftone field by ~12px on one side, with the star-burst badge halfway off the button corner, not neatly pinned.
- **Design/build screen:** the print canvas moves off dead-center — right two-thirds of the viewport, tilted 0° (the canvas itself must stay flat and undistorted per the existing code comment, correctly) but the chrome around it — price ticker, size selector, color swatches — occupies the left third stacked at a slight collective rotation (-1.5°), like taped-on labels rather than a form.
- **Ticket/QR screen:** the ticket code becomes the dominant graphic element, not a caption. Full-bleed halftone behind it, crop marks at all four *viewport* corners (not card corners), the QR sitting inside a rotated box-label frame as if it were stamped on.

### Type scale and pairing

- **Display:** Plus Jakarta Sans ExtraBold (800), used at genuinely oversized clamp ranges — headline `clamp(48px, 13vw, 128px)`, tracked tight (`-0.03em` to `-0.045em`), skewed -4° to -6° on the wordmark only (current treatment is right, keep it).
- **Accent word:** Fraunces 900 italic, reserved for exactly one word per screen maximum — currently "yours" on the build screen. Do not let it spread; its power is scarcity. One serif italic accent word is a signature; three is a font salad.
- **Body/UI chrome:** Plus Jakarta Sans, 700–800 weight only on the kiosk (never below 700 — this surface has no room for a "regular" voice, it's all shouting or it's all mono).
- **Numerals, codes, meta:** JetBrains Mono 700, tracked wide (`0.14em`–`0.2em`), always uppercase where alphabetic. This is the only place a quiet, technical voice is allowed — ticket codes, "SCAN TO PAY" captions, timestamps.

### Colour deployment

Blue (`#1b4df5`) is the hero color and should dominate at least one full-bleed field per screen — not just borders and accents. Cream (`#f7f5f1`) is the ground. Signal (`#c6302b`) appears only as the star glyph, the box-label fill, and CTA badges — never as a background field larger than a chip; it stays a spark, not a wash. Ink (`#0f0f10`) does the heavy lifting for text and hard rules. No tints, no opacity-reduced pastels of any of these — every color on the kiosk is used at full saturation. If a "quiet" moment is needed (e.g. secondary caption text), drop to mono ink-on-cream rather than diluting a brand color.

### Ornament (push these harder than the shipped build)

- **Halftone:** full-bleed background layer at 8–15% opacity behind entire screens, not a small decorative patch. Vary dot size per screen (9px on the attract screen, 5px tighter on the receipt-adjacent ticket screen) so it doesn't read as one repeated texture.
- **Crop marks:** move from card-corner brackets to viewport-corner brackets, larger (14–16px arms, 2.5px stroke), always cream-on-blue or ink-on-cream depending on the field they sit on.
- **Star-burst:** the ✦ glyph is correct; let it appear at inconsistent sizes and rotations across a single screen (one large, one small, tucked into a different corner) rather than one uniform badge — this is what makes hand-stamped ephemera feel authentic rather than templated.
- **Box label (rotated tag):** this is the strongest motif in the current build. Use it for price, size, and "LIMITED PRESS" style callouts, always rotated between -2° and -5°, always signal-fill/cream-text, always with a hard 2px ink border — never soften it into a chip.
- **New motif worth adding, since it's named in the prototype but underused in the shipped kiosk:** the torn-tape/marquee ticker from `Kiosk v3.dc.html` (`vTape` keyframe, `✳`-separated infinite scroll) on the attract screen only — a single line of tracked mono text drifting at 40–50s linear, listing press themes or "RAISED FOR AQUATERRA SO FAR" running totals. It's free motion that reinforces the market-stall energy without asking for a click.

### Imagery treatment

Product/tee mockups render clean and undistorted (existing code comment is correct: no halftone or texture on top of the customer's actual design — the chrome carries the skin, not the artwork). Any supporting photography (event/crowd shots, if used on the attract screen) should be duotone-treated to ink/cream or a cream/blue duotone, never full color — full color photography next to flat brand color reads as stock-photo and breaks the printed-material illusion.

### The hero moment

One entrance, once, on the attract screen: wordmark slams in with a stamp-style overshoot (`scale(1.5)→scale(.95)→scale(1)`, ~0.4s, the `vSheet`/`stallStamp` timing from the prototypes is the right reference), followed 100–150ms later by the headline rising up, followed by the CTA's underline-wipe. That's the one big choreographed moment; everything after (screen-to-screen transitions during the build flow) should be fast and functional — 150–200ms fades/slides, no repeated fanfare. A kiosk that showboats on every screen exhausts the person standing in front of it for 90 seconds; it should showboat once, at the moment that gets photographed.

---

## 3. The volunteer POS — Operate surface

Opposite discipline entirely. The person using this is standing in direct sun, holding a phone in one hand, with three more people in line. Every design decision here is judged by: can this be read in under a second at arm's length in sunlight, and can this be hit with a thumb without looking.

### Where restraint applies (almost everywhere)

- Flat cream ground, flat white panels, 2px ink borders — no texture, no halftone, no ornament components imported at all. The current `sell/page.tsx` is already correct on this: no `Halftone`/`StarBurst`/`BoxLabel` in the file. Keep it that way; resist the urge to "brand it up" here.
- Contrast ≥7:1 everywhere, verified against actual token pairs, not assumed: ink (`#0f0f10`) on cream (`#f7f5f1`) and white both clear 15:1+; muted (`#52504c`) on white/cream clears ~7:1 per the Design System doc's own note — fine for secondary text, do not introduce a lighter gray for tertiary text, there is no budget for a third gray.
- All interactive targets ≥48px — fix the one known violation (`TabBar` at `min-h-[44px]`) as part of this rework; it's a one-line change and it's the kind of inconsistency that undermines everything else being disciplined.
- Typography: Plus Jakarta Sans across the board, weight doing the hierarchy work instead of size tricks — extrabold uppercase tracked labels for field names and status, regular/semibold for values, JetBrains Mono for anything numeric-scannable (bin codes, SKUs, stock counts) so digits align and don't need to be read character-by-character.

### The few precise places brand is allowed to land

Name these explicitly so nobody free-associates brand elements back in elsewhere:

1. **The header/kicker band.** One blue field per screen, top of frame, holding the "STALL OS · SELL" kicker and screen title in mono/extrabold. This is the single largest use of blue on the surface and it's structural (wayfinding), not decorative.
2. **The primary action.** Exactly one blue `BigButton` per screen — Charge, Confirm, Save — never more than one blue button visible at once. If a screen has two meaningful actions, the second is ink or cream/ghost, never a second blue.
3. **Selection state on line items.** The current `outline-2 -outline-offset-2 outline-blue` treatment on a selected garment row (replacing an earlier low-contrast blue tint) is the right pattern — full-strength outline, not a wash. Reuse this exact treatment anywhere else a row/card needs a "this one is active" state.
4. **Signal red stays 100% functional.** Void, remove, error, overdue, discount-gate warnings only. Confirmed compliant in the current build — do not let a future pass reach for red to mean "attention" in any non-destructive sense; it must keep meaning "stop/undo/danger" without exception, because a volunteer under pressure needs that color to be unambiguous.

Nothing else on this surface should carry brand color. No blue borders on default panels, no red decoration, no star-bursts, no crop marks except the one small `CropCorner` accent already scoped to specific header treatments — audit for any place blue currently appears as pure decoration (a stray blue border on a non-primary panel, for instance) and neutralize it to ink.

---

## 4. The receipt and shift summary card

This is the highest-leverage artefact in the whole product — it's the thing that leaves the stall and lands in a WhatsApp group, and it's the one place "Raised for AquaTerra" is actually read by someone who wasn't at the event. It deserves the most deliberate print-shop treatment in the system, and right now it's the least specified.

Full spec:

- **Format logic:** treat it as a physical printed slip, not a screen. Dimensions constrained to thermal-receipt proportions (58mm or 80mm width equivalent if physically printed; on-screen/share-image render at a matching tall-narrow aspect, e.g. 640×1400px for the shareable card).
- **Crop marks:** all four corners, 12–14px arms, 2px ink stroke — signals "this was produced by a machine, on purpose," reinforcing the DTF-press material world.
- **Wordmark:** halftone-dot-filled text treatment (the `radial-gradient` dot-pattern background-clip:text technique sampled from the prototype) at the top — this is a strong, specific motif and should be the one non-negotiable brand element on the receipt. Render at a size that stays legible as a dot pattern (don't go below ~28px cap-height or the dots blur into gray).
- **Blue baseline band:** an 8px solid blue rule separating header from itemized list, and a second one separating itemized list from totals — these act as the "fold lines" of a real receipt.
- **Line items:** JetBrains Mono throughout, tabular figures right-aligned, ink on cream/white, no color.
- **"Raised for AquaTerra" line:** this is the hero moment of the receipt and should be treated as such — full-width solid blue block, cream text, extrabold, the single largest and highest-contrast element on the slip after the wordmark. It should visually outrank the total-paid line; the customer paid for a shirt, but what they're meant to remember and screenshot is this line.
- **QR/payload block:** diagonal-stripe swatch treatment (45° repeating ink/cream stripes) as a placeholder/frame around the actual QR, echoing packing-tape material logic — but make sure the actual QR itself sits on a clean quiet-zone inset, never printed directly over the stripe (scanability first, ornament second).
- **Shift summary card (distinct from the per-sale receipt):** same crop-marks/halftone-wordmark/blue-band system, but the hero block becomes the shift total, with a secondary row of mono stat chips (units sold, average sale, float variance) beneath it in a tight grid — this is the card that gets posted at shift close, so it should read completely at thumbnail size in a chat thread: wordmark, big blue "RAISED" number, done, everything else is supporting detail below the fold.
- **No signal red anywhere on this surface** — it's a celebratory/summary artefact, not a warning surface; keep it entirely within ink/cream/blue plus the halftone texture.

---

## 5. Component visual specs

Exact values, extending what's already correct in `ui.tsx`/`globals.css` and filling the gaps (missing `Card`/`Table`, kiosk-specific variants).

**Buttons (`BigButton`)**
- Border: `2px solid var(--color-ink)` always, regardless of fill.
- Min height: `52px` (POS/admin), `70–72px` (kiosk primary CTAs, matches the clamp-scale prototype spec).
- Type: `font-extrabold`, `text-sm` (POS) / `clamp(17px,2.4vmin,22px)` (kiosk), `tracking-[0.08em]`.
- Variants: `blue` / `ink` / `cream` / `ghost` as shipped — correct, keep.
- Disabled: `opacity-60` + desaturate, not `opacity-40` — the existing fix is right, don't regress it.
- Kiosk-only addition: primary CTA gets `transform: rotate(-1deg to -2deg)` and an offset star-burst badge; POS buttons stay unrotated always.

**Chips**
- `border-2 px-3 py-2 min-h-[48px] min-w-[48px] font-bold text-[13px] tracking-wide` — shipped spec is correct.
- Active state: full ink fill + cream text, not a tint — keep the "full strength or nothing" rule consistent with the row-selection pattern in §3.

**Inputs (`Field`)**
- `border-2 border-ink p-3 text-base min-h-[48px] bg-white` — correct. Border-radius 0 everywhere on POS; kiosk inputs (rare — mostly sliders/steppers) may use the pill-shaped `.kiosk-slider` thumb since it's a physical drag-handle metaphor, not a form field.

**Panels**
- `bg-white p-2.5 border-2 border-ink`, blue border variant (`accent`) reserved for the one-per-screen brand-landing use named in §3.
- **New: `Card` primitive** (currently missing from `ui.tsx`, being hand-rolled per screen) — define once: `bg-white border-2 border-ink p-3 flex flex-col gap-2`, optional `rotate` prop for kiosk contexts (box-label / press-sheet cards), no rotate on POS/admin.

**Banners**
- `px-3.5 py-2 font-extrabold text-[12px] tracking-[0.1em] uppercase` — signal/blue variants as shipped, correct, keep `role="alert"`/`role="status"` distinction.

**Tables**
- **New: `Table` primitive** (currently missing) — for admin/stock screens: `border-collapse`, `2px solid ink` outer border only (no internal cell borders — use a 1px `var(--color-hairline)` row divider instead to avoid a grid-heavy look at density), header row `bg-ink text-cream font-extrabold text-[11px] tracking-[0.1em] uppercase`, body rows `font-mono text-[13px]` for numeric columns, `min-h-[44px]` row height (admin is desktop/mouse, so this can sit below the 48px touch floor deliberately — the 48px rule is for touch surfaces, not admin tables).

**Kiosk canvas**
- `border-2 border-ink bg-white`, dashed blue print-safe-area guide (`border-2 border-dashed border-blue/50`) — correct as shipped, do not add texture on top of it (per the existing, correct code comment).

**Press sheet (ticket/production card)**
- Crop marks at card corners, `border-2 border-ink`, ticket code in mono at `clamp(32px,12vw,60px)` tracked `0.2em`–`0.3em` — correct as shipped. Add: a rotated box-label corner tag stating the press queue position/priority, currently absent from this screen per the research pass.

---

## 6. What to kill

1. **`Kiosk v3.dc.html`'s pill/999px/theme-token direction, as a literal spec.** Pill buttons and the 26px red slider thumb never belonged anywhere near this system. **Resolved 2026-08-13**, per [[Design Decision - Direction Resolved]]: `app-v2` settled on a modest 4–24px radius scale instead of either the old zero-radius build or v3's pills — a third, already-shipped answer. No longer a live ambiguity.
2. **The `TabBar` 44px touch target.** Off-system, no reason for it to be smaller than every other target in the product. Bump to 48px.
3. **Any stray decorative blue on POS panels that aren't the header band, the primary action, or the active-selection state.** If an audit finds a blue border on a panel that's just sitting there for "brand," neutralize it to ink per §3's explicit allow-list.
4. **The Eina references anywhere they still linger in code comments or dead CSS** (the `.dc.html` prototypes both `@font-face` it, and it's referenced in the PRD table) — not a licensing risk since it's not shipped, but worth a pass to make sure no comment or dead import still points at it as if it were live, so nobody reintroduces it by copying an old block.
5. **Hand-rolled one-off card/table markup per screen.** Every screen currently improvising its own bordered-box-with-header pattern instead of using a shared `Card`/`Table` primitive (§5) is technical and visual drift waiting to happen — consolidate before adding more screens, not after.
6. **The kiosk's current "illustrated brutalism" layout** (ornament components dropped onto an otherwise centered-stack layout) in favor of the actual collision grid described in §2 — this is the single biggest gap between what's shipped and what the brief actually asks for.
7. **The three-way wordmark spelling conflict** (§0) — **resolved 2026-08-13**, canonical spelling is `CRFTD`, per [[Design Decision - Direction Resolved]]. The prototype spellings (`CRFT★O`, `CRFT★D`) remain in the archived `.dc.html` files for historical reference only; do not copy them into new work.

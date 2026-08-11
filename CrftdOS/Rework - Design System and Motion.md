Part of [[Frontend Map]]. Reworks [[Design System]] with a motion vocabulary. Answers the "dynamic reverb" complaint: the shipped app has 1 CSS transition, 1 animation, 0 keyframes, 0 `hover:`/`active:` variants, and 0 radius tokens in ~2,500 lines of surface code, against a source-of-truth prototype (`Stall OS Flow v1.dc.html`, `Kiosk v3.dc.html`) that has 8 named keyframes on the POS side and 6 on the kiosk side, plus a working transition/hover/active system. This document says exactly what to bring back, what to leave dead, and what the shipped app already got right that the prototype didn't.

Grounding for every number below: direct read of both `.dc.html` files' `<style>` blocks and ~15 sampled inline controls each, plus `app/src/app/globals.css`, `ui.tsx`, `PosFrame.tsx`, `TabBar.tsx`, `sell/page.tsx`, kiosk `page.tsx`, and `Design System.md`.

---

## 1. Divergence table

| Aspect | Prototype (POS) | Prototype (Kiosk) | Shipped | Recommendation | Rationale |
|---|---|---|---|---|---|
| Border radius, buttons | `button{border-radius:14px}` globally, but every real button in the body is inline-styled with **no** radius property, so they actually render at that 14px stylesheet default | JS-computed scale: `R=22/28px`, `Ri=14/18px`, plus `999px` pills for chips/segmented controls | `0` everywhere — no `rounded-*` class in `ui.tsx`, `PosFrame.tsx`, `TabBar.tsx`, or `sell/page.tsx` | **Give POS a small, real radius token (6–8px) on buttons/panels; keep the kiosk's larger scale.** Do not copy the prototype's 14px verbatim — it was accidental (author never set radius on the inline-styled buttons that carry the file's actual visual identity), and the shipped app's sharp corners read intentionally brutalist, which is correct for a stall-branded POS. But 0px everywhere reads as unstyled, not brutalist — a barely-there radius keeps the edge while stopping it from looking like a wireframe. | Sharp corners work for "printed cardboard sign" aesthetic (D19), but zero radius on *every* surface, including the field/chip/panel/tab-bar, collapses "restrained" into "unfinished." A near-imperceptible 6px says "this was decided," not "this was skipped." |
| Border radius, kiosk | n/a | 18–28px + 999px pills, applied pervasively (hero tiles, cards, CTAs, chips) | 0, except one 3D-printed `.kiosk-slider` thumb at `border-radius:9999px` | **Adopt the kiosk's radius scale in full.** This is the surface D19 explicitly grants full expressive licence to. | The kiosk currently looks like the POS wearing a different palette. It needs to look like a different *object*. Radius is the cheapest, highest-leverage way to make that true — it changes the silhouette of every tile without touching layout. |
| Radius on inputs | `input,select,textarea{border-radius:10px !important}` (contradicts a same-file `8px` webkit-appearance rule; the `!important` wins) | driven by same `R/Ri` scale | `0` (Field component has no radius) | POS: 6px. Kiosk: `Ri` value (14/18). | Match to the button radius one step down (see concentric-radius token table in §3) rather than reproduce the prototype's internal contradiction. |
| Button press feedback | `button:active{transform:scale(.97)}`, `transition:transform .12s ease, background .14s ease, color .14s ease` | none in kiosk stylesheet (kiosk relies on `button{transition:background .32s cubic-bezier(.22,.61,.36,1), color .32s, border-color .32s}` — a colour-only crossfade, no scale) | **Zero** — `BigButton` has no `active:` class, no `transition-*` class at all. A tap on Charge is visually silent until the next screen paints. | **Add `active:scale-[0.97]` + `transition-transform` to every pressable primitive in `ui.tsx`.** POS gets scale feedback (matches its prototype and its usage context — gloved/sunlit one-handed taps need confirmation the tap registered). Kiosk CTAs get the colour-crossfade version, not scale, to match its prototype's own choice. | This is the single highest-leverage fix in the whole audit. Charge is pressed under time pressure with a queue watching; right now nothing on screen confirms the tap landed until the network round-trip resolves. `scale(.97)` costs ~5 lines and closes that entire gap. |
| Global transition coverage | `button{transition:transform .12s ease,...}` applies to all ~40+ buttons in the file uniformly | `button{transition:background .32s,...}` uniform, plus per-element transitions on progress dots (`width .34s`) and shuffle icon (`transform .52s`) | 1 transition in the entire app: `transition-colors` on `Chip` (`ui.tsx:99`). `BigButton`, `Panel`, `Field`, `Banner`, `TabBar`'s active-tab swap — all instant, no easing. | Add a small transition to `BigButton`, `TabBar` active state, and `Field` focus ring. Leave `Panel`/`Banner`/`Mono`/`CropCorner` untransitioned — they don't change state. | Both prototypes transition *every* interactive element uniformly via a single `button{}` rule. That's the "reverb" — a base hum of responsiveness under everything. The shipped app transitioned exactly one component (`Chip`) and left the rest silent, which is why the silence is so noticeable: it's inconsistent, not just sparse. |
| Keyframe animations | 8 named: `stallPulse`, `stallRise`, `stallDrift`, `stallPop`, `stallWiggle` (2.8s infinite, decorative "tap anywhere" nudge), `stallSlideIn` (.22–.34s, panel/column entrances), `stallStamp` (.42s, `cubic-bezier(.3,1.5,.6,1)` overshoot — ticket code reveal), `stallBand` | 6 named: `vIn`/`vFade` (staggered entrance, `cubic-bezier(.22,.61,.36,1)`), `vWipe` (hero rule-line scaleX), `vTape` (48s linear marquee), `vSheet` (bottom-sheet entrance), `vSpin` | 0 keyframes. 1 animation total: Tailwind's built-in `animate-spin`, used once (catalogue loading spinner). | See §2 for the exact set to bring back. Not all 14 keyframes should return — most are one-off entrance flourishes for a static prototype walkthrough, not a live app under load. | A prototype demoed once needs to impress on first viewing. An app used all day by the same three volunteers needs to disappear after the first viewing. Cargo-culting all 14 keyframes back in would make the POS *worse* — see §2 for which ones actually earn their keep under repeat use. |
| Focus states | **None.** No `:focus`/`:focus-visible` rule in either prototype file. | same — none | **Better than prototype.** `ui.tsx` defines a shared `FOCUS` constant: `focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-cream`, applied to `Field`, `BigButton`, `Chip`, and `TabBar` links. | **Keep as-is. Do not touch.** This is the one area where shipped already beat the prototype. | Prototypes are mouse/touch demos and never needed keyboard focus handling. The real POS may see a keyboard/barcode-scanner-as-keyboard at the till. Shipped's focus-visible ring is correct, tokenized consistently, and already accounts for ink-on-ink surfaces where a bare `outline:none` default would have been invisible. |
| Hover states | 1 rule total, global: `a:hover{color:#1B4DF5}` | same 1 rule | 0 hover rules anywhere | **Do not add hover states to POS or kiosk.** | Both are touch-primary surfaces (tablet POS, kiosk touchscreen). `hover` on a touch device either never fires or false-fires on tap-release, and Emil's own framework here says gate any hover animation behind `@media (hover:hover) and (pointer:fine)`. Neither prototype bothered, and they were right not to — there's no desktop mouse user of this product. Skip it entirely rather than add media-query plumbing for a pointer type this product doesn't have. |
| Scrollbars | Visible, styled: `::-webkit-scrollbar{width:8px}`, thumb `#1B4DF5` (brand blue), no track colour | **Hidden**: `::-webkit-scrollbar{width:0}`, `scrollbar-width:none` (Firefox) | Default browser scrollbar (unstyled), no hiding | POS: adopt the prototype's blue 8px scrollbar — it's cheap, on-brand, and confirms to the volunteer that a panel is scrollable (important on the small `max-w-[480px]` column where content overflow isn't always obvious). Kiosk: hide scrollbars, matching its prototype. | Different context, different answer, correctly diverging per D19: the volunteer needs to *see* there's more list below the fold (functional signal); the customer kiosk should look edgeless and considered (aesthetic signal), and browser scrollbar chrome breaks the illusion of a designed surface. |
| Range input thumb | Square-ish: `34×34px`, no radius, `background:#C6302B`, `border:2px solid #111`, `cursor:grab` | Round: `26×26px`, `border-radius:999px`, `background:#C6302B`, `border:2px solid #F7F5F1` | `.kiosk-slider` class in `globals.css`: `32×32px`, `border-radius:9999px`, 3px cream border — round, sized between the two prototypes | **Keep shipped as-is for kiosk.** For POS, if a range input is ever used in the volunteer flow (currently none found in scope), give it the square 34px prototype treatment, not the rounded kiosk one — POS controls should look like the rest of POS. | Shipped already made a sound synthesis of the two prototype values for the one slider that exists (kiosk size-picker). No change needed; flagged as an example of the shipped app getting a *component-level* decision right even while missing the *system-level* motion layer. |
| Reduced motion | Full kill: `*{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}` in **Kiosk v3.dc.html** (POS prototype has no reduced-motion block at all) | as above | `.animate-spin{animation-duration:3s}` under `prefers-reduced-motion: reduce` — the *only* rule in the media query, and it slows rather than stops | **Fix.** Add a global reduced-motion kill switch matching the kiosk prototype's pattern, scoped to transform/position motion, but *keep* the spinner spinning (slowly) rather than freezing it — a frozen spinner reads as a hang, which is worse than motion sickness risk for a single small looping element. | The current rule is backwards in scope, not in spirit: it's right to keep *a* form of loading feedback alive under reduced motion (freezing the only loading indicator in the app would make every network wait look broken), but it currently does nothing for any of the new transitions/keyframes this document proposes adding elsewhere. The fix is to add a proper blanket rule for the new motion vocabulary, and deliberately carve out `.animate-spin` as the named exception with a comment explaining why. |
| Box-shadow / elevation | Effectively none — `box-shadow:0 0 0 1px #000` (hard outline, not a shadow) is the only usage; the visual language is 2–3px solid borders, not layered shadows | same | `PosFrame.tsx` reuses the identical value: `shadow-[0_0_0_1px_#000]` | **Keep.** No layered elevation system in either surface. | This is a considered brutalist choice on both sides (prototype and shipped agree), not a gap. Adding soft blurred shadows would fight the flat, printed-signage aesthetic the whole product is built on. Nothing to fix here. |
| Sticker drag (kiosk canvas) | n/a | Direct style mutation during drag (`cursor:grab`, `touch-action:none`, `user-select:none`), entrance via `vFade .34s` on placement, selection shown via `outline:2px solid [hot]` + `outline-offset:2px` (not box-shadow) | Not verified in this pass to have any entrance animation on sticker placement; drag math lives in JS in shipped `page.tsx` per the SAT collision system already documented elsewhere | Bring back exactly the entrance flourish (`vFade`, ~.3s) on sticker placement and the outline-based (not shadow-based) selection indicator. Do **not** add any transition *during* the drag itself in either version. | Motion during an active drag must track the finger with zero latency — a transition during drag reads as unresponsive lag, not polish. The only two things allowed to animate around a drag are: the moment it starts (nothing, per Sonner principles — dragging must feel instant) and the moment it lands (a small settle). |

---

## 2. Motion vocabulary

The test for every entry: would a volunteer who uses this screen 200 times a shift still want to see it on rep 200? If no, it's cut or fired once per session, not once per action.

### POS (restrained set — 3 motions total)

| Name | Trigger | Duration | Easing | Properties | Notes |
|---|---|---|---|---|---|
| **press** | `:active` on any `BigButton`/`Chip`/tab-bar link | 100ms | `ease-out` (no custom curve needed at this duration) | `transform: scale(0.97)` | Fires on every tap, hundreds of times a shift — must be near-free. No colour change bundled in; scale alone is the confirmation. |
| **field-focus** | input/select gains focus | 120ms | `ease-out` | `box-shadow` (the existing `FOCUS` ring), not transform | Already exists as an instant snap; adding 120ms keeps the keyboard-driven case (barcode scanner as keyboard input) from feeling like it's lagging while still giving it *some* settle. |
| **sheet/toast enter** | undo toast, error banner, any transient overlay | 180ms | `cubic-bezier(0.23,1,0.32,1)` (strong ease-out) | `transform: translateY(8px)→0`, `opacity: 0→1` | Occasional (tens/day, not hundreds) — earns a real animation per the frequency table. Exit: 120ms, same translateY distance, no easing change — exit stays fast, not slower than enter. |

Explicitly cut from the POS prototype and not brought back: `stallWiggle` (2.8s infinite idle nudge — fine once on an idle attract state, actively annoying on a working till screen glanced at hundreds of times), `stallStamp`'s bounce overshoot (`cubic-bezier(.3,1.5,.6,1)` — playful bounce reads wrong on a restrained, high-contrast, sunlight-legible operate surface; reserve overshoot easing for the kiosk only), `stallPulse`/`stallDrift`/`stallBand` (no clear trigger identified in the sampled inline usage — likely decorative background texture, not functional, and POS has no motion budget for pure decoration).

### Kiosk (expressive set — 5 motions, all decorative/entrance, never blocking)

| Name | Trigger | Duration | Easing | Properties | Notes |
|---|---|---|---|---|---|
| **tile-enter** | product tiles, hero cards appearing (screen transition, filter change) | 400ms, staggered 60ms per item | `cubic-bezier(0.22,0.61,0.36,1)` (prototype's own curve — keep it, it's already good) | `transform: translateY(10px)→0`, `opacity: 0→1` | Direct port of `vIn`. Cap stagger group at ~6 items (360ms max stagger tail) so a 12-tile grid doesn't take 700ms to finish settling. |
| **cta-press** | tap on any kiosk button | 320ms | `cubic-bezier(0.22,0.61,0.36,1)` | `background-color`, `color`, `border-color` (no scale) | Port of the kiosk's own `button{transition:...}` rule as-is — deliberately a colour crossfade, not a scale-press, per the prototype's own choice. Kiosk buttons are large and thumb-pressed at a stall counter, not urgently repeated like POS taps; a colour settle reads as considered rather than transactional. |
| **theme-swap** | paper/ink/electric field theme toggle | 450ms | `cubic-bezier(0.22,0.61,0.36,1)` | `background`, `color` on root | Rare (once or twice per customer session) — full "marketing/explanatory" budget applies, can be as long as it needs to read as a deliberate mode change. |
| **sticker-place** | sticker dropped onto canvas | 340ms | `cubic-bezier(0.22,0.61,0.36,1)` | `opacity: 0→1` only (no transform — it should land exactly where released, not slide) | Port of `vFade`. Confirms placement without relocating the sticker after the user's finger already put it there. |
| **rule-wipe** | hero underline reveal on first paint of a screen | 620ms, 260ms delay | same curve | `transform: scaleX(0→1)`, `transform-origin: left` | Once-per-screen-visit flourish (not once-per-action) — the frequency table's "occasional" tier, fine to keep decorative. |

Explicitly cut from the kiosk prototype: `vTape` (48s linear marquee) — keep only if there's an actual scrolling ticker of stall announcements; do not add motion that exists purely to prove the canvas can move. `vSpin` — superseded by Tailwind's `animate-spin`, already shipped correctly.

### What must NOT animate, on either surface

- Keyboard-triggered actions (there are effectively none in this touch-only product, but if a barcode scanner or hardware keypress ever drives a shortcut, it gets zero animation — per the 100+/day rule).
- The Charge button's *success* state transition — once payment confirms, navigate/update immediately. Do not add a self-congratulatory success animation on top of an already-relieved volunteer with a queue waiting; a4 delay here is pure risk for zero benefit.
- Any list re-sort or re-filter on the POS product grid — FLIP-style reordering animations look impressive in a demo and cause dropped frames / visual noise mid-transaction on a busy till. Re-render instantly.
- Cart line-item quantity increments/decrements on POS (numbers should snap, not count up) — this is a till, not a hero stat; use `tabular-nums` to prevent layout shift instead of motion.

### `prefers-reduced-motion` policy

Current shipped rule (`globals.css:102-106`) only touches `.animate-spin`, slowing it to 3s. That's an intentional, narrow exception, but it currently has no companion blanket rule, because nothing else animates yet. Once the vocabulary above ships, add:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  .animate-spin {
    animation-duration: 3s !important;
  }
}
```

The blanket kill matches the kiosk prototype's own (correct) approach. `.animate-spin` stays the sole named exception, ordered after the blanket rule so its higher specificity/later declaration wins — a frozen spinner during a real network wait reads as a hang, not as accessibility. Every other motion in this document is decorative or confirmatory, not comprehension-critical, so killing it under reduced-motion costs nothing.

---

## 3. Token additions

Add to `app/src/app/globals.css` `:root`, re-exported through the existing `@theme inline` block alongside the current `--color-*` tokens:

```css
:root {
  /* existing --color-* tokens unchanged */

  /* radius scale */
  --radius-pos-sm: 6px;   /* POS inputs, chips */
  --radius-pos-md: 8px;   /* POS buttons, panels */
  --radius-kiosk-sm: 14px; /* kiosk inner elements (Ri at phone size) */
  --radius-kiosk-md: 18px; /* kiosk inner elements (Ri at desktop size) */
  --radius-kiosk-lg: 28px; /* kiosk outer tiles/cards (R at desktop size) */
  --radius-pill: 9999px;   /* kiosk chips, segmented controls, both prototypes' pill usage */

  /* duration scale */
  --dur-press: 100ms;      /* POS scale-on-press */
  --dur-fast: 120ms;       /* focus rings, small state flips */
  --dur-pos: 180ms;        /* POS toast/sheet enter */
  --dur-kiosk: 340ms;      /* kiosk tile/sticker/CTA settle */
  --dur-kiosk-slow: 450ms; /* kiosk theme-swap, rule-wipe */

  /* easing scale */
  --ease-out-strong: cubic-bezier(0.23, 1, 0.32, 1);   /* POS entrances */
  --ease-kiosk: cubic-bezier(0.22, 0.61, 0.36, 1);      /* all kiosk motion, ported verbatim from prototype */
  --ease-linear: linear;                                 /* only if a marquee/progress element is added */
}
```

No elevation tokens are added — §1 already confirmed the flat, hard-outline `shadow-[0_0_0_1px_#000]` approach is correct and shared by prototype and shipped alike; introducing a blur-based elevation scale would fight the brutalist/printed-signage material language on both surfaces.

Note the split: **POS radius/duration/easing tokens are deliberately small and separate from kiosk's**, not a shared generic scale. This is enforced in code, not just convention — see §4.

---

## 4. Per-surface rules

**The kiosk gets, and POS must never get:**
- Radius above 8px (kiosk runs 14–28px + pills; POS caps at 6–8px)
- Any bounce/overshoot easing curve
- Staggered multi-element entrance animations
- Full-palette theme-swap transitions
- Hidden scrollbars
- Colour-crossfade button presses in place of scale — POS buttons must always use scale, never a pure colour tween, because the volunteer needs a tactile-feeling confirmation under sunlight glare where subtle colour shifts may not even be visible

**POS gets, and the kiosk must never get:**
- Visible, coloured scrollbars (functional affordance — kiosk optimizes for looking edgeless instead)
- `scale(0.97)` press feedback as the primary confirmation language
- Any motion budget spent on "does this feel considered" — POS motion exists solely to confirm state changes (pressed, focused, dismissed), never to delight
- Sub-150ms interaction budgets as the default, not the exception — every POS motion in §2 is at or under 180ms; nothing on the till should ever feel like it's making the volunteer wait

**Shared, unconditionally, on both surfaces:**
- `focus-visible` ring system exactly as currently shipped in `ui.tsx` — already correct, do not fork it per-surface
- No `:hover` styling at all (no mouse users)
- Reduced-motion blanket kill (§2) with the `.animate-spin` exception
- `touch-action: manipulation` on buttons, `touch-action: none` on drag surfaces and range inputs, `overscroll-behavior: none` at the `html,body` level — currently only partially present (`PosFrame.tsx` has `overscroll-contain` on `main`, not the `html,body`-level rule both prototypes use; recommend promoting it to global scope so a single fast swipe near the shell edge can't accidentally trigger the browser's own pull-to-refresh/back-swipe during a checkout)

---

## 5. Component-level feel spec

**BigButton** (`ui.tsx`) — Add `transition-transform` (property-scoped, not `transition-all`) at `--dur-press` (100ms) with default browser `ease-out`; add `active:scale-[0.97]`. Keep `disabled:opacity-60 disabled:saturate-0` as-is — no motion on the disabled→enabled flip, that's a state readout, not an interaction. Do not add radius here beyond `--radius-pos-md` (8px) — this button's identity is its 2px hard border and huge tap target, not curvature.

**Chip** (`ui.tsx`) — Already has `transition-colors`; extend to `transition: color 140ms ease, background-color 140ms ease, transform 100ms ease` and add `active:scale-[0.97]` to match `BigButton` — right now `Chip` is the only primitive with any transition and `BigButton` (the far more consequential control) has none, which is backwards. Radius: `--radius-pos-sm` (6px).

**Field** (`ui.tsx`) — Add `transition: box-shadow 120ms ease-out` scoped to the existing `FOCUS` ring so the ring settles rather than snapping. No press/scale motion — fields aren't pressed, they're focused. Radius: `--radius-pos-sm` (6px), one step below `BigButton`'s 8px per the concentric-radius principle (outer chrome slightly more rounded than nested content).

**Panel** (`ui.tsx`) — No motion. Panels are structural containers, not interactive; the frequency-and-purpose test in the animate skill fails immediately (no trigger, no state change). Radius: `--radius-pos-md` (8px) only if a Panel ever gets a visible border-radius treatment at all — current recommendation is to leave Panel at 0 and reserve radius for controls, keeping the "printed card stock" reading of the outer shell intact.

**Banner** (`ui.tsx`) — Entrance only, when it appears/dismisses as a transient (error/success banner, not a persistent header banner): `--dur-pos` (180ms) translateY(8px)+opacity per the sheet/toast-enter motion in §2. A banner that's always mounted (e.g. a persistent status strip) gets no entrance motion at all — only apply this to banners that actually mount/unmount.

**TabBar** (`TabBar.tsx`) — The active-tab colour swap (`text-blue bg-cream` vs `text-cream`) currently has zero transition. Add `transition: color 140ms ease, background-color 140ms ease` to the tab `Link` — this is a state a volunteer sees dozens of times a shift (every screen switch), so keep the duration short and skip scale entirely; a colour settle is enough for a navigation element, reserving scale-press for primary actions only.

**PosFrame** (`PosFrame.tsx`) — No new motion inside the frame itself; it's the outer shell. The one recommended change is structural, not motion: promote `overscroll-behavior: none` from `main`'s `overscroll-contain` to the `html,body` level (see §4) so gesture containment matches both prototypes' scope.

**Kiosk canvas sticker drag** — Zero transition/animation *during* an active drag (direct `style.transform` mutation on pointer move, matching the prototype's own approach — this is correct in both prototype and, per available evidence, shipped code). On drop/placement: `opacity 0→1` over `--dur-kiosk` (340ms), `--ease-kiosk`, no positional transform (it must land exactly where released). Selection indicator: `outline: 2px solid var(--color-signal); outline-offset: 2px` — outline, not box-shadow, matching the prototype (outline doesn't affect layout or get clipped by `overflow:hidden` canvas containers the way a shadow can).

**Charge action** (POS) — This is the highest-stakes single control in the app and currently has the least feedback of anything in this document's scope. Full spec:
1. **Press** (`pointerdown`): `scale(0.97)`, 100ms, immediate — no waiting for network.
2. **Pending** (network in flight): do not scale back to 1 until resolution — holding the compressed scale communicates "working" without needing a spinner layered on top of a giant button; if the request exceeds ~600ms, layer the existing `animate-spin` treatment at small size in the button's trailing edge, not centered (don't obscure the price/label).
3. **Success**: instant state change (button becomes disabled/hidden, screen advances) — no celebratory animation, per the "must NOT animate" list in §2. The relief is getting to the next customer, not watching a checkmark animate.
4. **Failure**: `scale(1)` release is immediate (200ms max, faster than the press-in), paired with an error `Banner` using the sheet/toast-enter motion (§2) so the failure state visibly *arrives* rather than silently appearing — a failed charge is the one moment on this whole surface where the volunteer's attention must be forcibly redirected, so this is the one exception to "instant state changes only" for POS.


---
type: note
updated: 2026-08-10
---

# Design System

Part of [[Frontend Map]]. Implements PRD §11 and D19.

## The governing idea: asymmetric skin

PRD D19. The brand goes loud exactly where it sells and quiet where it works.

- **[[Surface - Kiosk]]** — full brutalist collision layout. Halftone, crop marks, star-bursts, rotated box labels, blue-primary hero. This is the surface a customer photographs, so it carries the brand load.
- **[[Surface - Volunteer POS]]** — restrained. Blue header band, cream ground, huge targets, maximum contrast. Somebody is squinting at a phone in direct sunlight with a queue in front of them; collision layout would be actively hostile.
- **Receipt and shift summary card** — print-shop treatment: crop marks, blue baseline band, box labels for totals.

## Tokens

Defined in `src/app/globals.css` as CSS custom properties, re-exported through Tailwind v4's `@theme inline`.

| Token | Value | Note |
|---|---|---|
| `--color-ink` | `#0f0f10` | near-black; also the `html/body` background |
| `--color-cream` | `#f7f5f1` | |
| `--color-blue` | `#1b4df5` | crftd blue |
| `--color-signal` | `#c6302b` | **destructive and warning states only** |
| `--color-line` | `#333333` | |

> **These deviate from the PRD §11 table** (`#1F3A93` blue, `#111111` ink, `#F4F0E6` cream, `#E8552A` orange). The deviation is deliberate and documented in `globals.css`: the values come from the executed `.dc.html` visual prototype, which supersedes the PRD table where they conflict. The blue is markedly more saturated and the signal colour has moved from orange toward red.

**Signal is reserved.** Void, negative stock, overdue collection. It must never appear decoratively on a volunteer screen, because its whole job is to be the only thing on the screen that means *stop*.

## Type

| Role | Loaded | Where |
|---|---|---|
| Body | **Plus Jakarta Sans** (300–800) | global, `--font-body` |
| Mono / numerals | **JetBrains Mono** (400, 700) | global, `--font-mono` |
| Serif accent | **Fraunces 900 italic** | **kiosk only**, `--font-fraunces` |

Both global faces load through `next/font/google`, so they are self-hosted, preloaded, and immune to a third-party font CDN outage at a stall on mobile data.

**Two licensing decisions are recorded in code, and both are correct:**

1. `layout.tsx` — the design reference calls for **Eina**, a paid Fontspring face. The `.ttf` files exist in `_import/` but are not shipped, because there is no evidence of a licence covering this deployment. Plus Jakarta Sans is the OFL substitute with similar geometric-grotesk proportions.
2. `kiosk/page.tsx` — Fraunces is explicitly noted as OFL/free, *and* deliberately scoped to the kiosk subtree so the restrained surface cannot inherit it.

PRD §11's Anton and Archivo Expanded Black are not loaded; their roles (display numerals, field labels) are served by weight and tracking on the two loaded faces.

## Utilities

- `.tap-target` → `min-height: 48px`, the PRD §11 floor.
- `.crop-marks` → `::before`/`::after` corner rules, the recurring print-shop motif on header bands.
- `.kiosk-slider` → enlarges the range thumb from ~16 px to **32 px** with a 3 px cream ring. A default thumb is ungrabbable on a touchscreen; this is the rotation control on the canvas.
- Number-input spinners are stripped globally — they are a mis-tap hazard on a POS.

## Accessibility posture

PRD §11 asks for **7:1 contrast** (sunlight, not WCAG minimums), 48 px targets, 16 px body floor, light mode only. The last commit on the branch (`bd9eba0`) was a dedicated a11y / contrast / touch-target pass, so this has had at least one deliberate sweep.

`TabBar` carries `aria-label="Primary"` and `min-h-[44px]` — note that is 44, not the 48 the `.tap-target` utility and the PRD specify.

## Responsive targets

| Surface | Viewport |
|---|---|
| Volunteer | 360–480, mobile |
| Kiosk | 768–1024 tablet, **portrait locked** |
| Admin | 1280+, desktop-first |

## Related
[[Frontend Map]] · [[Surface - Kiosk]] · [[Surface - Volunteer POS]]

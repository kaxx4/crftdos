---
type: note
updated: 2026-08-13
---

# Design Decision — Direction Resolved

Resolves the conflict flagged in [[Rework - Visual Direction]] §0 and §1, item 1. Written against `app-v2/src/app/globals.css`, `app-v2/src/components/ui.tsx`, and the kiosk/admin/POS shells as they actually exist in code today, not against the `.dc.html` prototypes or the old `app/` build those two docs were analysing.

**Read this first if you're picking up visual work on the kiosk, POS, or admin.** `app-v2` is the live app (see [[Architecture Overview]]) and it already made both of the decisions below, in code, before this document existed. This document formalises what's shipped and closes the ambiguity in the vault — it does not propose new changes.

---

## Decision 1 — Radius and motion

**Kept: a modest, deliberate radius scale on every surface (4–24px). Killed: the `Kiosk v3.dc.html` pill/999px direction, entirely, everywhere except the two physical drag-handle metaphors (range slider thumbs, `.kiosk-slider`) that legitimately want to look like a knob.**

This is *not* the "keep zero-radius, brutalist, hard-edged" recommendation [[Rework - Design System and Motion]] and [[Rework - Visual Direction]] argued for. Those docs were written against the older `app/` codebase, which really did ship at 0px radius everywhere. `app-v2` — the rebuild that superseded it — went a different way on its own initiative: `globals.css` defines `--radius-xs` (4px) through `--radius-xl` (24px), and `ui.tsx` applies `rounded-lg`/`rounded-xl`/`rounded-2xl` across `Panel`, `Field`, `Chip`, `Banner`, and the modal sheet, with the kiosk running one step softer than POS/admin. The `globals.css` header comment states the intent directly: *"Modest rounding on both surfaces. No pills — the 999px geometry from the v3 prototypes is deliberately killed."*

**Reason, one sentence:** the shipped `app-v2` code is the harder thing to change and it already resolved this consistently — a small, real radius scale everywhere, no pills anywhere except drag-handle controls — which happens to land close to what the design docs independently proposed (a small POS radius, a larger kiosk radius) without adopting either prototype's radius values verbatim.

**What changes in code:** nothing. This document is the formalisation, not a trigger for a design pass. If a future change wants to push the kiosk toward zero-radius brutalism or toward the v3 prototype's pills, that's a real design decision that needs to go through the same process this one did — don't silently drift either direction.

Motion: `app-v2/globals.css` also already ships the keyframe vocabulary [[Rework - Design System and Motion]] called for — `rise`, `pop`, `place` (with the one deliberately restrained overshoot, reserved for sticker placement only), `refuse`, `arrive`, `shimmer`, `marquee`, a `stagger` utility capped at 8 items, and a `prefers-reduced-motion` blanket kill with `.animate-spin` carved out as the named exception. This matches the rework doc's recommendation closely enough (right vocabulary, right restraint, right reduced-motion carve-out) that no further motion work is needed either. `Rework - Design System and Motion.md` is left as-is in the vault as the design rationale behind these choices — it's now describing something that shipped, not something proposed.

## Decision 2 — Wordmark spelling

**Canonical spelling: `CRFTD`, with the ✦ star used as a trailing decorative glyph (`CRFTD★`), never as a letter substitute inside the word.**

Checked every live occurrence in `app-v2`:

| File | Renders |
|---|---|
| `app/layout.tsx` (page title/metadata) | `crftd Stall OS` |
| `app/pos/receipt/page.tsx` | `CRFTD` |
| `features/admin/AdminShell.tsx` | `CRFTD★` |
| `features/kiosk/KioskApp.tsx` | `CRFTD★` |
| `features/kiosk/Storefront.tsx` | "crftd is the commercial arm of AQUATERRA / TerraRoots" |
| `features/kiosk/OrderStep.tsx` | UPI payee default `"crftd"`, ticket-note prefix `crftd-<id>` |

Every live instance spells the five letters **C-R-F-T-D**, lowercase in prose/metadata contexts and uppercase-tracked in the header wordmark, with the star (where present) appended after the D as a decorative glyph — not fused into the word as a letter substitute the way the `.dc.html` prototypes did (`CRFT★O`) or the way the old `app/` kiosk did (`CRFT★D`, star standing in for the O). This also matches the PRD's stated "crftd."

**Reason, one sentence:** `app-v2` is unanimous across five files and both the PRD and the live code agree on the same five letters, so there's no real ambiguity left to resolve — the star-substitution reading only existed in the two abandoned prototypes and the superseded `app/` build.

**What changes in code:** nothing. All six live references already agree. If any future screen renders the wordmark, use `CRFTD` (five letters, no star fused in) with an optional trailing `★` as a standalone decorative glyph.

## Related
[[Rework - Visual Direction]] · [[Rework - Design System and Motion]] · [[Design System]] · [[Architecture Overview]]

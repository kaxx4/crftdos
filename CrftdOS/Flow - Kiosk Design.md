---
type: flow
updated: 2026-08-10
---

# Flow - Kiosk Design

`src/app/kiosk/page.tsx` (758 lines). The Customer Design Studio. Part of [[User Flows]] and [[Surface - Kiosk]].

PRD §4 calls this the highest-leverage addition and the highest-risk one. Leverage: the customer self-serves the slow part (choosing and arranging) while a volunteer serves someone else. Risk: a design tool that accepts an order you physically cannot press.

## Stages

```
attract → path → product → canvas → ticket
```

State machine in one `useState`. Attract is full-screen with no navigation chrome; leaving requires the kiosk PIN.

## Two paths

**Presets** — a grid of pre-composed best sellers from `stall_presets`. Tap, choose colour/fit/size, done. Three taps to a ticket. This should carry most volume, because most customers do not want to design anything — they want the one they saw on Instagram.

**Canvas** — compose from scratch: product → side (front/back, priced independently) → browse/search designs → tap to drop → drag to position → rotate.

## The four constraints that keep it fulfillable

This is where the module either works or becomes a broken promise. All four are implemented.

### 1. No scaling (PRD D13)
There is no resize handle anywhere. Stickers render at true relative size:

```js
pxPerCmX = (printArea.w * IMG_W) / printArea.cm_w
wPx      = design.print_w_cm * pxPerCmX
```

Real print centimetres, scaled against the mockup's known print-area centimetres. The customer sees the actual size they will get. This is the most important constraint in the module — the transfers are pre-cut at fixed S/M/L, so a scalable canvas produces unfulfillable orders.

> Depends entirely on `print_w_cm` / `print_h_cm` being populated on every design and `print_area` on every SKU. Both are nullable. A null yields `NaN` geometry. See [[Known Issues]].

### 2. Print-area bounds
`clampCenterPct()` clamps a placement's centre so the sticker's half-width stays inside the printable rectangle:

```js
halfPct = (sizeCm / fullCm) * 50
return clamp(pct, halfPct, 100 - halfPct)
```

Nothing can land on a seam, a hem, or a sleeve.

### 3. Overlap blocked
Two transfers cannot be pressed on top of each other. `boxesOverlap()` is a standard AABB test against every other placement **on the same side**.

The implementation is more generous than the spec: rather than refusing the first collision outright, `placeDesign` tries a grid of six alternate centres `(30,30) (70,30) (30,70) (70,70) (50,25) (50,75)` and only refuses if all fail — *"No free space on this side without overlapping — remove one first."* It still enforces the rule; it just does not dead-end a customer on their first tap.

> The AABB is computed from unrotated `print_w_cm × print_h_cm`. Rotation is applied visually but not folded into the collision box, so a sticker rotated toward 45° has a real footprint larger than the box being tested. Two rotated stickers can therefore be accepted while physically colliding. Narrow, but real.

### 4. Stock-aware, with a real lock
A design with zero available transfers never enters the kiosk catalogue — `/api/kiosk/catalogue` subtracts active holds and filters `available_qty > 0`.

Placing a sticker **reserves it first**, before it appears on the canvas:

```js
holdId = await reserveSticker(design)   // POST /api/kiosk/reserve
if (!holdId) return
```

That endpoint wraps `stall_reserve_sticker_hold`, which takes `select ... for update` on the design row and recomputes availability inside the lock — so two kiosks cannot both compose with the last `M-014`. Removing a placement releases the hold; a failed release is surfaced rather than swallowed, and the TTL expires it anyway. See [[Holds]].

## Session identity

`sessionStorage["kiosk_session_id"]` — a UUID per customer session, used to scope reservations. Session storage, not local, so a fresh tab is a fresh customer.

## Price transparency
Running total visible at all times: `sku.unit_price + sum(placement.unit_price)`. No surprises at the till.

## What this is not

Not an e-commerce storefront. No payment, no accounts, no order history, no delivery. It is a composition tool that outputs a ticket for an in-person transaction. PRD §4.6 is explicit that it must not grow into a shop without a separate decision.

## Next
[[Kiosk Handoff]]

## Related
[[Holds]] · [[Sticker Catalogue]] · [[Product SKUs]] · [[Surface - Kiosk]]

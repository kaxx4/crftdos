---
type: flow
updated: 2026-08-10
---

# Kiosk Handoff

How a composed design crosses from the customer's tablet to the volunteer's till. Part of [[User Flows]]. Implements PRD D14 and §4.4.

## The design decision

PRD D14: **hand off by code, never by shared cart state.**

The alternative — a cart synced through the server between kiosk and till — fails on all three counts that matter here: it keeps the customer's session entangled with a till device, it does not survive eight devices, and it breaks the moment the kiosk drops offline mid-session. A ticket is a value the customer physically carries. It has none of those dependencies.

## What is generated

`POST /api/kiosk/ticket` creates a row in [[Database Tables#stall_design_tickets]]:

- **A 4-character code** from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` — 32 symbols, **no O/0 and no I/1**, because a volunteer will be reading it off a screen at arm's length in a queue. 32⁴ ≈ 1.05 M combinations; the route additionally re-rolls up to 5 times on a collision against existing codes.
- **`payload` jsonb** — the full composed cart: garment SKU, side, and every placement with `pos_x`/`pos_y` as **percentages of the print area** and `rotation` in degrees.
- **`quoted_total`**, **`expires_at`** (30 minutes).

## Redemption

The customer walks to the till. The volunteer types the code into the prominent field on [[Flow - Sell]]. `GET /api/tickets/[code]` returns the payload; the cart loads with placements attached.

On charge, `/api/orders`:
1. looks up the ticket by `code` where `status = 'open'`
2. flips it to `redeemed` and links `order_id`
3. **releases the kiosk's soft-hold reservations** for that ticket's stickers, because real stock is about to decrement instead — a failed release is non-fatal and written to `stall_admin_audit` rather than swallowed

## The ticket is a quote, not a sale

Nothing decrements until the volunteer charges. Expired tickets release their session reservations. This is what makes it safe to hand tickets to browsers who wander off.

## What is missing

### No QR
PRD D14 and §4.4 specify a QR **alongside** the code, as the fast path. The `qrcode` package appears exactly once in the codebase — in `admin/catalogue`, for the sticker label sheet. **The kiosk renders no QR at all.** Task #15.

### No offline handoff — and this is the important one
PRD §10 states the requirement in bold: *the QR encodes the full compressed payload, not just a lookup code.* The reasoning is spelled out — a ticket generated offline on the kiosk cannot be resolved by a till device on a different mobile connection, so the payload must travel **in the QR itself**, making the whole kiosk→till flow network-independent. The 4-character code was meant to be the *online-only fallback*.

What was built is the fallback and only the fallback. Redemption is a server lookup. So:

- Kiosk offline at ticket time → ticket row never reaches Postgres → code is unresolvable at the till.
- Till offline at redemption → lookup fails → cart cannot load.

The flow the spec most deliberately engineered to survive no network is currently the one most dependent on it. See [[Offline and Sync]].

### No press sheet
PRD §4.4 specifies a **composite PNG** of the tee with stickers in position — what the person at the heat press actually looks at — stored at `composite_path` and shown in the pending queue and on the order detail. The column exists; nothing writes to it. The machine-readable placement list *is* captured (in `payload` and on `stall_order_item_stickers`), so the press operator has coordinates but no picture.

## Related
[[Flow - Kiosk Design]] · [[Flow - Sell]] · [[Flow - Press and Collection]] · [[Holds]] · [[Known Issues]]

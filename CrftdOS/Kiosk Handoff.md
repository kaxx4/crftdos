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

## QR and offline handoff — fixed as of [[Changelog 2026-08-10]]

This section previously described two gaps: no QR at all, and redemption being a server lookup with no offline path. Both are closed. The kiosk QR now carries the **full compressed payload**, not a lookup code: JSON → `deflate-raw` → base64url under a `crftd:t:` prefix, with one- and two-character keys to fit QR capacity — satisfying PRD §10's bold requirement that the handoff survive kiosk and till being on two different, possibly-offline mobile connections. The 4-character code remains as the online-only fallback the till's field also accepts. See [[Offline and Sync]].

### No press sheet
PRD §4.4 specifies a **composite PNG** of the tee with stickers in position — what the person at the heat press actually looks at — stored at `composite_path` and shown in the pending queue and on the order detail. The column exists; nothing writes to it. The machine-readable placement list *is* captured (in `payload` and on `stall_order_item_stickers`), so the press operator has coordinates but no picture.

## Related
[[Flow - Kiosk Design]] · [[Flow - Sell]] · [[Flow - Press and Collection]] · [[Holds]] · [[Known Issues]]

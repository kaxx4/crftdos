---
type: reference
updated: 2026-08-10
---

# API Routes

Part of [[Architecture Overview]]. 33 route handlers under `app/src/app/api/`. Every one uses `supabaseAdmin()` (service role, RLS bypassed). Every one does its own cookie check *except* the three `/api/kiosk/*` routes, which are deliberately public — see [[Row Level Security]].

`middleware.ts` explicitly lets `/api/*` through untouched: *"API routes do their own auth checks per-handler."* There is no second gate.

---

## Auth

### `POST /api/auth/pin` · `DELETE /api/auth/pin`
Reads the argon2 hash from `stall_settings` (`pin_stall` / `pin_admin` / `pin_kiosk`), verifies with `@node-rs/argon2`, signs a JWT and sets an httpOnly cookie. Rate-limited to 5 failures per IP+kind per 15 min. `DELETE` clears the cookie. See [[Auth and Sessions]].

### `POST /api/auth/verify`
One-off PIN check that gates a *single action* (a >10% discount, the B2B margin override) without granting route access. Returns `{ok:boolean}`.
> ⚠️ **No rate limiting on this route.** It reaches the same `pin_admin` hash as `/api/auth/pin` but calls neither `checkRateLimit` nor `recordFailure`. Task #11.

---

## Shift

### `GET /api/shift/current?deviceId=`
Returns the single open shift plus this device's open receipt block. Called on boot by every volunteer page.

### `POST /api/shift/open`
Creates the shift, or joins the existing one if another device already opened it — including catching the `23505` from `stall_one_open_shift` when two devices race. Then allocates a 100-number receipt block for `deviceId`, deriving `start_no` from `max(end_no)+1` for the FY.
> The block allocation is a read-then-insert with no lock. Two devices opening simultaneously can compute the same `start_no`; the `(fy, start_no)` unique constraint catches it, but the loser gets a 500 rather than a retry. See [[Receipt Numbering]].

### `POST /api/shift/close`
Sums non-void orders for expected cash (`total` for cash, `paid_cash` for split), writes `variance`, closes the shift, then bulk-closes every open block for it in **one** update. Returns the count of voided numbers.

### `GET /api/shift/summary?shiftId=`
Gross, discounts, net, `raisedForAquaterra`, units, top-3 designs, cash variance. Feeds the shift summary card. Bounded by shift — fine.

---

## Selling

### `POST /api/orders` — the hot path
The most important route in the app. **As of [[Changelog 2026-08-10]] the whole charge is one call to `stall_create_order(jsonb)`** — idempotency, receipt number, customer, order, ticket redemption, every line, every sticker, every stock guard, every ledger row, in one round trip inside one transaction. An out-of-stock line anywhere in the order rolls the entire attempt back — stock, receipt number, order, movements and customer together — instead of leaving partial state.

Previously this route orchestrated ~30 sequential PostgREST round trips from Node with no transaction, so a mid-order failure left stock already decremented with no way to roll it back. That is the "headline" fix in [[Changelog 2026-08-10]] and it no longer applies — see [[Database Functions]] and [[Order Creation RPC]].

### `GET /api/orders?shiftId=&limit=`
Orders with nested items and stickers. `limit` is clamped 1–200 — but **only applied when `shiftId` is absent**. With a `shiftId` the shift's entire order set comes back unpaginated.

### `GET /api/orders/search?receipt=`
Exact `receipt_no` lookup. Returns four columns. Clean.

### `POST /api/orders/[id]/void`
Restocks everything the order consumed, writes `void` movements, soft-voids the order (number preserved). Runs through `stall_void_order` — one atomic RPC as of [[Changelog 2026-08-10]].

### `POST /api/orders/[id]/press`
PRD §3.2 one-tap **Pressed**. Plain `update` guarded by `eq("fulfillment_status", "pending_press")` — stamps `pressed_at`, order stays in the press queue. No RPC: single row, single column, no stock or ledger side effect.

### `POST /api/orders/[id]/handover`
PRD §3.2 one-tap **Handed Over**, the on-site flow's exit. Sets `fulfillment_status = 'handed_over'`; backfills `pressed_at` if the garment was handed over without an explicit Pressed tap first.

### `POST /api/orders/[id]/collect`
Collections tab's exit action for `collect_later` orders. Sets `fulfillment_status = 'collected'` and `collected_at`.

---

## Kiosk

All three kiosk routes are intentionally unauthenticated as of [[Changelog 2026-08-10]] — the kiosk is now the public site root (`/`), not a PIN-gated staff surface, so there is no session to check. Abuse surface is bounded by hold TTLs and ticket expiry rather than a login.

### `GET /api/kiosk/catalogue`
Six parallel queries (colors, fits, skus, designs, presets, active holds), then computes `available_qty` per design in JS and drops anything at zero, so a sold-out design never appears in the kiosk. Uses service role because anon cannot see holds.

### `POST /api/kiosk/reserve` · `DELETE`
Wraps `stall_reserve_sticker_hold` — the `for update` lock that stops two kiosks reserving the last transfer. `DELETE` releases. See [[Holds]].

### `POST /api/kiosk/ticket`
Generates a 4-char code from the unambiguous alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no O/0/I/1), retrying up to 5 times on collision, and stores the composed cart as `payload` jsonb with an expiry. See [[Kiosk Handoff]].

### `GET /api/tickets/[code]`
Till-side redemption lookup.

---

## Stock & operations

| Route | Notes |
|---|---|
| `PATCH /api/stock/product/[id]`, `/api/stock/sticker/[id]` | Manual adjustments + movement rows |
| `GET /api/restock` | Below-par and dead-stock lists. Computed in Postgres via `stall_restock_signals()` as of [[Changelog 2026-08-10]] — previously pulled every row of `stall_order_items`/`stall_order_item_stickers` over the wire; now only the answer crosses the wire. |
| `POST /api/restock` | Uses the atomic adjust RPC. Correct. |
| `POST /api/waste` | Logs waste, decrements with reason `damage` |
| `POST /api/returns` | Links to the original order; exchanges create a zero-value replacement |
| `GET/POST/PATCH /api/holds`, `/api/holds/[id]` | Reserve, convert, release |

---

## Admin

| Route | Notes |
|---|---|
| `GET /api/admin/analytics` | ⚠️ Selects **every order ever** with no date range or limit and aggregates in JS; same for waste, designs, SKUs, returns. PRD §13 asks for a selected period; there is no period parameter. Task #13 |
| `GET/PATCH /api/admin/pricing` | Inline cell edits + `bulk` set by fit. Writes `stall_admin_audit`. See [[Pricing]] |
| `GET/POST /api/admin/b2b`, `/api/admin/b2b/[id]` | Pipeline CRUD + activity log. See [[B2B Pipeline]] |
| `POST /api/admin/bulk` | Fixed as of [[Changelog 2026-08-10]] — batched inserts, moved onto the guarded stock RPC; insufficient-stock lines are now reported rather than silently miscounted. |
| `POST /api/admin/catalogue/import` | CSV bulk upsert for `stall_sticker_designs`, by code. Hand-rolled parser (quoted-field aware), no dependency. See [[Known Issues]] |
| `POST /api/admin/catalogue/cutouts` | Multipart bulk upload of cutout PNGs to the `stall-public` storage bucket; matched to designs by filename (`M-014.png` → code `M-014`) |
| `GET/POST /api/admin/mockups` | Tee mockup photo + print-area rectangle, per colour/fit/side, applied to every SKU sharing that combo |
| `GET /api/admin/email-status` | Resend domain verification status — reads `RESEND_API_KEY`, calls Resend's `/domains` if set |

---

## Cross-cutting observations

- ~~Three routes still do read-modify-write on stock (`bulk`, `void`)~~ **Fixed as of [[Changelog 2026-08-10]].** `void` now runs through the atomic `stall_void_order` RPC and `bulk` was moved onto the guarded stock RPC in the same session — no route does read-modify-write on stock anymore.
- ~~Two routes are unbounded reads (`admin/analytics`, `restock`)~~ **`restock` fixed as of [[Changelog 2026-08-10]]** — computed in Postgres via `stall_restock_signals()` instead of pulling every row over the wire. **`admin/analytics` is still unbounded** — selects every order/waste/design/SKU row with no date range or limit. Task #13.
- **No route sets `Cache-Control`.** Nothing here is cacheable enough to matter much, but `/api/kiosk/catalogue` is a candidate for a short `s-maxage` with Realtime for invalidation.
- Compression is handled by the Vercel edge and by Next's default `compress: true`; no route needs to do anything. See [[Performance Backlog]].

## Related
[[Auth and Sessions]] · [[Offline and Sync]] · [[Performance Backlog]] · [[Known Issues]]

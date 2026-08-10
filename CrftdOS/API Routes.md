---
type: reference
updated: 2026-08-10
---

# API Routes

Part of [[Architecture Overview]]. 30 route handlers under `app/src/app/api/`. Every one uses `supabaseAdmin()` (service role, RLS bypassed) and does its own cookie check — see [[Row Level Security]].

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
The most important and most expensive route in the app. Sequence:
1. Idempotency `select` on the client UUID → return existing if found
2. `select` the device's open receipt block
3. `stall_consume_receipt_no` RPC
4. optional customer `insert`
5. order `insert`
6. optional design-ticket `select` + `update` + hold release
7. **per line**: item `insert` → `stall_adjust_product_stock` → movement `insert`
8. **per sticker**: optional custom-sticker seq + `insert` → sticker `insert` → `stall_adjust_sticker_stock` → movement `insert`

> ⚠️ ~30 sequential PostgREST round trips for a 2-garment / 6-sticker order, and **not a transaction**. `abortOrder()` soft-voids the order on failure but cannot roll back stock already decremented. Task #2 — see [[Performance Backlog]].

### `GET /api/orders?shiftId=&limit=`
Orders with nested items and stickers. `limit` is clamped 1–200 — but **only applied when `shiftId` is absent**. With a `shiftId` the shift's entire order set comes back unpaginated.

### `GET /api/orders/search?receipt=`
Exact `receipt_no` lookup. Returns four columns. Clean.

### `POST /api/orders/[id]/void`
Restocks everything the order consumed, writes `void` movements, soft-voids the order (number preserved).
> ⚠️ Restocks via `SELECT stock_qty` → `UPDATE` with a JS-computed value — the exact lost-update race migration 001 added the atomic RPCs to fix. This route was never converted. Task #12.

---

## Kiosk

### `GET /api/kiosk/catalogue`
Six parallel queries (colors, fits, skus, designs, presets, active holds), then computes `available_qty` per design in JS and drops anything at zero, so a sold-out design never appears in the kiosk. Uses service role because anon cannot see holds. **No auth check** — but the `/kiosk` *page* is PIN-gated by middleware.

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
| `GET /api/restock` | Below-par and dead-stock lists. ⚠️ Pulls **every row** of `stall_order_items` and `stall_order_item_stickers` over the wire to build two id Sets. Task #4 |
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
| `POST /api/admin/bulk` | ⚠️ N+1 loop **and** read-modify-write stock (does not use the atomic RPC). Task #3 |

---

## Cross-cutting observations

- **Three routes still do read-modify-write on stock** (`bulk`, `void`) while the rest use the atomic RPCs. Migration 001 fixed the pattern; the conversion was incomplete.
- **Two routes are unbounded reads** (`admin/analytics`, `restock`) that grow forever with sales volume.
- **No route sets `Cache-Control`.** Nothing here is cacheable enough to matter much, but `/api/kiosk/catalogue` is a candidate for a short `s-maxage` with Realtime for invalidation.
- Compression is handled by the Vercel edge and by Next's default `compress: true`; no route needs to do anything. See [[Performance Backlog]].

## Related
[[Auth and Sessions]] · [[Offline and Sync]] · [[Performance Backlog]] · [[Known Issues]]

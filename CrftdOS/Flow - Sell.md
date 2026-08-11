---
type: flow
updated: 2026-08-10
---

# Flow - Sell

`src/app/sell/page.tsx` (880 lines). The screen that has to be fast. Part of [[User Flows]].

> **AUDIT NOTE:** As of [[Changelog 2026-08-10]] fifth pass, Sell lives at `app/sell/page.tsx` (kiosk moved to `app/page.tsx`, the site root). This doc's 880-line figure matches the Aug 10 state; [[Rework - Master Plan]] (Aug 11, in-progress rework) cites 1,222 lines for the same file as its pre-rework baseline. Both may be correct for their respective dates — not verified against the current uncommitted working tree, which is out of this audit's scope.

## Layout

Single screen, no navigation mid-sale. Cart on top, entry controls in the middle, total and **Charge** pinned to the bottom.

## Boot

```js
getDeviceId()
  → GET /api/shift/current?deviceId=      // no open shift → redirect /shift-open
  → Promise.all([ colors, fits, skus, designs ])   // anon supabase client
```

Two serial hops. The catalogue does not depend on the shift, so the second is needlessly gated behind the first — task #5, [[Performance Backlog]].

## Adding to the cart

**Product** — type (Tee, locked) → colour → fit → size. Sizes not stocked in a fit are hidden. Out-of-stock is greyed with the count, still selectable behind a confirmation, because a volunteer with the physical garment in hand outranks the database.

**Sticker** — four input modes, per PRD §3.1:
1. Type the code. `14` matches `S-014`/`M-014`/`L-014`; `m14` matches `M-014`.
2. Browse the grid, filter by size class and tag.
3. Tap from the **Recent** row — the 8 most-used this shift.
4. Scan the QR on the sleeve *(behind a flag; camera scanning is Phase 5 and not built)*.

Results show **bin location** next to the code, so the volunteer knows where to physically walk: `M-014 · Box 2 / Tab M · 12 left`. This is the single highest-value detail on the screen and it is why [[Sticker Catalogue]] carries `bin_location` at all.

**Design ticket** — a prominent field takes the 4-char kiosk code and pulls the whole composed cart with placements. See [[Kiosk Handoff]].

**Custom sticker** — size class, description, price. Allocates the next `C-####`.

## Discount

Amount or percentage, plus a reason enum. Above 10% opens an admin-PIN prompt that calls `/api/auth/verify` — a step-up check that grants no session. See [[Auth and Sessions]].

Manual total override exists and is flagged separately (`orders.manual_override`) so analytics can tell a considered discount from a typed-over total.

## Payment

UPI / Cash / Split / Pending. A single TerraRoots UPI destination means the reference field is optional and reconciliation is a sum against one bank statement. Split reveals two fields that must total (`splitOk`).

## Charge — the important part

```
guard: cart non-empty, admin gate satisfied, split totals, shift + block present
  ↓
build payload (client uuid, items, stickers, totals, payment)
  ↓
resetCart(); setCharging(false)        ← UI clears HERE, before any network
  ↓
if (navigator.onLine) POST /api/orders
if (!synced) enqueueOrder(...)          ← IndexedDB outbox
  ↓
sessionStorage["last_receipt"] = {...}  → /receipt
```

The cart clears **before** the await. The screen is ready for the next customer regardless of the network. Offline, `receipt_no` reads `PENDING SYNC` until the outbox flushes. 8-second undo toast.

See [[Offline and Sync]] for the outbox, [[Receipt Numbering]] for the number.

> The server side of this — `POST /api/orders` — is the app's worst performance and correctness liability: ~30 sequential round trips and no transaction. [[Performance Backlog]] item 1.

## Customer sheet

Slides up after charge. Name, phone, email, marketing consent **unticked by default**. Skippable in one tap — *unless* the order has a custom or canvas item on a collect-later shift, where contact is mandatory because you have to reach them.

> Each capture inserts a **new** `stall_customers` row with no phone lookup, so a repeat buyer becomes N rows. Task #9.

## Related
[[Flow - Press and Collection]] · [[Receipt Numbering]] · [[Offline and Sync]] · [[Pricing]]

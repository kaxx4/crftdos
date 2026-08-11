---
type: note
updated: 2026-08-10
---

# Offline and Sync

Part of [[Architecture Overview]]. Implements PRD §10. The stall runs on mobile data at a school festival; assume the network is absent.

## The outbox

`src/lib/outbox.ts` — IndexedDB store `stallos-outbox` / `orders`, keyed by the client-generated order UUID.

```
type OutboxOrder = { id, payload, queuedAt, status: 'queued'|'syncing'|'failed', lastError? }
```

The UUID is the idempotency key at both ends: it is the order's primary key in Postgres, and `/api/orders` starts by selecting on it and returning the existing row if found. A retry can therefore never double-charge.

## Charge is optimistic, and correctly so

`charge()` in `src/app/sell/page.tsx` does this, in this order:

```
build payload  →  resetCart()  →  setCharging(false)   ← UI is already clear
               →  if (navigator.onLine) try POST /api/orders
               →  if (!synced) enqueueOrder(...)
```

The cart clears **before** any network work. The screen is ready for the next customer within a frame whether the POST takes 80 ms or never completes. This is exactly the pattern PRD §3.1 asks for ("screen clears within 100ms regardless of network") and it is already right — no change needed.

The trade: the volunteer sees `receipt_no: "PENDING SYNC"` on an offline sale, because the real number comes back from the server. The number itself is still deterministic — it was reserved from this device's block — but the client does not compute it locally. See [[Receipt Numbering]].

## Flushing

`flushOutbox()` walks queued items **serially** and POSTs each. Serial is deliberate: parallel flushes would race on the device's receipt block.

Reentrancy is guarded by a module-level `inFlightFlush` promise — a second caller awaits the first run rather than starting a concurrent pass. This matters because two events can fire near-simultaneously:

```js
document.addEventListener("visibilitychange", onVis);
window.addEventListener("online", onVis);
```

**Why those two events and not Background Sync:** iOS Safari does not implement Background Sync. So flushing can only happen while the app is foregrounded. Practically — *a volunteer must open the app for queued sales to sync*. That is a human process dependency, not a technical one, and it is why:

- the connectivity bar must be unmissable, and
- shift close must block on a non-empty outbox.

## Failure semantics

| Outcome | Status written | Retried? |
|---|---|---|
| `res.ok` | removed from store | — |
| non-OK response | `failed` + `lastError` | **No** — `flushOutboxInner` skips nothing on status, but `failed` items are re-attempted on the next pass since only `syncing` is skipped |
| network throw | `queued` + `lastError` | yes |

Note the asymmetry: a server-side rejection (out of stock, exhausted receipt block) parks the item as `failed`, and it will be retried forever on every subsequent flush, failing identically each time. There is no dead-letter state and no UI to inspect or discard a poisoned item. See [[Known Issues]].

## How much of "offline-first" is actually built

**Fixed as of [[Changelog 2026-08-10]]** — this section previously described three structural gaps (no PWA, no catalogue cache, no kiosk QR). All three are now closed:

**1. PWA — built.** A manifest, an SVG icon (rasterised to `public/icon-192.png`/`icon-512.png` via `sharp`), and a hand-written `sw.js` with three rules, the first being *never cache `/api/*`*. Navigations are network-first with a cached shell; static assets are cache-first. `public/sw.js`'s precache list is hand-maintained — a new volunteer route must be added there or it will not work offline (see [[Known Issues]] watch list).

**2. Catalogue cache — built.** `src/lib/catalogueCache.ts` snapshots the catalogue into IndexedDB (a separate database from the outbox on purpose — the outbox holds money, this is disposable derived data) so the Sell screen boots from the snapshot when the network is gone. A banner names the snapshot's age so a volunteer knows they're selling from stale data. A failed shift lookup no longer bounces a mid-shift volunteer to `/shift-open`.

**3. Kiosk QR — built.** The QR now carries the whole cart: JSON → `deflate-raw` → base64url under a `crftd:t:` prefix, one- and two-character keys to fit QR capacity. The till's field accepts either a scan or a typed code, so the 4-character code remains the online-only fallback rather than the only path. See [[Kiosk Handoff]].

**Net:** the outbox, the PWA, the catalogue cache and the offline-capable QR together mean "the app survives no network" (PRD Appendix A item 10) now holds for both starting offline and losing the network mid-session. Not yet browser-verified per the Changelog's own note (ninth pass): the stale-catalogue banner and service-worker behaviour in production are still on the "not verified in a browser" list.

## Related
[[Known Issues]] · [[Performance Backlog]] · [[Receipt Numbering]] · [[Kiosk Handoff]] · [[User Flows]]

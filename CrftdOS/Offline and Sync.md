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

`charge()` in `src/app/page.tsx` does this, in this order:

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

Less than the spec, and the gap is structural. Three things are missing, and together they undercut the outbox:

**1. There is no PWA.** No `manifest.json`, no service worker, no `next-pwa` or workbox anywhere. `public/` holds svgs and mockups. PRD Phase 1 scoped "Offline outbox and PWA"; only the outbox shipped.
→ The outbox protects a sale made while the tab is *already open*. A reload, a tab eviction, or a cold open on a dead network yields a browser error page. Task #14.

**2. There is no catalogue cache.** `src/lib/outbox.ts` is the only IndexedDB user in the codebase. Both the Sell page and the kiosk fetch the catalogue fresh from the anon Supabase client on every boot. PRD §10 specifies the full catalogue plus thumbs and cutouts (~15–25 MB), with the kiosk pre-fetching cutouts on wifi at setup.
→ Offline, there is nothing to sell from. Task #16.

**3. The kiosk generates no QR.** The `qrcode` package appears exactly once, in `admin/catalogue` for the sticker label sheet. PRD §10 makes it a hard requirement that the handoff QR encode the **full compressed payload** rather than a lookup code, precisely so kiosk→till survives no network. As built, redemption is a server lookup on the 4-char code.
→ The one flow the spec most deliberately designed to be network-independent is the one that hard-requires the network. Task #15. See [[Kiosk Handoff]].

**Net:** the outbox is solid and the optimistic charge is correct, but "the app survives no network" (PRD Appendix A item 10) is not true today. It survives *losing* the network mid-session. It does not survive starting without one.

## Related
[[Known Issues]] · [[Performance Backlog]]

## Related
[[Receipt Numbering]] · [[Kiosk Handoff]] · [[User Flows]] · [[Known Issues]]

---
type: reference
updated: 2026-08-10
---

# Frontend Map

Part of [[Architecture Overview]]. 17 pages, 3 shared components, all client-rendered.

## Route table

### Volunteer — [[Surface - Volunteer POS]]
| Route | File | Lines | What |
|---|---|---|---|
| `/` | `app/page.tsx` | 880 | **Sell.** The main POS screen. See [[Flow - Sell]] |
| `/orders` | `app/orders/page.tsx` | 264 | Shift log, pending press queue, voids, summary card export |
| `/holds` | `app/holds/page.tsx` | | Active reservations with countdown |
| `/stock/products` `/stock/stickers` | | | Inventory matrices |
| `/restock` | | | Below-par, dead stock, print queue |
| `/waste` | | | Log a failed press |
| `/returns` | | | Returns and exchanges |
| `/more` | | | Overflow nav |
| `/shift-open` | | | Shift setup + receipt block allocation |
| `/receipt` | | | Rendered receipt, WhatsApp deep link |
| `/pin` | | | PIN entry for all three kinds |

### Kiosk — [[Surface - Kiosk]]
| `/kiosk` | `app/kiosk/page.tsx` | 758 | Attract → presets or canvas → ticket |

### Admin — [[Surface - Admin]]
| `/admin` | 86 | Dashboard |
| `/admin/analytics` `/admin/pricing` `/admin/b2b` `/admin/bulk` `/admin/catalogue` | | |

## Components

- **`PosFrame.tsx`** — the volunteer chrome: blue header band, crop marks, connectivity state.
- **`TabBar.tsx`** — sticky bottom nav, five tabs (Sell · Stock · Orders · Restock · More), `min-h-[44px]` targets, `aria-label="Primary"`.
- **`ui.tsx`** — the primitive set: `BigButton`, `Chip`, `Field`, `Panel`, `PanelLabel`, `Banner`, `Mono`. See [[Design System]].

## State model

There is **no state library**. No Redux, Zustand, TanStack Query, SWR, or React Context. Every page is a `useState` island that fetches its own data in a `useEffect` on mount.

Consequences worth naming:
- Navigating Sell → Orders → Sell **refetches the entire catalogue**. There is no cache to hit.
- The Sell page alone holds ~25 `useState` calls. It is the natural first candidate for a reducer.
- Cross-page invalidation does not exist — a stock change on `/stock/stickers` is invisible on `/` until remount or a Realtime event.

That is a defensible choice for an app this size, but it is the reason [[Performance Backlog]] item 5 (the boot waterfall) hits on *every* navigation rather than once.

## Data access from the client

Two paths, chosen per call site:

```js
// direct anon read — catalogue only, RLS-enforced
supabaseBrowser().from("stall_sticker_designs").select("*")

// everything else
fetch("/api/...")
```

The Sell page boot does both, and does them **serially**:

```js
const res = await fetch(`/api/shift/current?deviceId=${deviceId}`);  // hop 1
...
const [c,f,s,d] = await Promise.all([ ...4 supabase queries ]);      // hop 2
```

The catalogue does not depend on the shift, so hop 2 is needlessly gated behind hop 1. Task #5.

## Rendering

Every page carries `"use client"`. No page exports `dynamic`, `revalidate`, `runtime` or `fetchCache`; no page uses `cookies()` or `headers()`. So Next prerenders each one to a **static shell at build time** — nothing is re-rendered per visitor, and the "server rebuilding HTML for every visitor" failure mode does not apply here.

The cost lands elsewhere: a blank shell, then hydration, then a fetch waterfall before anything is usable.

## Fonts

`next/font/google` — **Plus Jakarta Sans** (body) and **JetBrains Mono**, self-hosted and preloaded by the loader, exposed as `--font-body` / `--font-mono`.

The design reference specifies **Eina**, a paid Fontspring-licensed face. `layout.tsx` carries an explicit note that the `.ttf` files are *not* shipped because there is no proof of a licence covering this deployment, and Plus Jakarta Sans is the OFL substitute. Good call, and the reasoning is recorded where the next person will find it.

**Fraunces 900 italic** is loaded separately and *only inside* `kiosk/page.tsx`, scoped via `fraunces.variable` on the kiosk root so the restrained volunteer skin cannot pick it up. It renders the "yours" in *Build yours*, per PRD §11.

Anton, Archivo Expanded Black and Chivo from the PRD §11 stack are not loaded at all. See [[Design System]].

## Related
[[Design System]] · [[User Flows]] · [[Offline and Sync]] · [[Performance Backlog]]

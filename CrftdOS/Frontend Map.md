---
type: reference
updated: 2026-08-13
---

# Frontend Map

Part of [[Architecture Overview]]. Describes `app-v2`, the current live app — not the old `app/` v1 build. No route is PIN-gated; see [[Auth and Sessions]].

## Route table

### Volunteer — `/pos/*`
| Route | What |
|---|---|
| `/pos/sell` | **Sell.** The main POS screen. See [[Flow - Sell]] |
| `/pos/orders` | Shift log, pending press queue, voids, summary card export |
| `/pos/holds` | Active reservations with countdown |
| `/pos/stock` | Inventory matrices |
| `/pos/press` | Press queue / production board |
| `/pos/waste` | Log a failed press |
| `/pos/returns` | Returns and exchanges |
| `/pos/leads` | Lead capture — bulk-order / custom-tee enquiries (`stall_leads`, migration 036). Distinct from B2B: a lead is "someone worth following up with," not a committed deal |
| `/pos/receipt` | Rendered receipt, WhatsApp deep link |
| `/pos/more` | Overflow nav |

`/pin` and `/admin/pins` **do not exist in `app-v2`** — PIN auth was removed 13 Aug (see [[Auth and Sessions]]). Do not add them back or link to them; if you find a reference to either in older docs or code comments, it's describing the removed v1 model.

### Kiosk
| `/` | Attract → presets or canvas → ticket. Public, no gate, none needed — it was already unauthenticated even under the old PIN model. |

### Admin — `/admin/*`
| Route | What |
|---|---|
| `/admin` | Dashboard |
| `/admin/analytics` | |
| `/admin/pricing` | |
| `/admin/b2b` | |
| `/admin/bulk` | |
| `/admin/catalogue` | |
| `/admin/stock` | |
| `/admin/environments` | Manage `stall_environments` — see [[Database Map]] |
| `/admin/templates` | Manage `stall_templates` (kiosk preset designs) |
| `/admin/discounts` | Discount log/audit — see [[Known Issues]] re: the discount step-up flow that used to gate this |

> The old v1 discount flow required a PIN step-up (`/api/auth/verify`) for discounts over 10%. That step-up endpoint is gone along with the rest of PIN auth (see [[Auth and Sessions]]) — `/admin/discounts` is now a plain, ungated log, not a gate.

## Components

- **`RoleSwitcher.tsx`** (`app-v2/src/components`) — the credential-free Volunteer/Kiosk/Admin toggle that replaced PIN auth, wired into every shell header (`PosShell`, `AdminShell`, `KioskApp`). Persists the last-picked role in `localStorage` as a convenience only — not an access control. See [[Auth and Sessions]].
- **`PosShell`**, **`AdminShell`**, **`KioskApp`** (`app-v2/src/features/{pos,admin,kiosk}`) — the per-surface chrome, each carrying the `RoleSwitcher`.
- **`ui.tsx`** (`app-v2/src/components`) — the primitive set: `BigButton`, `Chip`, `Field`, `Panel`, `Card`, `Banner`, `Mono`, etc. See [[Design System]] and [[Design Decision - Direction Resolved]] for the current radius/motion tokens.

## State model and data access

Not re-verified against `app-v2`'s current source as part of this pass — the v1 notes on this (no state library, direct anon Supabase reads for catalogue + `fetch /api/*` for everything else, serial boot waterfall) may still broadly hold given `app-v2` shares the same client/server split (see [[Architecture Overview]]), but treat specifics (hook counts, `useState` counts, exact boot sequence) as unconfirmed for `app-v2` until someone checks.

## Fonts

Plus Jakarta Sans (body) + JetBrains Mono, self-hosted via `next/font/google`. Fraunces 900 italic loaded separately and scoped to the kiosk only. Eina (PRD-referenced, paid Fontspring face) is still not shipped — no licence evidence. See [[Design System]] for the reasoning, which still holds in `app-v2`.

## Related
[[Design System]] · [[Design Decision - Direction Resolved]] · [[Auth and Sessions]] · [[User Flows]] · [[Offline and Sync]]

---
type: note
updated: 2026-08-10
---

# Auth and Sessions

Part of [[Architecture Overview]]. Implements PRD §12. **Supabase Auth is not used at all** — there are no user accounts. There are three shared PINs and three cookies.

## Why PINs and not accounts

Eight devices, a rotating cast of teenage volunteers, no time to onboard anyone. A shared PIN per *role* is the right granularity. Attribution happens at the order level via `sold_by`, not at the session level.

## The three kinds

| Kind | Cookie | TTL | Gates |
|---|---|---|---|
| `stall` | `stallos_stall_session` | 14 h — one long shift | `/`, `/orders`, `/stock/*`, `/restock`, `/holds`, `/waste`, `/returns`, `/more`, `/shift-open`, `/receipt` |
| `admin` | `stallos_admin_session` | 4 h | `/admin/*` |
| `kiosk` | `stallos_kiosk_session` | 14 h | `/kiosk` |

The kiosk PIN exists for exactly one reason: to stop a *customer* navigating out of kiosk mode. It is not protecting anything valuable.

Admin is a genuinely separate gate — holding a stall session does not get you into `/admin`.

## Mechanics

`src/lib/session.ts`:
- PIN hashes live in `stall_settings` under `pin_stall` / `pin_admin` / `pin_kiosk`, hashed with **argon2** (`@node-rs/argon2`).
- On success, `signSession()` mints an **HS256 JWT** via `jose` carrying `{kind, deviceId}` and an expiry.
- Signing key is `process.env.PIN_SESSION_SECRET`; the module **throws at import time** if it is missing or under 16 chars, which is the right failure mode.
- Cookie is `httpOnly`, `sameSite: lax`, `secure` in production, `path: /`.
- `verifySession(kind, token)` checks the signature *and* that `payload.kind` matches — so a kiosk cookie cannot be replayed against an admin route.

No PIN or hash ever reaches client JavaScript.

## Two enforcement points

1. **`middleware.ts`** — gates pages. Matches everything except `_next/static`, `_next/image`, `favicon.ico`, `fonts`, then additionally short-circuits on a `PUBLIC_PATHS` list and on a `STATIC_FILE` regex.
   > The static-file regex exists because of a real bug: unauthenticated `<img>` requests for sticker cutouts were being redirected to the PIN *page*, and the browser then tried to render HTML as an image.
2. **Each route handler** — gates data. Middleware passes `/api/*` straight through, so the handler's own `verifySession` call is the **only** thing standing between the internet and a service-role client. A handler that forgets it is a full database breach.

## Step-up auth

`/api/auth/verify` does a one-off PIN check without issuing a session — used for the >10% discount gate and the B2B margin override. It returns `{ok}` and grants nothing persistent.

> ⚠️ It is **not rate-limited**, unlike `/api/auth/pin`, while reaching the same admin hash. Task #11. See [[Known Issues]].

## Rate limiting

`src/lib/rateLimit.ts` — an in-process `Map` of IP+kind → `{count, resetAt}`, 5 attempts per 15 minutes.

The file's own header comment admits the flaw: on Vercel each serverless instance holds its own Map, so the limit is per-instance, not per-IP. In practice this means PRD §12's brute-force protection is **largely unenforced in production**. Task #10.

## Device identity

`src/lib/deviceId.ts` mints `dev-xxxxxxxx` from `Math.random()` into `localStorage`. It is not a security control — it is the key that ties a device to its [[Receipt Numbering|receipt block]] and stamps `orders.device_id`. Clearing browser storage orphans a device from its block, which surfaces as *"No receipt numbers left on this device's block. Reopen shift on this device."*

## Related
[[Row Level Security]] · [[API Routes]] · [[Known Issues]]

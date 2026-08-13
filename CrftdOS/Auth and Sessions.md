---
type: note
updated: 2026-08-13
---

# Auth and Sessions

Part of [[Architecture Overview]]. Describes `app-v2`, the current live app. **There is no auth model.** This replaces PRD §12's PIN-based design, which was implemented once (in the old `app/` build, still described in v1-era docs and below for history) and then deliberately removed rather than ported forward.

## The current model: a role toggle, not a gate

`app-v2/src/components/RoleSwitcher.tsx` renders a plain three-way switch — **Volunteer / Kiosk / Admin** — in the header of every shell (`PosShell`, `AdminShell`, `KioskApp`). It has no credential, no server round-trip, and no session. Picking a role just navigates (`/pos`, `/`, `/admin`) and remembers the choice in `localStorage` so a refresh doesn't reset it. The component's own header comment says it plainly: *"Small trusted-volunteer environment — anyone can switch, no gate... it is a UI convenience, not an access control."*

`middleware.ts` is a no-op — it matches every non-static path and returns `NextResponse.next()` unconditionally. No cookie is read, no redirect happens, nothing is gated at the page level. Every route handler under `app-v2/src/app/api` had its session check (`requireSession`/`requireAnySession`) removed in the same pass. **Every surface and every API route is open to anyone who can reach the deployment.**

## This was a deliberate decision, not an oversight

Commit `361bc4c`, "Remove PIN authentication, add role/mode toggle," 13 Aug: *"PIN gating was a false sense of security for a small trusted-volunteer event stall."* The reasoning, spelled out so a future session doesn't silently "fix" this by reintroducing a PIN:

- The old three-shared-PIN model (below) never provided real access control in the first place — a PIN known to eight rotating teenage volunteers and printed on a laminated card at the till is not a security boundary against anyone with physical access, and this product's whole threat model is "someone at the stall," not "an internet attacker." The PIN's actual job was accidental clicks and the odd customer wandering into `/sell`, not defense against a determined person.
- Maintaining it cost real surface area: an HS256 JWT scheme, argon2 hashing, a PIN-change feature that was never built, a step-up-auth endpoint (`/api/auth/verify`) that was flagged in [[Known Issues]] as unrate-limited against the same hash the rate-limited login endpoint protected, and a rate limiter that (before migration 004) didn't even work correctly on Vercel's per-instance model.
- What actually matters — customer-facing PII, payment data, the live database — is protected by the service-role/anon-client split described in [[Architecture Overview]] and by [[Row Level Security]], neither of which depended on the PIN layer at all. Removing PINs did not remove that protection.

**If a future session is tempted to add a PIN, cookie, or login screen back in "for security," that is relitigating a decision the product owner already made on 13 Aug, not fixing a bug.** Raise it as a product question first.

## What actually distinguishes "who did this"

Order/action attribution still happens the same way it always did in this product — at the row level (`sold_by`, `actor`, `logged_by` columns), not at the session level. Nothing about the auth removal touched attribution; a volunteer or admin picks their name/role in-flow where the schema asks for it, same as before.

## Deferred: rate limiting

`stall_rate_limits` (migration 004) is a real database-backed rate limiter, replacing the old in-process `Map` that didn't work across serverless instances. It's still wired up for the kiosk-events insert budget (`stall_kiosk_events_rate_limit()`, a DB trigger) even though the PIN-login use case it was originally built for is gone. It's a reasonable primitive to reach for if any future public-facing write path needs abuse protection.

---

## Historical: the PIN model (old `app/` build, removed, not in `app-v2`)

Kept for context — this describes what the "PIN gating" that got removed on 13 Aug actually was.

Eight devices, a rotating cast of teenage volunteers, no time to onboard anyone. A shared PIN per *role* was the model: `stall` (gated `/sell` and most volunteer routes, 14h TTL), `admin` (gated `/admin/*`, 4h TTL), `kiosk` (existed in the auth system but nothing gated on it after the kiosk moved to the public site root). PIN hashes lived in `stall_settings`, hashed with argon2; sessions were HS256 JWTs signed with `PIN_SESSION_SECRET`, carried in an `httpOnly` cookie. `/api/auth/verify` did a one-off step-up PIN check (discount gate, B2B margin override) without issuing a session, and was never rate-limited against the same admin hash the rate-limited login endpoint protected — see the old [[Known Issues]] entries for that gap. None of this exists in `app-v2`.

## Related
[[Row Level Security]] · [[API Routes]] · [[Known Issues]] · [[Architecture Overview]]

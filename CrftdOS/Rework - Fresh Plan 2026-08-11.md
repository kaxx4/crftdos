---
type: plan
updated: 2026-08-11
status: draft — open questions resolved, ready to move to Phase 0
---

# Fresh Rework Plan — 11 Aug 2026

Supersedes [[Rework - Master Plan]] as the *frontend* direction. Part of [[crftd Stall OS]].

**Hard constraint, unchanged:** existing Supabase project (`drvucogrjphctwfealxd`) stays as the source of truth. No schema/RPC edits land in this track. Anything the new flows need that the backend doesn't have today becomes a **separate requirements document**, run in its own session, connected to Supabase directly. This plan produces that document as one of its outputs, it does not execute it.

**Git history stays.** The already-committed decomposition (kiosk → `src/features/kiosk/`, partial sell/orders extraction) is not reverted. It's the starting point to redesign forward from, not something to undo. Where the new flow direction conflicts with it, we replace files; we don't reset commits.

**Priority order:** flows and behavior first, per surface, in parallel tracks. Visual system follows once each surface's flow is settled — not before.

---

## 1. The end-to-end model, as described

```
                                    ┌─────────────────────────┐
                                    │         ADMIN           │
                                    │  templates · sticker    │
                                    │  sizes · pricing ·      │
                                    │  stall/online mode ·    │
                                    │  analytics · B2B        │
                                    └────────────┬─────────────┘
                                                 configures
                                                 ▼
   customer                                  KIOSK                              volunteer POS
   ─────────                          ─────────────────                       ──────────────────
   walks up / opens link  ──────►  home (ecommerce-style):
                                    templates, "most popular",
                                    start blank canvas
                                          │
                                    canvas: drag/drop stickers
                                    (sizes/colors from admin)
                                          │
                                    order: name + number + payment
                                          │
                                    order ticket generated
                                    (design snapshot, immutable) ─────────►  ticket lands in
                                                                             PREP queue
                                                                                   │
                                                                             pull stickers,
                                                                             mark PREPPED
                                                                                   │
                                                                             PRINT station sees
                                                                             prepped tickets,
                                                                             press, mark PRINTED
                                                                                   │
                                                                             package, mark
                                                                             HANDED OVER
```

Two kiosk *modes*, both admin-controlled, **running simultaneously** — not exclusive:
- **Stall mode** — local, on-site tablet/phone. Multiple physical stalls can run at once, each a **localized environment**: it operates on its own local data (works if the connection is flaky, doesn't wait on a round trip to a shared server for every interaction) and syncs up into the central dataset once that stall's session completes. All synced stalls' sales roll up into one aggregate — the org doesn't care which physical stall a sale came from for the headline numbers, it's all one *Raised for AquaTerra* total.
- **Online mode** — a shareable link, same design experience remotely; every interaction (sticker picks, drags, template opens) is logged live to Supabase as an analytics stream, surfaced in admin.

Both can be live at the same event: a physical stall running locally *and* a shareable online link, at the same time, syncing into the same central data.

---

## 2. Per-surface requirements

### 2.1 Kiosk — public, ecommerce-grade

- **Home page** (not an "attract screen" — a storefront): featured/most-popular templates, "start from scratch" CTA, admin-curated merchandising. This is new; today's kiosk opens straight into a stage machine with no home/browse layer.
- **Templates**: a genuinely new entity, distinct from `stall_presets` (confirmed — presets are "starting noise," an existing starting-point concept; templates are a new set on top, admin-managed, merchandised on the home page). Customer picks one and can still edit it, or starts blank.
- **Canvas**: unchanged core mechanic (drag/drop stickers, admin-configured sizes/colors, SAT overlap, true-scale rendering) — this part of the existing kiosk logic is verified and gets carried forward, not re-derived.
- **Order step**: collects name + phone, **and payment**. Two methods, confirmed:
  - **UPI** — admin configures a UPI QR code once (uploaded in `/admin`); the kiosk order step displays that QR with the order's amount, customer scans and pays.
  - **Cash** — falls through to the volunteer, handled physically at handover (no online capture, just a method flag on the order).
  - Order creation happens at the kiosk step, not at POS charge time as it does today.
- **Ticket**: still an immutable design snapshot, still crosses to POS — but now attached to an actual (paid or pending, per your decision) order record, not just a cart payload redeemed later.
- **Online mode**: same experience behind a shareable URL, no physical device gating. Every drag/pick/template-open event streamed to Supabase for admin analytics.

### 2.2 Volunteer POS — phone, sunlight, huge targets, fast

Reframed from one "Sell" screen into an explicit **pipeline with modes**, matching the description:

- **Prep mode** — queue of open tickets. Volunteer sees which stickers a ticket needs, pulls physical stock, taps **Mark Prepped**.
- **Print mode** — queue of prepped tickets, transparent to the print station (they see what's coming before it arrives). Press, tap **Mark Printed**.
- **Handover mode** — package, tap **Handed Over**. Ticket leaves the board.
- Plus the existing utility screens, kept: stock, returns, waste, past orders/log.
- **Guided hand-holding**: empty states aren't blank — they teach ("No open tickets yet — new orders from the kiosk will appear here"), and an open ticket in prep mode gets inline nudges ("Pull sticker S-014, then M-014"). This is a real content/interaction layer to design, not just copy — it needs a defined nudge system (per-state, per-ticket-contents), which becomes part of the component architecture.
- Still phone-first, huge tap targets, optimized for speed under a queue — this constraint from the current plan carries forward unchanged.
- **Walk-up sales still exist, confirmed.** Not every order originates at the kiosk — a direct walk-up sale path stays on the POS alongside the kiosk-ticket pipeline. The Prep/Print/Handover board needs to accept both kiosk-originated tickets and volunteer-created walk-up orders into the same queue.

### 2.3 Admin — desktop, configuration + analytics command center

- **Catalogue/config**: templates (new entity, distinct from presets), sticker sizes/colors (exists, needs a proper editor if not already one), pricing (exists), a UPI QR upload for kiosk payment, everything the kiosk canvas reads.
- **Stall/online mode management**: not a toggle — both run simultaneously, and multiple physical stalls can run at once. Admin needs a view of which localized stall sessions are active, their sync status (synced vs pending), and the shareable online link generator. Each stall's local session data rolls up into central data once complete.
- **Analytics**: existing gross/COGS/"Raised for AquaTerra" dashboard, aggregated **across all synced stall sessions plus online-mode sales as one total**, **plus** new interaction analytics for online-mode sessions (what stickers get picked, drag patterns, drop-off point in the flow) — a genuinely new data stream.
- **B2B, bulk, everything else**: carries forward from the current admin, gets the same visual/UX pass as the rest.

---

## 3. What this means for the backend (separate track — not built here)

Per your instruction, this becomes its own requirements document for a dedicated backend session. Items identified so far that the current schema/API don't support:

1. **Order creation moves earlier** — from POS-charge-time to kiosk-order-time. Needs either a new order status (`pending_payment` / `awaiting_prep` before `pressed_at`) or confirmation that `stall_create_order` can be called from the kiosk context with a payment method captured there. Walk-up orders (confirmed still in scope) still originate at the POS as today — the new path is additive, not a replacement.
2. **Kiosk-side payment capture** — two methods: **UPI**, shown as an admin-configured QR (static image, order amount overlaid/displayed alongside it — confirm whether the amount needs to be embedded in the UPI deep link itself or just shown as text next to a fixed merchant QR); and **Cash**, which is just a method flag, settled physically at handover, no online capture needed.
3. **Prep → Print → Handover as three tracked stages** — today's schema has two (`pressed_at`, `collected_at`). Needs a third timestamp/status (e.g. `prepped_at`) and possibly a formal status enum instead of loose timestamp fields.
4. **Templates as a genuinely new entity**, separate from `stall_presets` (confirmed — presets already serve as editable starting points; templates are an additional admin-managed, merchandisable set for the kiosk home page).
5. **Multi-stall local-first architecture** — this is the biggest new item. Multiple physical stalls run simultaneously, each operating on **localized data** (works offline/degraded-connection, doesn't block on a shared server per interaction), syncing into central data once a stall's session completes, all rolling up into one aggregate total. This is a materially different consistency model from today's single-shared-Supabase-instance-per-write assumption — needs real design (per-stall local store — IndexedDB, a local Postgres, something else — a sync/merge protocol, and conflict handling if two stalls' local clocks or IDs collide) before it's just a checkbox in a requirements doc.
6. **Online/remote kiosk sessions** — shareable link generation, session identity for a non-physical device, running concurrently with stall-mode kiosks, not exclusive. Today the kiosk is fully unauthenticated by design; a remote link presumably stays that way, but needs its own session tracking for analytics attribution and for feeding into the same central-aggregate sync as stall sessions.
7. **Interaction analytics event stream** — logging granular UI events (sticker picked, dragged, template opened) to Supabase, live. New table(s) or a lightweight event-log pattern, plus a decision on retention/volume (this could get noisy fast — worth scoping before building).

Item 5 in particular deserves its own focused conversation before it becomes a requirements doc — it's an architecture decision (local-first + sync), not a schema tweak. This list is otherwise a draft; walk through it once more with you before it's handed to a backend session.

---

## 4. Frontend architecture direction

- **Feature-based structure carries forward**, one folder per surface (`src/features/kiosk/`, `src/features/pos/` — reframed from `sell`, `src/features/admin/`), each broken into flow-stage subfolders rather than one file per page.
- **New: a lightweight state layer.** The current "no state library, every page refetches" model breaks down once POS becomes a live multi-stage board (prep/print/handover) that needs to reflect kiosk-originated tickets arriving in real time, and once online-mode analytics needs a streaming write path. This isn't a full app-wide store — scoped: a POS ticket-board hook backed by Supabase Realtime, a kiosk canvas hook (already exists, keep it), an admin config hook.
- **Frontend-side implication of environments (§7–8):** simpler than first thought — no local-first data layer needed. Every device just needs to know its bound environment id (read from a settings page, persisted locally) and thread it into the writes/reads it already makes. The existing IndexedDB outbox stays exactly what it is — connectivity-loss resilience, unrelated to environment scoping. New UI surface: a settings page per device, and a persistent environment chip (top-left, every page, every surface).
- **Three visual languages, one system.** Kiosk becomes genuinely ecommerce-grade (product-grid energy, template gallery, checkout-style order step) — a step beyond the current "brutalist but static" direction. POS stays restrained/huge-target/fast. Admin becomes a real dense desktop console. Shared tokens (color, radius, motion primitives), surface-specific application — this is close to what the old plan already started (Workstream B), reusable as raw material even though the direction changes.
- **Nudge/guidance system** is a first-class component category, not copy sprinkled in — empty states and in-progress states both consume it, driven by context (ticket contents, flow stage).

---

## 5. Execution phases

Flows before visuals, three surfaces in parallel once IA is settled, per your priority call.

| Phase | Kiosk | POS | Admin |
|---|---|---|---|
| **0 — Backend requirements doc** | Draft the six items in §3 precisely with you, hand off to separate session | | |
| **1 — IA & flow spec** | Home/templates/canvas/order step, wireframe-level | Prep/Print/Handover board model, walk-up-sale question resolved | Templates editor, stall/online toggle, analytics surfaces — spec level |
| **2 — Data/state layer** | Wire canvas hook to real config; order-step against mocked payment+order-creation until backend lands | Ticket-board hook (Realtime-backed), stage-transition actions | Config CRUD hooks |
| **3 — Visual system** | Ecommerce-grade redesign | Restrained/fast redesign, nudge components | Dense desktop console redesign |
| **4 — Guidance layer** | In-flow tutorials on first use | Contextual nudges per ticket/stage | — |
| **5 — Online mode + analytics** | Shareable link flow | — | Live interaction dashboard |
| **6 — Verify** | Full e2e: kiosk order (stall + online) → prep → print → handover → admin analytics reflects it. Responsive sweep, audit re-score. | | |

Each phase gates on: builds clean, no regression in the money-path invariants already verified (stock guards, atomic order creation, receipt numbering) — same discipline as the old plan's wave gates, just against the new flow shape.

---

## 6. Resolved

1. **Walk-up sales** — stay, additive to the kiosk-ticket pipeline.
2. **Kiosk payment method** — UPI (admin-uploaded QR, amount shown) or Cash (method flag, settled at handover).
3. **Stall vs online mode** — not exclusive. Multiple physical stalls plus an online link can all run concurrently, each syncing into one central aggregate.
4. **Templates vs presets** — confirmed distinct. Presets = existing editable starting points. Templates = new, admin-managed, merchandised on the kiosk home page.

## 7. Environments — resolved, and much simpler than first scoped

This is **not** a local-first-then-sync architecture. There is no separate local cache that later reconciles with the main database. Confirmed explicitly: data is written **directly and in real time to the same shared main database**, always — a stall environment is a **scope/tag on live data**, not a separate local store. Anyone in admin can see a stall's data the instant it happens, same as today. This removes essentially all the sync/conflict-resolution complexity from §3 item 5 and §4 — it's a data-partitioning concern, not a distributed-systems one.

The actual shape:

- **Admin generates an environment.** Creating a "stall environment" is an admin action, and at creation time admin is asked for a **preset/prefix** — this becomes the basis for that environment's generated IDs (receipt numbers, order codes, etc.), guaranteeing uniqueness across environments without needing runtime collision resolution, since two environments never share an id-generation sequence.
- **Devices join via a settings page.** Every device (kiosk tablet or POS phone) has a settings page where the operator selects which environment it's bound to — cloud/general, or a specific stall environment. Not a login/session flow, a persisted local device setting.
- **The active environment is always visible** — a routing chip in the top-left corner on every page of every surface, so nobody is ever unsure which environment a device is writing into.
- **Writes are scoped, not staged.** An order created on a device bound to "Stall B" is tagged with Stall B's environment id and lands in the main database immediately, same transaction guarantees as today (`stall_create_order` etc. unchanged) — the environment id is effectively a new scoping column, not a new data-flow.
- **Admin sees both.** A single-environment live view (drill into just Stall B) and an all-environments live aggregate view (the org-wide "Raised for AquaTerra" total, cross-stall analytics) — both real-time, both already-synced-because-nothing-was-ever-unsynced.

## 8. What this actually means for the backend requirements doc

Item 5 in §3 is now much smaller than originally scoped:

1. An `environment_id` (or similar) column/table added to the relevant `stall_*` tables (orders, shifts, receipt blocks, inventory movements, etc.), plus a small `stall_environments` table (id, name, prefix/preset, created_at, cloud vs stall type).
2. Receipt/order-code generation becomes environment-scoped, keyed off that environment's prefix — this is an extension of the existing receipt-block pattern, not a new mechanism.
3. RLS and the service-role write paths need to carry environment scoping through — every write already goes through route handlers with a service-role client, so this is a matter of threading an environment id through those calls, not a security-model rewrite.
4. Admin queries need an environment filter (single) and an aggregate-across-all mode (existing analytics, un-filtered).

No offline/local-store engine needed here — the existing IndexedDB **outbox** (for genuine connectivity loss, e.g. a stall's own wifi drops) stays exactly what it is today, unrelated to environments. Environments and offline-resilience are now two separate, much simpler concerns instead of one conflated one.

**Confirmed:** the kiosk gets the same settings page + environment chip as POS and admin — it's not a special case, just another device on the same shared link, bound to whichever environment its settings page selects. No separate mechanism for kiosk vs POS binding. And to be explicit since it came up: there's no custom sync engine anywhere in this — Supabase itself *is* the real-time layer every device writes to and reads from directly; "sync" in the environment sense is nothing more than a shared `environment_id` on rows in one live database.

## Status, 11 Aug 2026

Phase 0 delivered as [[Backend Requirements - Rework 2026-08]]. Phases 1–6 built from scratch in `app-v2/` against a mock backend and verified in a browser — see [[Rework - Build Log 2026-08-11]], including the three product decisions taken on the day (per-environment stock, holds-not-decrement at kiosk order, dynamic UPI link) and an honest list of what is not yet covered.

## Related
[[Backend Requirements - Rework 2026-08]] — Phase 0 deliverable, written 11 Aug
[[Rework - Build Log 2026-08-11]] — execution record
[[crftd Stall OS]] · [[Rework - Master Plan]] · [[Known Issues]] · [[Database Map]] · [[User Flows]]

---
type: spec
updated: 2026-08-11
---

# Rework — UX Architecture

Part of [[crftd Stall OS]]. Answers one brief, stated verbatim by the person who owns this: **"make flows features intuitive, i should know what's happening where."**

This is a specification for an information-architecture and wayfinding rework of the built app (not a redesign of the brand or the data model). It assumes the PRD (`crftd_Stall_OS_PRD_v2.md`) and the current build described in [[Frontend Map]], [[Flow - Sell]], [[Flow - Kiosk Design]], [[Kiosk Handoff]], and [[Known Issues]] as ground truth. No code is written here.

## Why this is needed, in one paragraph

The app has three surfaces (volunteer POS, public kiosk, admin) with genuinely different jobs, but nothing on screen tells a person which surface they're in, what stage of a multi-step task they're at, or what happens if they do nothing. The kiosk is a five-stage state machine (`attract → path → product → canvas → ticket`, per [[Flow - Kiosk Design]]) with zero progress indicator. The Sell screen (`/sell`, 880 lines, per [[Flow - Sell]]) is one continuously scrolling column with cart, product picker, sticker picker, discount, payment and charge all visually equal weight — nothing marks where "add items" ends and "take payment" begins. Critical states that can silently cost money — an unsynced sale, a stale offline catalogue, a customer who never got a receipt — exist in the code (`online`, `pendingOutbox`, `catalogueAge` state in `sell/page.tsx`) but are not consistently or hierarchically surfaced. This document specifies the fix at the IA/wayfinding level, screen by screen.

---

## 1. Route and surface map

Three PIN-gated surfaces, per PRD §2 and §12, and [[Frontend Map]]. **Note the inversion from the PRD text**: the PRD's §2 diagram shows `/` as Sell and `/kiosk` as the customer surface. The **built app is the opposite** — `/` is now the public kiosk (no PIN) and Sell lives at `/sell`. `/kiosk` 308-redirects to `/` for old links/QR codes. Any rework must design for the app as built, not as originally drafted.

| Surface | Gate | Root | Routes |
|---|---|---|---|
| **Kiosk** (public) | none — customer-facing | `/` | attract → path → product → canvas → ticket, all one route, state held in a single `useState` |
| **Volunteer POS** | stall PIN, via `/pin` | `/sell` | `/sell` (till), `/orders` (shift log, pending press, voids, summary export), `/holds`, `/stock/products`, `/stock/stickers`, `/restock`, `/waste`, `/returns`, `/more`, `/shift-open`, `/receipt` |
| **Admin** | admin PIN, via `/pin` | `/admin` | `/admin`, `/admin/analytics`, `/admin/pricing`, `/admin/b2b`, `/admin/bulk`, `/admin/catalogue`, `/admin/mockups` |

**The wayfinding problem this map creates on its own:** a volunteer typing `crftdos.app` in a browser lands on the *customer* kiosk, not the till. There is no visible cue on `/` that a "Staff passcode" link exists until you scan the attract screen for it. **Recommendation:** the attract screen's staff entry point must be a persistent, low-visual-weight but discoverable affordance (e.g. a fixed corner tap target, not buried in copy), and `/pin` itself should immediately state which surface a successful PIN unlocks *before* navigating, so a volunteer who fat-fingers the kiosk PIN into the stall-PIN field gets "Kiosk unlocked — this opens the customer screen, not Sell" rather than silently landing somewhere unexpected.

**Cross-surface identity signal, missing everywhere:** none of the three surfaces currently self-announce which one you're in beyond the page title. `PosFrame`'s header (`kicker` + `title`, per `PosFrame.tsx`) already has the slot to say "VOLUNTEER · SELL" instead of just "SELL" — this is a one-line addition with an existing, unused kicker slot rather than new layout.

---

## 2. Wayfinding — place, stage, and next step

Three separable questions a person must be able to answer at every screen, per the brief:
1. **Where am I?** (which surface, which route)
2. **What stage of this task am I at?** (step N of M)
3. **What happens if I do nothing / what's next?**

### 2.1 Kiosk — the five-stage machine with no progress indicator

Per [[Flow - Kiosk Design]], stages are `attract → path → product → canvas → ticket`, held in one `useState` in `app/page.tsx`. Today, nothing on screen tells the customer how many steps remain or what stage they're in — a customer who has just chosen colour/fit/size has no signal that the next screen is stickers, not payment.

**Specification:**
- A persistent stage indicator, present on every non-attract stage, styled in the kiosk's brutalist skin (box-label / crop-mark treatment per PRD §11, not a generic dot-stepper — it must look native to the surface, e.g. a torn-paper strip of stamped step labels: `01 PRODUCT · 02 STICKERS · 03 REVIEW`). Preset path collapses to fewer visible steps than canvas path, since presets PRD-spec "three taps to a ticket" — the indicator must reflect the *actual* path length the customer chose, not a fixed five-stage bar that lies about how far is left on the fast path.
- Each stage screen states in one line what happens next: on `product`, "Next: pick your stickers." On `canvas`, the running total (already built per [[Flow - Kiosk Design]] "Price transparency") doubles as a persistent "what happens if I stop now" cue — but should be paired with an explicit "nothing is charged yet" microcopy line near the total, because customers unfamiliar with a ticket-based (not cart-based) checkout may worry that adding items is committing to a purchase.
- On `ticket` (the terminal stage), the screen must say explicitly: **"Show this code or QR to a crftd volunteer to pay. Nothing has been charged."** — closing the biggest conceptual gap in the flow (per PRD §4.4, "the ticket is a quote, not a sale").
- A visible, tappable "back" affordance at every stage past `attract` — not a hardware back button dependency (this runs on shared tablets in kiosk-locked mode, per PRD §11 "portrait locked"). Currently the flow's only documented navigation is forward.
- A visible session/idle indicator on `canvas`: since sticker reservations expire after 15 minutes of inactivity (PRD §4.3) and this is user-invisible today, a small countdown or "still working?" prompt before expiry prevents a customer's held stickers silently releasing back to stock mid-composition.

### 2.2 Sell — the one long scroll with no sequence

Per [[Flow - Sell]], `/sell` is "a single screen, no navigation mid-sale," with cart top, entry controls middle, Charge pinned bottom — architecturally correct for speed, but the entry-controls middle section (product picker, sticker picker, design-ticket field, custom sticker, discount) has no visual sequence markers. A volunteer mid-shift knows the flow from muscle memory; a new volunteer does not know where "adding" ends and "about to charge" begins, and nothing distinguishes "you still need to pick a payment method" from "you're done."

**Specification (does not restructure the single-screen model — PRD and existing docs are explicit this is deliberately fast, not a wizard):**
- A persistent, compact **cart-state summary chip** anchored near the top (not just the cart list itself) stating item count and running total in the largest legible numeral on screen at all times — Anton/mono treatment already exists via `Mono` component, reuse it.
- A **"ready to charge" gate state**, surfaced as the Charge button's own label changing contextually rather than a separate progress bar: disabled/greyed with inline reason text when blocked ("Add at least one item," "Split amounts don't total," "Enter admin PIN to apply this discount") instead of a generic disabled state a volunteer has to guess about. (`splitOk` and the admin-gate check already exist per [[Flow - Sell]] — this is exposing existing guard state as copy, not new logic.)
- The **design-ticket field** (kiosk handoff) should visually announce itself as the fast path it is designed to be (PRD: "should be the first thing on the screen at a busy stall") — currently just "a prominent field" per the flow doc, worth confirming in implementation that it sits above, not beside, the manual product/sticker pickers, with a one-line explainer ("Customer has a code from the kiosk? Enter it here to skip manual entry.").
- After Charge, the **customer sheet** (name/phone/email, skippable) should state up front why it's asking — currently unconditional. Specify: when the sheet is *mandatory* (custom/canvas item + collect-later shift, per PRD §3.1), the sheet must open in a visually distinct "required" state (e.g. no skip button rendered at all, plus a one-line reason: "We need to reach you — this order needs to be collected on [date]") rather than the same optional-looking sheet with a skip button quietly absent.

### 2.3 The "what happens if I do nothing" problem across both surfaces

Several states in this app resolve themselves silently over time and the UI currently gives no notice:
- Kiosk sticker holds expire after 15 min idle (§4.3) — no visible countdown.
- Design tickets expire after 30 min (§4.4) — no visible countdown once handed off; a customer who dawdles to the till risks the code going stale with no warning.
- Holds (the `/holds` reservation feature) expire after 2 hours or shift close (§3.3) — `/holds` lists a countdown per the route table, which is correct; the same pattern (live countdown, not just an expiry timestamp) should extend to design tickets and kiosk sticker reservations, which currently have none.

---

## 3. Per-flow step model

For each flow: discrete steps, decisions, failure modes, and what the UI must say. Grounded in PRD §3, §4, §6, §7 and the corresponding CrftdOS vault flow notes.

### 3.1 Shift open (`/shift-open`)

| Step | Volunteer decides | Can go wrong | UI must say |
|---|---|---|---|
| 1. Identify shift | Name, event, venue, date | Duplicate/overlapping shift; a second device joining an already-open shift (documented live bug, now fixed per [[Known Issues]] — but the *class* of risk, "did my device get set up correctly," remains a UX gap) | "Opening shift for [venue] — [date]" with explicit confirmation before commit |
| 2. Set press mode | `press_on_site` toggle (PRD D16) | Volunteer doesn't understand what the toggle changes downstream | Inline one-line consequence text under the toggle: "ON — pressed orders queue live in Orders. OFF — customers get a promised collection date and must leave contact info." This decision silently reshapes the entire Orders and Sell customer-sheet behavior for the whole day; it must not be a bare switch with no explanation. |
| 3. Select volunteers | Multi-select from roster | Commission misattribution if wrong names selected | Show selected names as removable chips, not a closed dropdown, so the confirmed roster is glanceable before submit |
| 4. Enter opening float | Cash amount | Typo becomes the day's variance baseline | Confirm float amount back in large numerals before commit — this number silently seeds shift-close variance math |
| 5. Receipt block allocation | Automatic (100 numbers/device, PRD §6.2) | Silent failure = device can never charge (the fixed live bug) | Explicit success confirmation on this screen: "Receipt numbers 000142–000241 assigned to this device" — currently invisible to the volunteer, who has no way to confirm this step even succeeded before their first sale |

**What's missing today, worth calling out explicitly:** nothing in the shift-open flow currently confirms step 5 completed. Per [[Known Issues]] item on the "eighth pass" bug, that silent failure is exactly the failure mode a receipt-block confirmation line would have surfaced immediately instead of at first-charge time.

### 3.2 Sell (`/sell`)

Already detailed in §2.2. Step model:

| Step | Decision | Failure mode | UI must say |
|---|---|---|---|
| Load ticket (fast path) OR build cart manually | Which path | Wrong code typo; expired ticket | "Ticket not found or expired — ask the customer to re-generate at the kiosk" (specific, not a generic error) |
| Add product | Colour/fit/size; confirm if greyed-out (out of stock but sellable) | Volunteer sells a garment that doesn't physically exist | The out-of-stock confirmation dialog (already exists per [[Flow - Sell]]) must state the current count, not just "confirm anyway" |
| Add sticker(s) | Code, browse, Recent, or (flagged, unbuilt) QR scan | Wrong code (visually similar codes); bin location wrong | Bin location shown inline (`M-014 · Box 2 / Tab M · 12 left`) is already correct and load-bearing per the PRD — preserve exactly, this is the single highest-value UI detail on the screen |
| Custom sticker | Size class, description, price | Forgets to note description clearly enough for press | Placeholder/example text in the description field showing what a useful description looks like |
| Apply discount | Amount/% + reason | Discount >10% needs admin PIN — volunteer doesn't have it | The admin-PIN prompt must state *why* it's asking ("Discounts over 10% need a supervisor") not just present a naked PIN pad |
| Choose payment | UPI/Cash/Split/Pending | Split doesn't total | Inline running total-vs-entered delta shown live, not just a blocked Charge button |
| Charge | — | Network down | Screen clears regardless (already correct, optimistic per [[Offline and Sync]]) — but must show a distinct "saved, will sync" receipt-number placeholder state (already `PENDING SYNC`, per the outbox note) with enough visual weight that a volunteer doesn't think the sale silently failed |
| Customer sheet | Optional unless mandatory | Volunteer skips a mandatory one accidentally | Per §2.2 — no skip affordance rendered at all when mandatory |

### 3.3 Kiosk design (`/`)

Already detailed in §2.1. Step model summary:

| Stage | Customer decides | Failure mode | UI must say |
|---|---|---|---|
| Attract | Preset or Canvas | Doesn't know staff entry exists | Persistent, discoverable but unobtrusive staff-PIN affordance |
| Product | Colour, fit, size | Size unavailable | "Ask a volunteer" copy already spec'd (§4.2) — keep, pair with why (out of stock, not a bug) |
| Canvas | Browse/search stickers, place, rotate | Placement refused (overlap); design sells out mid-session (stock reserved via `stall_reserve_sticker_hold`, correct) | Refusal message already spec'd — "No free space on this side without overlapping — remove one first" (per [[Flow - Kiosk Design]]) is a good model for specific, actionable copy; extend the same specificity to reservation failures |
| Review/Ticket | Confirm and Get Ticket | Ticket generated but customer doesn't understand it's not a receipt | Explicit "not charged yet" line, per §2.1 |

### 3.4 Handoff (kiosk ticket → till)

Per [[Kiosk Handoff]], today this is code-only (no QR rendered, despite PRD D14/§4.4 specifying QR as the *fast* path and the code as fallback — this is a build gap, not a spec gap, flagged in [[Known Issues]]/[[Kiosk Handoff]] as Task #15). Until QR ships, the wayfinding fix is entirely about the code:

- On the kiosk ticket screen: render the 4-character code at the largest legible size on the display, with the no-ambiguous-character alphabet already correctly chosen (no O/0, I/1) — but also state the expiry window ("Show this within 30 minutes") since nothing today communicates the 30-minute clock to the customer.
- On the Sell screen's ticket-entry field: on a not-found/expired result, distinguish "wrong code" from "expired code" if the API can tell them apart, since the fix differs (retype vs. re-generate at kiosk).

### 3.5 Press / collection

Per PRD §3.2 and D16, this branches entirely on the shift's `press_on_site` toggle set at shift open (§3.1) — a decision invisible after the fact unless surfaced.

**`press_on_site = on`:** orders with custom/canvas items enter `pending`. A badge on the Sell header shows count + oldest wait (per PRD). `/orders` pins pending items with a live timer.
- **UI must say:** the Sell-header badge should escalate visually (not just numerically) as wait time grows — e.g. a queue sitting for 20+ minutes reads differently from one sitting for 2. A single static badge undersells urgency.
- `/orders`' one-tap Pressed → Handed Over should each carry a confirming toast naming what changed ("Marked pressed — now in Handed Over queue"), not just visually move the row.

**`press_on_site = off`:** orders become `collect_later` with mandatory promised date + contact. `/orders` groups a Collections tab by date; admin dashboard flags overdue in red.
- **UI must say:** on the Sell screen, when this shift's mode is `off`, the customer sheet must make the promised-date requirement visually load-bearing (see §2.2) rather than another optional field among several.
- The receipt (§6.1) already shows the promised date "in the largest type on the receipt" per PRD — preserve.

### 3.6 Holds (`/holds`)

Per PRD §3.3: reserve SKU against customer name+phone; available vs on-hand shown separately; default 2h/shift-close expiry; countdown, convert-to-sale, release actions already spec'd on `/holds`.

- **UI must say:** since holds silently affect what appears sellable elsewhere (Sell screen's stock counts subtract holds), a volunteer on Sell seeing lower-than-expected available stock has no visibility into *why* without navigating to `/holds`. Specify a lightweight cross-reference: when a sticker/product's available count differs from its on-hand count on Sell, a small annotation ("3 held") rather than just a lower number with no explanation.

### 3.7 Waste (`/waste`)

Per PRD §3.4: two taps from Sell; transfer code + qty, product SKU if garment ruined, reason enum, volunteer, note, optional photo; decrements stock with reason `damage`.

- **UI must say:** confirm the stock decrement happened, explicitly, since this is a destructive-feeling action (admitting a loss) that a volunteer might worry didn't register. "Logged — M-014 stock reduced to 9."
- The reason enum should show which reasons are most common this shift/event (a small frequency hint) to speed entry, not change the model.

### 3.8 Returns and exchanges (`/returns`)

Per PRD §3.5: search original order by receipt/phone/order number; capture items, reason, action, resaleable/write-off, refund amount, approver; policy reminder rendered at point of entry; rejected returns still logged; exchanges create a zero-value linked replacement order.

- **UI must say:** the policy reminder (already spec'd to render in-UI) should sit *before* the volunteer starts filling the form, not as a footnote, since it directly affects which `action` they should pick.
- When an exchange creates a linked replacement order, the UI must confirm this explicitly ("Exchange logged — replacement order #[X] created at ₹0, inventory adjusted") since it's an invisible side effect otherwise (two orders exist where the volunteer only performed one action).

### 3.9 Restock (`/restock`)

Per PRD §2/§13 (below-par, dead stock, print queue) — not detailed at flow level in the PRD prose, but the IA principle applies: this screen aggregates three different concerns (what's low, what's dead, what to reprint) that must be visually separated, not blended into one list, so a volunteer glancing at it can tell which of the three questions they're answering.

### 3.10 Shift close

Per PRD Appendix B and §14: pending queue must be empty or converted; outbox must be empty (blocking); waste logged; cash counted, variance under ₹200 or noted; unused receipt numbers auto-voided; summary card shared.

- **UI must say:** shift close should present as a **checklist with live status per item**, not a single "close shift" action gated behind hidden validation. Each of the six Appendix B items should show pass/fail/attention-needed inline before the close button is even reachable: "Outbox: 3 sales not yet synced — connect to wifi" (already spec'd in [[Offline and Sync]] as required copy, extend the same treatment to all six checklist items, not just outbox).
- The summary card (§14) is explicitly called the highest-leverage retention tool in the PRD ("makes their work visible") — its generation should feel like the reward at the end of the checklist, not a separate afterthought action.

---

## 4. State visibility — critical states a volunteer must never miss

Per PRD §10/§11 and [[Offline and Sync]], these states already exist in code (`sell/page.tsx`: `online`, `pendingOutbox`, `catalogueAge`, plus `Banner` components with `tone="signal"`/`"blue"`) but need a specified priority hierarchy so they don't visually compete or get missed.

| State | Where it lives today | Priority | Specification |
|---|---|---|---|
| **Offline** | `online` state, `Banner tone="signal"` | Highest — blocks trust in everything else | Persistent, not dismissible, top of screen, signal-red (reserved colour, correctly used here per Design System doc). Must distinguish "offline, sales still work (outbox)" from any future state where offline truly blocks a sale — today it never blocks a sale, and the banner copy must say so explicitly so a volunteer doesn't panic-stop selling. |
| **Unsynced outbox count** | `pendingOutbox`, `Banner tone="blue"` when online with a queue | High | Currently shown only `online && pendingOutbox > 0` — correct logic (no point warning about sync if you're already offline, the offline banner covers it) but must persist across navigation (Sell → Orders → back) since state isn't shared cross-page (no state library, per [[Frontend Map]]) — verify the count re-fetches on every page mount, not just once. |
| **Stale cached catalogue** | `catalogueAge`, `describeAge(cat.cachedAt)` | Medium-high | Today surfaced as a string age. Specify: this must escalate in tone once age crosses a threshold where prices/stock are plausibly wrong (e.g. same-day fine, previous-day amber, older red) rather than a flat neutral "last updated" string — a volunteer needs to know when to distrust what's on screen, not just when it was fetched. |
| **No-receipt-block state** | Implicit (silent failure historically, per [[Known Issues]]) | Highest at shift-open, n/a after | Per §3.1 — must become an explicit confirmation at shift open, and if a device somehow has zero remaining block numbers mid-shift, Charge must fail loudly with "Out of receipt numbers for this device — reopen shift or contact admin," not silently. |
| **Pending-press queue depth** | Sell-header badge (PRD §3.2) | Medium, escalates with wait time | Per §3.5 — escalate visually with oldest-wait time, not just a static count. |
| **Stock about to run out** | Bin-location inline count on Sell; par levels on Restock | Medium | Today shown as a bare number ("12 left"). Consider a threshold-based visual cue (not full redesign — a subtle colour/weight shift) when a design/SKU nears its `par_level`, so a volunteer notices depletion during a sale rather than only on `/restock`. |

**Ordering principle:** when multiple states are true simultaneously (e.g. offline AND stale catalogue AND pending press queue), they must stack in the priority order above, most urgent nearest the top of the fixed header/banner area — not all compete for the same banner slot or appear in DOM/fetch order.

---

## 5. Empty, loading, and error states

By screen, keyed to what's actually built (per [[Frontend Map]] and the flow docs) so this is implementable, not generic.

| Screen | Empty state | Loading state | Error state |
|---|---|---|---|
| `/sell` | N/A (cart starts empty by design — the "empty cart" is the normal ready-to-sell state; label it as such, not blank) | Boot does two serial hops (shift check, then catalogue) per [[Frontend Map]] — must show *what* is loading, not a bare spinner: "Checking shift..." then "Loading catalogue..." so a volunteer waiting several seconds knows it isn't frozen | No open shift → redirect to `/shift-open` already happens; must carry a one-line reason so the redirect doesn't feel like a bug: "No shift is open on this device — start one to begin selling" |
| `/` (kiosk) attract | N/A, always has content | Catalogue fetch on mount (no cache today, per [[Offline and Sync]]) — attract screen can loop indefinitely while this loads in background since attract itself needs no catalogue data, but `product`/`canvas` stages must show a loading state if entered before fetch completes | Catalogue fetch failure on a public, unattended device is severe — must fail to a "Ask a volunteer to help" screen, not a broken canvas, since no one is present to read a technical error |
| `/orders` | No orders yet this shift: state it's normal, not broken ("No sales yet — first one will show here") | Standard list-loading skeleton | Fetch failure should offer retry, since this screen is checked mid-shift under time pressure |
| `/holds` | No active holds: "No reservations — use Sell to hold an item for a customer" (teaches the feature exists) | — | Expired holds still visible briefly with a distinct "expired" visual state before disappearing, rather than vanishing silently (a volunteer who placed the hold should see it resolve, not wonder if it ever existed) |
| `/stock/products`, `/stock/stickers` | N/A (seeded catalogue) | — | A design with `NaN` geometry (missing `print_w_cm`/`print_area`, a known data gap per [[Flow - Kiosk Design]]) must not silently break kiosk rendering — Stock screens should flag incomplete records ("Missing print size — will not render correctly in kiosk canvas") so an admin catches it before a customer does |
| `/restock` | Nothing below par: positive framing ("Everything's stocked") not a blank list | — | — |
| `/waste`, `/returns` | Log forms, no meaningful empty state beyond the form itself | — | Submission failure must state clearly whether the stock decrement/adjustment happened or not — ambiguity here is the worst-case outcome (double-logging or silent loss) |
| `/shift-open` | — | Receipt-block allocation must show a loading/confirming state, not resolve silently (§3.1) | Duplicate-open-shift attempt should explain, not just fail |
| `/admin/*` | Each admin list screen needs its own "nothing here yet" copy specific to its content (pricing matrix blank cells already documented in PRD §5 as "inherit from size-class/fit default" — surface that inheritance visibly, e.g. greyed inherited values vs. explicit overrides) | Desktop-first, less time pressure than volunteer surfaces, but should still distinguish loading from empty | — |
| Ticket redemption (`/sell` ticket field) | — | — | Distinguish not-found vs. expired vs. already-redeemed (a ticket used twice is a real failure mode with ticket-based handoff) — three different messages, three different volunteer actions |

---

## 6. Progressive disclosure — first-time vs experienced volunteer

The PRD and vault docs describe a single, fast, always-visible UI for volunteers with no onboarding flow — appropriate for a stall where volunteers rotate and can't sit through training. Progressive disclosure here should not mean hiding features behind a "advanced mode" toggle (adds a decision volunteers don't have time for); it means **layering explanation, not layering functionality**.

- **First-time volunteer (first shift, or first use of a given screen):** every non-obvious control gets a one-line inline explainer the *first* time it's encountered per device/session (not permanently, since a permanent explainer becomes noise for the ninth shift). Candidates: the press-mode toggle at shift open (§3.1), the admin-PIN discount gate, the design-ticket fast-path field, the mandatory-vs-optional customer sheet. Implementation-agnostic: this could be a dismissible first-run tooltip keyed to `localStorage`, not a modal walkthrough that blocks the actual task.
- **Experienced volunteer:** the same screens, same functionality, explainers dismissed/collapsed. The wayfinding elements from §2 (stage indicators on kiosk, cart-state chip on Sell, checklist on shift close) stay **permanently visible regardless of experience** — those aren't onboarding aids, they're the actual fix for "I should know what's happening where," and removing them for "experienced" users would reintroduce the exact problem this document exists to solve.
- **Kiosk (customer-facing) has no experience tiering** — every customer is a first-time user of this specific composition tool, even if they've bought from crftd before. The stage indicator, "not charged yet" messaging, and expiry countdowns from §2.1 must always render, with no dismiss/skip state, since there's no session memory across customers (kiosk_session_id is per-tab per [[Flow - Kiosk Design]]).
- **Admin** is the one surface where progressive disclosure in the traditional sense (advanced fields hidden by default) is appropriate, since admin users are a small, trained, repeat set (per PRD "desktop-first, nobody reads analytics on a phone") — e.g. `/admin/b2b`'s full activity log and margin-gate override could stay collapsed until needed, unlike anything on the volunteer or kiosk surfaces where hiding is never appropriate under time pressure.

---

## Summary of concrete deliverables for implementation

1. Kiosk: stage indicator strip (brutalist-skinned), path-aware step count, persistent back affordance, "not charged yet" copy on canvas + ticket stages, idle/expiry countdowns on canvas reservation and ticket.
2. Sell: persistent cart-state summary chip, contextual Charge-button block reasons, visually distinct mandatory vs. optional customer sheet, escalating pending-press badge.
3. Shift open: explicit success confirmation for receipt-block allocation; inline consequence text under press-mode toggle.
4. Shift close: convert to a live checklist against Appendix B's six items, not a single gated action.
5. State-visibility hierarchy: fixed stacking order for offline / unsynced-outbox / stale-catalogue / no-receipt-block / pending-press-depth / low-stock banners, so simultaneous states don't collide.
6. Screen-by-screen empty/loading/error copy per §5, with special attention to ticket redemption's three-way failure (not-found / expired / already-redeemed) and stock-record completeness flags (missing `print_w_cm`/`print_area`) surfaced on Stock screens rather than failing silently in the kiosk canvas.
7. Surface self-identification: use `PosFrame`'s existing unused `kicker` slot to state "VOLUNTEER · [SCREEN]" consistently; `/pin` states which surface a PIN unlocks before navigating.
8. First-run inline explainers (session/localStorage-scoped, not permanent) on the least-obvious controls; wayfinding elements from items 1–5 are never hidden by experience level.

## Related
[[User Flows]] · [[Flow - Sell]] · [[Flow - Kiosk Design]] · [[Kiosk Handoff]] · [[Frontend Map]] · [[Design System]] · [[Offline and Sync]] · [[Known Issues]]

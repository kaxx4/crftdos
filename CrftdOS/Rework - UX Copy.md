# crftd Stall OS — UX Copy Rework

Audit date: 11 Aug 2026. Scope: every user-visible string under `app/src/app/` and `app/src/components/`, plus client-reachable strings in `app/src/app/api/*/route.ts`.

Two audiences, two voices:
- **Staff/volunteer screens** (Sell, Stock, Orders, Holds, Returns, Waste, Admin, Shift): plain, calm, action-first. Written for a 16-year-old handed a phone five minutes ago.
- **Kiosk** (`app/src/app/page.tsx`, customer-facing parts of receipt): confident, brand-forward, short. It sells the tee.

Money rule for every error message on a staff screen: say what happened, say whether money or stock moved, say the next action. Never print a route name, table name, PRD section, RLS, "phase", "stubbed", or any other build-status word where a customer or volunteer can see it.

---

## 1. `app/src/app/sell/page.tsx` — the till

This is the highest-traffic staff screen: a volunteer runs the whole queue through it. Copy here needs to survive being read in bright sun, one-handed, mid-conversation with a customer.

| Location | Current | Proposed | Reason |
|---|---|---|---|
| :742 | `Loading stall…` | keep | Fine as a boot-time placeholder. |
| :759, :1194 | `CHARGING…` / `CHARGE ₹{total}` | keep | Verb-first, states the exact amount. Good pattern. |
| :262, :320 | `window.confirm(`${sku.sku_code} shows 0 in stock. Add anyway?`)` / `${design.code} shows 0 in stock. Add anyway?` | `"${label} shows 0 in stock — add it anyway? You'll need to check with a volunteer before handing it over."` | Confirms the volunteer meant it, but also warns them the number might be wrong (stock counts lag other devices) rather than silently trusting a zero. |
| :270 | `OUT OF STOCK — confirmed` (stockNote on a cart line) | `Added despite 0 in stock` | "confirmed" alone in a cart line reads like a status the volunteer set, not an explanation; spell out what happened. |
| :394, :472 | `Ticket ${code} is already in this cart.` | keep | Clear, specific, correct — tells them exactly what's wrong. |
| :414 | `Offline — scan the QR on the kiosk screen instead of typing the code.` | keep | Explains cause and gives the working alternative in one line — exactly right. |
| :419 | `body.error \|\| "No open ticket with that code."` | keep fallback; audit `body.error` server-side to ensure it never contains a route/table name | Fallback text is good; only the pass-through path needs checking. |
| :583 | `Promised date and a phone number are required — this garment isn't handed over today.` | keep | States the rule and the reason together — good pattern to copy elsewhere. |
| :775 | `OFFLINE — sales queue locally` | `You're offline — sales are saved on this phone and will send once you're back online` | "queue locally" is engineer phrasing; a volunteer needs to know their sale isn't lost, not the mechanism name. |
| :781 | `SYNCING OUTBOX` | `Sending queued sales…` | "Outbox" is an internal noun no volunteer was ever taught. |
| :789–791 | `CACHED CATALOGUE — STOCK MAY BE STALE` | `Showing saved stock counts — may be a few sales behind` | "Cached catalogue" and "stale" are dev vocabulary; say what it means for the volunteer's decision (a size shown as in-stock might already be gone). |
| :799 | `NO RECEIPT BLOCK — CAN'T CHARGE ON THIS DEVICE` / `reload or ask a volunteer` | `This phone can't print receipt numbers yet — reload the page, or ask another volunteer to help` | "Receipt block" is an internal allocation concept; tell them the actual limitation (this device can't charge) and the fix. |
| :834 | `Nothing in cart. Add a garment below or load a ticket.` | keep | Textbook empty state — what/why/next in one line already. |
| :945 | `No sizes for this combo.` | `No sizes stocked in this colour and fit — try another combination.` | "This combo" is vague shorthand; spell out what's empty. |
| :953 | `→ onto selected garment` / `→ standalone sale` | `Adding to: {garment label}` / `Adding as: sticker only (no shirt)` | Arrow-plus-fragment reads like UI debug output; say plainly where the next tap will land. |
| :959 | placeholder `14, m14, ramen, anime…` | keep placeholder, add one line of help text beneath the field: `"14" finds every size (S/M/L-014). "m14" finds only the Medium.` | This is the exact undocumented behavior called out in the brief — the placeholder examples hint at it but never explain the rule, so a volunteer has to guess by trial and error mid-queue. |
| :1001 | `{d.bin_location || "no bin set"} · {d.stock_qty} left` | `Go to {d.bin_location || "no bin — ask a volunteer"} · {d.stock_qty} left` | Bin location is a physical instruction (where to walk), not a data field; "Go to" makes that legible at a glance. Sentence-case fallback matches rest of app. |
| :1008 | `No sticker designs seeded yet — import the catalogue in /admin.` | `No stickers loaded yet. Ask an admin to import the sticker catalogue in Admin → Catalogue.` | "Seeded" is a database term; "/admin" is a URL, not a place name a volunteer recognises. Point at the actual menu label. |
| :1013 | `No match. Try a code like **14** or **m14**.` | keep | Already a good example-driven empty state. |
| :1097 | `Above 10% — admin PIN required at Charge` | `Discounts over 10% need an admin's PIN — you'll be asked for it when you hit Charge.` | Same information, written as a sentence instead of a label fragment; tells them when the PIN prompt will appear so it isn't a surprise. |
| :1122 | `Single TerraRoots UPI destination — reference optional.` | `All UPI payments go to the one TerraRoots account — no reference number needed.` | "Destination" is payments-infrastructure language; say where the money goes and that the optional field really is optional. |
| :1132 | `Admin PIN required (discount &gt; 10%)` | `This discount needs an admin's PIN` | Simplify the punctuation-heavy label into a sentence a nervous volunteer reads correctly on the first pass. |
| :1140, :532 | `adminPinErr`: `"Incorrect admin PIN"` / lockout `j.error` | keep "Incorrect admin PIN"; ensure lockout message reads e.g. `"Too many tries — wait 2 minutes and try again"` | Good existing distinction between wrong-PIN and locked-out (code comment confirms this is intentional) — just make sure the lockout copy names the wait, not a raw retry-after number. |
| :1167–1169 | `Custom or canvas item on a collect-later shift — a promised date and phone number are required.` | `This includes a custom sticker or kiosk design — since it's not ready today, we need a way to reach the customer when it is.` | "Custom or canvas item" and "collect-later shift" are PRD terms; explain the real-world reason (why we're asking) instead of naming the internal category. |
| :1189 | `OK to contact for marketing` | `OK to text updates and offers?` | "OK to contact for marketing" is a legal-consent phrase copied into a checkbox; make it read like a question a volunteer can ask out loud. |
| :1199 | `SKIP` | keep | Correct — clearly optional, correct default action name. |
| :1209 | `Sale charged.` | `Sale done.` | "Charged" doubles as the button label already showing; "done" reads faster in a toast glanced at for half a second. |
| :1210 | `UNDO` | keep | Correct, standard. |
| :1096–1098 wording elsewhere: discount reason `<option>` labels | `Volunteer discretion`, `Freebie`, `Bulk`, `Damaged item`, `Price match`, `Other` | keep | All plain English already — good reference list. |

---

## 2. `app/src/app/receipt/page.tsx` — customer-facing document (highest priority)

This screen is handed to (or emailed to, or WhatsApped to) the actual customer. Anything here is the worst place in the app for internal language to leak, because it becomes a permanent external record of the sale.

| Location | Current | Proposed | Reason |
|---|---|---|---|
| :65 | `TERRAROOTS FOUNDATION · LEGAL NAME PENDING (PRD §16.5)` | `TERRAROOTS FOUNDATION` — move the "legal name not finalised" caveat into an internal admin note, off the receipt entirely | A live customer receipt is citing an internal planning document by section number. This is a financial document; it must read as finished, not as work-in-progress. |
| :77–79 | `Offline sale — number confirms once this device syncs` | `Receipt number confirms once this device is back online` | Slightly softer, drops "sale" (redundant on a receipt) and "syncs" (jargon) without losing the meaning. |
| :104 | `Discount ({data.discountReason})` rendering the raw value, e.g. `volunteer_discretion` | Map to a label: `Discount (Volunteer discretion)`, `Discount (Damaged item)`, etc. | A database enum with an underscore is printed on a customer's receipt. |
| :134 | `title="Email delivery is Phase 4 (needs a verified sending domain — PRD §16.9)"` | `title="Email receipts aren't turned on yet"` | Build-phase number and PRD citation exposed in a tooltip a customer can hover/tap. |
| :137 | `EMAIL (PHASE 4)` | `EMAIL (COMING SOON)` | Literal internal phase number on a button a customer sees and can tap. |

---

## 3. `app/src/app/page.tsx` — kiosk / Customer Design Studio (brand voice)

This is the only screen a customer drives unsupervised. It should sound like a confident young brand talking to a customer who is deciding whether to buy — short sentences, active verbs, price always visible, never a dead end.

| Location | Current | Proposed | Reason |
|---|---|---|---|
| :194 | `Could not load the catalogue. Ask a volunteer for help.` | keep | Correct tone for a customer-facing failure: no jargon, gives a human fallback instead of a retry loop. |
| :723–731 | Hero copy (`Build yours`, `TAP TO START`, etc.) | keep | Already on-brand, confident, short. Use as the tone reference for the rest of the kiosk. |
| :777 | `No presets yet.` | `No ready-made designs yet — build your own below, it takes under a minute.` | A dead-end empty state on a screen whose whole job is to sell; always redirect to the path that still works. |
| :850 | `{sku.sku_code}` shown as the garment's own label, e.g. `BLK-REG-M` | `Black · Regular · M` | The one place in the whole app where an internal SKU code reaches an actual paying customer instead of a describable product. |
| :454–456, :491, :493 | `"...placement reverted."` (×3, incl. rotation variants) | `"...moved back."` | "Reverted" is version-control vocabulary; a customer moving a sticker on a touchscreen should read plain confirmation. |
| :962 | `No match / sold out.` | `No stickers match that search — or they're sold out for now. Try another word.` | Slash-fragment reads like a code comment; kiosk copy should always be a full, confident sentence with a next step. |
| :829, :839, :918–995 | Search/ticket/done-state copy | keep | Already price-transparent and matches the "ask a volunteer" out-of-stock pattern correctly. |

---

## 4. `app/src/app/holds/page.tsx`

| Location | Current | Proposed | Reason |
|---|---|---|---|
| :85 | `alert("No SKU/sticker code matched")` | `alert("Nothing matches that code — check the spelling and try again")` | "SKU" is internal terminology in a native alert a volunteer reads mid-queue; no next step given previously. |
| :122 | `alert(j.error \|\| "Could not convert")` | `j.error \|\| "Could not turn this hold into a sale — the item may already be sold, or the hold may have expired. Try again or start a new hold."` | One word with no cause or next action for an action that affects a real sale. |
| :142 | `RELEASE` button — no confirmation, no feedback afterwards | Add a toast after release: `"Hold released — item is available to sell again."` | This is a deliberately silent one-tap action per spec, but the volunteer currently gets zero confirmation anything happened; add feedback without adding friction. |
| :148 | `No active holds.` | `No active holds. Tap + NEW HOLD to set an item aside for a customer who's coming back for it.` | Doesn't explain what a hold is for or how to make one. |

---

## 5. `app/src/app/orders/page.tsx`

| Location | Current | Proposed | Reason |
|---|---|---|---|
| :64 | `window.prompt("Void reason?")` | `window.prompt("Why are you voiding this order? (The stock will be added back automatically.)")` | Voiding reverses a charge and restocks items — the volunteer should know that before they confirm, not find out after. |
| :121–123 | Sync-pending banner copy | keep | Plain and actionable already, matches offline-state language used well elsewhere. |
| :209 | Text baked into the rendered/shareable shift-summary image: `"crftd Stall OS · placeholder skin, full crop-mark brutalist card is a later polish pass"` | Remove this line from the card entirely | This card gets downloaded and shared in the team WhatsApp group as an external artifact — an internal design-status note becomes a permanent public document. This is the single highest-risk leak in the app because it leaves the product. |
| :287 | `No orders yet this shift.` | keep | Correctly scoped ("this shift"), no action needed since orders will simply appear as sales happen. |
| :309 | Close-shift confirmation copy | keep | Good confirmation pattern — names the action and consequence plainly; use as the house model for confirmations elsewhere (see §9 below). |

---

## 6. `app/src/app/returns/page.tsx`

| Location | Current | Proposed | Reason |
|---|---|---|---|
| :45 | `Logged. Zero-value exchange order created.` | `Logged. We've created a replacement order at no extra charge, so stock updates correctly.` | "Zero-value exchange order" is internal accounting language; a volunteer needs to know money isn't being taken twice, not the record-keeping mechanism. |
| :50 | `j.error \|\| "Failed"` | `j.error \|\| "Could not log this return — try again, or ask an admin if it keeps happening."` | Single word with no cause or next step for an action that touches stock and a customer's refund/exchange. |
| (elsewhere) | Reject-return confirmation | Ensure it reads: `"Reject this return? The customer keeps the item and no refund or exchange happens."` | Destructive/decision copy should state the consequence plainly, matching the pattern already good in Orders' close-shift dialog. |

Rest of screen (policy reminder, receipt-not-found message) already states cause and format hint correctly — kept as-is.

---

## 7. `app/src/app/waste/page.tsx`

| Location | Current | Proposed | Reason |
|---|---|---|---|
| :61 | `alert("No matching product SKU or sticker code")` | `alert("Nothing matches that code — check the spelling and try again")` | Same jargon-plus-no-next-step issue as Holds; use identical wording across both screens so volunteers learn one pattern. |
| :90–94, :105 | Reason list built with `r.replace("_", " ")`, e.g. `misalignment`, `peel failure` shown lowercase and raw | Explicit label map: "Misalignment", "Peel failure", "Wrong temperature", "Print defect", "Garment defect", "Other" | `.replace()` only swaps the first underscore, so any two-word reason (e.g. `peel_failure_edge`) would render half-broken; the visible list also reads as a raw enum dump rather than words a person chose. |
| :98–100 | `LOG WASTE (DECREMENTS STOCK)` | keep | States the consequence directly in the button label — this is the model to copy for other stock-affecting buttons. |

---

## 8. `app/src/app/restock/page.tsx`

| Location | Current | Proposed | Reason |
|---|---|---|---|
| :83–85 | `In stock but zero sales recorded — simplest correct definition, not a real analytics window yet.` | `In stock, but hasn't sold at all in the data we have so far.` | "Not a real analytics window yet" is a developer's self-aware caveat that has no business on an admin-facing screen. |
| :92 | `No dead stock.` | `Nothing here — every item in stock has sold at least once. Nice.` | Textbook ambiguous empty state: reads as either "the feature is broken" or "good news," with zero explanation of what "dead stock" even means. Rewrite states plainly it's good news. |
| :77 | `Nothing below par.` | keep | Fine given the tab label immediately above it provides the context ("par" = restock threshold). |

---

## 9. `app/src/app/shift-open/page.tsx`

| Location | Current | Proposed | Reason |
|---|---|---|---|
| :76–79 | `Custom/canvas orders go to a live pending-press queue.` / `Custom/canvas orders become collect-later with a promised date.` | `Custom stickers or kiosk designs go into a live press queue — someone presses them while the customer waits.` / `Custom stickers or kiosk designs become collect-later — the customer picks a pickup date and we press it before then.` | "Custom/canvas" is internal PRD shorthand a first-shift volunteer has never seen; describe the two real outcomes instead. |

Rest of screen (float amount, venue, receipt-block explainer) already reads plainly — kept.

---

## 10. `app/src/app/admin/*` (admin-only, lower urgency but still visible to real people running the stall)

| Location | Current | Proposed | Reason |
|---|---|---|---|
| `admin/b2b/page.tsx:64` | `"Account owner is required — this is intentional friction per PRD §7."` | `"Account owner is required — every B2B deal needs one person accountable for it."` | Drop the PRD citation; state the actual policy reason. |
| `admin/b2b/page.tsx:93,97` | `Committed value (confirmed+)` / `Collected (deposits + balances)` | `Committed value (confirmed deals and later)` / `Collected so far (deposits and balances)` | "+" shorthand reads as code on a stat tile meant to be scanned quickly. |
| `admin/b2b/page.tsx:134` | `HARD BLOCKED — cannot save below 0% margin.` | `Can't save — this deal would sell at a loss. Raise the price or lower the cost.` | "HARD BLOCKED" is internal gate terminology; state the actual problem and the fix. |
| `admin/b2b/page.tsx:159` | `No B2B enquiries yet.` | `No enquiries yet. New ones you save will show up here.` | Bare empty state, no context or next step. |
| `admin/pricing/page.tsx:51–55` | `PLACEHOLDER PRICING — seeded per PRD §5 defaults, not yet signed off by AQUATERRA. Replace before treating any of this as real invoicing data. Prices snapshot onto order lines at sale time — editing here never rewrites past orders.` | `These prices are starting defaults, not signed off yet — replace them before treating this as real invoicing data. Once you change a price, it only affects new sales; past orders keep whatever price they were charged.` | Drop "PRD §5" and "seeded"; keep the two genuinely useful facts (not final yet, and edits don't retroactively change history) in plain language. |
| `admin/page.tsx:54` | `Net profit after COGS, all-time, non-voided orders` | `Net profit after cost, all time, excludes voided sales` | "COGS" is accounting jargon on a dashboard admins may not have accounting backgrounds for. |
| `admin/page.tsx:64` | `COGS` (stat tile label) | `Cost` | Same. |
| `admin/page.tsx:88–91` | `This is headline + waste + returns only, per the current build pass. Full §13 analytics (kiosk conversion, fulfilment timing, holds conversion, B2B pipeline value) is a later pass.` | `This dashboard currently shows totals, waste and returns only. Kiosk conversion, fulfilment timing, holds and B2B pipeline numbers are coming in a future update.` | "Current build pass" / "§13" is engineering-roadmap language on a screen an admin (possibly a parent or teacher volunteer, not a developer) reads. |
| `admin/page.tsx:99` | `EMAIL DELIVERY (RESEND)` | `EMAIL DELIVERY` | Naming the vendor is meaningless and slightly confusing to a non-technical admin. |
| `admin/page.tsx:100` | `{email.message}` raw | — | Flag for engineering: confirm this never echoes a raw vendor/config error string to the admin UI. |
| `admin/catalogue/page.tsx:76–79` | `PRD §16.10: code, name, size class, stock, cost, price, bin location. Upserts by code — re-import the same file after fixing a typo, existing rows update rather than duplicate.` | `Columns needed: code, name, size class, stock, cost, price, bin location. Matched by code — re-import the same file after fixing a typo and it updates existing rows instead of creating duplicates.` | Strip the PRD citation; lead with the useful, actionable part (which columns, what happens on re-import). |
| `admin/catalogue/page.tsx:117–120` | `PRD §16.10: transparent PNGs named by code (e.g. **M-014.png**). Select every file at once — each is matched to its design by filename.` | `Transparent PNGs, named after the design code (e.g. **M-014.png**). Select every file at once — each one matches to a design by its filename.` | Same — drop citation, keep the how-to. |
| `admin/catalogue/page.tsx:143–146` | `Encodes crftd:s:<code> per PRD §9. Camera scanning stays off by default until labels are printed and a settings flag is flipped — not built this pass.` | `Each QR code links straight to that sticker. Camera scanning at the till stays off until labels are printed and it's turned on in Settings.` | Raw internal encoding string and "not built this pass" both leak development state; reframe as how it works and how to turn it on later. |
| `admin/catalogue/page.tsx:152`, `admin/stock/stickers/page.tsx:83` | `{d.bin_location \|\| "no bin set"}` | `{d.bin_location \|\| "Bin not set"}` | Sentence case, consistent with the rest of the app. |
| `admin/mockups/page.tsx:130–132` | `PRD §16.7–8. One mockup + print rectangle per colour/fit/side, applied to every size that shares it.` | `One mockup and print area per colour, fit and side — it's applied to every size that shares that combination.` | Drop citation; the explanation stands fine on its own. |
| `stock/products/page.tsx:62–64` | `No product SKUs yet.` | `No products yet. Import them from Admin → Catalogue, or ask an admin to add the starter tees.` | Bare empty state, no next step. |
| `stock/products/page.tsx:65–68` | `...each writes to the movement ledger with a reason. CSV / image import lives in Admin → Catalogue.` | `...each one is recorded with a reason, so you can always see why a number changed. Bulk import lives in Admin → Catalogue.` | "Movement ledger" mirrors an internal table name; describe the outcome (a record you can check later), not the implementation. |
| `stock/stickers/page.tsx:117–120` | `No sticker designs yet. The 200-design catalogue import (PRD §16.10) is still pending — add a few manually below to test Sell.` | `No sticker designs yet. Import the full catalogue from Admin → Catalogue, or add a few here by hand to try out Sell.` | PRD citation and "still pending" frame a normal empty state as an unfinished build. |

---

## 11. Components used across screens

| Location | Current | Proposed | Reason |
|---|---|---|---|
| `components/Collections.tsx:21` | `No collections pending.` | `No collections pending. Orders customers need to come back for will show up here once they're sold.` | Bare empty state, no explanation of what a "collection" is. |
| `components/Collections.tsx:27` | `"No date given"` | `"No pickup date on file"` | Slightly technical fragment sitting among otherwise formatted dates; clarifies exactly what's missing. |
| `components/PressQueue.tsx:122–125` | `No mockup or print area on file for this SKU — use the placement list below.` | `No mockup or print area set up for this product yet — use the placement list below instead.` | "SKU" is jargon at a station where whoever's pressing is under time pressure and may not know the term. |
| `components/TabBar.tsx` | — | keep | Labels are already plain and consistent everywhere. |
| `components/ui.tsx`, `components/PosFrame.tsx`, `components/ServiceWorker.tsx` | — | no findings | No hardcoded copy; all text passed in from call sites already covered above. |

---

## 12. States that must never be missed (cross-screen checklist)

| State | Where it shows today | Copy status |
|---|---|---|
| Offline (Sell) | `sell/page.tsx:775` | Needs rewrite — see §1. Must say sale is saved on-device and will send later, never "queue locally." |
| Unsynced sales / outbox | `sell/page.tsx:781`, `orders/page.tsx:121–123` | Sell needs rewrite ("Sending queued sales…"); Orders banner already good — copy that pattern into Sell. |
| Stale catalogue | `sell/page.tsx:789–791` | Needs rewrite — say stock might be a few sales behind, not "cached"/"stale." |
| No receipt block (can't charge on this device) | `sell/page.tsx:799` | Needs rewrite — name the actual limitation ("can't print receipt numbers yet") and the fix. |
| Out-of-stock at checkout | `sell/page.tsx:262,320` (add-anyway confirm), `help/page.tsx` | `help/page.tsx` already models the right reassurance ("nothing was charged and no stock moved" pattern) — every out-of-stock confirm elsewhere should match that exact promise once the sale actually can't complete. |
| Voiding an order | `orders/page.tsx:64` | Needs rewrite — must state that stock returns automatically. |
| Releasing a hold | `holds/page.tsx:142` | Needs added feedback toast — currently silent. |
| Rejecting a return | `returns/page.tsx` | Confirm copy states the customer keeps the item and no refund/exchange happens. |

`help/page.tsx` is the one screen in the whole codebase that already does all of this correctly — it explains the sticker-search "14"/"m14" behaviour, explains bin location as a physical instruction, and states the out-of-stock reassurance in full. Use it as the reference implementation when rewriting the others.

---

## 13. Voice and tone guide

**1. Say what happened, not what the system did.**
Right: *"Sale saved on this phone — it'll send once you're back online."*
Wrong: *"Order queued to outbox pending sync."*
A volunteer needs the consequence (their sale is safe), not the mechanism (there is an outbox, it syncs).

**2. Every error names the next action.**
Right: *"Could not log this return — try again, or ask an admin if it keeps happening."*
Wrong: *"Failed."*
If a volunteer can't tell what to do next, the error has failed at its only job.

**3. Never let a build word reach a screen.**
Right: *"Email receipts aren't turned on yet."*
Wrong: *"EMAIL (PHASE 4)"* or *"...per PRD §16.9."*
Phase numbers, PRD sections, table names, route names, "stubbed," "not built this pass" are for commit messages and code comments, not for any surface a volunteer or customer sees. If a feature is unfinished, say what's missing and when it might matter — never cite the plan that says so.

**4. Every empty state teaches: what this is, why it's empty, what to do.**
Right: *"No active holds. Tap + NEW HOLD to set an item aside for a customer who's coming back for it."*
Wrong: *"No dead stock."*
An empty state that could mean either "working correctly" or "broken" has failed. State the good news plainly if it is good news.

**5. Destructive and money-moving actions state the consequence, not just the question.**
Right: *"Why are you voiding this order? (The stock will be added back automatically.)"*
Wrong: *"Void reason?"*
Anything that reverses a charge, restores or removes stock, or contacts a customer should say what happens as part of the prompt — not "Are you sure?"

**6. The kiosk sells; the till gets the job done.**
Kiosk right: *"No stickers match that search — or they're sold out for now. Try another word."*
Till right: *"Discounts over 10% need an admin's PIN — you'll be asked for it when you hit Charge."*
Kiosk copy is a confident sentence aimed at someone deciding whether to buy. Till copy is a fast, flat instruction aimed at someone mid-transaction with a queue behind them. Never swap the two registers — a kiosk line that sounds like an operations manual kills a sale, and till copy that sounds like marketing slows the volunteer down.

**7. Explain non-obvious behaviour where it's used, in one line, not in a manual.**
Right (search field help text): *"14" finds every size (S/M/L-014). "m14" finds only the Medium.*
Wrong: leaving the placeholder as the only hint and hoping the volunteer discovers the rule by trial and error mid-queue.
If a feature has a rule a first-time user can't guess, put the rule one line under the control that uses it.

**8. Bin locations and similar fields are instructions to a body, not data to a screen.**
Right: *"Go to Box 2 / Tab M · 6 left"*
Wrong: *"Box 2 / Tab M · 6 left"*
Anything that tells someone where to physically walk should read as a direction, not a label.

---

## 14. Term glossary

Keep these exact terms everywhere copy uses them. Do not introduce synonyms mid-flow — a volunteer who learns one word for a concept should never meet a second word for the same thing on the next screen.

| Term | Means | Do not call it |
|---|---|---|
| **Garment** | A physical tee/hoodie/etc. sold at the stall, before any design is added. | "Product", "SKU", "blank" (blank is internal only) |
| **SKU / sku_code** | The internal code for a specific garment variant (colour + fit + size). Staff-facing only — never shown to a customer as their product's name. | Never show raw to a customer; on staff screens, "SKU" is acceptable shorthand for volunteers who've been briefed, but full label (colour · fit · size) is always preferred where space allows. |
| **Sticker / sticker design** | A pre-made printable design a customer can add to a garment or buy standalone. Identified by a **design code** like `M-014`. | "Transfer" (see below — different thing), "decal" |
| **Transfer** | Not currently a user-facing term in this app — avoid introducing it. If ever needed for a print method, define it explicitly the first time it appears; do not use interchangeably with "sticker" or "design." | — |
| **Design / design code** | Same as sticker design above; "code" (e.g. `M-014`) is what volunteers search by. | "ID" (sounds like a database key, which it also technically is — keep it "code" in UI copy) |
| **Custom sticker** | A one-off sticker a customer wants that isn't in the pre-made catalogue; entered by hand at the till with a description and price. | "C-????" placeholder code should never be user-visible as the sticker's name — always show the typed description instead. |
| **Kiosk / Design Studio** | The customer-facing touchscreen where someone designs their own shirt before buying. | "Canvas" is the internal/PRD name for this flow — never show "canvas" to a customer; "kiosk design" is fine on staff screens. |
| **Design ticket** | The short code (e.g. `A7K2`) a customer gets from the kiosk after building a design, which a volunteer loads at the till to add it to a sale. | "QR payload", "ticket payload" |
| **Bin location** | Where a sticker or garment physically lives at the stall (e.g. "Box 2 / Tab M"), shown so a volunteer knows where to walk. | Never show as a bare label — always frame as a direction ("Go to…"). |
| **Hold** | Setting an item aside for a specific customer who is coming back to pay. | "Reservation" (unused elsewhere, would introduce a second word for the same idea) |
| **Collect-later** | An order where the customer pays now but picks up the finished item on a later date (used when press isn't on-site). | "Fulfilment status: collect_later" — the raw status string must never be user-visible. |
| **Press queue / pending press** | The list of orders waiting to be heat-pressed on-site during the shift. | "Press mode", "fulfilment queue" |
| **Receipt block** | The internal range of receipt numbers assigned to a device so it can issue numbers offline. Staff should never need this term — describe the effect ("this phone can charge / can't print receipt numbers") instead. | Never expose "block" to a volunteer. |
| **Outbox** | The internal name for sales saved on a device while offline, waiting to sync. Same rule — describe the effect, not the mechanism. | Never expose "outbox" in UI copy. |
| **Void** | Cancelling a completed sale; reverses the charge and returns stock automatically. | "Cancel" (reserve "cancel" for actions that haven't completed yet, e.g. closing a dialog) |
| **Exchange / return** | Customer brings an item back; a return may be logged with or without a replacement item (an exchange). | "Zero-value exchange order" is the internal record type — never say this to a volunteer; say "replacement, no extra charge." |
| **Waste** | Stock removed from inventory because it's damaged or unsellable, logged with a reason. | "Shrinkage" (accounting term, unused in this app — don't introduce it) |
| **Shift** | One stall session, from open to close, tracked per device with a float and a venue. | — |
| **Float** | The starting cash amount counted into the till at shift open. | "Opening balance" (finance term, avoid) |

---

## Summary — top priority fixes

1. `receipt/page.tsx:65` — PRD citation on a live customer receipt.
2. `receipt/page.tsx:134,137` — literal "PHASE 4" on the customer-facing receipt screen.
3. `orders/page.tsx:209` — internal build-status note baked into a shareable shift-summary image that leaves the app via WhatsApp.
4. Repeated `PRD §X.Y` citations across admin/staff screens (b2b, admin dashboard, catalogue, mockups, stickers, shift-open) — strip all of them, keep the underlying explanation.
5. Bare empty states with no next action (`restock`, `stock/products`, `holds`, `b2b`, `Collections`, kiosk presets) — all rewritten above.
6. `page.tsx:850` — raw SKU code (`BLK-REG-M`) shown to a paying customer instead of a plain description.
7. Internal-mechanism language on Sell's status banners (`outbox`, `cached catalogue`, `receipt block`) — rewritten to describe effects, not implementation.
8. Raw enum rendering in waste reasons and receipt discount reason — needs the explicit label maps given above.

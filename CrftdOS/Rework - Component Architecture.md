# Rework — Component Architecture

Scope: `app/src/app/sell/page.tsx` (1,222 lines) and `app/src/app/page.tsx` (1,017 lines, the kiosk). Frontend-only. No API route, SQL, or contract changes — every hook below consumes the exact same `fetch`/`supabaseBrowser` calls the pages make today, just relocated.

Read: `app/AGENTS.md`, both target pages in full, `PosFrame.tsx`, `ui.tsx`, `outbox.ts`, `catalogueCache.ts`. Next.js docs were not needed for this document — it proposes no routing, layout, or server-API change; the boundary section below is deliberately conservative about what a Next 16 Server Component can do given the offline constraint, and doesn't lean on any version-specific API.

---

## 1. Target module tree

Convention: **feature-first** (`src/features/<domain>/...`), not a flat `components/`. Reasoning: `sell` and `kiosk` share almost nothing (different skin, different state machine, different device role) except two generic pieces (`Panel`/`BigButton` design system, `ticketPayload` codec) which already live correctly in `src/components/ui.tsx` and `src/lib/`. Colocating hooks with the components that use them keeps a reviewer from having to jump between `hooks/` and `components/` directories to see one state slice end to end. `src/components/` stays as-is for cross-feature primitives (`PosFrame`, `TabBar`, `ui.tsx`).

### `src/features/sell/`

```
sell/
  SellPage.tsx                    orchestrator: composes hooks, renders layout, owns no business state itself
  hooks/
    useSellBoot.ts                shift/block fetch+join, offline catalogue load via loadWithCache, recentCounts restore
    useOutboxStatus.ts            online flag, pendingOutbox count, flush-on-visible/online — generic enough to also serve other screens later, but starts here since Sell is the only current consumer
    useCatalogueFilters.ts        colorId/fitId/sizesForSelection selection state (garment picker)
    useStickerSearch.ts           stickerQuery/sizeFilter/stickerResults memo, recentTop8, recentCounts write-through
    useCart.ts                    garments/standalone/targetGarmentKey + add/remove/addCustomSticker — the single source of truth for cart contents
    useTicketRedemption.ts        ticketCode/ticketErr/redeemedTicketCodes/loadingTicket, redeemTicket() (QR decode + typed-code fetch), appends into useCart via a passed-in callback
    useDiscountGate.ts            discountAmt/discountPct/discountReason, discountAmount/discountPctEffective/needsAdminGate memos — pure derivation off subtotal, no admin-PIN state inside it
    useAdminStepUp.ts             adminPinPrompt/adminPinValue/adminPinErr/discountUnlocked, submitAdminPin(), the needsAdminGate->discountUnlocked reset effect
    usePaymentSplit.ts            payment/cashAmt/upiAmt, splitTotal/splitOk memos
    useCustomerSheet.ts           customerName/phone/email/consent/promisedDate/customerErr, collectLater derivation (needs shift.press_on_site + cart fulfillment-trigger, both passed in)
    useCharge.ts                  charging/undo state, openCharge()/charge()/doUndo(); composes useCart + useDiscountGate + useAdminStepUp + usePaymentSplit + useCustomerSheet + useOutboxStatus outputs into the order payload; owns resetCart()
  components/
    TicketRedeemPanel.tsx         "Load design ticket" Panel — field + LOAD button + error banner
    CartList.tsx                  cart Panel: garment rows (selectable), sticker sub-rows, standalone rows, remove buttons
    GarmentPicker.tsx             color/fit chips + size grid Panel
    StickerPicker.tsx             search field, size-class chips, recent strip, results list, custom-sticker inline form
    DiscountPanel.tsx             amount/pct fields, reason select, >10% notice
    PaymentPanel.tsx              method chips, split fields + validation message
    ChargeFooter.tsx              the sticky BigButton, wraps PosFrame's `footer` slot
    AdminPinModal.tsx             PIN prompt overlay
    CustomerSheetModal.tsx        collect-later / customer-details overlay
    UndoToast.tsx                 post-charge undo bar
    StatusBanners.tsx             offline / syncing / cached-catalogue / no-receipt-block banners, fed by useOutboxStatus + useSellBoot
  types.ts                        CartGarment / CartSticker / CartStandaloneSticker (moved verbatim out of the page)
```

`SellPage.tsx` becomes the file at `app/src/app/sell/page.tsx` re-exports (`export { SellPage as default } from "@/features/sell/SellPage"`) — the route file stays a thin pointer so `app/` keeps being pure routing, matching how the rest of the app already treats `app/*/page.tsx` as leaf entries.

### `src/features/kiosk/`

```
kiosk/
  KioskPage.tsx                   orchestrator: stage machine + stage router, no geometry math inline
  hooks/
    useKioskCatalogue.ts          fetch /api/kiosk/catalogue, colors/fits/skus/designs/presets, catalogueLoading/catalogueError
    useKioskStage.ts              stage state + resetAll() (the only thing allowed to force stage back to "attract")
    useProductSelection.ts        colorId/fitId/size/side, sku memo, printArea memo
    usePlacements.ts              placements/selectedKey state, placeDesign/removePlacement/setRotation, reserveSticker/releaseHold network calls, applyPreset — the hold-lifecycle owner
    useCanvasGeometry.ts          PURE, no state: pxCorners/polysOverlap/overlaps/pxRect/clampCenterPct/withinPrintArea as exported functions taking printArea as a parameter — see §5 for why this must not close over React state
    useCanvasDrag.ts              pointer-drag handlers (position) built on useCanvasGeometry + usePlacements' setter, ref-based, effect-cleaned listener attach/detach
    useRotationDrag.ts            rotation-slider commit/revert logic, same shape as useCanvasDrag but simpler (single-axis)
    useDesignTicket.ts            getTicket(): builds payload, calls /api/kiosk/ticket, encodes QR via ticketPayload + qrcode, owns ticket/ticketQr/ticketError
  components/
    AttractScreen.tsx             stage "attract"
    PathScreen.tsx                stage "path" (presets + "build from scratch")
    ProductScreen.tsx             stage "product" (color/fit/size picker)
    CanvasScreen.tsx              stage "canvas" — composes CanvasSurface + StickerTray + RotationControl
    CanvasSurface.tsx             the mockup <img> + print-area outline + placed-sticker <img> layer; receives placements/printArea/side/selectedKey and drag/rotation handler props, no state of its own
    RotationControl.tsx           the range slider + REMOVE button for the selected placement
    StickerTray.tsx               search field + filtered design grid
    TicketScreen.tsx               stage "ticket" — QR + code + DONE
    kiosk-chrome/
      Halftone.tsx, KioskCropMarks.tsx, BoxLabel.tsx, StarBurst.tsx   pure decorative primitives, moved verbatim, no logic changes
  types.ts                        Color/Fit/Sku/Design/Preset/Placement/PlacementTrial (moved verbatim)
```

`app/src/app/page.tsx` similarly becomes a thin re-export of `KioskPage`.

Both trees are additive-only during extraction (§3) — nothing in `src/app/` besides the two `page.tsx` files changes shape.

---

## 2. State ownership map

### Sell — the dependency chain the prompt calls out explicitly

```
useCart (garments, standalone)
     │  subtotal = f(garments, standalone)      ← computed in SellPage, not inside useCart,
     │                                             because useDiscountGate needs it and useCart
     │                                             shouldn't need to know discount exists
     ▼
useDiscountGate(subtotal, discountAmt, discountPct)
     │  → discountAmount, discountPctEffective, needsAdminGate
     ▼
useAdminStepUp(needsAdminGate)
     │  → discountUnlocked, adminPinPrompt, submitAdminPin()
     │  (internal effect: needsAdminGate flips false → discountUnlocked resets false)
     ▼
usePaymentSplit(total)                           total = subtotal - discountAmount, computed in SellPage
     │  → splitOk
     ▼
useCustomerSheet(cartHasFulfillmentTrigger, shift.press_on_site)
     │  cartHasFulfillmentTrigger = f(garments, standalone), computed in SellPage
     │  → collectLater, customer field state
     ▼
useCharge({ cart, discount, adminStepUp, paymentSplit, customerSheet, shift, block, outboxStatus })
     → charging, undo, openCharge(), charge(), doUndo()
```

Key ownership decisions:

- **Derived values (`subtotal`, `total`, `cartHasFulfillmentTrigger`, `collectLater`) are NOT owned by any hook.** They are `useMemo`s computed in `SellPage.tsx` from the outputs of `useCart` + `useDiscountGate` + boot state, then passed down as **arguments** into the hooks below them in the chain. This is the decoupling mechanism the prompt is asking about: each hook takes its upstream numbers as plain function arguments (not by reaching into a store or another hook), so `useAdminStepUp` has zero import-time knowledge that `useCart` or `useDiscountGate` exist. It only knows "I am given a boolean."
- **`useCharge` is the one hook allowed to know about all the others**, because charging is genuinely the point where cart + discount + payment + customer + shift state all have to be assembled into one order payload — that fan-in is real, not an architecture smell. It receives their *outputs* as a single props object built in `SellPage.tsx`, never their setters beyond what it needs to call `resetCart()`/`doUndo()`'s revert (which needs setters from `useCart`, `useDiscountGate`, `usePaymentSplit` — passed explicitly, not implicitly).
- **No global store.** Composition via `SellPage.tsx` passing hook outputs as props to child hooks and components is sufficient here: the whole tree lives under one route, unmounts cleanly on navigation (matching the existing "shift-scoped, remounts every visit" comment in the code), and Zustand/Jotai would buy nothing but an extra dependency and a second place state could leak from. If a future screen needs to read cart state from *outside* `/sell` (e.g., a persistent mini-cart in `TabBar`), that's the trigger to introduce a store — not before. Recommendation: **composition, no store**, revisit only if cross-route cart visibility becomes a real requirement.
- **`recentCounts`** stays inside `useStickerSearch` since it's sticker-search-local UI convenience state (backed by `sessionStorage`, not cart truth) — it doesn't belong in the ownership chain above.

### Kiosk — the canvas chain

```
useKioskCatalogue → colors, fits, skus, designs, presets
     ▼
useProductSelection(skus) → colorId, fitId, size, side, sku, printArea
     ▼
usePlacements(printArea, side) → placements, selectedKey, placeDesign(), removePlacement(), setRotation()
     │        (reserveSticker/releaseHold are network side effects owned here — a hold's
     │         lifecycle is exactly as long as the placement that owns it)
     ▼
useCanvasDrag(placements, printArea, side, setPlacements from usePlacements)
useRotationDrag(placements, printArea, side, setPlacements from usePlacements)
     ▼
useDesignTicket(sku, placements, total) → ticket, ticketQr, getTicket()
```

- `useCanvasGeometry` is **not a stateful hook at all** — it's a plain module of exported pure functions (`pxCorners`, `polysOverlap`, `pxRect`, `clampCenterPct`, `withinPrintArea`) parameterized by `printArea`, called by `usePlacements`, `useCanvasDrag`, and `useRotationDrag` alike. Making it "just functions" rather than a hook avoids three different hooks each holding a slightly-stale closure over the same geometry constants — see §5 for why this matters specifically for React 19.
- `useKioskStage` sits above all of these and is the only place `resetAll()` lives, because reset needs to reach into `usePlacements` (release every hold) as well as reset `useProductSelection` and `useDesignTicket` — same "one legitimate fan-in point" pattern as `useCharge`.
- No store here either — single-route, single-session kiosk state, reset on every "DONE — NEXT CUSTOMER".

---

## 3. Extraction sequence

Every step must leave `tsc --noEmit` and `next build` clean, plus a manual pass of kiosk→ticket→till→charge in the browser. Order chosen so each step is a pure move (copy-paste + import fix), never a simultaneous move+behavior-change — that's what makes each step revertible on its own.

**Sell (do this tree first — it's the one with the money-handling logic, so a mistake there is costlier and each successive extraction is lower-risk once it's done):**

1. Move `CartGarment`/`CartSticker`/`CartStandaloneSticker` types to `features/sell/types.ts`. Build. No behavior change possible — types erase at compile time.
2. Extract `useCatalogueFilters` (colorId/fitId/sizesForSelection) — leaf state, nothing downstream depends on internals. Build + verify garment picker still filters by color/fit.
3. Extract `useStickerSearch` (query/sizeFilter/results/recentCounts) — same leaf-state shape. Verify search, size-class chips, and "Recent" strip still populate.
4. Extract `useCart` (garments/standalone/targetGarmentKey + add/remove/addCustomSticker). This is the first hook other things will depend on — verify cart add/remove and the "adding stickers here" highlight still work before moving on.
5. Extract `useTicketRedemption`, wired to call `useCart`'s garment-append via a prop callback rather than importing `useCart` directly (keeps it testable in isolation and matches the composition-not-coupling stance in §2). Verify both QR-scan and typed-code paths at the till against a real kiosk ticket.
6. Extract `useDiscountGate` — pure derivation, takes `subtotal` (still computed in the page) as an argument. Verify discount amount/percent fields and the >10% banner.
7. Extract `useAdminStepUp`, taking `needsAdminGate` as an argument. Verify PIN prompt, correct PIN, wrong PIN, and lockout (429) messaging — this is the security-relevant one, test deliberately, not just happy path.
8. Extract `usePaymentSplit`, taking `total` as an argument. Verify split validation math and the enable/disable of Charge on mismatch.
9. Extract `useCustomerSheet`, taking `cartHasFulfillmentTrigger`/`press_on_site` as arguments. Verify both branches: press-on-site (SKIP available) and collect-later (fields required, no SKIP).
10. Extract `useSellBoot` + `useOutboxStatus` — the least entangled with the transaction chain but the most side-effect-heavy (network boot, visibility/online listeners). Verify offline banner, cached-catalogue banner, and outbox count after toggling devtools offline.
11. Extract `useCharge` last, composing outputs of steps 4–10. This is where the actual order-payload assembly lives — diff the constructed `payload` object against the pre-extraction version field-by-field before testing live, then run the full kiosk→ticket→till→charge flow, then test undo, then test the offline path (charge while devtools-offline, confirm outbox enqueue, confirm sessionStorage `last_receipt`).
12. Split the JSX into the `components/` list in §1, each taking its state as props from `SellPage.tsx` — purely presentational extraction, do these last and one at a time since a stray prop-name typo here is the easiest mistake to make and the easiest to silently miss (a panel that just doesn't show a value). Screenshot before/after each one.
13. Collapse `app/src/app/sell/page.tsx` to the re-export. Full regression pass.

**Kiosk (same discipline, after Sell is done and the pattern is proven):**

1. Move types to `features/kiosk/types.ts`.
2. Extract `useCanvasGeometry` as pure functions — no state, so this is the safest possible first move; verify by unit-eyeballing that overlap detection still refuses a deliberately-overlapping placement and rotated placements still collide correctly (the SAT math is the part most worth a deliberate manual check — see §5).
3. Extract `useKioskCatalogue`. Verify catalogue loads, and that designs missing `print_w_cm`/`print_h_cm` are still filtered out.
4. Extract `useProductSelection`. Verify color/fit/size flow and printArea derivation.
5. Extract `usePlacements` (placeDesign/removePlacement/setRotation/reserveSticker/releaseHold/applyPreset), depending on `useCanvasGeometry`. Verify: place a sticker (center + offset-grid fallback), remove a sticker (hold released — check network tab for the DELETE), apply a preset (each placement gets its own hold).
6. Extract `useCanvasDrag` and `useRotationDrag`. This is the highest-risk step in the whole kiosk tree — see §5's React 19 closure note. Verify by dragging a sticker to an overlapping position (expect revert + message) and to a valid position (expect commit), then the same two cases for rotation via both pointer and keyboard.
7. Extract `useDesignTicket`. Verify ticket generation, QR encode/decode round-trip against the till (redeem the exact QR this kiosk just produced), and the typed-4-character-code fallback.
8. Extract `useKioskStage` (stage + resetAll), wired to call `usePlacements`' hold-release and reset the other hooks via callbacks. Verify DONE returns to attract with all holds released (check network tab for one DELETE per placement).
9. Split JSX into `components/`, stage-screen by stage-screen, decorative primitives (`Halftone` etc.) moved verbatim first since they're logic-free. Screenshot each stage before/after.
10. Collapse `app/src/app/page.tsx` to the re-export. Full regression: attract → path (preset) → ticket, and separately attract → path (scratch) → product → canvas (place, drag, rotate, remove) → ticket → till redemption → charge.

Do not interleave the two trees — finish Sell, ship/verify, then start Kiosk. Running both half-done at once doubles the surface you have to hold in your head when something breaks.

---

## 4. Server vs. client boundary

Every screen is `"use client"` today, and that's correct for nearly all of it — restating why is more useful than pretending otherwise:

- **Sell and Kiosk data loading is client-side by design, not oversight.** `loadWithCache` (catalogueCache.ts) reads/writes IndexedDB, which does not exist on the server, and the whole point is "fresh when online, last snapshot when not" decided in the browser at request time. A Server Component fetch would only ever see "online, from this server's perspective," which is a meaningless signal for a phone that's actually offline on the till. This cannot move server-side without breaking PRD §10.
- **Sell's boot sequence (`useSellBoot`) also depends on `getDeviceId()`** (a client-only localStorage-backed value used to scope `/api/shift/current`) and `sessionStorage` for `recentCounts` — both hard client requirements.
- **The kiosk canvas is inherently interactive** (pointer drag, live geometry) — there's no server-renderable version of it.

What genuinely could become a Server Component, without touching the API contract:

- **`app/src/app/receipt/page.tsx`-adjacent static chrome** — not in scope here, but worth naming as the actual candidate class: screens that only *display* server-fetched data with no client interaction. Neither `sell` nor the kiosk qualifies.
- **The decorative kiosk primitives** (`Halftone`, `KioskCropMarks`, `BoxLabel`, `StarBurst` in `kiosk-chrome/`) have no state, no event handlers, and no browser-only API — they *could* drop `"use client"` and be Server Components in isolation. In practice this buys nothing: they're rendered inside a client component tree (`KioskPage`), so Next still has to send their output as part of the same client bundle boundary, and marking a handful of tiny presentational leaves as Server Components while their parent and siblings stay client-only adds a directive to track for near-zero bytes saved. Not recommended — leave them client, note it as available headroom if the kiosk chrome tree ever grows large enough to matter.
- **Static panel labels / layout chrome inside `PosFrame`** — already correctly server-renderable in principle, but `PosFrame` itself is invoked from within client pages, same boundary argument as above.

Net recommendation: keep both trees fully client, as now. The honest server/client split in this codebase runs at the *route* level (`/sell`, the kiosk root, and `/receipt` are client; a hypothetical purely-informational admin report page would not be) — not within these two screens.

---

## 5. Risk register

| Extraction | What could silently break | How to detect |
|---|---|---|
| `useCart` | `targetGarmentKey` staying stale after a garment is removed (existing code already nulls it on removal — an extraction that drops that line reintroduces "sticker silently disappears into nowhere") | Add a garment, select it, remove it, then add a sticker — must go to standalone, not throw or vanish |
| `useTicketRedemption` | Duplicate-code guard racing a double-tap (the code has two guard checks — one pre-network on `ticketCode`, one post-decode on the resolved `code` from a scanned QR, because a QR's embedded code can differ from the typed field). Collapsing these into one check during extraction reopens the double-charge bug the comments describe. | Rapid double-tap LOAD on a real ticket; scan a QR whose code differs from whatever's typed in the field beforehand |
| `useDiscountGate` / `useAdminStepUp` split | The `needsAdminGate → discountUnlocked` reset effect (`eslint-disable-next-line react-hooks/set-state-in-effect`) has an explicit comment saying it's intentional state sync, not derivable. If this effect ends up in the wrong hook (e.g. inside `useDiscountGate`, which has no business knowing `discountUnlocked` exists), the gate silently stays "unlocked" after a volunteer edits the discount back down and up again. | Unlock via PIN, reduce discount below 10%, raise it back above 10% — must re-prompt for PIN |
| `useCharge` payload assembly | Any field silently dropped from the `payload` object (e.g. `adminPin` only sent `needsAdminGate && discountUnlocked` — an off-by-condition here either leaks an unnecessary PIN or, worse, lets a >10% discount through without one, since the server re-verifies but a client that never sends the PIN at all still hits the server's own gate — verify that path doesn't silently pass) | Diff the constructed payload object field-by-field against pre-extraction version; explicitly test a >10%-discount charge end to end, confirm receipt reflects the discount |
| `useCharge` — offline path | `resetCart()` firing before or after the outbox enqueue in the wrong order could clear cart state the offline payload still needed, or leave stale state visible after a queued sale | Toggle devtools offline, charge, confirm outbox count increments and cart clears; toggle back online, confirm outbox flushes and receipt syncs |
| `useCanvasGeometry` as pure functions | If this becomes a hook instead of plain functions, and any of `usePlacements`/`useCanvasDrag`/`useRotationDrag` call it without `printArea` in a dependency array, all three drift out of sync silently — a resize or side-switch (front/back have different `printArea`) leaves one of them evaluating collisions against the wrong rectangle | Switch side mid-canvas with placements on both, drag a sticker near the print-area edge on each side |
| `useCanvasDrag` — React 19 stale closures | `onPointerMove`/`onPointerUp` are currently plain functions attached via `window.addEventListener` inside `onPointerDownSticker`, closing over `dragState.current` (a ref, safe) and `printArea` (a plain variable from render scope — **not** a ref). If extraction turns `onPointerDownSticker` into a `useCallback` with a stale `printArea` in its closure (e.g. memoized once and never invalidated on side-switch), a drag started right after switching front/back will compute against the previous side's print area. The current code is *not* memoized at all, so it's accidentally correct today — an extraction that adds `useCallback` for "performance" without checking the dependency array is the actual regression risk here, not the extraction itself. | Switch side, immediately start a drag, drop near a boundary that's valid on the old side but invalid on the new one — must evaluate against the *current* side |
| `useCanvasDrag` / `useRotationDrag` — listener cleanup | `window.addEventListener("pointermove", ...)` / `pointerup` are added in the down-handler and removed in the up-handler, not in a `useEffect` cleanup. Extracting into a hook without converting this to effect-scoped listeners (attach in effect keyed on drag-start, detach in cleanup) risks a leaked listener if the component unmounts mid-drag (e.g. volunteer navigates away via the staff passcode link while a drag is in flight) — the existing code has this exact gap already, so the extraction should *fix* it, not just relocate it, since a leaked window listener silently corrupts placements state on any future pointer event anywhere on the page. | Start a drag, navigate away (staff passcode link) before releasing pointer, come back to the kiosk (fresh mount) and confirm no phantom placement updates occur; check `getEventListeners(window)` in devtools before/after |
| `usePlacements` — hold lifecycle | `resetAll()` must release every hold in `placements`, and `removePlacement` must release exactly that one. An extraction that moves hold-release into a `useEffect` cleanup keyed incorrectly could double-release (harmless — server should treat it as idempotent, but worth confirming) or under-release (leaks stock for up to 15 min) | Remove a placement, check network tab for exactly one DELETE with that `holdId`; reset the kiosk with 3 placements, check for exactly 3 DELETEs |
| Presentational component split (both trees) | Prop-name typos that TypeScript won't catch if a prop is optional or the types are too loose (e.g. `unit_price` vs `unitPrice` inconsistency slipping through if a component redefines its own prop type instead of importing from `types.ts`) | Screenshot-diff every panel before/after; deliberately widen no prop types during this step — import from the shared `types.ts`, never redeclare |
| `PosFrame` layout contract | Nothing here changes `PosFrame` itself, but the extracted `ChargeFooter`/panels must still render inside its `footer`/`children` slots exactly as before — the file's own comments warn this layout broke once (sticky-inside-scroll-container bug) | Confirm TabBar stays pinned and Charge footer stays visible without scrolling on a real phone viewport after each JSX-split step |

---

## 6. Performance

Two named hot paths in the prompt, plus what the extraction should specifically do about each — not blanket `memo()`.

**Sell — sticker grid re-rendering on every keystroke.**
Today `stickerResults` is already a `useMemo` keyed on `[designs, sizeFilter, stickerQuery]`, so the *filtering* isn't the problem — the problem is that `stickerQuery` lives in the same component as the ~1,200-line render tree, so every keystroke re-renders the garment picker, cart list, discount panel, everything. Once `useStickerSearch` and `<StickerPicker>` are split out (§1, §3 step 3), a keystroke only re-renders `<StickerPicker>` and its list — that's the actual fix, not memoization. On top of that:
- Wrap each result row as its own component (`StickerResultRow`) and `memo()` it with a custom comparator keyed on `design.id` + `design.stock_qty` — not the whole `design` object reference, since `designs` is refetched wholesale on boot and a naive reference-equality memo would never hit after any refetch even though most rows are unchanged content-wise. Compare `stock_qty` explicitly because that's the one field that can change under a row without the row's identity changing.
- Cap rendering to the existing `.slice(0, 30)` (already present) — do not virtualize; 30 rows doesn't warrant `@tanstack/react-virtual` and adding it would be scope creep against "no backend changes, frontend-only rework," best read as "minimal, targeted."
- Do not memoize `<StickerPicker>` itself with `memo()` — it re-renders on every keystroke by definition (that's the point of a live-filtered list); memoizing the container and relying on row-level memo for the actual win is the correct split.

**Kiosk — canvas re-rendering on every pointermove.**
This is the sharper problem: `onPointerMove` currently calls `setPlacements` on *every* pointer event during a drag, which re-renders the entire `CanvasScreen` (mockup image, print-area outline, every other placed sticker, the sticker tray grid, the query input) on every pixel of mouse movement, not just the dragged sticker.
- Split `<CanvasSurface>` so each placed sticker is its own `<PlacementSprite>` component, `memo()`'d on `{key, xPct, yPct, rotation, side}` (not the whole `Placement` object — `unit_price`/`unit_cost`/`holdId` never change mid-drag and including them in props just widens the comparator surface for no benefit).
- During an active drag, only the dragged sticker's `xPct`/`yPct` actually needs to update per-frame. Two viable approaches, in order of preference given "no premature complexity":
  1. Keep `setPlacements` as the update path (simplest, matches current code shape) but ensure `<StickerTray>` and the static mockup `<img>` are *sibling* components to the placement layer, each `memo()`'d with no props that change during a drag — so React's reconciliation skips them even though the parent re-renders on every `setPlacements` call. This is the lowest-risk option and should be tried first.
  2. If profiling after step 6 (§3 kiosk sequence) shows visible jank on real tablet hardware, move the actively-dragged sticker's position to a ref + direct DOM transform (`el.style.transform`) during `pointermove`, and only call `setPlacements` once on `pointerup` to commit — bypassing React entirely for the 60fps-critical path. Only do this if (1) proves insufficient; it's more code and more surface for the stale-closure risk flagged in §5.
- `overlaps()`/`pxCorners()` (SAT math) run on every `pointermove` today (inside the `onPointerUp` collision check, not mid-drag — re-confirm this after extraction, since the current code correctly defers the overlap check to release, not per-move). Keep that: computing SAT collision against every other same-side placement on every pixel of movement, not just at release, would be the actual perf trap to avoid introducing during extraction.
- Do not add `React.memo` to `<CanvasScreen>` or `<KioskPage>` themselves — they own the state, they're supposed to re-render when it changes; blanket-memoizing a stateful parent just adds a comparator that always returns "different" and wastes a comparison.

General rule applied above: memoize the leaf that has stable identity and changing-but-shallow props (`PlacementSprite`, `StickerResultRow`), not the container that legitimately owns the state driving the change.

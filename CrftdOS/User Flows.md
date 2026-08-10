---
type: moc
updated: 2026-08-10
---

# User Flows

Part of [[crftd Stall OS]]. What actually happens, end to end, for each thing a person does.

## The main line

1. [[Flow - Shift Open]] — before the first customer
2. [[Flow - Sell]] — the 30-second transaction
3. [[Flow - Kiosk Design]] — the customer composes
4. [[Kiosk Handoff]] — ticket crosses from customer to till
5. [[Flow - Press and Collection]] — fulfilment, both modes
6. [[Flow - Shift Close]] — cash, outbox, summary card

## Exceptions and operations

- [[Holds]] — reserve without selling
- [[Flow - Waste]] — a press goes wrong
- [[Flow - Returns]] — defect, exchange, refund, reject
- [[Flow - Restock]] — below par, dead stock, print queue
- [[B2B Pipeline]] — enquiry to dispatch

## Supporting concepts

- [[Receipt Numbering]] · [[Stock and Inventory]] · [[Pricing]] · [[Sticker Catalogue]] · [[Product SKUs]]

---

## The shape of a stall day

```
      volunteer                    customer                     admin
          │                            │                          │
  ┌───────▼────────┐                   │                          │
  │ Flow - Shift   │  ← receipt blocks allocated per device       │
  │ Open           │     press_on_site toggle set                 │
  └───────┬────────┘                   │                          │
          │                    ┌───────▼────────┐                 │
          │                    │ Flow - Kiosk   │                 │
          │                    │ Design         │                 │
          │                    └───────┬────────┘                 │
          │                            │ ticket A7K2              │
  ┌───────▼────────────────────────────▼───────┐                  │
  │              Flow - Sell                    │                 │
  │  cart → discount → payment → CHARGE         │                 │
  │  (optimistic: screen clears immediately)    │                 │
  └───────┬─────────────────────────────────────┘                 │
          │                                                        │
    press_on_site?                                                 │
     ├── on  → pending queue → Pressed → Handed Over               │
     └── off → collect_later + promised date + mandatory contact    │
          │                                                        │
  ┌───────▼────────┐                                       ┌───────▼──────┐
  │ Flow - Shift   │ ── summary card ────────────────────► │ /admin       │
  │ Close          │    cash variance, raised for AquaTerra│  analytics   │
  └────────────────┘                                       └──────────────┘
```

## The one number that matters

**Raised for AquaTerra** = gross − COGS, computed from the `cost_total` snapshot on each order. It appears on the admin dashboard, the shift summary card, and every receipt. PRD D23 makes it first-class deliberately: it is the reason the organisation exists, so it should not take three clicks.

Computed in `/api/shift/summary` and `/api/admin/analytics` as `gross - cogs`.

## Related
[[crftd Stall OS]] · [[Known Issues]]

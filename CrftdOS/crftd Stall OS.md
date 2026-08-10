---
type: moc
updated: 2026-08-10
---

# crftd Stall OS

Point-of-sale, customer design kiosk and operations app for **crftd**, the commercial arm of **AQUATERRA / TerraRoots**. Sells DTF-transfer-stickered tees at physical stalls; net profit is reported as a single headline figure, *Raised for AquaTerra*.

> The authoritative product spec is `crftd_Stall_OS_PRD_v2.md` at the repo root. These notes describe **what is actually built**, and flag where it diverges.

## Start here

| | |
|---|---|
| Architecture | [[Architecture Overview]] |
| The database | [[Database Map]] · [[Database Tables]] · [[Database Functions]] · [[Row Level Security]] |
| The server | [[API Routes]] · [[Auth and Sessions]] |
| The client | [[Frontend Map]] · [[Offline and Sync]] · [[Design System]] |
| What users do | [[User Flows]] |
| What's wrong | [[Known Issues]] · [[Performance Backlog]] |

## The three surfaces

This app is not one product, it is three, gated by three separate PINs and skinned differently on purpose.

- **[[Surface - Volunteer POS]]** — phones, one-handed, direct sunlight, a queue waiting. Restrained skin, huge tap targets.
- **[[Surface - Kiosk]]** — a tablet facing the customer. Full brutalist skin. This is the surface people photograph.
- **[[Surface - Admin]]** — desktop-first. Pricing, analytics, B2B, catalogue.

## Domain vocabulary

- **Sticker / transfer / design** — a pre-cut physical DTF transfer in a folder, coded `S-014` / `M-014` / `L-014`. Stock is a simple count. See [[Sticker Catalogue]].
- **Product / SKU** — a blank garment: type × colour × fit × size. See [[Product SKUs]].
- **Shift** — one day of trading. See [[Shifts and Receipt Blocks]].
- **Design ticket** — a 4-character code (`A7K2`) a customer carries from the kiosk to the till. See [[Kiosk Handoff]].
- **Hold** — a reservation that subtracts from *available* but not *on-hand*. See [[Holds]].
- **Receipt block** — 100 pre-allocated receipt numbers owned by one device. See [[Receipt Numbering]].

## Related

- [[Glossary]]
- [[Deployment and Environments]]

---
type: reference
updated: 2026-08-10
---

# Database Enums

Part of [[Database Map]]. Thirteen enums, all live and matching `schema.sql`.

| Type | Values |
|---|---|
| `stall_product_type` | tee · hoodie · jacket · jersey · uniform · other |
| `stall_product_size` | XS · S · M · L · XL · XXL · XXXL |
| `stall_sticker_size` | S · M · L |
| `stall_order_channel` | stall · event · kiosk · bulk · b2b · dm · other |
| `stall_payment_method` | upi · cash · split · pending |
| `stall_fulfillment` | handed_over · pending_press · collect_later · collected |
| `stall_movement_reason` | sale · void · restock · recount · damage · sample · gift · return_restock · correction |
| `stall_discount_reason` | volunteer_discretion · freebie · bulk · damaged_item · price_match · other |
| `stall_shift_type` | stall · event · popup · other |
| `stall_print_side` | front · back |
| `stall_b2b_stage` | enquiry · quoted · confirmed · production · ready · dispatched · closed · lost |
| `stall_return_action` | replace · refund · exchange · reject |
| `stall_waste_reason` | misalignment · peel_failure · temperature · print_defect · garment_defect · other |

## Notes

- **`product_type` is generic by design** (PRD D18). Only `tee` is active at launch; hoodies/jackets/jerseys/uniforms are schema-ready and seeded inactive so adding them later is a data change, not a migration.
- **`stall_design_tickets.status` is *not* an enum** — it is bare text holding `open | redeemed | expired`. The one inconsistency in an otherwise strictly-typed schema. See [[Known Issues]].
- **`stall_inventory_movements.sku_type`** is a `text` + `check` rather than an enum, because it selects *which table* `sku_id` points at.
- Adding a value to an enum is cheap (`alter type ... add value`); removing or reordering is not. Reason enums (`waste_reason`, `discount_reason`, `return_action`) are the ones most likely to grow once real stalls generate real cases.

## Related
[[Database Tables]] · [[Stock and Inventory]]

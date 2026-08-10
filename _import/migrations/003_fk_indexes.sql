-- crftd Stall OS v2 — migration 003: foreign-key indexes.
-- Run AFTER 002_atomic_order_creation.sql.
--
-- Postgres does not index foreign keys automatically. Roughly twenty FKs on
-- stall_* had no covering index; every one below sits under a query the app
-- actually runs (volunteer leaderboard, order detail, hold lists, waste and
-- returns reporting, the B2B pipeline board).

create index if not exists stall_orders_sold_by        on stall_orders (sold_by)      where sold_by is not null;
create index if not exists stall_orders_customer_id    on stall_orders (customer_id)  where customer_id is not null;
create index if not exists stall_inventory_ref_order   on stall_inventory_movements (ref_order) where ref_order is not null;
create index if not exists stall_holds_shift_id        on stall_holds (shift_id);
create index if not exists stall_holds_created_by      on stall_holds (created_by);
create index if not exists stall_holds_converted_order on stall_holds (converted_order) where converted_order is not null;
create index if not exists stall_custom_stickers_order on stall_custom_stickers (order_id);
create index if not exists stall_design_tickets_order  on stall_design_tickets (order_id) where order_id is not null;
create index if not exists stall_message_log_order     on stall_message_log (order_id);
create index if not exists stall_ois_custom_sticker    on stall_order_item_stickers (custom_sticker_id) where custom_sticker_id is not null;
create index if not exists stall_product_skus_color    on stall_product_skus (color_id);
create index if not exists stall_product_skus_fit      on stall_product_skus (fit_id);
create index if not exists stall_returns_original      on stall_returns (original_order);
create index if not exists stall_returns_replacement   on stall_returns (replacement_order) where replacement_order is not null;
create index if not exists stall_returns_approved_by   on stall_returns (approved_by);
create index if not exists stall_waste_shift           on stall_waste_log (shift_id);
create index if not exists stall_waste_sticker         on stall_waste_log (sticker_id) where sticker_id is not null;
create index if not exists stall_waste_product         on stall_waste_log (product_sku_id) where product_sku_id is not null;
create index if not exists stall_waste_logged_by       on stall_waste_log (logged_by);
create index if not exists stall_b2b_activity_b2b      on stall_b2b_activity (b2b_id);
create index if not exists stall_b2b_account_owner     on stall_b2b_orders (account_owner);
create index if not exists stall_b2b_stage             on stall_b2b_orders (stage);

-- Redundant duplicates of existing UNIQUE indexes on the same column: an
-- extra write on every insert, buying nothing.
drop index if exists stall_orders_receipt_no_idx;
drop index if exists stall_design_tickets_code_idx;

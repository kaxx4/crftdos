-- version: 20260811182138
-- applied name: stall_010_create_order_kiosk_deferred_stock_fix

-- no-op tracking entry: the coalesce(v_origin,'')='kiosk' fix was already applied directly via execute_sql
-- due to a transient apply_migration 502; this records it in migration history.
select 1;

-- version: 20260811182424
-- applied name: stall_012_stock_locations_seed


do $$
declare
  v_warehouse_id uuid;
  v_hq_location_id uuid;
  v_hq_env_id uuid := 'f7dc07c4-96d0-433b-822b-cdcf23cfcb6a';
begin
  insert into stall_stock_locations (name, is_warehouse, environment_id)
  values ('Warehouse', true, null)
  returning id into v_warehouse_id;

  -- HQ is the environment actively selling today (real orders/holds exist
  -- against it). Seeding its location with current stock, rather than the
  -- warehouse, keeps the live gate additive: today's single-pool behaviour
  -- continues unchanged post-migration. The warehouse starts empty, ready
  -- to receive future intake for allocation to new stall environments.
  insert into stall_stock_locations (name, is_warehouse, environment_id)
  values ('HQ Cloud', false, v_hq_env_id)
  returning id into v_hq_location_id;

  insert into stall_stock (location_id, sku_type, sku_id, qty, par_level)
  select v_hq_location_id, 'sticker', id, stock_qty, par_level from stall_sticker_designs;

  insert into stall_stock (location_id, sku_type, sku_id, qty, par_level)
  select v_hq_location_id, 'product', id, stock_qty, par_level from stall_product_skus;
end $$;

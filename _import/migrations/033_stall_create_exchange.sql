-- version: 20260812051803
-- applied name: 010_stall_create_exchange

-- migration 010: stall_create_exchange -- atomic exchange-replacement order.
--
-- /api/returns builds an 'exchange' as a linked zero-value replacement order
-- so inventory moves without inflating revenue. Doing that as separate
-- inserts (order, item, stock) is non-transactional: a stock-out on the last
-- step leaves an orphaned zero-value order behind. This folds it into one
-- function, the same pattern stall_create_order and stall_void_order use.
--
-- v1's _import/migrations/006_price_trust_and_exchange_atomicity.sql defined
-- a function by this name, but it was never applied to this database (the
-- deployed stall_create_order predates it and none of the tables it inserted
-- into had environment_id at the time). This is a fresh implementation
-- against the current schema (environment-scoped orders, per-location
-- stall_stock from migration 009), not a re-application of that file.
--
--   P0103  original order not found
--   P0107  no stock location for the order's environment
--   P0101  product out of stock
create or replace function stall_create_exchange(
  p_original_order   uuid,
  p_shift_id         uuid,
  p_device_id        text,
  p_product_sku_id   uuid,
  p_qty              int
)
returns jsonb
language plpgsql
as $$
declare
  v_original       stall_orders;
  v_order_id       uuid := gen_random_uuid();
  v_order          stall_orders;
  v_qty            int := coalesce(p_qty, 1);
  v_location_id    uuid;
  v_hit            int;
begin
  select * into v_original from stall_orders where id = p_original_order;
  if not found then
    raise exception 'Original order not found' using errcode = 'P0103';
  end if;

  insert into stall_orders (
    id, shift_id, channel, device_id, environment_id,
    subtotal, discount_amount, total, cost_total,
    payment_method, fulfillment_status, notes
  ) values (
    v_order_id,
    coalesce(p_shift_id, v_original.shift_id),
    'stall',
    coalesce(p_device_id, 'returns'),
    v_original.environment_id,
    0, 0, 0, 0,
    'pending',
    'handed_over',
    'Exchange replacement for ' || coalesce(v_original.receipt_no, v_original.id::text)
  )
  returning * into v_order;

  insert into stall_order_items (order_id, product_sku_id, qty, unit_price, unit_cost, line_total)
  values (v_order_id, p_product_sku_id, v_qty, 0, 0, 0);

  if p_product_sku_id is not null then
    select id into v_location_id from stall_stock_locations
     where environment_id = v_original.environment_id limit 1;
    if v_location_id is null then
      raise exception 'No stock location for this order''s environment' using errcode = 'P0107';
    end if;

    update stall_stock
       set qty = qty - v_qty
     where location_id = v_location_id and sku_type = 'product' and sku_id = p_product_sku_id
       and qty - v_qty >= 0;
    get diagnostics v_hit = row_count;
    if v_hit = 0 then
      raise exception 'Exchange item is out of stock' using errcode = 'P0101';
    end if;

    insert into stall_inventory_movements (sku_type, sku_id, delta, reason, ref_order, actor, note, environment_id, location_id)
    values ('product', p_product_sku_id, -v_qty, 'sale', v_order_id, 'returns', 'exchange replacement', v_original.environment_id, v_location_id);
  end if;

  return jsonb_build_object('order', to_jsonb(v_order));
end;
$$;

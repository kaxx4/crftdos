-- version: 20260811182516
-- applied name: stall_012_transfer_stock


create or replace function public.stall_transfer_stock(
  p_from uuid, p_to uuid, p_sku_type text, p_sku_id uuid, p_qty int, p_actor text default null
) returns jsonb
language plpgsql as $$
declare
  v_hit int;
begin
  if p_qty <= 0 then
    raise exception 'Transfer qty must be positive' using errcode = '22023';
  end if;
  if p_sku_type not in ('product','sticker') then
    raise exception 'Invalid sku_type' using errcode = '22023';
  end if;

  update stall_stock
     set qty = qty - p_qty
   where location_id = p_from and sku_type = p_sku_type and sku_id = p_sku_id
     and qty - p_qty >= 0;
  get diagnostics v_hit = row_count;
  if v_hit = 0 then
    raise exception 'Insufficient stock at source location to transfer' using errcode = 'P0106';
  end if;

  insert into stall_stock (location_id, sku_type, sku_id, qty)
  values (p_to, p_sku_type, p_sku_id, p_qty)
  on conflict (location_id, sku_type, sku_id) do update set qty = stall_stock.qty + excluded.qty;

  insert into stall_inventory_movements (sku_type, sku_id, delta, reason, actor, location_id, environment_id)
  select p_sku_type, p_sku_id, -p_qty, 'transfer_out', p_actor, p_from, environment_id
    from stall_stock_locations where id = p_from;

  insert into stall_inventory_movements (sku_type, sku_id, delta, reason, actor, location_id, environment_id)
  select p_sku_type, p_sku_id, p_qty, 'transfer_in', p_actor, p_to, environment_id
    from stall_stock_locations where id = p_to;

  return jsonb_build_object('from', p_from, 'to', p_to, 'skuType', p_sku_type, 'skuId', p_sku_id, 'qty', p_qty);
end;
$$;

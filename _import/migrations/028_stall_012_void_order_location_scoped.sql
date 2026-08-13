-- version: 20260811205218
-- applied name: stall_012_void_order_location_scoped


create or replace function public.stall_void_order(p_order_id uuid, p_actor text, p_reason text)
returns jsonb
language plpgsql
as $function$
declare
  v_order  stall_orders;
  v_row    record;
  v_location_id uuid;
begin
  select * into v_order from stall_orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found' using errcode = 'P0103';
  end if;
  if v_order.voided_at is not null then
    raise exception 'Order is already void' using errcode = 'P0104';
  end if;

  v_location_id := coalesce(stall_location_for_environment(v_order.environment_id), stall_warehouse_location());

  if v_order.affects_inventory then
    for v_row in
      select product_sku_id, sum(qty)::int as qty
        from stall_order_items
       where order_id = p_order_id and product_sku_id is not null
       group by product_sku_id
    loop
      insert into stall_stock (location_id, sku_type, sku_id, qty)
      values (v_location_id, 'product', v_row.product_sku_id, v_row.qty)
      on conflict (location_id, sku_type, sku_id) do update set qty = stall_stock.qty + excluded.qty;

      insert into stall_inventory_movements (sku_type, sku_id, delta, reason, ref_order, actor, environment_id, location_id)
      values ('product', v_row.product_sku_id, v_row.qty, 'void', p_order_id, p_actor, v_order.environment_id, v_location_id);
    end loop;

    for v_row in
      select ois.sticker_design_id, count(*)::int as qty
        from stall_order_item_stickers ois
        join stall_order_items oi on oi.id = ois.order_item_id
       where oi.order_id = p_order_id and ois.sticker_design_id is not null
       group by ois.sticker_design_id
    loop
      insert into stall_stock (location_id, sku_type, sku_id, qty)
      values (v_location_id, 'sticker', v_row.sticker_design_id, v_row.qty)
      on conflict (location_id, sku_type, sku_id) do update set qty = stall_stock.qty + excluded.qty;

      insert into stall_inventory_movements (sku_type, sku_id, delta, reason, ref_order, actor, environment_id, location_id)
      values ('sticker', v_row.sticker_design_id, v_row.qty, 'void', p_order_id, p_actor, v_order.environment_id, v_location_id);
    end loop;
  end if;

  update stall_orders
     set voided_at = now(), voided_by = coalesce(p_actor, 'volunteer'), void_reason = p_reason
   where id = p_order_id
  returning * into v_order;

  return to_jsonb(v_order);
end;
$function$;

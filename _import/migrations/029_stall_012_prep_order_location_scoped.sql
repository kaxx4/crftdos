-- version: 20260811205234
-- applied name: stall_012_prep_order_location_scoped


create or replace function public.stall_prep_order(p_order_id uuid, p_actor text)
returns jsonb
language plpgsql
as $function$
declare
  v_order        stall_orders;
  v_row          record;
  v_hit          int;
  v_ticket_payload jsonb;
  v_hold_ids     uuid[];
  v_location_id  uuid;
begin
  select * into v_order from stall_orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found' using errcode = 'P0103';
  end if;
  if v_order.voided_at is not null then
    raise exception 'Order is void, cannot prep' using errcode = 'P0104';
  end if;
  if v_order.prepped_at is not null then
    return jsonb_build_object('order', to_jsonb(v_order), 'alreadyPrepped', true);
  end if;

  if v_order.affects_inventory then
    update stall_orders set prepped_at = now() where id = p_order_id returning * into v_order;
    return jsonb_build_object('order', to_jsonb(v_order), 'alreadyPrepped', false);
  end if;

  v_location_id := stall_location_for_environment(v_order.environment_id);
  if v_location_id is null then
    raise exception 'Environment % has no stock location', v_order.environment_id using errcode = 'P0107';
  end if;

  for v_row in
    select product_sku_id, sum(qty)::int as qty
      from stall_order_items
     where order_id = p_order_id and product_sku_id is not null
     group by product_sku_id
  loop
    update stall_stock
       set qty = qty - v_row.qty
     where location_id = v_location_id and sku_type = 'product' and sku_id = v_row.product_sku_id
       and qty - v_row.qty >= 0;
    get diagnostics v_hit = row_count;
    if v_hit = 0 then
      raise exception 'Item went out of stock before prep (sku %)', v_row.product_sku_id
        using errcode = 'P0101';
    end if;
    insert into stall_inventory_movements (sku_type, sku_id, delta, reason, ref_order, actor, environment_id, location_id)
    values ('product', v_row.product_sku_id, -v_row.qty, 'sale', p_order_id, p_actor, v_order.environment_id, v_location_id);
  end loop;

  for v_row in
    select ois.sticker_design_id, count(*)::int as qty
      from stall_order_item_stickers ois
      join stall_order_items oi on oi.id = ois.order_item_id
     where oi.order_id = p_order_id and ois.sticker_design_id is not null
     group by ois.sticker_design_id
  loop
    update stall_stock
       set qty = qty - v_row.qty
     where location_id = v_location_id and sku_type = 'sticker' and sku_id = v_row.sticker_design_id
       and qty - v_row.qty >= 0;
    get diagnostics v_hit = row_count;
    if v_hit = 0 then
      raise exception 'Sticker went out of stock before prep (design %)', v_row.sticker_design_id
        using errcode = 'P0102';
    end if;
    insert into stall_inventory_movements (sku_type, sku_id, delta, reason, ref_order, actor, environment_id, location_id)
    values ('sticker', v_row.sticker_design_id, -v_row.qty, 'sale', p_order_id, p_actor, v_order.environment_id, v_location_id);
  end loop;

  if v_order.design_ticket is not null then
    select payload into v_ticket_payload from stall_design_tickets where code = v_order.design_ticket;
    if v_ticket_payload is not null then
      select array_agg((s->>'hold_id')::uuid)
        into v_hold_ids
        from jsonb_array_elements(coalesce(v_ticket_payload->'garments','[]'::jsonb)) g,
             jsonb_array_elements(coalesce(g->'stickers','[]'::jsonb)) s
       where nullif(s->>'hold_id','') is not null;

      if v_hold_ids is not null then
        update stall_holds set converted_order = p_order_id where id = any(v_hold_ids) and released_at is null;
      end if;
    end if;
  end if;

  update stall_orders
     set prepped_at = now(), affects_inventory = true
   where id = p_order_id
  returning * into v_order;

  return jsonb_build_object('order', to_jsonb(v_order), 'alreadyPrepped', false);
end;
$function$;

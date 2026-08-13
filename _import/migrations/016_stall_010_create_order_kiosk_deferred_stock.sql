-- version: 20260811181940
-- applied name: stall_010_create_order_kiosk_deferred_stock


create or replace function public.stall_create_order(p_order jsonb)
 returns jsonb
 language plpgsql
as $function$
declare
  v_order_id   uuid := (p_order->>'id')::uuid;
  v_shift_id   uuid := nullif(p_order->>'shiftId','')::uuid;
  v_device_id  text := p_order->>'deviceId';
  v_customer   jsonb := p_order->'customer';
  v_existing   stall_orders;
  v_order      stall_orders;
  v_block_id   uuid;
  v_consumed   int;
  v_fy         text;
  v_customer_id uuid;
  v_ticket_id  uuid;
  v_ticket_payload jsonb;
  v_hold_ids   uuid[];
  v_line       jsonb;
  v_item_id    uuid;
  v_sticker    jsonb;
  v_custom_id  uuid;
  v_custom_no  int;
  v_qty        int;
  v_sku_id     uuid;
  v_design_id  uuid;
  v_hit        int;
  v_env_id     uuid;
  v_env_prefix text;
  v_receipt_no text;
  v_origin     text := nullif(p_order->>'origin','');
  v_defer_stock boolean;
begin
  if v_order_id is null then
    raise exception 'Missing client order id' using errcode = '22023';
  end if;

  select * into v_existing from stall_orders where id = v_order_id;
  if found then
    return jsonb_build_object('order', to_jsonb(v_existing), 'alreadyExisted', true);
  end if;

  -- Kiosk-time order creation (migration 007): a kiosk order does not
  -- decrement stock at checkout. The soft hold keeps blocking double-sale;
  -- the real decrement happens at stall_prep_order. Every other origin
  -- (absent = walk-up POS) is byte-for-byte the pre-existing behaviour.
  v_defer_stock := (v_origin = 'kiosk');

  v_env_id := nullif(p_order->>'environmentId','')::uuid;
  if v_env_id is null and v_shift_id is not null then
    select environment_id into v_env_id from stall_shifts where id = v_shift_id;
  end if;
  if v_env_id is null then
    select id into v_env_id from stall_environments where prefix = 'HQ';
  end if;
  select prefix into v_env_prefix from stall_environments where id = v_env_id;

  update stall_receipt_blocks
     set next_no = next_no + 1
   where id = (
     select id from stall_receipt_blocks
      where shift_id = v_shift_id
        and device_id = v_device_id
        and closed_at is null
        and next_no <= end_no
      order by start_no
      limit 1
      for update
   )
  returning id, next_no - 1, fy
    into v_block_id, v_consumed, v_fy;

  if v_block_id is null then
    raise exception 'No receipt numbers left on this device''s block'
      using errcode = 'P0100';
  end if;

  if v_customer is not null and v_customer <> 'null'::jsonb
     and (nullif(v_customer->>'phone','') is not null
       or nullif(v_customer->>'name','')  is not null
       or nullif(v_customer->>'email','') is not null)
  then
    if nullif(v_customer->>'phone','') is not null then
      insert into stall_customers (name, phone_e164, email, consent_marketing)
      values (nullif(v_customer->>'name',''), v_customer->>'phone',
              nullif(v_customer->>'email',''), coalesce((v_customer->>'consent_marketing')::bool, false))
      on conflict (phone_e164) where phone_e164 is not null
      do update set
        name              = coalesce(excluded.name, stall_customers.name),
        email             = coalesce(excluded.email, stall_customers.email),
        consent_marketing = stall_customers.consent_marketing or excluded.consent_marketing
      returning id into v_customer_id;
    else
      insert into stall_customers (name, email, consent_marketing)
      values (nullif(v_customer->>'name',''), nullif(v_customer->>'email',''),
              coalesce((v_customer->>'consent_marketing')::bool, false))
      returning id into v_customer_id;
    end if;
  end if;

  v_receipt_no := 'CR/' || v_fy || '/' || lpad(v_consumed::text, 6, '0');
  if v_env_prefix is not null and v_env_prefix <> 'HQ' then
    v_receipt_no := v_env_prefix || '-' || v_receipt_no;
  end if;

  insert into stall_orders (
    id, receipt_no, shift_id, channel, design_ticket, sold_by, customer_id,
    subtotal, discount_amount, discount_reason, discount_note, total, cost_total,
    manual_override, payment_method, paid_cash, paid_upi, payment_ref,
    fulfillment_status, promised_date, device_id, client_created_at, environment_id,
    affects_inventory
  ) values (
    v_order_id,
    v_receipt_no,
    v_shift_id,
    coalesce(nullif(p_order->>'channel','')::stall_order_channel, 'stall'),
    nullif(p_order->>'designTicket',''),
    nullif(p_order->>'soldBy','')::uuid,
    v_customer_id,
    coalesce((p_order->>'subtotal')::numeric, 0),
    coalesce((p_order->>'discountAmount')::numeric, 0),
    nullif(p_order->>'discountReason','')::stall_discount_reason,
    nullif(p_order->>'discountNote',''),
    coalesce((p_order->>'total')::numeric, 0),
    coalesce((p_order->>'costTotal')::numeric, 0),
    coalesce((p_order->>'manualOverride')::bool, false),
    (p_order->>'paymentMethod')::stall_payment_method,
    coalesce((p_order->>'paidCash')::numeric, 0),
    coalesce((p_order->>'paidUpi')::numeric, 0),
    nullif(p_order->>'paymentRef',''),
    coalesce(nullif(p_order->>'fulfillmentStatus','')::stall_fulfillment, 'handed_over'),
    nullif(p_order->>'promisedDate','')::date,
    v_device_id,
    nullif(p_order->>'clientCreatedAt','')::timestamptz,
    v_env_id,
    not v_defer_stock
  )
  returning * into v_order;

  -- Ticket redemption. For a deferred-stock (kiosk) order, holds stay open
  -- (not released) until stall_prep_order converts them — they still block
  -- double-sale of the same physical item in the meantime.
  if nullif(p_order->>'designTicket','') is not null then
    update stall_design_tickets
       set status = 'redeemed', order_id = v_order_id
     where code = p_order->>'designTicket'
       and status = 'open'
    returning id, payload into v_ticket_id, v_ticket_payload;

    if v_ticket_id is not null and not v_defer_stock then
      select array_agg((s->>'hold_id')::uuid)
        into v_hold_ids
        from jsonb_array_elements(coalesce(v_ticket_payload->'garments','[]'::jsonb)) g,
             jsonb_array_elements(coalesce(g->'stickers','[]'::jsonb)) s
       where nullif(s->>'hold_id','') is not null;

      if v_hold_ids is not null then
        update stall_holds set released_at = now() where id = any(v_hold_ids);
      end if;
    end if;
  end if;

  for v_line in select * from jsonb_array_elements(coalesce(p_order->'items','[]'::jsonb))
  loop
    v_qty    := coalesce((v_line->>'qty')::int, 1);
    v_sku_id := nullif(v_line->>'product_sku_id','')::uuid;

    insert into stall_order_items (order_id, product_sku_id, qty, unit_price, unit_cost, line_total)
    values (
      v_order_id, v_sku_id, v_qty,
      coalesce((v_line->>'unit_price')::numeric, 0),
      coalesce((v_line->>'unit_cost')::numeric, 0),
      coalesce((v_line->>'unit_price')::numeric, 0) * v_qty
    )
    returning id into v_item_id;

    if v_sku_id is not null and not v_defer_stock then
      update stall_product_skus
         set stock_qty = stock_qty - v_qty
       where id = v_sku_id and stock_qty - v_qty >= 0;
      get diagnostics v_hit = row_count;
      if v_hit = 0 then
        raise exception 'Item went out of stock during checkout (sku %)', v_sku_id
          using errcode = 'P0101';
      end if;

      insert into stall_inventory_movements (sku_type, sku_id, delta, reason, ref_order, actor, environment_id)
      values ('product', v_sku_id, -v_qty, 'sale', v_order_id, v_device_id, v_env_id);
    end if;

    for v_sticker in select * from jsonb_array_elements(coalesce(v_line->'stickers','[]'::jsonb))
    loop
      v_design_id := nullif(v_sticker->>'sticker_design_id','')::uuid;
      v_custom_id := nullif(v_sticker->>'custom_sticker_id','')::uuid;

      if v_design_id is null and v_custom_id is null
         and nullif(v_sticker->>'description','') is not null then
        v_custom_no := stall_next_custom_sticker_no();
        insert into stall_custom_stickers (code, size_class, description, unit_price, order_id)
        values (
          'C-' || lpad(v_custom_no::text, 4, '0'),
          coalesce(nullif(v_sticker->>'size_class','')::stall_sticker_size, 'M'),
          v_sticker->>'description',
          coalesce((v_sticker->>'unit_price')::numeric, 0),
          v_order_id
        )
        returning id into v_custom_id;
      end if;

      if v_design_id is null and v_custom_id is null then
        raise exception 'Sticker line has neither a catalogue design nor a custom description'
          using errcode = '22023';
      end if;

      insert into stall_order_item_stickers (
        order_item_id, sticker_design_id, custom_sticker_id,
        side, pos_x, pos_y, rotation, unit_price, unit_cost
      ) values (
        v_item_id,
        v_design_id,
        case when v_design_id is null then v_custom_id else null end,
        coalesce(nullif(v_sticker->>'side','')::stall_print_side, 'front'),
        (v_sticker->>'pos_x')::numeric,
        (v_sticker->>'pos_y')::numeric,
        coalesce((v_sticker->>'rotation')::numeric, 0),
        coalesce((v_sticker->>'unit_price')::numeric, 0),
        coalesce((v_sticker->>'unit_cost')::numeric, 0)
      );

      if v_design_id is not null and not v_defer_stock then
        update stall_sticker_designs
           set stock_qty = stock_qty - 1
         where id = v_design_id and stock_qty - 1 >= 0;
        get diagnostics v_hit = row_count;
        if v_hit = 0 then
          raise exception 'Sticker went out of stock during checkout (design %)', v_design_id
            using errcode = 'P0102';
        end if;

        insert into stall_inventory_movements (sku_type, sku_id, delta, reason, ref_order, actor, environment_id)
        values ('sticker', v_design_id, -1, 'sale', v_order_id, v_device_id, v_env_id);
      end if;
    end loop;
  end loop;

  return jsonb_build_object('order', to_jsonb(v_order), 'alreadyExisted', false);
end;
$function$;

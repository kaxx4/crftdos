-- crftd Stall OS v2 — migration 006: server-side price trust + atomic exchanges.
-- Run AFTER 005_one_open_block_per_device.sql.
--
-- Two fixes:
--
--   1. stall_create_order accepted unit_price/unit_cost straight from the
--      request body for catalogue items (product SKUs and sticker designs).
--      The kiosk encodes those numbers into a client-side QR ticket
--      (lib/ticketPayload.ts) with nothing re-checking them against the SKU
--      table before the charge lands — a tampered/hand-crafted ticket (or a
--      hand-crafted POST to /api/orders) could force any price, including
--      zero. /api/holds/[id] already re-fetches from the SKU table before
--      charging; this brings /api/orders in line with that pattern. Custom
--      stickers have no catalogue price to check against (a volunteer types
--      the price at the till), so those still trust the payload.
--
--   2. /api/returns built an exchange as three separate non-transactional
--      calls (insert order, insert order item, then an RPC for stock). If
--      the stock RPC failed it returned 409 without rolling back the first
--      two inserts, leaving an orphaned zero-value order behind. Folded into
--      one function, same pattern migration 002 already used for the main
--      charge path.

create or replace function stall_create_order(p_order jsonb)
returns jsonb
language plpgsql
as $$
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
  v_unit_price numeric;
  v_unit_cost  numeric;
begin
  if v_order_id is null then
    raise exception 'Missing client order id' using errcode = '22023';
  end if;

  select * into v_existing from stall_orders where id = v_order_id;
  if found then
    return jsonb_build_object('order', to_jsonb(v_existing), 'alreadyExisted', true);
  end if;

  update stall_receipt_blocks
     set next_no = next_no + 1
   where shift_id = v_shift_id
     and device_id = v_device_id
     and closed_at is null
     and next_no <= end_no
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

  insert into stall_orders (
    id, receipt_no, shift_id, channel, design_ticket, sold_by, customer_id,
    subtotal, discount_amount, discount_reason, discount_note, total, cost_total,
    manual_override, payment_method, paid_cash, paid_upi, payment_ref,
    fulfillment_status, promised_date, device_id, client_created_at
  ) values (
    v_order_id,
    'CR/' || v_fy || '/' || lpad(v_consumed::text, 6, '0'),
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
    nullif(p_order->>'clientCreatedAt','')::timestamptz
  )
  returning * into v_order;

  if nullif(p_order->>'designTicket','') is not null then
    update stall_design_tickets
       set status = 'redeemed', order_id = v_order_id
     where code = p_order->>'designTicket'
       and status = 'open'
    returning id, payload into v_ticket_id, v_ticket_payload;

    if v_ticket_id is not null then
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

    -- Price trust boundary: for a catalogue product, the price is whatever
    -- the SKU table says right now, never what the client sent. A garment
    -- with no product_sku_id (shouldn't normally happen) falls back to the
    -- payload so the insert doesn't blow up on a null.
    if v_sku_id is not null then
      select unit_price, unit_cost into v_unit_price, v_unit_cost
        from stall_product_skus where id = v_sku_id;
      if not found then
        raise exception 'Unknown product SKU %', v_sku_id using errcode = '22023';
      end if;
    else
      v_unit_price := coalesce((v_line->>'unit_price')::numeric, 0);
      v_unit_cost  := coalesce((v_line->>'unit_cost')::numeric, 0);
    end if;

    insert into stall_order_items (order_id, product_sku_id, qty, unit_price, unit_cost, line_total)
    values (v_order_id, v_sku_id, v_qty, v_unit_price, v_unit_cost, v_unit_price * v_qty)
    returning id into v_item_id;

    if v_sku_id is not null then
      update stall_product_skus
         set stock_qty = stock_qty - v_qty
       where id = v_sku_id and stock_qty - v_qty >= 0;
      get diagnostics v_hit = row_count;
      if v_hit = 0 then
        raise exception 'Item went out of stock during checkout (sku %)', v_sku_id
          using errcode = 'P0101';
      end if;

      insert into stall_inventory_movements (sku_type, sku_id, delta, reason, ref_order, actor)
      values ('product', v_sku_id, -v_qty, 'sale', v_order_id, v_device_id);
    end if;

    for v_sticker in select * from jsonb_array_elements(coalesce(v_line->'stickers','[]'::jsonb))
    loop
      v_design_id := nullif(v_sticker->>'sticker_design_id','')::uuid;
      v_custom_id := nullif(v_sticker->>'custom_sticker_id','')::uuid;

      -- Same trust boundary for catalogue sticker designs. Custom stickers
      -- (no design id) have no catalogue price, so they keep the
      -- volunteer-typed price from the payload.
      if v_design_id is not null then
        select unit_price, unit_cost into v_unit_price, v_unit_cost
          from stall_sticker_designs where id = v_design_id;
        if not found then
          raise exception 'Unknown sticker design %', v_design_id using errcode = '22023';
        end if;
      else
        v_unit_price := coalesce((v_sticker->>'unit_price')::numeric, 0);
        v_unit_cost  := coalesce((v_sticker->>'unit_cost')::numeric, 0);
      end if;

      if v_design_id is null and v_custom_id is null
         and nullif(v_sticker->>'description','') is not null then
        v_custom_no := stall_next_custom_sticker_no();
        insert into stall_custom_stickers (code, size_class, description, unit_price, order_id)
        values (
          'C-' || lpad(v_custom_no::text, 4, '0'),
          coalesce(nullif(v_sticker->>'size_class','')::stall_sticker_size, 'M'),
          v_sticker->>'description',
          v_unit_price,
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
        v_unit_price,
        v_unit_cost
      );

      if v_design_id is not null then
        update stall_sticker_designs
           set stock_qty = stock_qty - 1
         where id = v_design_id and stock_qty - 1 >= 0;
        get diagnostics v_hit = row_count;
        if v_hit = 0 then
          raise exception 'Sticker went out of stock during checkout (design %)', v_design_id
            using errcode = 'P0102';
        end if;

        insert into stall_inventory_movements (sku_type, sku_id, delta, reason, ref_order, actor)
        values ('sticker', v_design_id, -1, 'sale', v_order_id, v_device_id);
      end if;
    end loop;
  end loop;

  return jsonb_build_object('order', to_jsonb(v_order), 'alreadyExisted', false);
end;
$$;

-- Atomic exchange creation: replacement order + item + stock decrement +
-- movement ledger row, all in one transaction. A stock-out raises and the
-- whole exchange (including the order/item rows /api/returns used to leave
-- behind) rolls back instead of leaving an orphaned zero-value order.
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
  v_item_id        uuid;
  v_qty            int := coalesce(p_qty, 1);
  v_hit            int;
begin
  select * into v_original from stall_orders where id = p_original_order;
  if not found then
    raise exception 'Original order not found' using errcode = 'P0103';
  end if;

  insert into stall_orders (
    id, shift_id, channel, device_id,
    subtotal, discount_amount, total, cost_total,
    payment_method, notes
  ) values (
    v_order_id,
    coalesce(p_shift_id, v_original.shift_id),
    'stall',
    coalesce(p_device_id, 'returns'),
    0, 0, 0, 0,
    'pending',
    'Exchange replacement for ' || v_original.receipt_no
  )
  returning * into v_order;

  insert into stall_order_items (order_id, product_sku_id, qty, unit_price, unit_cost, line_total)
  values (v_order_id, p_product_sku_id, v_qty, 0, 0, 0)
  returning id into v_item_id;

  if p_product_sku_id is not null then
    update stall_product_skus
       set stock_qty = stock_qty - v_qty
     where id = p_product_sku_id and stock_qty - v_qty >= 0;
    get diagnostics v_hit = row_count;
    if v_hit = 0 then
      raise exception 'Exchange item is out of stock' using errcode = 'P0101';
    end if;

    insert into stall_inventory_movements (sku_type, sku_id, delta, reason, ref_order, actor, note)
    values ('product', p_product_sku_id, -v_qty, 'sale', v_order_id, 'returns', 'exchange replacement');
  end if;

  return jsonb_build_object('order', to_jsonb(v_order));
end;
$$;

-- Atomic manual stock correction. /api/stock/product/[id] used to SELECT the
-- "before" quantity, then run a separate UPDATE, computing the audit delta
-- in Node — a concurrent edit between those two calls corrupts the delta the
-- audit log records. This does the read and write in one statement, and
-- floor-guards negative stock the same way the sale/restock RPCs already do
-- (the route previously allowed any integer including negative).
--   P0101  would go negative
create or replace function stall_set_product_stock(p_id uuid, p_new_qty int)
returns table(before_qty int, after_qty int)
language plpgsql
as $$
declare
  v_before int;
begin
  if p_new_qty < 0 then
    raise exception 'Stock quantity cannot be negative' using errcode = 'P0101';
  end if;

  select stock_qty into v_before from stall_product_skus where id = p_id for update;
  if not found then
    raise exception 'Product SKU not found' using errcode = 'P0103';
  end if;

  update stall_product_skus set stock_qty = p_new_qty where id = p_id;

  before_qty := v_before;
  after_qty := p_new_qty;
  return next;
end;
$$;

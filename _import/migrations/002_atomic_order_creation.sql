-- crftd Stall OS v2 — migration 002: atomic order creation.
-- Run AFTER 001_atomicity_and_indexes.sql.
--
-- Replaces the ~30 sequential PostgREST round trips /api/orders used to make
-- with a single RPC. Two problems, one fix:
--
--   PERFORMANCE. A 2-garment / 6-sticker order issued roughly 30 separate
--   HTTPS requests from the Vercel function to PostgREST, each paying full
--   round-trip latency. In-database the same work is one round trip.
--
--   CORRECTNESS. Those statements were not a transaction. If a sticker went
--   out of stock on the fourth line, the first three lines' stock had already
--   been decremented and committed; the route compensated by soft-voiding the
--   order, which does NOT give the stock back. Every failed charge silently
--   leaked inventory. Inside this function a raise rolls the whole thing back.
--
-- Also folds in customer de-duplication (previously a fresh stall_customers
-- row per order, so a repeat buyer became N rows) and placement columns
-- (side/pos_x/pos_y/rotation), which the schema has always had but nothing
-- populated.

-- De-dupe key for customers. Partial so rows without a phone are unaffected.
create unique index if not exists stall_customers_phone_unique
  on stall_customers (phone_e164)
  where phone_e164 is not null;

-- Covering index for the receipt-block lookup this function does on every
-- single charge, and /api/shift/current does on every app boot.
create index if not exists stall_receipt_blocks_shift_device
  on stall_receipt_blocks (shift_id, device_id)
  where closed_at is null;

-- Custom sticker sequence helper. This existed in the live database but in
-- neither schema.sql nor migration 001 — recreated here so a rebuild from
-- the SQL files produces a working database.
create or replace function stall_next_custom_sticker_no()
returns int
language sql
as $$
  select nextval('stall_custom_sticker_seq')::int;
$$;

-- Custom SQLSTATEs so the route can map business failures to HTTP status
-- instead of parsing message strings:
--   P0100  receipt block missing or exhausted            -> 409
--   P0101  product out of stock                          -> 409
--   P0102  sticker out of stock                          -> 409
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
begin
  if v_order_id is null then
    raise exception 'Missing client order id' using errcode = '22023';
  end if;

  -- Idempotency. The client generates the UUID, so an outbox retry after a
  -- response was lost in flight lands here and returns the original order
  -- rather than charging twice.
  select * into v_existing from stall_orders where id = v_order_id;
  if found then
    return jsonb_build_object('order', to_jsonb(v_existing), 'alreadyExisted', true);
  end if;

  -- Consume a receipt number from this device's open block. Single guarded
  -- UPDATE ... RETURNING, so concurrent charges on one device can never be
  -- handed the same number and an exhausted block matches no rows.
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

  -- Customer: de-duplicate on phone. Only overwrite name/email when the new
  -- capture actually supplies one, and let consent latch on rather than be
  -- silently revoked by a later skip-through.
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

  -- Redeem the kiosk design ticket, if this cart came from one.
  if nullif(p_order->>'designTicket','') is not null then
    update stall_design_tickets
       set status = 'redeemed', order_id = v_order_id
     where code = p_order->>'designTicket'
       and status = 'open'
    returning id, payload into v_ticket_id, v_ticket_payload;

    -- Real stock decrements below, so drop the kiosk's session soft-holds.
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

    insert into stall_order_items (order_id, product_sku_id, qty, unit_price, unit_cost, line_total)
    values (
      v_order_id, v_sku_id, v_qty,
      coalesce((v_line->>'unit_price')::numeric, 0),
      coalesce((v_line->>'unit_cost')::numeric, 0),
      coalesce((v_line->>'unit_price')::numeric, 0) * v_qty
    )
    returning id into v_item_id;

    if v_sku_id is not null then
      -- Floor-guarded: an oversell matches no rows, and the raise unwinds
      -- every stock change made so far in this transaction.
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

      -- stall_order_item_stickers checks exactly one of the two is set.
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

-- Voiding an order: restock everything it consumed, write the ledger rows,
-- and mark the order void — atomically. The route previously did this as a
-- read-modify-write loop (SELECT stock_qty, then UPDATE with a value computed
-- in Node), which is the lost-update race migration 001 set out to remove but
-- never converted this path away from.
--
--   P0103  order not found
--   P0104  already void
create or replace function stall_void_order(p_order_id uuid, p_actor text, p_reason text)
returns jsonb
language plpgsql
as $$
declare
  v_order  stall_orders;
  v_row    record;
begin
  select * into v_order from stall_orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found' using errcode = 'P0103';
  end if;
  if v_order.voided_at is not null then
    raise exception 'Order is already void' using errcode = 'P0104';
  end if;

  -- Products: one grouped UPDATE ... FROM instead of a statement per line.
  for v_row in
    select product_sku_id, sum(qty)::int as qty
      from stall_order_items
     where order_id = p_order_id and product_sku_id is not null
     group by product_sku_id
  loop
    update stall_product_skus set stock_qty = stock_qty + v_row.qty where id = v_row.product_sku_id;
    insert into stall_inventory_movements (sku_type, sku_id, delta, reason, ref_order, actor)
    values ('product', v_row.product_sku_id, v_row.qty, 'void', p_order_id, p_actor);
  end loop;

  for v_row in
    select ois.sticker_design_id, count(*)::int as qty
      from stall_order_item_stickers ois
      join stall_order_items oi on oi.id = ois.order_item_id
     where oi.order_id = p_order_id and ois.sticker_design_id is not null
     group by ois.sticker_design_id
  loop
    update stall_sticker_designs set stock_qty = stock_qty + v_row.qty where id = v_row.sticker_design_id;
    insert into stall_inventory_movements (sku_type, sku_id, delta, reason, ref_order, actor)
    values ('sticker', v_row.sticker_design_id, v_row.qty, 'void', p_order_id, p_actor);
  end loop;

  -- The receipt number is deliberately preserved. Gapless numbering means a
  -- void keeps its number and is marked void, never reused or reassigned.
  update stall_orders
     set voided_at = now(), voided_by = coalesce(p_actor, 'volunteer'), void_reason = p_reason
   where id = p_order_id
  returning * into v_order;

  return to_jsonb(v_order);
end;
$$;

-- Restock signals without shipping the whole order history to Node.
-- /api/restock previously SELECTed every row of stall_order_items and
-- stall_order_item_stickers purely to build two id sets in JavaScript, so the
-- payload grew linearly with lifetime sales forever.
create or replace function stall_restock_signals()
returns jsonb
language sql
stable
as $$
  with below_par as (
    select 'product' as type, p.id, p.sku_code as code, p.stock_qty as stock, p.par_level as par
      from stall_product_skus p
     where p.is_active and p.stock_qty < p.par_level
    union all
    select 'sticker', d.id, d.code, d.stock_qty, d.par_level
      from stall_sticker_designs d
     where d.is_active and d.stock_qty < d.par_level
  ),
  dead as (
    select 'product' as type, p.id, p.sku_code as code, p.stock_qty as stock
      from stall_product_skus p
     where p.is_active and p.stock_qty > 0
       and not exists (select 1 from stall_order_items oi where oi.product_sku_id = p.id)
    union all
    select 'sticker', d.id, d.code, d.stock_qty
      from stall_sticker_designs d
     where d.is_active and d.stock_qty > 0
       and not exists (
         select 1 from stall_order_item_stickers ois where ois.sticker_design_id = d.id
       )
  )
  select jsonb_build_object(
    'belowPar',  coalesce((select jsonb_agg(to_jsonb(b) order by b.code) from below_par b), '[]'::jsonb),
    'deadStock', coalesce((select jsonb_agg(to_jsonb(x) order by x.code) from dead x),      '[]'::jsonb)
  );
$$;

-- The two NOT EXISTS probes above need these to be index scans rather than
-- sequential scans over every line item ever sold.
create index if not exists stall_order_items_product_sku_id
  on stall_order_items (product_sku_id) where product_sku_id is not null;

create index if not exists stall_order_item_stickers_design_id
  on stall_order_item_stickers (sticker_design_id) where sticker_design_id is not null;

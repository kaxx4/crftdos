-- version: 20260812162555
-- applied name: 012_stall_reserve_named_hold

-- migration 012: stall_reserve_named_hold -- atomic volunteer-facing hold.
--
-- POST /api/holds (the "reserve for a customer by name" flow, added this
-- session) did a separate SELECT for on-hand qty, a separate SELECT for
-- active-hold total, then an INSERT, with no row lock spanning them -- a
-- real TOCTOU race: two volunteers could both succeed holding the last unit
-- of the same SKU for two different customers. stall_reserve_sticker_hold
-- already avoids this for the kiosk's anonymous soft-holds via
-- `select ... for update` on the stock row; this is the same pattern,
-- generalised to product-or-sticker and requiring a customer name.
create or replace function stall_reserve_named_hold(
  p_environment_id  uuid,
  p_sku_type        text,
  p_sku_id          uuid,
  p_qty             int,
  p_customer_name   text,
  p_customer_phone  text default null,
  p_shift_id        uuid default null,
  p_hours           numeric default 2
)
returns setof stall_holds
language plpgsql
as $$
declare
  v_location_id uuid;
  v_stock       int;
  v_held        int;
begin
  if p_customer_name is null or btrim(p_customer_name) = '' then
    raise exception 'Customer name is required' using errcode = '22023';
  end if;
  if p_sku_type not in ('product', 'sticker') then
    raise exception 'sku_type must be product or sticker' using errcode = '22023';
  end if;

  v_location_id := stall_location_for_environment(p_environment_id);
  if v_location_id is null then
    raise exception 'No stock location for this environment' using errcode = 'P0107';
  end if;

  select qty into v_stock
    from stall_stock
   where location_id = v_location_id and sku_type = p_sku_type and sku_id = p_sku_id
   for update;
  if v_stock is null then
    v_stock := 0;
  end if;

  select coalesce(sum(qty), 0) into v_held
    from stall_holds
   where environment_id = p_environment_id
     and (case when p_sku_type = 'product' then product_sku_id else sticker_id end) = p_sku_id
     and released_at is null
     and converted_order is null
     and expires_at > now();

  if (v_stock - v_held) < p_qty then
    raise exception 'Not enough available at this stall to hold that many' using errcode = 'P0101';
  end if;

  return query
  insert into stall_holds (
    environment_id, shift_id, product_sku_id, sticker_id, qty,
    customer_name, customer_phone, expires_at
  ) values (
    p_environment_id,
    p_shift_id,
    case when p_sku_type = 'product' then p_sku_id else null end,
    case when p_sku_type = 'sticker' then p_sku_id else null end,
    p_qty,
    p_customer_name,
    p_customer_phone,
    now() + (p_hours || ' hours')::interval
  )
  returning *;
end;
$$;

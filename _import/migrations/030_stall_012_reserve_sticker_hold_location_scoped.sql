-- version: 20260811205249
-- applied name: stall_012_reserve_sticker_hold_location_scoped


create or replace function public.stall_reserve_sticker_hold(
  p_sticker_id uuid, p_shift_id uuid, p_qty integer, p_expires_at timestamp with time zone,
  p_customer_name text default null::text, p_customer_phone text default null::text,
  p_created_by uuid default null::uuid, p_environment_id uuid default null::uuid
)
 RETURNS SETOF stall_holds
 LANGUAGE plpgsql
AS $function$
declare
  v_env_id uuid;
  v_location_id uuid;
  v_stock int;
  v_held int;
begin
  v_env_id := p_environment_id;
  if v_env_id is null and p_shift_id is not null then
    select environment_id into v_env_id from stall_shifts where id = p_shift_id;
  end if;
  if v_env_id is null then
    select id into v_env_id from stall_environments where prefix = 'HQ';
  end if;

  v_location_id := stall_location_for_environment(v_env_id);
  if v_location_id is null then
    return;
  end if;

  select qty into v_stock
    from stall_stock
   where location_id = v_location_id and sku_type = 'sticker' and sku_id = p_sticker_id
   for update;
  if v_stock is null then
    return;
  end if;

  select coalesce(sum(qty), 0) into v_held
  from stall_holds
  where sticker_id = p_sticker_id
    and environment_id = v_env_id
    and released_at is null
    and converted_order is null
    and expires_at > now();

  if (v_stock - v_held) < p_qty then
    return;
  end if;

  return query
  insert into stall_holds (shift_id, sticker_id, qty, customer_name, customer_phone, created_by, expires_at, environment_id)
  values (p_shift_id, p_sticker_id, p_qty, p_customer_name, p_customer_phone, p_created_by, p_expires_at, v_env_id)
  returning *;
end;
$function$;

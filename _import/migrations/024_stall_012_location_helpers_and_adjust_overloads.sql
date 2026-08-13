-- version: 20260811182504
-- applied name: stall_012_location_helpers_and_adjust_overloads


create or replace function stall_location_for_environment(p_environment_id uuid) returns uuid
language sql stable as $$
  select id from stall_stock_locations where environment_id = p_environment_id;
$$;

create or replace function stall_warehouse_location() returns uuid
language sql stable as $$
  select id from stall_stock_locations where is_warehouse;
$$;

-- Old signature kept byte-identical, now resolving to the warehouse location
-- underneath rather than the catalogue row directly.
create or replace function public.stall_adjust_product_stock(p_id uuid, p_delta integer)
returns setof stall_product_skus
language plpgsql as $$
begin
  return query select * from stall_adjust_product_stock(p_id, p_delta, stall_warehouse_location());
end;
$$;

create or replace function public.stall_adjust_product_stock(p_id uuid, p_delta integer, p_location_id uuid)
returns setof stall_product_skus
language plpgsql as $$
declare
  v_hit int;
begin
  update stall_stock
     set qty = qty + p_delta
   where location_id = p_location_id and sku_type = 'product' and sku_id = p_id
     and qty + p_delta >= 0;
  get diagnostics v_hit = row_count;

  if v_hit = 0 then
    if p_delta > 0 then
      insert into stall_stock (location_id, sku_type, sku_id, qty)
      values (p_location_id, 'product', p_id, p_delta)
      on conflict (location_id, sku_type, sku_id) do update set qty = stall_stock.qty + excluded.qty
        where stall_stock.qty + excluded.qty >= 0;
    else
      return;
    end if;
  end if;

  return query select * from stall_product_skus where id = p_id;
end;
$$;

create or replace function public.stall_adjust_sticker_stock(p_id uuid, p_delta integer)
returns setof stall_sticker_designs
language plpgsql as $$
begin
  return query select * from stall_adjust_sticker_stock(p_id, p_delta, stall_warehouse_location());
end;
$$;

create or replace function public.stall_adjust_sticker_stock(p_id uuid, p_delta integer, p_location_id uuid)
returns setof stall_sticker_designs
language plpgsql as $$
declare
  v_hit int;
begin
  update stall_stock
     set qty = qty + p_delta
   where location_id = p_location_id and sku_type = 'sticker' and sku_id = p_id
     and qty + p_delta >= 0;
  get diagnostics v_hit = row_count;

  if v_hit = 0 then
    if p_delta > 0 then
      insert into stall_stock (location_id, sku_type, sku_id, qty)
      values (p_location_id, 'sticker', p_id, p_delta)
      on conflict (location_id, sku_type, sku_id) do update set qty = stall_stock.qty + excluded.qty
        where stall_stock.qty + excluded.qty >= 0;
    else
      return;
    end if;
  end if;

  return query select * from stall_sticker_designs where id = p_id;
end;
$$;

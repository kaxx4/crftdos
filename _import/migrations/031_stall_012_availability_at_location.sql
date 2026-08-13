-- version: 20260811205305
-- applied name: stall_012_availability_at_location


create or replace function stall_product_availability_at(p_environment_id uuid)
returns table (
  id uuid, sku_type text, code text, stock_qty int, par_level int, available_qty int
)
language sql stable as $$
  with loc as (select stall_location_for_environment(p_environment_id) as location_id)
  select p.id, 'product', p.sku_code, coalesce(s.qty,0), p.par_level,
    coalesce(s.qty,0) - coalesce((
      select sum(h.qty) from stall_holds h
       where h.product_sku_id = p.id and h.environment_id = p_environment_id
         and h.released_at is null and h.converted_order is null and h.expires_at > now()
    ), 0)::int
  from stall_product_skus p
  left join loc on true
  left join stall_stock s on s.location_id = loc.location_id and s.sku_type = 'product' and s.sku_id = p.id
  where p.is_active
  union all
  select d.id, 'sticker', d.code, coalesce(s.qty,0), d.par_level,
    coalesce(s.qty,0) - coalesce((
      select sum(h.qty) from stall_holds h
       where h.sticker_id = d.id and h.environment_id = p_environment_id
         and h.released_at is null and h.converted_order is null and h.expires_at > now()
    ), 0)::int
  from stall_sticker_designs d
  left join loc on true
  left join stall_stock s on s.location_id = loc.location_id and s.sku_type = 'sticker' and s.sku_id = d.id
  where d.is_active;
$$;

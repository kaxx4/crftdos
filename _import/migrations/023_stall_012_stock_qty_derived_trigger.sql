-- version: 20260811182436
-- applied name: stall_012_stock_qty_derived_trigger


create or replace function stall_sync_derived_stock_qty() returns trigger
language plpgsql as $$
declare
  v_sku_type text := coalesce(new.sku_type, old.sku_type);
  v_sku_id   uuid := coalesce(new.sku_id, old.sku_id);
  v_total    int;
begin
  select coalesce(sum(qty), 0) into v_total from stall_stock where sku_type = v_sku_type and sku_id = v_sku_id;

  if v_sku_type = 'product' then
    update stall_product_skus set stock_qty = v_total where id = v_sku_id;
  else
    update stall_sticker_designs set stock_qty = v_total where id = v_sku_id;
  end if;

  return null;
end;
$$;

create trigger stall_stock_sync_derived_trg
  after insert or update or delete on stall_stock
  for each row execute function stall_sync_derived_stock_qty();

-- Verify the seed reconciled exactly (belt-and-suspenders on the migration itself).
do $$
declare
  v_mismatch int;
begin
  select count(*) into v_mismatch
  from stall_product_skus p
  join (select sku_id, sum(qty) total from stall_stock where sku_type='product' group by sku_id) s
    on s.sku_id = p.id
  where s.total <> p.stock_qty;
  if v_mismatch > 0 then
    raise exception 'stock_qty derivation mismatch for % product skus', v_mismatch;
  end if;

  select count(*) into v_mismatch
  from stall_sticker_designs d
  join (select sku_id, sum(qty) total from stall_stock where sku_type='sticker' group by sku_id) s
    on s.sku_id = d.id
  where s.total <> d.stock_qty;
  if v_mismatch > 0 then
    raise exception 'stock_qty derivation mismatch for % sticker designs', v_mismatch;
  end if;
end $$;

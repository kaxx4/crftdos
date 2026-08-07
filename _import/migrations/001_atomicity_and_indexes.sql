-- crftd Stall OS v2 — pre-launch fixes: atomic stock/receipt ops + missing indexes.
-- Run this against the same Supabase project as schema.sql, AFTER schema.sql.
-- Fixes:
--   - read-then-write stock races (oversell) in orders/returns/waste/restock routes
--   - non-atomic receipt-number consumption (duplicate receipt numbers)
--   - unindexed stall_holds scans on the hottest kiosk endpoints
--   - TOCTOU race in kiosk sticker-hold reservation (double-booking last unit)

-- Atomic, floor-guarded stock adjustment for product SKUs.
-- Negative p_delta that would take stock_qty below 0 is rejected (no row returned).
create or replace function stall_adjust_product_stock(p_id uuid, p_delta int)
returns setof stall_product_skus
language sql
as $$
  update stall_product_skus
  set stock_qty = stock_qty + p_delta
  where id = p_id and stock_qty + p_delta >= 0
  returning *;
$$;

-- Same for sticker designs.
create or replace function stall_adjust_sticker_stock(p_id uuid, p_delta int)
returns setof stall_sticker_designs
language sql
as $$
  update stall_sticker_designs
  set stock_qty = stock_qty + p_delta
  where id = p_id and stock_qty + p_delta >= 0
  returning *;
$$;

-- Atomic receipt-number consumption: increments next_no and returns the
-- number that was just consumed, guarded so it can never exceed end_no.
-- Returns no rows if the block is exhausted or missing.
create or replace function stall_consume_receipt_no(p_block_id uuid)
returns table(consumed_no int, fy text)
language sql
as $$
  update stall_receipt_blocks
  set next_no = next_no + 1
  where id = p_block_id and next_no <= end_no
  returning next_no - 1 as consumed_no, fy;
$$;

-- Atomic sticker-hold reservation: locks the sticker design row so
-- concurrent reservations for the same design serialize, computes live
-- availability (stock minus active holds) inside that lock, and only
-- inserts the hold if capacity remains. Returns the new hold row, or
-- no rows if unavailable.
create or replace function stall_reserve_sticker_hold(
  p_sticker_id uuid,
  p_shift_id uuid,
  p_qty int,
  p_expires_at timestamptz,
  p_customer_name text default null,
  p_customer_phone text default null,
  p_created_by uuid default null
)
returns setof stall_holds
language plpgsql
as $$
declare
  v_stock int;
  v_held int;
begin
  select stock_qty into v_stock from stall_sticker_designs where id = p_sticker_id for update;
  if v_stock is null then
    return;
  end if;

  select coalesce(sum(qty), 0) into v_held
  from stall_holds
  where sticker_id = p_sticker_id
    and released_at is null
    and converted_order is null
    and expires_at > now();

  if (v_stock - v_held) < p_qty then
    return;
  end if;

  return query
  insert into stall_holds (shift_id, sticker_id, qty, customer_name, customer_phone, created_by, expires_at)
  values (p_shift_id, p_sticker_id, p_qty, p_customer_name, p_customer_phone, p_created_by, p_expires_at)
  returning *;
end;
$$;

-- Indexes matching the exact predicates used by kiosk catalogue, reserve,
-- and holds-list queries (stall_holds previously had only a primary key).
create index if not exists stall_holds_active_sticker
  on stall_holds (sticker_id)
  where released_at is null and converted_order is null;

create index if not exists stall_holds_active_product
  on stall_holds (product_sku_id)
  where released_at is null and converted_order is null;

create index if not exists stall_holds_expires_at
  on stall_holds (expires_at)
  where released_at is null and converted_order is null;

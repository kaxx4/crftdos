-- crftd Stall OS v2 — migration 004: shared rate limiting + server-side analytics.
-- Run AFTER 003_fk_indexes.sql.

-- Shared PIN rate-limit store. src/lib/rateLimit.ts was a per-process Map, so
-- on Vercel each serverless instance kept its own counter and PRD §12's
-- "5 failed attempts per IP per 15 minutes" was effectively unenforced —
-- an attacker who tripped the limit was simply routed to a cold instance.
create table if not exists stall_rate_limits (
  key        text primary key,
  count      int  not null default 0,
  reset_at   timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table stall_rate_limits enable row level security;

create index if not exists stall_rate_limits_reset_at on stall_rate_limits (reset_at);

-- Atomic check-and-count. Callers use p_count_it=false to read the gate before
-- verifying a PIN, and p_count_it=true to record a failure after. That gives
-- exactly 5 attempts, blocking on the 6th.
create or replace function stall_rate_limit_hit(
  p_key text,
  p_max int default 5,
  p_window_seconds int default 900,
  p_count_it bool default false
)
returns table(allowed bool, remaining int, retry_after_seconds int)
language plpgsql
as $fn$
declare
  v_count int;
  v_reset timestamptz;
begin
  insert into stall_rate_limits (key, count, reset_at)
  values (p_key, 0, now() + make_interval(secs => p_window_seconds))
  on conflict (key) do update set
    count    = case when stall_rate_limits.reset_at < now() then 0 else stall_rate_limits.count end,
    reset_at = case when stall_rate_limits.reset_at < now()
                    then now() + make_interval(secs => p_window_seconds)
                    else stall_rate_limits.reset_at end,
    updated_at = now()
  returning stall_rate_limits.count, stall_rate_limits.reset_at into v_count, v_reset;

  if p_count_it and v_count < p_max then
    update stall_rate_limits set count = count + 1, updated_at = now() where key = p_key
    returning count into v_count;
  end if;

  return query select
    v_count < p_max,
    greatest(0, p_max - v_count),
    greatest(0, ceil(extract(epoch from (v_reset - now())))::int);
end;
$fn$;

create or replace function stall_rate_limit_clear(p_key text)
returns void language sql as $fn$
  delete from stall_rate_limits where key = p_key;
$fn$;

-- Headline analytics computed in Postgres. /api/admin/analytics pulled every
-- order ever plus every waste row and both catalogues' cost columns, then
-- reduced in Node; the payload grew with lifetime sales and the work was
-- redone on every dashboard load.
create or replace function stall_analytics_summary(
  p_from timestamptz default null,
  p_to   timestamptz default null
)
returns jsonb
language sql
stable
as $fn$
  with live as (
    select total, cost_total, discount_amount
      from stall_orders
     where voided_at is null
       and (p_from is null or created_at >= p_from)
       and (p_to   is null or created_at <  p_to)
  ),
  totals as (
    select coalesce(sum(total),0)::numeric           as gross,
           coalesce(sum(cost_total),0)::numeric      as cogs,
           coalesce(sum(discount_amount),0)::numeric as discounts,
           count(*)::int                             as order_count
      from live
  ),
  waste as (
    select count(*)::int as waste_count,
           coalesce(sum(
             coalesce(d.unit_cost,0) * coalesce(w.sticker_qty,0) +
             coalesce(p.unit_cost,0) * coalesce(w.product_qty,0)
           ),0)::numeric as waste_cost
      from stall_waste_log w
      left join stall_sticker_designs d on d.id = w.sticker_id
      left join stall_product_skus    p on p.id = w.product_sku_id
     where (p_from is null or w.created_at >= p_from)
       and (p_to   is null or w.created_at <  p_to)
  ),
  rets as (
    select count(*)::int as return_count
      from stall_returns r
     where (p_from is null or r.created_at >= p_from)
       and (p_to   is null or r.created_at <  p_to)
  )
  select jsonb_build_object(
    'gross',               t.gross,
    'cogs',                t.cogs,
    'discounts',           t.discounts,
    -- The number the organisation exists for: net profit after COGS. PRD §13.
    'raisedForAquaterra',  t.gross - t.cogs,
    'orderCount',          t.order_count,
    'wasteCount',          w.waste_count,
    'wasteCost',           w.waste_cost,
    'returnCount',         r.return_count,
    'returnRate',          case when t.order_count > 0
                                then round((r.return_count::numeric / t.order_count) * 100, 2)
                                else 0 end
  )
  from totals t, waste w, rets r;
$fn$;

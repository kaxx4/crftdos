-- version: 20260811182216
-- applied name: stall_011_kiosk_events_stream


create table stall_kiosk_events (
  id             bigint generated always as identity primary key,
  environment_id uuid not null references stall_environments(id),
  session_id     uuid not null,
  event          text not null,
  detail         jsonb,
  created_at     timestamptz not null default now()
);

create index stall_kiosk_events_session_idx on stall_kiosk_events (session_id, created_at);
create index stall_kiosk_events_created_at_idx on stall_kiosk_events (created_at);

alter table stall_kiosk_events enable row level security;

create policy stall_kiosk_events_anon_insert on stall_kiosk_events
  for insert
  to anon
  with check (true);

-- Per-session insert budget. Batching happens client-side (~5s / 25 events),
-- but this is the honest enforcement point since an in-process rate limiter
-- doesn't work across serverless instances. A session that floods past this
-- gets refused rather than silently accepted.
create or replace function stall_kiosk_events_rate_limit() returns trigger
language plpgsql as $$
declare
  v_recent int;
begin
  select count(*) into v_recent
  from stall_kiosk_events
  where session_id = new.session_id
    and created_at > now() - interval '1 minute';

  if v_recent >= 500 then
    raise exception 'Kiosk event rate limit exceeded for this session' using errcode = 'P0105';
  end if;

  return new;
end;
$$;

create trigger stall_kiosk_events_rate_limit_trg
  before insert on stall_kiosk_events
  for each row execute function stall_kiosk_events_rate_limit();

-- 90-day retention purge. Scheduled via pg_cron (available on this project)
-- and also exposed as a callable function for a manual admin button, so
-- there are two ways to trigger it, never zero.
create or replace function stall_purge_kiosk_events(p_older_than interval default interval '90 days')
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count bigint;
begin
  delete from stall_kiosk_events where created_at < now() - p_older_than;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

select cron.schedule(
  'stall-kiosk-events-purge',
  '0 3 * * *',
  $$select stall_purge_kiosk_events();$$
);

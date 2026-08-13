-- version: 20260811181534
-- applied name: stall_007_environments_table


create type stall_environment_kind as enum ('cloud', 'stall', 'online');

create table stall_environments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  prefix      text not null unique check (prefix ~ '^[A-Z][A-Z0-9]{1,5}$'),
  kind        stall_environment_kind not null default 'stall',
  is_active   boolean not null default true,
  opened_at   timestamptz not null default now(),
  closed_at   timestamptz,
  created_by  text,
  notes       text
);

insert into stall_environments (name, prefix, kind, is_active, notes)
values ('HQ Cloud', 'HQ', 'cloud', true, 'Seeded by migration 007 as the default/general environment. All pre-existing rows backfill to this environment.');

alter table stall_environments enable row level security;

create policy stall_environments_anon_select on stall_environments
  for select
  to anon
  using (true);

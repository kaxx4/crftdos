-- version: 20260811181735
-- applied name: stall_009_templates_table


create table stall_templates (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  payload       jsonb not null,
  preview_path  text,
  blurb         text,
  is_featured   boolean not null default false,
  is_active     boolean not null default true,
  sort          int not null default 0,
  times_used    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index stall_templates_active_sort_idx on stall_templates (sort) where is_active;

alter table stall_templates enable row level security;

create policy stall_templates_anon_select on stall_templates
  for select
  to anon
  using (is_active);

create or replace function stall_set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger stall_templates_set_updated_at
  before update on stall_templates
  for each row execute function stall_set_updated_at();

create or replace function stall_template_is_valid(p_payload jsonb) returns boolean
language sql stable as $$
  select not exists (
    select 1
    from jsonb_array_elements(coalesce(p_payload->'garments','[]'::jsonb)) g
    where (g->>'product_sku_id') is not null
      and not exists (
        select 1 from stall_product_skus s
        where s.id = (g->>'product_sku_id')::uuid and s.is_active
      )
  ) and not exists (
    select 1
    from jsonb_array_elements(coalesce(p_payload->'garments','[]'::jsonb)) g,
         jsonb_array_elements(coalesce(g->'stickers','[]'::jsonb)) st
    where (st->>'sticker_design_id') is not null
      and not exists (
        select 1 from stall_sticker_designs d
        where d.id = (st->>'sticker_design_id')::uuid and d.is_active
      )
  );
$$;

-- version: 20260811182413
-- applied name: stall_012_stock_locations_tables


create table stall_stock_locations (
  id             uuid primary key default gen_random_uuid(),
  environment_id uuid unique references stall_environments(id),
  name           text not null,
  is_warehouse   boolean not null default false
);

create unique index stall_stock_locations_one_warehouse
  on stall_stock_locations ((true)) where is_warehouse;

create table stall_stock (
  location_id  uuid not null references stall_stock_locations(id),
  sku_type     text not null check (sku_type in ('product','sticker')),
  sku_id       uuid not null,
  qty          int  not null default 0 check (qty >= 0),
  par_level    int  not null default 0,
  primary key (location_id, sku_type, sku_id)
);

create index stall_stock_sku_idx on stall_stock (sku_type, sku_id);

alter table stall_inventory_movements
  add column location_id uuid references stall_stock_locations(id);

alter type stall_movement_reason add value 'transfer_in';
alter type stall_movement_reason add value 'transfer_out';

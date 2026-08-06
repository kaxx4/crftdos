-- crftd Stall OS v2 schema (prefixed stall_ to coexist in shared paradox-2026 project)

create type stall_product_type    as enum ('tee','hoodie','jacket','jersey','uniform','other');
create type stall_product_size    as enum ('XS','S','M','L','XL','XXL','XXXL');
create type stall_sticker_size    as enum ('S','M','L');
create type stall_order_channel   as enum ('stall','event','kiosk','bulk','b2b','dm','other');
create type stall_payment_method  as enum ('upi','cash','split','pending');
create type stall_fulfillment     as enum ('handed_over','pending_press','collect_later','collected');
create type stall_movement_reason as enum ('sale','void','restock','recount','damage','sample','gift','return_restock','correction');
create type stall_discount_reason as enum ('volunteer_discretion','freebie','bulk','damaged_item','price_match','other');
create type stall_shift_type      as enum ('stall','event','popup','other');
create type stall_print_side      as enum ('front','back');
create type stall_b2b_stage       as enum ('enquiry','quoted','confirmed','production','ready','dispatched','closed','lost');
create type stall_return_action   as enum ('replace','refund','exchange','reject');
create type stall_waste_reason    as enum ('misalignment','peel_failure','temperature','print_defect','garment_defect','other');

create sequence stall_custom_sticker_seq start 1;
create sequence stall_order_no_seq start 1;

create table stall_colors (
  id       uuid primary key default gen_random_uuid(),
  name     text unique not null,
  hex      text,
  sort     int default 0,
  is_active bool default true
);

create table stall_fits (
  id       uuid primary key default gen_random_uuid(),
  name     text not null,
  applies_to stall_product_type not null default 'tee',
  sort     int default 0,
  is_active bool default true,
  unique (name, applies_to)
);

create table stall_sticker_designs (
  id            uuid primary key default gen_random_uuid(),
  code          text unique not null,
  size_class    stall_sticker_size not null,
  name          text,
  artwork_group text,
  tags          text[] default '{}',
  auto_tags     text[] default '{}',
  image_path    text,
  thumb_path    text,
  cutout_path   text,
  print_w_cm    numeric(5,2),
  print_h_cm    numeric(5,2),
  stock_qty     int not null default 0,
  par_level     int not null default 10,
  bin_location  text,
  unit_cost     numeric(10,2) not null default 0,
  unit_price    numeric(10,2) not null default 0,
  is_active     bool not null default true,
  kiosk_visible bool not null default true,
  created_at    timestamptz default now()
);
create index on stall_sticker_designs (size_class, is_active);
create index on stall_sticker_designs using gin (tags);
create index on stall_sticker_designs using gin (auto_tags);

create table stall_product_skus (
  id           uuid primary key default gen_random_uuid(),
  product_type stall_product_type not null default 'tee',
  color_id     uuid references stall_colors(id),
  fit_id       uuid references stall_fits(id),
  size         stall_product_size not null,
  sku_code     text unique not null,
  stock_qty    int not null default 0,
  par_level    int not null default 5,
  unit_cost    numeric(10,2) not null default 0,
  unit_price   numeric(10,2) not null default 0,
  mockup_front text,
  mockup_back  text,
  print_area   jsonb,
  is_active    bool not null default true,
  unique (product_type, color_id, fit_id, size)
);

create table stall_volunteers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  commission_rate numeric(5,4) default 0.05,
  is_active bool default true
);

create table stall_customers (
  id uuid primary key default gen_random_uuid(),
  name text,
  phone_e164 text,
  email text,
  consent_marketing bool not null default false,
  created_at timestamptz default now()
);
create index on stall_customers (phone_e164);

create table stall_shifts (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  event_name    text,
  type          stall_shift_type not null default 'stall',
  venue         text,
  shift_date    date not null default current_date,
  volunteer_ids uuid[] default '{}',
  press_on_site bool not null default true,
  opening_float numeric(10,2) default 0,
  counted_cash  numeric(10,2),
  expected_cash numeric(10,2),
  variance      numeric(10,2),
  notes         text,
  opened_at     timestamptz default now(),
  closed_at     timestamptz
);
create unique index stall_one_open_shift on stall_shifts ((closed_at is null)) where closed_at is null;

create table stall_receipt_blocks (
  id         uuid primary key default gen_random_uuid(),
  shift_id   uuid references stall_shifts(id),
  device_id  text not null,
  fy         text not null,
  start_no   int not null,
  end_no     int not null,
  next_no    int not null,
  closed_at  timestamptz,
  unique (fy, start_no)
);

create table stall_orders (
  id                 uuid primary key,
  order_no           int not null default nextval('stall_order_no_seq'),
  receipt_no         text unique,
  shift_id           uuid references stall_shifts(id),
  channel            stall_order_channel not null default 'stall',
  design_ticket      text,
  sold_by            uuid references stall_volunteers(id),
  customer_id        uuid references stall_customers(id),
  subtotal           numeric(10,2) not null default 0,
  discount_amount    numeric(10,2) not null default 0,
  discount_reason    stall_discount_reason,
  discount_note      text,
  total              numeric(10,2) not null default 0,
  cost_total         numeric(10,2) not null default 0,
  manual_override    bool not null default false,
  payment_method     stall_payment_method not null,
  paid_cash          numeric(10,2) default 0,
  paid_upi           numeric(10,2) default 0,
  payment_ref        text,
  fulfillment_status stall_fulfillment not null default 'handed_over',
  promised_date      date,
  pressed_at         timestamptz,
  collected_at       timestamptz,
  affects_inventory  bool not null default true,
  notes              text,
  created_at         timestamptz not null default now(),
  client_created_at  timestamptz,
  device_id          text,
  voided_at          timestamptz,
  voided_by          text,
  void_reason        text
);
create index on stall_orders (shift_id);
create index on stall_orders (created_at desc);
create index on stall_orders (receipt_no);
create index on stall_orders (fulfillment_status) where fulfillment_status <> 'handed_over';

create table stall_order_items (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references stall_orders(id) on delete cascade,
  product_sku_id uuid references stall_product_skus(id),
  qty            int not null default 1,
  unit_price     numeric(10,2) not null default 0,
  unit_cost      numeric(10,2) not null default 0,
  line_total     numeric(10,2) not null default 0
);
create index on stall_order_items (order_id);

create table stall_custom_stickers (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  size_class  stall_sticker_size not null,
  description text not null,
  image_path  text,
  unit_price  numeric(10,2) not null default 0,
  order_id    uuid references stall_orders(id),
  created_at  timestamptz default now()
);

create table stall_order_item_stickers (
  id                uuid primary key default gen_random_uuid(),
  order_item_id     uuid not null references stall_order_items(id) on delete cascade,
  sticker_design_id uuid references stall_sticker_designs(id),
  custom_sticker_id uuid references stall_custom_stickers(id),
  side              stall_print_side default 'front',
  pos_x             numeric(6,3),
  pos_y             numeric(6,3),
  rotation          numeric(6,2) default 0,
  unit_price        numeric(10,2) not null default 0,
  unit_cost         numeric(10,2) not null default 0,
  check (num_nonnulls(sticker_design_id, custom_sticker_id) = 1)
);
create index on stall_order_item_stickers (order_item_id);

create table stall_design_tickets (
  id           uuid primary key default gen_random_uuid(),
  code         text unique not null,
  device_id    text,
  payload      jsonb not null,
  composite_path text,
  quoted_total numeric(10,2),
  status       text not null default 'open',
  order_id     uuid references stall_orders(id),
  created_at   timestamptz default now(),
  expires_at   timestamptz not null
);
create index on stall_design_tickets (code) where status = 'open';

create table stall_presets (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  payload     jsonb not null,
  preview_path text,
  sort        int default 0,
  is_active   bool default true
);

create table stall_holds (
  id             uuid primary key default gen_random_uuid(),
  shift_id       uuid references stall_shifts(id),
  product_sku_id uuid references stall_product_skus(id),
  sticker_id     uuid references stall_sticker_designs(id),
  qty            int not null default 1,
  customer_name  text,
  customer_phone text,
  created_by     uuid references stall_volunteers(id),
  expires_at     timestamptz not null,
  released_at    timestamptz,
  converted_order uuid references stall_orders(id),
  created_at     timestamptz default now()
);

create table stall_waste_log (
  id             uuid primary key default gen_random_uuid(),
  shift_id       uuid references stall_shifts(id),
  sticker_id     uuid references stall_sticker_designs(id),
  sticker_qty    int default 0,
  product_sku_id uuid references stall_product_skus(id),
  product_qty    int default 0,
  reason         stall_waste_reason not null,
  note           text,
  photo_path     text,
  logged_by      uuid references stall_volunteers(id),
  created_at     timestamptz default now()
);

create table stall_returns (
  id              uuid primary key default gen_random_uuid(),
  original_order  uuid references stall_orders(id),
  replacement_order uuid references stall_orders(id),
  reason          text not null,
  action          stall_return_action not null,
  refund_amount   numeric(10,2) default 0,
  restocked       bool default false,
  approved_by     uuid references stall_volunteers(id),
  note            text,
  created_at      timestamptz default now()
);

create table stall_b2b_orders (
  id              uuid primary key default gen_random_uuid(),
  client_org      text not null,
  contact_name    text,
  contact_phone   text,
  contact_email   text,
  account_owner   uuid not null references stall_volunteers(id),
  stage           stall_b2b_stage not null default 'enquiry',
  product_type    stall_product_type default 'tee',
  quantity        int not null default 0,
  size_breakdown  jsonb,
  design_ref      text,
  artwork_path    text,
  unit_price      numeric(10,2) not null default 0,
  unit_cost       numeric(10,2) not null default 0,
  gross_value     numeric(12,2) generated always as (quantity * unit_price) stored,
  deposit_amount  numeric(12,2),
  deposit_date    date,
  deposit_method  stall_payment_method,
  balance_amount  numeric(12,2),
  balance_date    date,
  balance_method  stall_payment_method,
  promised_date   date,
  dispatched_date date,
  affects_inventory bool default false,
  lost_reason     text,
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create table stall_b2b_activity (
  id       uuid primary key default gen_random_uuid(),
  b2b_id   uuid references stall_b2b_orders(id) on delete cascade,
  actor    text,
  event    text not null,
  detail   jsonb,
  created_at timestamptz default now()
);

create table stall_inventory_movements (
  id         uuid primary key default gen_random_uuid(),
  sku_type   text not null check (sku_type in ('product','sticker')),
  sku_id     uuid not null,
  delta      int not null,
  reason     stall_movement_reason not null,
  ref_order  uuid references stall_orders(id),
  actor      text,
  note       text,
  created_at timestamptz default now()
);
create index on stall_inventory_movements (sku_type, sku_id, created_at desc);

create table stall_settings (key text primary key, value jsonb not null, updated_at timestamptz default now());

create table stall_message_log (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references stall_orders(id),
  channel text not null check (channel in ('email','whatsapp')),
  status text not null, error text, sent_at timestamptz,
  created_at timestamptz default now()
);

create table stall_admin_audit (
  id uuid primary key default gen_random_uuid(),
  actor text, action text not null, detail jsonb, created_at timestamptz default now()
);

create view stall_product_availability as
select p.*,
  p.stock_qty - coalesce((
    select sum(h.qty) from stall_holds h
    where h.product_sku_id = p.id and h.released_at is null
      and h.converted_order is null and h.expires_at > now()
  ),0) as available_qty
from stall_product_skus p;

-- RLS: deny anon by default, allow read on catalogue tables needed by kiosk/realtime
alter table stall_colors enable row level security;
alter table stall_fits enable row level security;
alter table stall_sticker_designs enable row level security;
alter table stall_product_skus enable row level security;
alter table stall_presets enable row level security;
alter table stall_volunteers enable row level security;
alter table stall_customers enable row level security;
alter table stall_shifts enable row level security;
alter table stall_receipt_blocks enable row level security;
alter table stall_orders enable row level security;
alter table stall_order_items enable row level security;
alter table stall_custom_stickers enable row level security;
alter table stall_order_item_stickers enable row level security;
alter table stall_design_tickets enable row level security;
alter table stall_holds enable row level security;
alter table stall_waste_log enable row level security;
alter table stall_returns enable row level security;
alter table stall_b2b_orders enable row level security;
alter table stall_b2b_activity enable row level security;
alter table stall_inventory_movements enable row level security;
alter table stall_settings enable row level security;
alter table stall_message_log enable row level security;
alter table stall_admin_audit enable row level security;

create policy stall_anon_read_colors on stall_colors for select to anon using (true);
create policy stall_anon_read_fits on stall_fits for select to anon using (true);
create policy stall_anon_read_stickers on stall_sticker_designs for select to anon using (true);
create policy stall_anon_read_products on stall_product_skus for select to anon using (true);
create policy stall_anon_read_presets on stall_presets for select to anon using (true);

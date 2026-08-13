-- version: 20260812162909
-- applied name: 013_stall_leads

-- migration 013: stall_leads
--
-- Potential-customer tracking (bulk orders, single custom-tee enquiries) —
-- distinct from stall_b2b_orders, which is a committed deal pipeline with a
-- margin gate. A lead is just "someone worth following up with." Org-wide,
-- not environment-scoped, same reasoning as B2B (migration 004.2): a lead
-- isn't tied to a physical stall.
create table stall_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  notes text,
  logged_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index stall_leads_created_at_idx on stall_leads (created_at desc);

alter table stall_leads enable row level security;

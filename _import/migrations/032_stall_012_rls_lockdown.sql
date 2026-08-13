-- version: 20260811205352
-- applied name: stall_012_rls_lockdown


alter table stall_stock_locations enable row level security;
alter table stall_stock enable row level security;

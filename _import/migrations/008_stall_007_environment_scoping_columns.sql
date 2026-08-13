-- version: 20260811181551
-- applied name: stall_007_environment_scoping_columns


do $$
declare
  hq_id uuid := 'f7dc07c4-96d0-433b-822b-cdcf23cfcb6a';
  t text;
  tables text[] := array[
    'stall_orders','stall_shifts','stall_receipt_blocks','stall_holds',
    'stall_inventory_movements','stall_waste_log','stall_returns','stall_design_tickets'
  ];
begin
  foreach t in array tables loop
    execute format('alter table %I add column environment_id uuid references stall_environments(id)', t);
    execute format('update %I set environment_id = %L where environment_id is null', t, hq_id);
    execute format('alter table %I alter column environment_id set not null', t);
  end loop;
end $$;

create index stall_orders_environment_created_idx on stall_orders (environment_id, created_at desc);
create index stall_shifts_environment_idx on stall_shifts (environment_id);
create index stall_receipt_blocks_environment_idx on stall_receipt_blocks (environment_id);
create index stall_holds_environment_idx on stall_holds (environment_id);
create index stall_inventory_movements_environment_idx on stall_inventory_movements (environment_id);
create index stall_waste_log_environment_idx on stall_waste_log (environment_id);
create index stall_returns_environment_idx on stall_returns (environment_id);
create index stall_design_tickets_environment_idx on stall_design_tickets (environment_id);

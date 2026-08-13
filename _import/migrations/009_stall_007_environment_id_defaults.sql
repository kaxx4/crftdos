-- version: 20260811181609
-- applied name: stall_007_environment_id_defaults


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
    execute format('alter table %I alter column environment_id set default %L', t, hq_id);
  end loop;
end $$;

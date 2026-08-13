-- version: 20260811181718
-- applied name: stall_008_prepped_at_and_board_indexes


alter table stall_orders add column prepped_at timestamptz;

create index stall_orders_prep_queue_idx on stall_orders (created_at)
  where fulfillment_status = 'pending_press' and prepped_at is null;

create index stall_orders_print_queue_idx on stall_orders (prepped_at)
  where prepped_at is not null and pressed_at is null;

create index stall_orders_handover_queue_idx on stall_orders (pressed_at)
  where pressed_at is not null and collected_at is null;

-- version: 20260811181622
-- applied name: stall_007_receipt_block_env_scoping


alter table stall_receipt_blocks drop constraint if exists stall_receipt_blocks_fy_start_no_key;
alter table stall_receipt_blocks add constraint stall_receipt_blocks_env_fy_start_no_key unique (environment_id, fy, start_no);

create or replace function stall_allocate_receipt_block(
  p_environment_id uuid,
  p_shift_id uuid,
  p_device_id text,
  p_fy text,
  p_block_size int default 100
) returns stall_receipt_blocks
language plpgsql
as $$
declare
  v_max int;
  v_block stall_receipt_blocks;
begin
  perform 1 from stall_environments where id = p_environment_id for update;

  select coalesce(max(end_no), 0) into v_max
  from stall_receipt_blocks
  where environment_id = p_environment_id and fy = p_fy;

  insert into stall_receipt_blocks (shift_id, device_id, fy, start_no, end_no, next_no, environment_id)
  values (p_shift_id, p_device_id, p_fy, v_max + 1, v_max + p_block_size, v_max + 1, p_environment_id)
  returning * into v_block;

  return v_block;
end;
$$;

-- version: 20260812165936
-- applied name: 014_per_environment_open_shift

drop index if exists stall_one_open_shift;
create unique index stall_one_open_shift_per_env
  on stall_shifts (environment_id)
  where (closed_at is null);

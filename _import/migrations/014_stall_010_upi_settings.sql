-- version: 20260811181806
-- applied name: stall_010_upi_settings


insert into stall_settings (key, value) values
  ('upi_vpa', to_jsonb(''::text)),
  ('upi_payee_name', to_jsonb('crftd'::text))
on conflict (key) do nothing;

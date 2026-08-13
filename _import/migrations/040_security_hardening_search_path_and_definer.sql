-- version: 20260813050937
-- applied name: 017_security_hardening_search_path_and_definer

ALTER FUNCTION public.stall_adjust_product_stock(uuid,integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.stall_adjust_product_stock(uuid,integer,uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.stall_adjust_sticker_stock(uuid,integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.stall_adjust_sticker_stock(uuid,integer,uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.stall_allocate_receipt_block(uuid,uuid,text,text,integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.stall_analytics_summary(timestamp with time zone,timestamp with time zone) SET search_path = public, pg_temp;
ALTER FUNCTION public.stall_consume_receipt_no(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.stall_create_exchange(uuid,uuid,text,uuid,integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.stall_create_order(jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.stall_kiosk_events_rate_limit() SET search_path = public, pg_temp;
ALTER FUNCTION public.stall_location_for_environment(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.stall_next_custom_sticker_no() SET search_path = public, pg_temp;
ALTER FUNCTION public.stall_prep_order(uuid,text) SET search_path = public, pg_temp;
ALTER FUNCTION public.stall_product_availability_at(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.stall_rate_limit_clear(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.stall_rate_limit_hit(text,integer,integer,boolean) SET search_path = public, pg_temp;
ALTER FUNCTION public.stall_reserve_named_hold(uuid,text,uuid,integer,text,text,uuid,numeric) SET search_path = public, pg_temp;
ALTER FUNCTION public.stall_reserve_sticker_hold(uuid,uuid,integer,timestamp with time zone,text,text,uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.stall_reserve_sticker_hold(uuid,uuid,integer,timestamp with time zone,text,text,uuid,uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.stall_restock_signals() SET search_path = public, pg_temp;
ALTER FUNCTION public.stall_set_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.stall_sync_derived_stock_qty() SET search_path = public, pg_temp;
ALTER FUNCTION public.stall_template_is_valid(jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.stall_transfer_stock(uuid,uuid,text,uuid,integer,text) SET search_path = public, pg_temp;
ALTER FUNCTION public.stall_void_order(uuid,text,text) SET search_path = public, pg_temp;
ALTER FUNCTION public.stall_warehouse_location() SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.stall_purge_kiosk_events(interval) FROM anon;
REVOKE EXECUTE ON FUNCTION public.stall_purge_kiosk_events(interval) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.stall_purge_kiosk_events(interval) FROM public;
GRANT EXECUTE ON FUNCTION public.stall_purge_kiosk_events(interval) TO service_role;

ALTER VIEW public.stall_product_availability SET (security_invoker = true);

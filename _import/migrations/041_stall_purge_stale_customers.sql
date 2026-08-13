-- version: 20260813055246
-- applied name: 018_stall_purge_stale_customers

CREATE OR REPLACE FUNCTION public.stall_purge_stale_customers(p_older_than interval DEFAULT interval '24 months')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.stall_customers c
  WHERE c.created_at < now() - p_older_than
    AND NOT EXISTS (
      SELECT 1 FROM public.stall_orders o
      WHERE o.customer_id = c.id
        AND o.created_at >= now() - p_older_than
    );
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.stall_purge_stale_customers(interval) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.stall_purge_stale_customers(interval) TO service_role;

SELECT cron.schedule('stall-customer-retention-purge', '30 3 * * *', $$select stall_purge_stale_customers();$$);

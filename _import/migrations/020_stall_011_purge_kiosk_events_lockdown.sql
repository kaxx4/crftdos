-- version: 20260811182232
-- applied name: stall_011_purge_kiosk_events_lockdown


revoke execute on function stall_purge_kiosk_events(interval) from anon, authenticated;

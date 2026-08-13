# Migrations

Files `001`–`006` are the original hand-tracked set.

Files `007`–`041` were reconciled on 2026-08-13 by pulling the actual applied
SQL for every `stall_*`-prefixed migration directly out of
`supabase_migrations.schema_migrations` on the live `paradox-2026` project,
in applied order. Before this, the live schema had drifted well ahead of what
was tracked here — `stall_environments`, `stall_templates`, `stall_leads`,
`stall_kiosk_events`, per-environment stock locations, price-trust, and more
existed live but nowhere in this folder. Rebuilding from `_import/` alone
would have produced a broken database.

`_import/schema.sql` is a point-in-time dump from before this reconciliation
and is now known-stale relative to these migration files; treat the
migrations folder, not `schema.sql`, as the source of truth for the current
schema.

Non-`stall_*` migrations (the `paradox_*` / `phase*` ones, belonging to the
unrelated app sharing this Supabase project) were intentionally excluded.

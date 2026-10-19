begin;

-- Supabase projects may explicitly grant new public functions to API roles via
-- default privileges. Revoke those direct grants as well as PUBLIC inheritance.
revoke all on function jsonb_has_forbidden_behaviour_key(jsonb) from public, anon, authenticated;
revoke all on function upsert_preference_signal(uuid,text,text,numeric,timestamptz) from public, anon, authenticated;
revoke all on function resolve_preference_profile(uuid,uuid) from public, anon, authenticated;
revoke all on function apply_behaviour_signal(uuid,uuid) from public, anon, authenticated;
revoke all on function ingest_behaviour_batch(jsonb,uuid,uuid,uuid,boolean,boolean) from public, anon, authenticated;
revoke all on function reset_personalisation_data() from public, anon, authenticated;
revoke all on function purge_expired_behaviour_events(timestamptz,integer) from public, anon, authenticated;
revoke all on function personalisation_admin_metrics(timestamptz) from public, anon, authenticated;

grant execute on function ingest_behaviour_batch(jsonb,uuid,uuid,uuid,boolean,boolean) to service_role;
grant execute on function purge_expired_behaviour_events(timestamptz,integer) to service_role;
grant execute on function reset_personalisation_data() to authenticated;
grant execute on function personalisation_admin_metrics(timestamptz) to authenticated;

commit;

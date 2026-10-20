-- Existing analytics writes use the checked SECURITY DEFINER ingestion RPCs.
-- RLS does not protect TRUNCATE. Remove table capabilities, preserve scoped reads.
begin;
revoke all privileges on table public.analytics_events from public,anon,authenticated;
grant select on table public.analytics_events to authenticated;
-- Existing analytics_operator_read policy and service_role privileges are unchanged.
notify pgrst,'reload schema';
commit;

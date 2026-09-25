-- Public release metadata only: no tenant identities, data or secrets.
begin;
create function public.crm_release_readiness() returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('release','2026-09-25-pos-1','database_ready',
  pg_catalog.to_regprocedure('public.crm_workspace_access(text)') is not null
  and pg_catalog.to_regprocedure('public.crm_read_workspace_snapshot(text)') is not null
  and pg_catalog.to_regprocedure('public.crm_write_workspace_snapshot(text,jsonb,timestamp with time zone)') is not null
  and pg_catalog.to_regprocedure('public.crm_hospitality_command(text,uuid,jsonb)') is not null
  and pg_catalog.to_regprocedure('public.crm_hospitality_overview(text)') is not null
  and pg_catalog.to_regclass('public.crm_inventory_value_events') is not null
  and pg_catalog.to_regclass('public.crm_fiscal_outbox') is not null,
  'fiscal_issuance_enabled',false);
$$;
revoke all on function public.crm_release_readiness() from public;
grant execute on function public.crm_release_readiness() to anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;

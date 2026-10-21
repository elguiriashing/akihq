begin;
-- Presentation adapter only. The shared stage ledger is installed independently by AkiPasa.
create function public.akipulse_business_funnel(p_kind text,p_id uuid,p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare allowed boolean; total integer; workspace text; result jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501';end if;
 if pg_catalog.to_regprocedure('public.account_features_allowed()') is not null then
  execute 'select public.account_features_allowed()' into allowed;
  if allowed is distinct from true then raise exception 'Account completion required' using errcode='42501';end if;
 end if;
 if p_kind is null or p_kind not in('venue','property','fleet','organisation') or p_id is null or p_days is null or p_days not in(7,30,90) then raise exception 'Invalid scope' using errcode='22023';end if;
 -- Scope authorization is independent of UI selection and reuses the reviewed read-only scope RPC.
 perform public.akipulse_scope_analytics(p_kind,p_id,p_days,now());
 if p_kind not in('venue','property') then return jsonb_build_object('available',false,'reason','scope_mapping_unsupported');end if;
 select count(*),min(w.id) into total,workspace from public.crm_workspaces w where w.source_venue_id=p_id and w.status in('active','trial');
 if total=0 then return jsonb_build_object('available',false,'reason','workspace_mapping_missing');end if;
 if total<>1 then return jsonb_build_object('available',false,'reason','workspace_mapping_ambiguous');end if;
 if not public.crm_can_access_workspace(workspace) or not exists(select 1 from public.crm_workspace_members m where m.workspace_id=workspace and m.profile_id=auth.uid() and m.status='active' and m.role in('owner','admin','manager')) then
  return jsonb_build_object('available',false,'reason','workspace_management_required');end if;
 if pg_catalog.to_regprocedure('public.suite_business_funnel(text,integer)') is null then return jsonb_build_object('available',false,'reason','stage_adapter_not_installed');end if;
 -- Keep the real auth.uid(): the called RPC intersects workspace membership again.
 execute 'select public.suite_business_funnel($1,$2)' into result using workspace,p_days;
 return jsonb_build_object('kind',p_kind,'id',p_id,'days',p_days,'funnel',result);
end $$;
revoke all on function public.akipulse_business_funnel(text,uuid,integer) from public,anon;
grant execute on function public.akipulse_business_funnel(text,uuid,integer) to authenticated;
commit;

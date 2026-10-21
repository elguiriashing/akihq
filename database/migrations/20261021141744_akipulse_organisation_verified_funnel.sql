begin;
-- Distinct verified ledger facts across explicit organisation locations; never sum workspace reports.
create function public.akipulse_organisation_funnel(p_organisation uuid,p_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare workspaces text[]; venues uuid[]; total integer; included integer; result jsonb; since timestamptz; retention integer;
begin
 if auth.uid() is null or public.account_features_allowed() is distinct from true
 or public.can_manage_operating_organisation(p_organisation) is distinct from true
 or not exists(select 1 from public.operating_organisations where id=p_organisation and status='active') then raise exception 'Organisation manager required' using errcode='42501';end if;
 if p_days is null or p_days not in(7,30,90) then raise exception 'Invalid period' using errcode='22023';end if;
 select count(*) into total from public.operating_organisation_locations where organisation_id=p_organisation;
 if total=0 then return jsonb_build_object('available',false,'reason','organisation_mapping_missing');end if;
 if total>100 then raise exception 'Organisation exceeds report scope; inspect individual locations' using errcode='54000';end if;
 select coalesce(array_agg(w.id),'{}'),coalesce(array_agg(distinct w.source_venue_id) filter(where w.source_venue_id is not null and public.is_venue_member(w.source_venue_id,array['owner','manager']::public.venue_member_role[])),'{}')
 into workspaces,venues from public.operating_organisation_locations l join public.crm_workspaces w on w.id=l.workspace_id
 where l.organisation_id=p_organisation and public.akipulse_workspace_management(w.id) is true;
 included:=cardinality(workspaces);
 if included=0 then return jsonb_build_object('available',false,'reason','workspace_management_required');end if;
 if to_regclass('suite_funnel_private.settings') is null or to_regclass('suite_funnel_private.stages') is null then return jsonb_build_object('available',false,'reason','stage_adapter_not_installed');end if;
 if not coalesce((select enabled from suite_funnel_private.settings where singleton),false) then return jsonb_build_object('available',false,'reason','not_activated');end if;
 select enabled_since,retention_days into since,retention from suite_funnel_private.settings where singleton;
 if since is null or retention is null then return jsonb_build_object('available',false,'reason','not_initialized');end if;
 select coalesce(jsonb_object_agg(stage,n),'{}') into result from (
 select s.stage,count(*) n from suite_funnel_private.stages s
 where s.occurred_at>=greatest(since,now()-make_interval(days=>least(p_days,retention)))
 and s.occurred_at<=now() and (s.workspace_id=any(workspaces) or (s.workspace_id is null and s.venue_id=any(venues)))
 and suite_funnel_private.subject_allowed(s.profile_id) is true group by s.stage) counts;
 return jsonb_build_object('available',true,'scope','organisation','days',p_days,'stages',result,'coverage','consented_verified_observations_only',
 'retention_days',retention,'collection_started_at',since,'claim_stage_available',cardinality(venues)>0,'cta_attribution_available',false,'conversion_rate_available',false,'hq_activation_definition','owner_created_management_workspace',
 'organisation_coverage',jsonb_build_object('included_workspaces',included,'excluded_workspaces',total-included));
end $$;
revoke all on function public.akipulse_organisation_funnel(uuid,integer) from public,anon;
grant execute on function public.akipulse_organisation_funnel(uuid,integer) to authenticated;
commit;

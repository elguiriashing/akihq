begin;
create function public.akipulse_business_funnel_v2(p_kind text,p_id uuid,p_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare workspace text; venue uuid; result jsonb; total integer;
begin
 if auth.uid() is null or public.account_features_allowed() is distinct from true then raise exception 'Account access required' using errcode='42501';end if;
 if p_days is null or p_days not in(7,30,90) or p_id is null or p_kind is null then raise exception 'Invalid scope' using errcode='22023';end if;
 if p_kind='organisation' then result:=public.akipulse_organisation_funnel(p_id,p_days);
 elsif p_kind='native_property' then
 if to_regprocedure('public.can_manage_accommodation_property(uuid)') is null then return jsonb_build_object('available',false,'reason','native_mapping_not_installed');end if;
 if public.can_manage_accommodation_property(p_id) is distinct from true then raise exception 'Property manager required' using errcode='42501';end if;
 select p.workspace_id into workspace from public.accommodation_properties p where p.id=p_id;
 if workspace is null then return jsonb_build_object('available',false,'reason','workspace_mapping_missing');end if;
 if public.akipulse_workspace_management(workspace) is distinct from true then return jsonb_build_object('available',false,'reason','workspace_management_required');end if;
 -- Native properties have their own identity. Workspace stages are explicitly named as such in the UI.
 result:=public.suite_business_funnel(workspace,p_days);
 elsif p_kind='fleet' then
 if public.can_manage_rental_company(p_id) is distinct from true then raise exception 'Branch manager required' using errcode='42501';end if;
 select r.workspace_id into workspace from public.akipulse_rental_workspaces r where r.company_id=p_id;
 if workspace is not null then
 if public.akipulse_workspace_management(workspace) is distinct from true then return jsonb_build_object('available',false,'reason','workspace_management_required');end if;
 result:=public.suite_business_funnel(workspace,p_days);
 return jsonb_build_object('kind',p_kind,'id',p_id,'days',p_days,'funnel',result);end if;
 -- Only the current optional link is authoritative; detached/archived links never participate.
 select c.venue_id into venue from public.car_rental_companies c where c.id=p_id;
 if venue is null then return jsonb_build_object('available',false,'reason','workspace_mapping_missing');end if;
 result:=public.akipulse_business_funnel('venue',venue,p_days);
 if result->>'kind'='venue' then result:=result->'funnel';end if;
 else return public.akipulse_business_funnel(p_kind,p_id,p_days);end if;
 return jsonb_build_object('kind',p_kind,'id',p_id,'days',p_days,'funnel',result);
end $$;
revoke all on function public.akipulse_business_funnel_v2(text,uuid,integer) from public,anon;
grant execute on function public.akipulse_business_funnel_v2(text,uuid,integer) to authenticated;
commit;

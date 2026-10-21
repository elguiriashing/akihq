begin;
-- Internal supplement: no client execution and no client-supplied aggregate is trusted.
create function public.akipulse_organisation_rental_report(p_org uuid,p_until timestamptz,p_base jsonb,p_native_covered text[]) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare companies uuid[]; covered text[]; linked integer; units integer; facts jsonb; start_at timestamptz; previous_at timestamptz;
begin
 if auth.uid() is null or public.account_features_allowed() is distinct from true or public.can_manage_operating_organisation(p_org) is distinct from true then raise exception 'Organisation manager required' using errcode='42501';end if;
 select count(*) into linked from public.akipulse_rental_workspaces r join public.operating_organisation_locations l on l.workspace_id=r.workspace_id where l.organisation_id=p_org;
 if linked>100 then raise exception 'Organisation exceeds rental branch report scope; inspect individual branches' using errcode='54000';end if;
 select coalesce(array_agg(r.company_id),'{}'),coalesce(array_agg(distinct r.workspace_id) filter(where (w.source_venue_id is null or not public.is_venue_member(w.source_venue_id,array['owner','manager']::public.venue_member_role[])) and not(r.workspace_id=any(coalesce(p_native_covered,'{}')))),'{}')
 into companies,covered from public.akipulse_rental_workspaces r join public.operating_organisation_locations l on l.workspace_id=r.workspace_id join public.crm_workspaces w on w.id=r.workspace_id
 where l.organisation_id=p_org and public.akipulse_workspace_management(w.id) is true and public.can_manage_rental_company(r.company_id) is true;
 start_at:=(p_base#>>'{period,current_from}')::timestamptz;previous_at:=(p_base#>>'{period,previous_from}')::timestamptz;
 select count(*) into units from public.car_rental_vehicles where company_id=any(companies) and active;
 select coalesce(jsonb_agg(to_jsonb(g) order by period,status),'[]') into facts from (
 select 'fleet'::text source,case when b.created_at>=start_at then 'current' else 'previous' end period,b.status,count(*) total
 from public.car_rental_bookings b join public.car_rental_vehicles v on v.id=b.vehicle_id
 where v.company_id=any(companies) and b.created_at>=previous_at and b.created_at<p_until group by 2,3)g;
 p_base:=jsonb_set(p_base,'{bookings}',(p_base->'bookings')||facts);
 p_base:=jsonb_set(p_base,'{coverage,measured_rental_branches}',to_jsonb(cardinality(companies)));
 p_base:=jsonb_set(p_base,'{coverage,excluded_rental_branches}',to_jsonb(linked-cardinality(companies)));
 p_base:=jsonb_set(p_base,'{coverage,current_active_vehicles}',to_jsonb(units));
 p_base:=jsonb_set(p_base,'{coverage,excluded_locations}',to_jsonb(greatest(0,(p_base#>>'{coverage,excluded_locations}')::integer-cardinality(covered))));
 return p_base;
end $$;
revoke all on function public.akipulse_organisation_rental_report(uuid,timestamptz,jsonb,text[]) from public,anon,authenticated;
commit;

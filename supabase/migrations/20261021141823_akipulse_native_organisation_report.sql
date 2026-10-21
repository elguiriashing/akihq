begin;
create function public.akipulse_scope_analytics_v2(p_kind text,p_id uuid,p_days integer default 30,p_until timestamptz default now()) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare base jsonb; properties uuid[]; covered text[]; linked integer; excluded integer; units integer; facts jsonb; start_at timestamptz; previous_at timestamptz;
begin
 if p_kind='native_property' then return public.akipulse_native_property_report(p_id,p_days,p_until);end if;
 -- Existing RPC rechecks account, selected resource, period and 100-location organisation bound.
 base:=public.akipulse_scope_analytics(p_kind,p_id,p_days,p_until);
 if p_kind<>'organisation' then return base;end if;
 if public.akipulse_native_inventory_ready() is distinct from true or to_regclass('public.pulse_native_reservations_time') is null then
 return public.akipulse_organisation_rental_report(p_id,p_until,jsonb_set(base,'{coverage,native_reporting_available}','false'::jsonb),'{}');end if;
 select count(*) into linked from public.accommodation_properties p join public.operating_organisation_locations l on l.workspace_id=p.workspace_id where l.organisation_id=p_id;
 if linked>100 then raise exception 'Organisation exceeds native property report scope; inspect individual properties' using errcode='54000';end if;
 select coalesce(array_agg(p.id),'{}'),coalesce(array_agg(distinct p.workspace_id) filter(where w.source_venue_id is null or not public.is_venue_member(w.source_venue_id,array['owner','manager']::public.venue_member_role[])),'{}')
 into properties,covered from public.accommodation_properties p join public.operating_organisation_locations l on l.workspace_id=p.workspace_id join public.crm_workspaces w on w.id=l.workspace_id
 where l.organisation_id=p_id and public.akipulse_workspace_management(w.id) is true and public.can_manage_accommodation_inventory(p.id) is true;
 excluded:=linked-cardinality(properties);
 start_at:=(base#>>'{period,current_from}')::timestamptz;previous_at:=(base#>>'{period,previous_from}')::timestamptz;
 select count(*) into units from public.accommodation_property_units where property_id=any(properties) and active;
 select coalesce(jsonb_agg(to_jsonb(g) order by period,status),'[]') into facts from (
 select 'native_accommodation'::text source,case when created_at>=start_at then 'current' else 'previous' end period,status,count(*) total from public.accommodation_property_reservations
 where property_id=any(properties) and created_at>=previous_at and created_at<p_until group by 2,3)g;
 base:=jsonb_set(base,'{bookings}',(base->'bookings')||facts);
 base:=jsonb_set(base,'{coverage,measured_native_properties}',to_jsonb(cardinality(properties)));
 base:=jsonb_set(base,'{coverage,native_reporting_available}','true'::jsonb);
 base:=jsonb_set(base,'{coverage,excluded_native_properties}',to_jsonb(excluded));
 base:=jsonb_set(base,'{coverage,current_active_units}',to_jsonb((base#>>'{coverage,current_active_units}')::integer+units));
 -- A workspace counted as unmapped by the legacy report is now covered through its explicit property link.
 base:=jsonb_set(base,'{coverage,excluded_locations}',to_jsonb(greatest(0,(base#>>'{coverage,excluded_locations}')::integer-cardinality(covered))));
 return public.akipulse_organisation_rental_report(p_id,p_until,base,covered);
end $$;
revoke all on function public.akipulse_scope_analytics_v2(text,uuid,integer,timestamptz) from public,anon;
grant execute on function public.akipulse_scope_analytics_v2(text,uuid,integer,timestamptz) to authenticated;
commit;

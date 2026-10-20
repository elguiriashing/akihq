begin;
-- Additive read-only aggregates. Existing source RLS/grants and all booking records remain unchanged.
create index if not exists pulse_booking_requests_scope_time on public.booking_requests(venue_id,created_at);
create index if not exists pulse_accommodation_scope_time on public.accommodation_reservations(venue_id,created_at);
create index if not exists pulse_rental_scope_time on public.car_rental_bookings(vehicle_id,created_at);

create function public.akipulse_scopes(p_kind text,p_limit integer default 51,p_offset integer default 0)
returns table(id uuid,name text) language plpgsql stable security definer set search_path='' as $$
declare v_account_allowed boolean;
begin
 if (select auth.uid()) is null then raise exception 'Authentication required' using errcode='42501'; end if;
 -- Staged shared identity gate: existing/exempt accounts and absent rollout schema retain access.
 if pg_catalog.to_regprocedure('public.account_features_allowed()') is not null then
  execute 'select public.account_features_allowed()' into v_account_allowed;
  if v_account_allowed is distinct from true then raise exception 'Account completion required' using errcode='42501'; end if;
 end if;
 if p_kind is null or p_kind not in ('venue','property','fleet','organisation') or p_limit is null or p_limit not between 1 and 101 or p_offset is null or p_offset not between 0 and 10000 then raise exception 'Invalid scope page' using errcode='22023'; end if;
 if p_kind in ('venue','property') then
  return query select v.id,v.name from public.venues v where
   exists(select 1 from public.venue_members m where m.venue_id=v.id and m.profile_id=(select auth.uid()) and m.role::text in ('owner','manager'))
   and (p_kind='venue' or v.discovery_vertical='accommodation') order by v.name,v.id limit p_limit offset p_offset;
 elsif p_kind='fleet' then
  return query select c.id,c.name from public.car_rental_companies c where public.can_manage_rental_company(c.id) order by c.name,c.id limit p_limit offset p_offset;
 else
  return query select o.id,o.name from public.operating_organisations o where o.status='active' and public.can_manage_operating_organisation(o.id) order by o.name,o.id limit p_limit offset p_offset;
 end if;
end $$;
revoke all on function public.akipulse_scopes(text,integer,integer) from public,anon;
grant execute on function public.akipulse_scopes(text,integer,integer) to authenticated;

create function public.akipulse_scope_analytics(p_kind text,p_id uuid,p_days integer default 30,p_until timestamptz default now())
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 v_venues uuid[]:='{}'; v_name text; v_from timestamptz; v_previous timestamptz;
 v_bookings jsonb; v_interactions jsonb:='[]'; v_excluded integer:=0; v_total integer;
 v_units integer:=null; v_vehicles integer:=null; v_account_allowed boolean;
begin
 if (select auth.uid()) is null then raise exception 'Authentication required' using errcode='42501'; end if;
 -- Staged shared identity gate: existing/exempt accounts and absent rollout schema retain access.
 if pg_catalog.to_regprocedure('public.account_features_allowed()') is not null then
  execute 'select public.account_features_allowed()' into v_account_allowed;
  if v_account_allowed is distinct from true then raise exception 'Account completion required' using errcode='42501'; end if;
 end if;
 if p_id is null or p_kind is null or p_kind not in ('venue','property','fleet','organisation') or p_days is null or p_days not in (7,30,90)
 or p_until is null or p_until>now()+interval '1 minute' or p_until<now()-interval '10 years' then raise exception 'Invalid report range' using errcode='22023'; end if;
 -- Exact elapsed UTC windows match the existing Pulse action comparison contract.
 v_from:=p_until-(p_days*interval '24 hours'); v_previous:=v_from-(p_days*interval '24 hours');
 if p_kind in ('venue','property') then
  select name into v_name from public.venues where id=p_id and (p_kind='venue' or discovery_vertical='accommodation');
  if v_name is null or not public.is_venue_member(p_id,array['owner','manager']::public.venue_member_role[]) then raise exception 'Location management required' using errcode='42501'; end if;
  v_venues:=array[p_id];
 elsif p_kind='fleet' then
  if not public.can_manage_rental_company(p_id) then raise exception 'Branch management required' using errcode='42501'; end if;
  select name into v_name from public.car_rental_companies where id=p_id;
  select count(*) into v_vehicles from public.car_rental_vehicles where company_id=p_id and active;
 else
  if not public.can_manage_operating_organisation(p_id) then raise exception 'Organisation management required' using errcode='42501'; end if;
  select name into v_name from public.operating_organisations where id=p_id and status='active';
  if v_name is null then raise exception 'Active organisation required' using errcode='42501'; end if;
  select count(*) into v_total from public.operating_organisation_locations where organisation_id=p_id;
  if v_total>100 then raise exception 'Organisation exceeds report scope; inspect individual locations' using errcode='54000'; end if;
  -- Only the explicit source_venue_id is an ownership link. CRM leads/catalogue imports are not.
  select coalesce(array_agg(distinct w.source_venue_id) filter(where w.source_venue_id is not null and w.status in ('active','trial') and public.is_venue_member(w.source_venue_id,array['owner','manager']::public.venue_member_role[])),'{}'),
   count(*) filter(where w.source_venue_id is null or w.status not in ('active','trial') or not public.is_venue_member(w.source_venue_id,array['owner','manager']::public.venue_member_role[]))
   into v_venues,v_excluded from public.operating_organisation_locations l join public.crm_workspaces w on w.id=l.workspace_id where l.organisation_id=p_id;
 end if;
 if p_kind<>'fleet' then
  select count(*) into v_units from public.accommodation_units where venue_id=any(v_venues) and active;
  with actions as (
   select a.action::text as action,count(*) filter(where a.occurred_at>=v_from) as current,count(*) filter(where a.occurred_at<v_from) as previous
   from public.analytics_events a where a.venue_id=any(v_venues) and a.occurred_at>=v_previous and a.occurred_at<p_until group by a.action
  ) select coalesce(jsonb_agg(to_jsonb(actions) order by action),'[]') into v_interactions from actions;
 end if;
 with facts as (
  select 'venue'::text source,case when created_at>=v_from then 'current' else 'previous' end period,status::text status
   from public.booking_requests where venue_id=any(v_venues) and created_at>=v_previous and created_at<p_until
  union all
  select 'accommodation',case when created_at>=v_from then 'current' else 'previous' end,status
   from public.accommodation_reservations where venue_id=any(v_venues) and created_at>=v_previous and created_at<p_until
  union all
  select 'fleet',case when b.created_at>=v_from then 'current' else 'previous' end,b.status
   from public.car_rental_bookings b join public.car_rental_vehicles v on v.id=b.vehicle_id
   where p_kind='fleet' and v.company_id=p_id and b.created_at>=v_previous and b.created_at<p_until
 ), grouped as (select source,period,status,count(*) total from facts group by source,period,status)
 select coalesce(jsonb_agg(to_jsonb(grouped) order by source,period,status),'[]') into v_bookings from grouped;
 if jsonb_array_length(v_bookings)>128 or jsonb_array_length(v_interactions)>32 then raise exception 'Report shape exceeds reviewed bounds' using errcode='54000'; end if;
 return jsonb_build_object('version',1,'kind',p_kind,'id',p_id,'name',v_name,
  'period',jsonb_build_object('days',p_days,'until',p_until,'current_from',v_from,'previous_from',v_previous),
  'coverage',jsonb_build_object('measured_venues',cardinality(v_venues),'excluded_locations',v_excluded,'current_active_units',v_units,'current_active_vehicles',v_vehicles),
  'bookings',v_bookings,'interactions',v_interactions,'revenue_available',false,
  'commercial_funnel',jsonb_build_object('available',false,'reason','no_scoped_verified_attribution_adapter'),'acquisition_sources',jsonb_build_object('available',false));
end $$;
revoke all on function public.akipulse_scope_analytics(text,uuid,integer,timestamptz) from public,anon;
grant execute on function public.akipulse_scope_analytics(text,uuid,integer,timestamptz) to authenticated;
comment on function public.akipulse_scope_analytics(text,uuid,integer,timestamptz) is 'Management-only booking-created cohorts, current statuses, scoped actions. No paid revenue, historical occupancy, causal funnel or invented acquisition source. Organisation coverage excludes resources without explicit linkage and individual management access.';
commit;

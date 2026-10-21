begin;
create function public.akipulse_native_property_report(p_id uuid,p_days integer,p_until timestamptz) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare title text; units integer; bookings jsonb; start_at timestamptz; previous_at timestamptz;
begin
 if auth.uid() is null or public.account_features_allowed() is distinct from true then raise exception 'Account access required' using errcode='42501';end if;
 if p_id is null or p_days is null or p_days not in(7,30,90) or p_until is null or p_until>now()+interval '1 minute' or p_until<now()-interval '10 years' then raise exception 'Invalid report range' using errcode='22023';end if;
 if to_regprocedure('public.can_manage_accommodation_inventory(uuid)') is null or to_regclass('public.accommodation_property_reservations') is null or to_regclass('public.pulse_native_reservations_time') is null then raise exception 'Native inventory reporting not installed' using errcode='55000';end if;
 if public.akipulse_native_inventory_ready() is distinct from true then raise exception 'Native inventory reporting not active' using errcode='55000';end if;
 if public.can_manage_accommodation_inventory(p_id) is distinct from true then raise exception 'Property inventory manager required' using errcode='42501';end if;
 select name into title from public.accommodation_properties where id=p_id;
 if title is null then raise exception 'Property inventory manager required' using errcode='42501';end if;
 start_at:=p_until-(p_days*interval '24 hours');previous_at:=start_at-(p_days*interval '24 hours');
 select count(*) into units from public.accommodation_property_units where property_id=p_id and active;
 select coalesce(jsonb_agg(to_jsonb(g) order by period,status),'[]') into bookings from (
 select 'native_accommodation'::text source,case when created_at>=start_at then 'current' else 'previous' end period,status,count(*) total
 from public.accommodation_property_reservations where property_id=p_id and created_at>=previous_at and created_at<p_until group by 2,3)g;
 return jsonb_build_object('version',1,'kind','native_property','id',p_id,'name',title,
 'period',jsonb_build_object('days',p_days,'until',p_until,'current_from',start_at,'previous_from',previous_at),
 'coverage',jsonb_build_object('measured_venues',0,'measured_native_properties',1,'native_reporting_available',true,'excluded_locations',0,'current_active_units',units,'current_active_vehicles',null),
 'bookings',bookings,'interactions','[]'::jsonb,'revenue_available',false,'commercial_funnel',jsonb_build_object('available',false,'reason','no_scoped_verified_attribution_adapter'),'acquisition_sources',jsonb_build_object('available',false));
end $$;
revoke all on function public.akipulse_native_property_report(uuid,integer,timestamptz) from public,anon;
grant execute on function public.akipulse_native_property_report(uuid,integer,timestamptz) to authenticated;
-- Time index is installed separately after native inventory; migration remains valid before foundation.
do $$begin if to_regclass('public.accommodation_property_reservations') is not null then execute 'create index if not exists pulse_native_reservations_time on public.accommodation_property_reservations(property_id,created_at)';end if;end $$;
commit;

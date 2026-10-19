-- Forward-only hardening: no deletion or adjustment of earned balances.
begin;
alter table public.reward_claims add column if not exists stamp_cost integer check(stamp_cost>0);
update public.reward_claims c set stamp_cost=p.stamps_required from public.loyalty_programs p where c.program_id=p.id and c.stamp_cost is null;

create or replace function public.claim_stamp_reward(p_program uuid,p_reward uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare v_profile uuid:=auth.uid();v_required int;v_balance bigint;v_window int;v_claim reward_claims%rowtype;
begin
 if v_profile is null then raise exception 'authentication required';end if;
 perform 1 from profiles where id=v_profile for update;
 select p.stamps_required,r.claim_window_days into v_required,v_window from loyalty_programs p join loyalty_program_rewards l on l.program_id=p.id join business_rewards r on r.id=l.reward_id where p.id=p_program and r.id=p_reward and p.venue_id=r.venue_id and p.active and r.active;
 if v_required is null then raise exception 'reward unavailable';end if;
 update reward_claims set status='expired' where profile_id=v_profile and program_id=p_program and status='ready' and expires_at<=now();
 select * into v_claim from reward_claims where profile_id=v_profile and program_id=p_program and status='ready' order by created_at limit 1;
 if v_claim.id is not null then
  if v_claim.reward_id=p_reward then return v_claim.id;end if;
  raise exception 'claim already ready';
 end if;
 select coalesce(sum(delta),0) into v_balance from loyalty_ledger where profile_id=v_profile and program_id=p_program;
 if v_balance<v_required then raise exception 'not enough stamps';end if;
 insert into reward_claims(profile_id,reward_id,program_id,stamp_cost,expires_at) values(v_profile,p_reward,p_program,v_required,now()+make_interval(days=>v_window)) returning * into v_claim;
 return v_claim.id;
end $$;

create or replace function public.claim_passport_reward(p_enrollment uuid,p_reward uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare v_profile uuid:=auth.uid();v_window int;v_claim reward_claims%rowtype;
begin
 if v_profile is null then raise exception 'authentication required';end if;
 perform 1 from profiles where id=v_profile for update;
 select * into v_claim from reward_claims where profile_id=v_profile and enrollment_id=p_enrollment and status in('ready','redeemed') order by created_at limit 1;
 if v_claim.id is not null then
  if v_claim.reward_id=p_reward and (v_claim.status='redeemed' or v_claim.expires_at>now()) then return v_claim.id;end if;
  raise exception 'passport reward already claimed';
 end if;
 select r.claim_window_days into v_window from passport_enrollments e join passport_rewards pr on pr.passport_id=e.passport_id join business_rewards r on r.id=pr.reward_id
 where e.id=p_enrollment and e.profile_id=v_profile and e.state='completed' and e.expires_at>now() and r.id=p_reward and r.active and (pr.access_tier='free' or has_active_entitlement(v_profile,'premium'));
 if v_window is null then raise exception 'reward unavailable';end if;
 insert into reward_claims(profile_id,reward_id,enrollment_id,expires_at) values(v_profile,p_reward,p_enrollment,now()+make_interval(days=>v_window)) returning * into v_claim;
 update passport_enrollments set state='redeemed' where id=p_enrollment;
 return v_claim.id;
end $$;

create or replace function public.redeem_reward_claim(p_code uuid) returns void language plpgsql security definer set search_path=public as $$
declare v reward_claims%rowtype;v_required int;v_balance bigint;
begin
 if auth.uid() is null then raise exception 'authentication required';end if;
 select * into v from reward_claims where claim_code=p_code;
 if v.id is null then raise exception 'claim unavailable';end if;
 if not exists(select 1 from business_rewards r where r.id=v.reward_id and is_venue_member(r.venue_id)) then raise exception 'venue access required';end if;
 -- Always acquire balance lock before claim lock; issuance follows this order too.
 perform 1 from profiles where id=v.profile_id for update;
 select * into v from reward_claims where claim_code=p_code for update;
 if v.status='redeemed' then return;end if;
 if v.status<>'ready' or v.expires_at<=now() then raise exception 'claim unavailable';end if;
 if v.program_id is not null then
  select coalesce(v.stamp_cost,p.stamps_required) into v_required from loyalty_programs p where p.id=v.program_id;
  if v_required is null or v_required<1 then raise exception 'invalid reward cost';end if;
  select coalesce(sum(delta),0) into v_balance from loyalty_ledger where profile_id=v.profile_id and program_id=v.program_id;
  if v_balance<v_required then raise exception 'stamp balance changed';end if;
  insert into loyalty_ledger(profile_id,program_id,delta,reason) values(v.profile_id,v.program_id,-v_required,'reward_redeemed');
 end if;
 update reward_claims set status='redeemed',redeemed_at=now() where id=v.id;
end $$;
revoke all on function public.claim_stamp_reward(uuid,uuid),public.claim_passport_reward(uuid,uuid),public.redeem_reward_claim(uuid) from public,anon;
grant execute on function public.claim_stamp_reward(uuid,uuid),public.claim_passport_reward(uuid,uuid),public.redeem_reward_claim(uuid) to authenticated;
create or replace function check_in_by_token(p_token uuid,p_idempotency_key uuid,p_latitude float8,p_longitude float8,p_accuracy_meters integer) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_profile uuid:=auth.uid();v_credential venue_checkin_credentials%rowtype;v_venue venues%rowtype;v_check uuid;v_existing check_ins%rowtype;
 v_count int;v_xp int;v_distance float8;v_program record;v_step record;v_awarded int:=0;v_passports int:=0;
begin
 if v_profile is null then raise exception 'authentication required';end if;
 if p_token is null or p_idempotency_key is null then raise exception 'token and idempotency key required';end if;
 if p_latitude is null or p_longitude is null or p_accuracy_meters is null or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 or p_accuracy_meters not between 0 and 500 then raise exception 'valid precise location required';end if;
 -- Serialize all loyalty mutations for a person, including different QR codes.
 perform 1 from profiles where id=v_profile for update;
 select * into v_credential from venue_checkin_credentials where token=p_token and active for update;
 if v_credential.id is null then raise exception 'invalid check-in token';end if;
 select * into v_venue from venues where id=v_credential.venue_id;
 if v_venue.location is null or v_venue.status<>'published' or not coalesce(v_venue.verified,false) then raise exception 'verified venue location required';end if;
 v_distance:=st_distance(v_venue.location,st_setsrid(st_makepoint(p_longitude,p_latitude),4326)::geography);
 if v_distance is null or not(v_distance between 0 and 40000000) then raise exception 'valid venue distance required';end if;
 select * into v_existing from check_ins where profile_id=v_profile and idempotency_key=p_idempotency_key;
 if v_existing.id is not null then
  if v_existing.venue_id<>v_venue.id then raise exception 'idempotency key belongs to another venue';end if;
  return jsonb_build_object('state',case when 'outside_geofence'=any(v_existing.risk_flags) then 'outside_geofence' else v_existing.state::text end,'check_in_id',v_existing.id);end if;
 if v_distance>greatest(100,least(250,p_accuracy_meters+100)) then
  insert into check_ins(profile_id,venue_id,idempotency_key,state,risk_flags,distance_meters,location_accuracy_meters,credential_id) values(v_profile,v_venue.id,p_idempotency_key,'duplicate',array['outside_geofence'],round(v_distance),p_accuracy_meters,v_credential.id) returning id into v_check;
  return jsonb_build_object('state','outside_geofence','check_in_id',v_check,'distance_meters',round(v_distance));end if;
 select count(*) into v_count from check_ins where profile_id=v_profile and state='accepted' and created_at>now()-interval '24 hours';
 if v_count>=20 then insert into check_ins(profile_id,venue_id,idempotency_key,state,risk_flags,credential_id) values(v_profile,v_venue.id,p_idempotency_key,'rate_limited',array['daily_limit'],v_credential.id) returning id into v_check;return jsonb_build_object('state','rate_limited','check_in_id',v_check);end if;
 if exists(select 1 from check_ins where profile_id=v_profile and venue_id=v_venue.id and state='accepted' and created_at>now()-interval '6 hours') then
  insert into check_ins(profile_id,venue_id,idempotency_key,state,risk_flags,credential_id) values(v_profile,v_venue.id,p_idempotency_key,'cooldown',array['venue_cooldown'],v_credential.id) returning id into v_check;return jsonb_build_object('state','cooldown','check_in_id',v_check);end if;
 v_xp:=case when has_active_entitlement(v_profile,'premium') then 20 else 10 end;
 insert into check_ins(profile_id,venue_id,idempotency_key,state,distance_meters,location_accuracy_meters,credential_id) values(v_profile,v_venue.id,p_idempotency_key,'accepted',round(v_distance),p_accuracy_meters,v_credential.id) returning id into v_check;
 for v_program in select id from loyalty_programs where venue_id=v_venue.id and active loop
  insert into loyalty_ledger(profile_id,program_id,check_in_id,delta,reason) values(v_profile,v_program.id,v_check,1,'check_in') on conflict do nothing;v_awarded:=v_awarded+1;end loop;
 insert into xp_ledger(profile_id,check_in_id,delta,reason,idempotency_key) values(v_profile,v_check,v_xp,case when v_xp=20 then 'premium_check_in' else 'check_in' end,'check_in:'||v_check);
 for v_step in select s.id,s.passport_id,e.id enrollment_id from passport_steps s join passport_enrollments e on e.passport_id=s.passport_id and e.profile_id=v_profile and e.state='active' and e.expires_at>now() where s.venue_id=v_venue.id loop
  insert into passport_progress(profile_id,step_id,check_in_id,enrollment_id) values(v_profile,v_step.id,v_check,v_step.enrollment_id) on conflict do nothing;
  if found then v_passports:=v_passports+1;end if;
  if not exists(select 1 from passport_steps s where s.passport_id=v_step.passport_id and not exists(select 1 from passport_progress pp where pp.enrollment_id=v_step.enrollment_id and pp.step_id=s.id)) then update passport_enrollments set state='completed',completed_at=coalesce(completed_at,now()) where id=v_step.enrollment_id;end if;
 end loop;
 return jsonb_build_object('state','accepted','check_in_id',v_check,'stamp_cards_credited',v_awarded,'passports_credited',v_passports,'xp_awarded',v_xp,'distance_meters',round(v_distance));
end$$;
revoke all on function check_in_by_token(uuid,uuid,float8,float8,integer) from public,anon;
grant execute on function check_in_by_token(uuid,uuid,float8,float8,integer) to authenticated;


-- Aggregate only; never expose visitor identifiers or demographics here.
create or replace function public.venue_owner_results(p_venue uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
 if auth.uid() is null or not is_venue_member(p_venue) then raise exception 'venue access required';end if;
 select jsonb_build_object(
 'days',30,'listing_views',count(*) filter(where event_type='venue_opened'),
 'event_views',count(*) filter(where event_type='event_opened'),
 'directions',count(*) filter(where event_type in('venue_directions_clicked','event_directions_clicked')),
 'website_clicks',count(*) filter(where event_type in('venue_website_clicked','event_booking_clicked')),
 'contact_clicks',count(*) filter(where event_type in('venue_phone_clicked','venue_whatsapp_clicked'))
 ) into result from behaviour_events b
 where b.received_at>=now()-interval '30 days' and
 ((b.entity_type='venue' and b.entity_id=p_venue) or (b.entity_type='event' and b.entity_id in(select id from events where venue_id=p_venue)));
 return result || jsonb_build_object(
 'accepted_checkins',(select count(*) from check_ins where venue_id=p_venue and state='accepted' and created_at>=now()-interval '30 days'),
 'rewards_redeemed',(select count(*) from reward_claims c join business_rewards r on r.id=c.reward_id where r.venue_id=p_venue and c.status='redeemed' and c.redeemed_at>=now()-interval '30 days')
 );
end $$;
revoke all on function public.venue_owner_results(uuid) from public,anon;
grant execute on function public.venue_owner_results(uuid) to authenticated;
create or replace function public.public_stay_viewport(p_west float8,p_east float8,p_south float8,p_north float8,p_type text default 'all',p_query text default '')
returns jsonb language plpgsql stable security invoker set search_path=public as $$
declare result jsonb;
begin
 if p_west is null or p_east is null or p_south is null or p_north is null or not(p_west between -180 and 180 and p_east between -180 and 180 and p_south between -85 and 85 and p_north between -85 and 85 and p_west<p_east and p_south<p_north) then raise exception 'invalid bounds';end if;
 select jsonb_build_object('markers',coalesce(jsonb_agg(jsonb_build_array(v.id,st_x(v.location::geometry),st_y(v.location::geometry),case when v.verified then 1 else 0 end,1)),'[]'::jsonb),'truncated',count(*)>1000) into result from (
 select id,location,verified from venues where status='published' and discovery_vertical='accommodation' and (p_type='all' or accommodation_type=p_type)
 and location && st_makeenvelope(p_west,p_south,p_east,p_north,4326)::geography
 and (coalesce(trim(p_query),'')='' or venue_search_normalize(name||' '||coalesce(address,'')) like '%'||replace(replace(venue_search_normalize(left(p_query,100)),'%',''), '_','')||'%')
 order by id limit 1001) v;
 return result;
end $$;
revoke all on function public.public_stay_viewport(float8,float8,float8,float8,text,text) from public;
grant execute on function public.public_stay_viewport(float8,float8,float8,float8,text,text) to anon,authenticated,service_role;
create index if not exists behaviour_events_owner_results_idx on public.behaviour_events(entity_type,entity_id,received_at);
create or replace function public.public_product_release_ready() returns jsonb language sql stable security definer set search_path='' as $$
select jsonb_build_object('release','2026-09-26-product-readiness', 'database_ready',
 exists(select 1 from information_schema.columns where table_schema='public' and table_name='billing_subscriptions' and column_name='stripe_event_created_at')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='membership_tier')
 and exists(select 1 from pg_catalog.pg_trigger where tgrelid='public.billing_subscriptions'::regclass and tgname='billing_subscriptions_reconcile_profile' and tgenabled<>'D')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reward_claims' and column_name='stamp_cost')
 and pg_catalog.to_regprocedure('public.search_public_venues(text,integer,integer)') is not null
 and pg_catalog.to_regprocedure('public.venue_owner_results(uuid)') is not null
 and pg_catalog.to_regprocedure('public.public_stay_viewport(double precision,double precision,double precision,double precision,text,text)') is not null);
$$;
revoke all on function public.public_product_release_ready() from public,anon,authenticated;
grant execute on function public.public_product_release_ready() to service_role;
commit;

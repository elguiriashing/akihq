-- product contract migration
begin;

alter table profiles
  add column if not exists username text,
  add column if not exists avatar_url text,
  add column if not exists banner_url text,
  add column if not exists bio text,
  add column if not exists public_email text,
  add column if not exists phone text,
  add column if not exists website_url text,
  add column if not exists instagram_url text,
  add column if not exists locality text,
  add column if not exists province text,
  add column if not exists birth_year smallint,
  add column if not exists gender text,
  add column if not exists profile_visibility text not null default 'public',
  add column if not exists contact_visibility text not null default 'private',
  add column if not exists attendance_visibility text not null default 'private';
create unique index if not exists profiles_username_unique on profiles(lower(username)) where username is not null;
alter table profiles add constraint profiles_username_format check(username is null or username ~ '^[a-zA-Z0-9_]{3,30}$');
alter table profiles add constraint profiles_public_urls check(
  (avatar_url is null or avatar_url ~ '^https://') and (banner_url is null or banner_url ~ '^https://') and
  (website_url is null or website_url ~ '^https://') and (instagram_url is null or instagram_url ~ '^https://'));
alter table profiles add constraint profiles_public_privacy_values check(
  profile_visibility in ('public','members','private') and contact_visibility in ('public','members','private') and
  attendance_visibility in ('public','members','private') and (birth_year is null or birth_year between 1900 and extract(year from current_date)::int));

create or replace function sync_profile_to_creator() returns trigger language plpgsql security definer set search_path=public as $$
begin
 update creator_profiles set display_name=new.display_name,avatar_url=coalesce(new.avatar_url,avatar_url),
 cover_url=coalesce(new.banner_url,cover_url),locality=coalesce(new.locality,locality),province=coalesce(new.province,province),
 website_url=coalesce(new.website_url,website_url),instagram_url=coalesce(new.instagram_url,instagram_url),updated_at=now()
 where profile_id=new.id; return new;
end $$;
drop trigger if exists profiles_sync_creator on profiles;
create trigger profiles_sync_creator after update of display_name,avatar_url,banner_url,locality,province,website_url,instagram_url on profiles for each row execute function sync_profile_to_creator();
revoke all on function sync_profile_to_creator() from public,anon,authenticated;

create table creator_verification_settings(
 singleton boolean primary key default true check(singleton),minimum_published_events integer not null default 3 check(minimum_published_events between 1 and 100),
 minimum_participants integer not null default 20 check(minimum_participants between 1 and 100000),updated_at timestamptz not null default now());
insert into creator_verification_settings(singleton) values(true);
alter table creator_verification_settings enable row level security;
create policy creator_verification_settings_read on creator_verification_settings for select using(true);
grant select on creator_verification_settings to authenticated;

create or replace function creator_verification_eligibility(p_profile uuid default auth.uid()) returns jsonb language sql stable security definer set search_path=public as $$
 with settings as(select * from creator_verification_settings where singleton),metrics as(
  select count(distinct e.id)::int events,count(distinct case when u.state='going' then u.profile_id end)::int participants
  from events e left join user_event_preferences u on u.event_id=e.id where e.creator_profile_id=p_profile and e.status='published')
 select jsonb_build_object('eligible',metrics.events>=settings.minimum_published_events and metrics.participants>=settings.minimum_participants,
 'published_events',metrics.events,'participants',metrics.participants,'required_events',settings.minimum_published_events,
 'required_participants',settings.minimum_participants) from settings,metrics
$$;
revoke all on function creator_verification_eligibility(uuid) from public,anon;
grant execute on function creator_verification_eligibility(uuid) to authenticated;
create or replace function request_creator_verification() returns void language plpgsql security definer set search_path=public as $$
declare v jsonb; begin v:=creator_verification_eligibility(auth.uid());
 if not coalesce((v->>'eligible')::boolean,false) then raise exception 'creator requirements not met'; end if;
 update creator_profiles set verification_state='pending',verification_note=null,updated_at=now()
 where profile_id=auth.uid() and state='published' and verification_state in ('unverified','rejected');
 if not found then raise exception 'published creator profile required'; end if;
end $$;
revoke all on function request_creator_verification() from public,anon;
grant execute on function request_creator_verification() to authenticated;

alter table loyalty_programs drop constraint if exists loyalty_programs_venue_id_key;
create table venue_checkin_credentials(
 id uuid primary key default gen_random_uuid(),venue_id uuid not null references venues(id) on delete cascade,
 token uuid not null unique default gen_random_uuid(),label text not null default 'Main QR',active boolean not null default true,
 created_by uuid references profiles(id) on delete set null,created_at timestamptz not null default now());
insert into venue_checkin_credentials(venue_id,token,label) select distinct on(venue_id) venue_id,check_in_token,'Legacy QR' from loyalty_programs on conflict(token) do nothing;
alter table venue_checkin_credentials enable row level security;
create policy venue_checkin_credentials_manage on venue_checkin_credentials for all to authenticated
 using(is_venue_member(venue_id,array['manager','owner']::venue_member_role[]) or has_platform_role(array['moderator','administrator']::app_role[]))
 with check(is_venue_member(venue_id,array['manager','owner']::venue_member_role[]) or has_platform_role(array['moderator','administrator']::app_role[]));
grant select,insert,update on venue_checkin_credentials to authenticated;
alter table check_ins add column if not exists distance_meters integer;
alter table check_ins add column if not exists location_accuracy_meters integer;
alter table check_ins add column if not exists credential_id uuid references venue_checkin_credentials(id) on delete set null;
alter table loyalty_ledger drop constraint if exists loyalty_ledger_check_in_id_key;
create unique index loyalty_ledger_checkin_program_unique on loyalty_ledger(check_in_id,program_id);

alter table passports add column if not exists access_tier text not null default 'free';
alter table passports add column if not exists completion_window_days integer not null default 30;
alter table passports add constraint passports_access_tier_check check(access_tier in('free','premium') and completion_window_days between 1 and 365);
create table passport_enrollments(
 id uuid primary key default gen_random_uuid(),profile_id uuid not null references profiles(id) on delete cascade,
 passport_id uuid not null references passports(id) on delete cascade,started_at timestamptz not null default now(),expires_at timestamptz not null,
 completed_at timestamptz,state text not null default 'active' check(state in('active','completed','expired','redeemed')),check(expires_at>started_at));
create unique index passport_one_open_enrollment on passport_enrollments(profile_id,passport_id) where state in('active','completed');
alter table passport_progress add column if not exists enrollment_id uuid references passport_enrollments(id) on delete cascade;
alter table passport_enrollments enable row level security;
create policy passport_enrollments_own_read on passport_enrollments for select to authenticated using(profile_id=auth.uid());
grant select on passport_enrollments to authenticated;

create table business_rewards(
 id uuid primary key default gen_random_uuid(),venue_id uuid not null references venues(id) on delete cascade,
 title_es text not null check(char_length(title_es) between 3 and 160),title_en text,description_es text not null check(char_length(description_es) between 3 and 1000),description_en text,
 active boolean not null default true,claim_window_days integer not null default 30 check(claim_window_days between 1 and 365),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table loyalty_program_rewards(program_id uuid not null references loyalty_programs(id) on delete cascade,reward_id uuid not null references business_rewards(id) on delete cascade,primary key(program_id,reward_id));
create table passport_rewards(passport_id uuid not null references passports(id) on delete cascade,reward_id uuid not null references business_rewards(id) on delete cascade,access_tier text not null default 'free' check(access_tier in('free','premium')),primary key(passport_id,reward_id,access_tier));
create table reward_claims(
 id uuid primary key default gen_random_uuid(),profile_id uuid not null references profiles(id) on delete cascade,reward_id uuid not null references business_rewards(id),
 program_id uuid references loyalty_programs(id),enrollment_id uuid references passport_enrollments(id),claim_code uuid not null unique default gen_random_uuid(),
 status text not null default 'ready' check(status in('ready','redeemed','expired','cancelled')),created_at timestamptz not null default now(),expires_at timestamptz not null,redeemed_at timestamptz,
 check((program_id is null)<>(enrollment_id is null)));
alter table business_rewards enable row level security; alter table loyalty_program_rewards enable row level security;
alter table passport_rewards enable row level security; alter table reward_claims enable row level security;
create policy rewards_public_read on business_rewards for select using(active or is_venue_member(venue_id));
create policy rewards_venue_manage on business_rewards for all to authenticated using(is_venue_member(venue_id,array['manager','owner']::venue_member_role[])) with check(is_venue_member(venue_id,array['manager','owner']::venue_member_role[]));
create policy loyalty_reward_read on loyalty_program_rewards for select using(true);
create policy loyalty_reward_manage on loyalty_program_rewards for all to authenticated using(exists(select 1 from loyalty_programs p where p.id=program_id and is_venue_member(p.venue_id,array['manager','owner']::venue_member_role[]))) with check(exists(select 1 from loyalty_programs p where p.id=program_id and is_venue_member(p.venue_id,array['manager','owner']::venue_member_role[])));
create policy passport_reward_read on passport_rewards for select using(true);
create policy passport_reward_manage on passport_rewards for all to authenticated using(exists(select 1 from business_rewards r where r.id=reward_id and is_venue_member(r.venue_id,array['manager','owner']::venue_member_role[]))) with check(exists(select 1 from business_rewards r join passport_steps s on s.passport_id=passport_id and s.venue_id=r.venue_id where r.id=reward_id and is_venue_member(r.venue_id,array['manager','owner']::venue_member_role[])));
create policy reward_claims_read on reward_claims for select to authenticated using(profile_id=auth.uid() or exists(select 1 from business_rewards r where r.id=reward_id and is_venue_member(r.venue_id)));
grant select on business_rewards,loyalty_program_rewards,passport_rewards,reward_claims to authenticated;
grant insert,update,delete on business_rewards,loyalty_program_rewards,passport_rewards to authenticated;

create or replace function claim_stamp_reward(p_program uuid,p_reward uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare v_profile uuid:=auth.uid();v_required int;v_balance int;v_window int;v_claim uuid;
begin
 select p.stamps_required,r.claim_window_days into v_required,v_window from loyalty_programs p join loyalty_program_rewards l on l.program_id=p.id join business_rewards r on r.id=l.reward_id where p.id=p_program and r.id=p_reward and p.active and r.active;
 if v_required is null then raise exception 'reward unavailable'; end if;
 select coalesce(sum(delta),0) into v_balance from loyalty_ledger where profile_id=v_profile and program_id=p_program;
 if v_balance<v_required then raise exception 'not enough stamps'; end if;
 if exists(select 1 from reward_claims where profile_id=v_profile and program_id=p_program and status='ready' and expires_at>now()) then raise exception 'claim already ready'; end if;
 insert into reward_claims(profile_id,reward_id,program_id,expires_at) values(v_profile,p_reward,p_program,now()+make_interval(days=>v_window)) returning id into v_claim;
 return v_claim;
end $$;
create or replace function claim_passport_reward(p_enrollment uuid,p_reward uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare v_profile uuid:=auth.uid();v_window int;v_claim uuid;
begin
 select r.claim_window_days into v_window from passport_enrollments e join passport_rewards pr on pr.passport_id=e.passport_id join business_rewards r on r.id=pr.reward_id
 where e.id=p_enrollment and e.profile_id=v_profile and e.state='completed' and r.id=p_reward and r.active and (pr.access_tier='free' or has_active_entitlement(v_profile,'premium'));
 if v_window is null then raise exception 'reward unavailable'; end if;
 insert into reward_claims(profile_id,reward_id,enrollment_id,expires_at) values(v_profile,p_reward,p_enrollment,now()+make_interval(days=>v_window)) returning id into v_claim;
 update passport_enrollments set state='redeemed' where id=p_enrollment; return v_claim;
end $$;
create or replace function redeem_reward_claim(p_code uuid) returns void language plpgsql security definer set search_path=public as $$
declare v reward_claims%rowtype;v_program loyalty_programs%rowtype;v_required int;v_balance int;
begin
 select * into v from reward_claims where claim_code=p_code and status='ready' and expires_at>now() for update;
 if v.id is null then raise exception 'claim unavailable'; end if;
 if not exists(select 1 from business_rewards r where r.id=v.reward_id and is_venue_member(r.venue_id)) then raise exception 'venue access required'; end if;
 if v.program_id is not null then select * into v_program from loyalty_programs where id=v.program_id;v_required:=v_program.stamps_required;
  select coalesce(sum(delta),0) into v_balance from loyalty_ledger where profile_id=v.profile_id and program_id=v.program_id;
  if v_balance<v_required then raise exception 'stamp balance changed'; end if;
  insert into loyalty_ledger(profile_id,program_id,delta,reason) values(v.profile_id,v.program_id,-v_required,'reward_redeemed');
 end if;
 update reward_claims set status='redeemed',redeemed_at=now() where id=v.id;
end $$;
revoke all on function claim_stamp_reward(uuid,uuid),claim_passport_reward(uuid,uuid),redeem_reward_claim(uuid) from public,anon;
grant execute on function claim_stamp_reward(uuid,uuid),claim_passport_reward(uuid,uuid),redeem_reward_claim(uuid) to authenticated;

create or replace function check_in_by_token(p_token uuid,p_idempotency_key uuid,p_latitude float8,p_longitude float8,p_accuracy_meters integer) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_profile uuid:=auth.uid();v_credential venue_checkin_credentials%rowtype;v_venue venues%rowtype;v_check uuid;v_existing check_ins%rowtype;
 v_count int;v_xp int;v_distance float8;v_program record;v_step record;v_enrollment passport_enrollments%rowtype;v_awarded int:=0;
begin
 if v_profile is null then raise exception 'authentication required'; end if;
 if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 or p_accuracy_meters not between 0 and 500 then raise exception 'valid precise location required'; end if;
 select * into v_credential from venue_checkin_credentials where token=p_token and active for update;
 if v_credential.id is null then raise exception 'invalid check-in token'; end if;
 select * into v_venue from venues where id=v_credential.venue_id;
 v_distance:=st_distance(v_venue.location,st_setsrid(st_makepoint(p_longitude,p_latitude),4326)::geography);
 select * into v_existing from check_ins where profile_id=v_profile and idempotency_key=p_idempotency_key;
 if v_existing.id is not null then return jsonb_build_object('state',v_existing.state,'check_in_id',v_existing.id); end if;
 if v_distance>greatest(100,least(250,p_accuracy_meters+100)) then
  insert into check_ins(profile_id,venue_id,idempotency_key,state,risk_flags,distance_meters,location_accuracy_meters,credential_id)
  values(v_profile,v_venue.id,p_idempotency_key,'duplicate',array['outside_geofence'],round(v_distance),p_accuracy_meters,v_credential.id) returning id into v_check;
  return jsonb_build_object('state','outside_geofence','check_in_id',v_check,'distance_meters',round(v_distance));
 end if;
 select count(*) into v_count from check_ins where profile_id=v_profile and state='accepted' and created_at>now()-interval '24 hours';
 if v_count>=20 then insert into check_ins(profile_id,venue_id,idempotency_key,state,risk_flags,credential_id) values(v_profile,v_venue.id,p_idempotency_key,'rate_limited',array['daily_limit'],v_credential.id) returning id into v_check;return jsonb_build_object('state','rate_limited','check_in_id',v_check);end if;
 if exists(select 1 from check_ins where profile_id=v_profile and venue_id=v_venue.id and state='accepted' and created_at>now()-interval '6 hours') then
  insert into check_ins(profile_id,venue_id,idempotency_key,state,risk_flags,credential_id) values(v_profile,v_venue.id,p_idempotency_key,'cooldown',array['venue_cooldown'],v_credential.id) returning id into v_check;return jsonb_build_object('state','cooldown','check_in_id',v_check);end if;
 v_xp:=case when has_active_entitlement(v_profile,'premium') then 20 else 10 end;
 insert into check_ins(profile_id,venue_id,idempotency_key,state,distance_meters,location_accuracy_meters,credential_id)
 values(v_profile,v_venue.id,p_idempotency_key,'accepted',round(v_distance),p_accuracy_meters,v_credential.id) returning id into v_check;
 for v_program in select id from loyalty_programs where venue_id=v_venue.id and active loop
  insert into loyalty_ledger(profile_id,program_id,check_in_id,delta,reason) values(v_profile,v_program.id,v_check,1,'check_in') on conflict do nothing;v_awarded:=v_awarded+1;
 end loop;
 insert into xp_ledger(profile_id,check_in_id,delta,reason,idempotency_key) values(v_profile,v_check,v_xp,case when v_xp=20 then 'premium_check_in' else 'check_in' end,'check_in:'||v_check);
 for v_step in select s.id,s.passport_id,p.completion_window_days from passport_steps s join passports p on p.id=s.passport_id
  where s.venue_id=v_venue.id and p.status='published' and now() between p.starts_at and p.ends_at and (p.access_tier='free' or has_active_entitlement(v_profile,'premium')) loop
  select * into v_enrollment from passport_enrollments where profile_id=v_profile and passport_id=v_step.passport_id and state='active' and expires_at>now() order by started_at desc limit 1;
  if v_enrollment.id is null then insert into passport_enrollments(profile_id,passport_id,expires_at) values(v_profile,v_step.passport_id,now()+make_interval(days=>v_step.completion_window_days)) returning * into v_enrollment;end if;
  insert into passport_progress(profile_id,step_id,check_in_id,enrollment_id) values(v_profile,v_step.id,v_check,v_enrollment.id) on conflict do nothing;
  if not exists(select 1 from passport_steps s where s.passport_id=v_step.passport_id and not exists(select 1 from passport_progress pp where pp.enrollment_id=v_enrollment.id and pp.step_id=s.id)) then
   update passport_enrollments set state='completed',completed_at=coalesce(completed_at,now()) where id=v_enrollment.id;
  end if;
 end loop;
 return jsonb_build_object('state','accepted','check_in_id',v_check,'stamp_cards_credited',v_awarded,'xp_awarded',v_xp,'distance_meters',round(v_distance));
end $$;
create or replace function check_in_by_token(p_token uuid,p_idempotency_key uuid) returns jsonb language plpgsql security definer set search_path=public as $$begin raise exception 'location required';end$$;
revoke all on function check_in_by_token(uuid,uuid,float8,float8,integer) from public,anon;
grant execute on function check_in_by_token(uuid,uuid,float8,float8,integer) to authenticated;
revoke all on function check_in_by_token(uuid,uuid) from public,anon,authenticated;

create or replace function venue_event_audience_summary(p_venue uuid) returns table(event_id uuid,going_count bigint,age_bands jsonb,gender_mix jsonb,language_mix jsonb)
language plpgsql stable security definer set search_path=public as $$
begin
 if not is_venue_member(p_venue) then raise exception 'venue access required';end if;
 return query select e.id,count(*) filter(where u.state='going'),
  case when count(*) filter(where u.state='going')>=5 then (select jsonb_object_agg(k,c) from(select coalesce(((extract(year from current_date)::int-p2.birth_year)/10*10)::text||'s','unspecified') k,count(*) c from user_event_preferences u2 join profiles p2 on p2.id=u2.profile_id where u2.event_id=e.id and u2.state='going' group by 1)x) else '{}'::jsonb end,
  case when count(*) filter(where u.state='going')>=5 then (select jsonb_object_agg(k,c) from(select coalesce(p2.gender,'unspecified') k,count(*) c from user_event_preferences u2 join profiles p2 on p2.id=u2.profile_id where u2.event_id=e.id and u2.state='going' group by 1)x) else '{}'::jsonb end,
  case when count(*) filter(where u.state='going')>=5 then (select jsonb_object_agg(k,c) from(select coalesce(p2.preferred_locale::text,'unspecified') k,count(*) c from user_event_preferences u2 join profiles p2 on p2.id=u2.profile_id where u2.event_id=e.id and u2.state='going' group by 1)x) else '{}'::jsonb end
 from events e left join user_event_preferences u on u.event_id=e.id where e.venue_id=p_venue group by e.id;
end$$;
revoke all on function venue_event_audience_summary(uuid) from public,anon;
grant execute on function venue_event_audience_summary(uuid) to authenticated;

create or replace function undo_event_preference_signal(p_event uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 delete from behaviour_events where event_id in(
  select event_id from behaviour_events where profile_id=auth.uid() and entity_type='event' and entity_id=p_event
  and event_type in('event_going','event_not_interested') order by occurred_at desc limit 1);
end$$;
revoke all on function undo_event_preference_signal(uuid) from public,anon;
grant execute on function undo_event_preference_signal(uuid) to authenticated;

commit;

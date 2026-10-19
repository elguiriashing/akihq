-- Complete the visible user, loyalty, booking, and premium product contract.
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-media', 'profile-media', true, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists profile_media_insert on storage.objects;
create policy profile_media_insert on storage.objects for insert to authenticated with check(
 bucket_id='profile-media' and (storage.foldername(name))[1]=auth.uid()::text and storage.extension(name) in ('jpg','jpeg','png','webp'));
drop policy if exists profile_media_update on storage.objects;
create policy profile_media_update on storage.objects for update to authenticated using(
 bucket_id='profile-media' and owner_id=auth.uid()::text) with check(bucket_id='profile-media' and owner_id=auth.uid()::text);
drop policy if exists profile_media_delete on storage.objects;
create policy profile_media_delete on storage.objects for delete to authenticated using(bucket_id='profile-media' and owner_id=auth.uid()::text);

create table if not exists premium_appearance_preferences(
 profile_id uuid primary key references profiles(id) on delete cascade,
 theme text not null default 'sunset' check(theme in('sunset','aurora','midnight','paper','canvas','custom')),
 font text not null default 'brand' check(font in('brand','rounded','editorial','system')),
 app_icon text not null default 'classic' check(app_icon in('classic','sunset','night','mint')),
 custom_background_url text,updated_at timestamptz not null default now(),
 check(custom_background_url is null or custom_background_url ~ '^https://')
);
alter table premium_appearance_preferences enable row level security;
drop policy if exists premium_appearance_own on premium_appearance_preferences;
create policy premium_appearance_own on premium_appearance_preferences for all to authenticated
 using(profile_id=auth.uid()) with check(profile_id=auth.uid() and has_active_entitlement(auth.uid(),'premium'));
grant select,insert,update,delete on premium_appearance_preferences to authenticated;

create table if not exists calendar_preferences(
 profile_id uuid primary key references profiles(id) on delete cascade,
 provider text not null default 'download' check(provider in('download','google','outlook','apple')),updated_at timestamptz not null default now());
alter table calendar_preferences enable row level security;
drop policy if exists calendar_preferences_own on calendar_preferences;
create policy calendar_preferences_own on calendar_preferences for all to authenticated using(profile_id=auth.uid()) with check(profile_id=auth.uid());
grant select,insert,update on calendar_preferences to authenticated;

create table if not exists venue_booking_settings(
 venue_id uuid primary key references venues(id) on delete cascade,
 mode text not null default 'external' check(mode in('external','request','disabled')),
 requires_deposit boolean not null default false,deposit_cents integer check(deposit_cents is null or deposit_cents between 0 and 1000000),
 currency text not null default 'EUR' check(currency ~ '^[A-Z]{3}$'),instructions_es text,instructions_en text,
 active boolean not null default true,updated_at timestamptz not null default now(),check(not requires_deposit or deposit_cents is not null));
create table if not exists venue_availability_slots(
 id uuid primary key default gen_random_uuid(),venue_id uuid not null references venues(id) on delete cascade,
 starts_at timestamptz not null,ends_at timestamptz not null,capacity integer not null default 1 check(capacity between 1 and 10000),
 active boolean not null default true,created_at timestamptz not null default now(),check(ends_at>starts_at));
create table if not exists booking_requests(
 id uuid primary key default gen_random_uuid(),profile_id uuid not null references profiles(id) on delete cascade,
 venue_id uuid not null references venues(id) on delete cascade,event_id uuid references events(id) on delete set null,
 slot_id uuid references venue_availability_slots(id) on delete set null,party_size integer not null check(party_size between 1 and 100),
 contact_name text not null check(char_length(contact_name) between 2 and 120),contact_email text not null,contact_phone text,notes text,
 status text not null default 'requested' check(status in('requested','confirmed','declined','cancelled','completed')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now());
alter table venue_booking_settings enable row level security;alter table venue_availability_slots enable row level security;alter table booking_requests enable row level security;
create policy booking_settings_public_read on venue_booking_settings for select using(active or is_venue_member(venue_id));
create policy booking_settings_manage on venue_booking_settings for all to authenticated using(is_venue_member(venue_id,array['manager','owner']::venue_member_role[])) with check(is_venue_member(venue_id,array['manager','owner']::venue_member_role[]));
create policy booking_slots_public_read on venue_availability_slots for select using((active and starts_at>now()) or is_venue_member(venue_id));
create policy booking_slots_manage on venue_availability_slots for all to authenticated using(is_venue_member(venue_id,array['manager','owner']::venue_member_role[])) with check(is_venue_member(venue_id,array['manager','owner']::venue_member_role[]));
create policy booking_requests_read on booking_requests for select to authenticated using(profile_id=auth.uid() or is_venue_member(venue_id));
create policy booking_requests_update on booking_requests for update to authenticated using(profile_id=auth.uid() or is_venue_member(venue_id)) with check(profile_id=auth.uid() or is_venue_member(venue_id));
grant select on venue_booking_settings,venue_availability_slots to anon,authenticated;
grant insert,update,delete on venue_booking_settings,venue_availability_slots to authenticated;
grant select,update on booking_requests to authenticated;

create or replace function request_booking(p_slot uuid,p_event uuid,p_party_size integer,p_name text,p_email text,p_phone text,p_notes text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_profile uuid:=auth.uid();v_slot venue_availability_slots%rowtype;v_venue uuid;v_booked integer;v_id uuid;
begin
 if v_profile is null then raise exception 'authentication required';end if;
 if p_party_size not between 1 and 100 or char_length(trim(p_name)) not between 2 and 120 or position('@' in p_email)<2 then raise exception 'invalid booking details';end if;
 select * into v_slot from venue_availability_slots where id=p_slot and active and starts_at>now() for update;
 if v_slot.id is null then raise exception 'slot unavailable';end if;
 select venue_id into v_venue from venue_booking_settings where venue_id=v_slot.venue_id and active and mode='request';
 if v_venue is null then raise exception 'booking unavailable';end if;
 if p_event is not null and not exists(select 1 from events where id=p_event and venue_id=v_venue and status='published') then raise exception 'event unavailable';end if;
 select coalesce(sum(party_size),0)::integer into v_booked from booking_requests where slot_id=p_slot and status in('requested','confirmed');
 if v_booked+p_party_size>v_slot.capacity then raise exception 'slot full';end if;
 insert into booking_requests(profile_id,venue_id,event_id,slot_id,party_size,contact_name,contact_email,contact_phone,notes)
 values(v_profile,v_venue,p_event,p_party_size,trim(p_name),lower(trim(p_email)),nullif(trim(p_phone),''),nullif(trim(p_notes),'')) returning id into v_id;
 return v_id;
end$$;
revoke all on function request_booking(uuid,uuid,integer,text,text,text,text) from public,anon;
grant execute on function request_booking(uuid,uuid,integer,text,text,text,text) to authenticated;

create or replace function enroll_in_passport(p_passport uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare v_profile uuid:=auth.uid();v_passport passports%rowtype;v_id uuid;
begin
 if v_profile is null then raise exception 'authentication required';end if;
 update passport_enrollments set state='expired' where profile_id=v_profile and state='active' and expires_at<=now();
 select * into v_passport from passports where id=p_passport and status='published' and now() between starts_at and ends_at;
 if v_passport.id is null or (v_passport.access_tier='premium' and not has_active_entitlement(v_profile,'premium')) then raise exception 'passport unavailable';end if;
 select id into v_id from passport_enrollments where profile_id=v_profile and passport_id=p_passport and state in('active','completed') order by started_at desc limit 1;
 if v_id is not null then return v_id;end if;
 insert into passport_enrollments(profile_id,passport_id,expires_at) values(v_profile,p_passport,least(v_passport.ends_at,now()+make_interval(days=>v_passport.completion_window_days))) returning id into v_id;
 return v_id;
end$$;
revoke all on function enroll_in_passport(uuid) from public,anon;
grant execute on function enroll_in_passport(uuid) to authenticated;

create or replace function event_public_engagement(p_event uuid) returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('going',count(*) filter(where state='going')) from user_event_preferences where event_id=p_event
$$;
revoke all on function event_public_engagement(uuid) from public;
grant execute on function event_public_engagement(uuid) to anon,authenticated;

create or replace function check_in_by_token(p_token uuid,p_idempotency_key uuid,p_latitude float8,p_longitude float8,p_accuracy_meters integer) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_profile uuid:=auth.uid();v_credential venue_checkin_credentials%rowtype;v_venue venues%rowtype;v_check uuid;v_existing check_ins%rowtype;
 v_count int;v_xp int;v_distance float8;v_program record;v_step record;v_awarded int:=0;v_passports int:=0;
begin
 if v_profile is null then raise exception 'authentication required';end if;
 if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 or p_accuracy_meters not between 0 and 500 then raise exception 'valid precise location required';end if;
 select * into v_credential from venue_checkin_credentials where token=p_token and active for update;
 if v_credential.id is null then raise exception 'invalid check-in token';end if;
 select * into v_venue from venues where id=v_credential.venue_id;
 v_distance:=st_distance(v_venue.location,st_setsrid(st_makepoint(p_longitude,p_latitude),4326)::geography);
 select * into v_existing from check_ins where profile_id=v_profile and idempotency_key=p_idempotency_key;
 if v_existing.id is not null then return jsonb_build_object('state',v_existing.state,'check_in_id',v_existing.id);end if;
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

commit;

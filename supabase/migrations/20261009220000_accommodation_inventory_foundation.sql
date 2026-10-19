-- AkiDuermo room-night inventory foundation. No public booking permissions are granted.
-- Not enabled until the application and transaction suites have passed.
begin;
create extension if not exists btree_gist;

create table if not exists public.accommodation_room_types (
 id uuid primary key default gen_random_uuid(),
 venue_id uuid not null references public.venues(id) on delete cascade,
 name text not null check (char_length(btrim(name)) between 2 and 120),
 max_guests integer not null check (max_guests between 1 and 30),
 active boolean not null default true,
 created_at timestamptz not null default now(),
 unique (id, venue_id)
);

create table if not exists public.accommodation_units (
 id uuid primary key default gen_random_uuid(),
 venue_id uuid not null references public.venues(id) on delete cascade,
 room_type_id uuid not null,
 name text not null check (char_length(btrim(name)) between 1 and 120),
 active boolean not null default true,
 created_at timestamptz not null default now(),
 foreign key (room_type_id,venue_id) references public.accommodation_room_types(id,venue_id),
 unique (id,venue_id),
 unique (venue_id,name)
);

create table if not exists public.accommodation_nightly_rates (
 id uuid primary key default gen_random_uuid(),
 venue_id uuid not null references public.venues(id) on delete cascade,
 room_type_id uuid not null,
 start_date date not null,
 end_date_exclusive date not null,
 nightly_price_cents integer not null check (nightly_price_cents >= 0),
 minimum_nights integer not null default 1 check (minimum_nights between 1 and 365),
 check (start_date < end_date_exclusive),
 foreign key (room_type_id,venue_id) references public.accommodation_room_types(id,venue_id),
 exclude using gist (room_type_id with =, daterange(start_date,end_date_exclusive,'[)') with &&)
);

create table if not exists public.accommodation_reservations (
 id uuid primary key default gen_random_uuid(),
 venue_id uuid not null references public.venues(id) on delete cascade,
 unit_id uuid not null,
 check_in date not null,
 check_out date not null,
 guests integer not null check (guests between 1 and 30),
 status text not null default 'requested'
  check (status in ('requested','confirmed','checked_in','completed','cancelled','declined')),
 contact_name text not null check (char_length(btrim(contact_name)) between 2 and 120),
 contact_email text not null,
 quoted_total_cents integer not null check (quoted_total_cents >= 0),
 quote_snapshot jsonb not null default '{}'::jsonb,
 idempotency_key uuid not null,
 created_at timestamptz not null default now(),
 check (check_in < check_out),
 foreign key (unit_id,venue_id) references public.accommodation_units(id,venue_id),
 unique (venue_id,idempotency_key),
 exclude using gist (unit_id with =, daterange(check_in,check_out,'[)') with &&)
  where (status in ('requested','confirmed','checked_in'))
);

create table if not exists public.accommodation_unit_blocks (
 id uuid primary key default gen_random_uuid(),
 venue_id uuid not null references public.venues(id) on delete cascade,
 unit_id uuid not null,
 start_date date not null,
 end_date_exclusive date not null,
 reason text not null default 'maintenance',
 check (start_date < end_date_exclusive),
 foreign key (unit_id,venue_id) references public.accommodation_units(id,venue_id),
 exclude using gist (unit_id with =, daterange(start_date,end_date_exclusive,'[)') with &&)
);

-- Protect against block/reservation races with the same per-unit transaction lock.
-- All future book and maintenance block writes must take the same lock on the unit.
create or replace function public.accommodation_guard_occupancy()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare occupied boolean;
begin
 -- Touch the lock row as well: REPEATABLE READ must fail serialization instead
 -- of checking the other occupancy table against an older transaction snapshot.
 update public.accommodation_units set active=active where id=new.unit_id and venue_id=new.venue_id;
 if not found then raise exception 'Accommodation unit does not belong to this property'; end if;
 if tg_table_name = 'accommodation_unit_blocks' then
  select exists (
   select 1 from public.accommodation_reservations r
   where r.unit_id=new.unit_id and r.status in ('requested','confirmed','checked_in')
     and daterange(r.check_in,r.check_out,'[)') && daterange(new.start_date,new.end_date_exclusive,'[)')
  ) into occupied;
 else
  if new.status not in ('requested','confirmed','checked_in') then return new; end if;
  select exists (
   select 1 from public.accommodation_unit_blocks b
   where b.unit_id=new.unit_id and daterange(b.start_date,b.end_date_exclusive,'[)')
     && daterange(new.check_in,new.check_out,'[)')
  ) into occupied;
 end if;
 if occupied then raise exception 'Unit unavailable for selected nights'; end if;
 return new;
end;
$$;

create trigger accommodation_booking_guard before insert or update of unit_id,venue_id,check_in,check_out,status
 on public.accommodation_reservations for each row execute function public.accommodation_guard_occupancy();
create trigger accommodation_block_guard before insert or update of unit_id,venue_id,start_date,end_date_exclusive
 on public.accommodation_unit_blocks for each row execute function public.accommodation_guard_occupancy();

-- Deny customer access until a reviewed server-side pricing and booking RPC is shipped.
-- Owners/managers can inspect property inventory, but cannot forge a guest booking through RLS.
do $$
declare t text;
begin
 foreach t in array array['accommodation_room_types','accommodation_units','accommodation_nightly_rates','accommodation_reservations','accommodation_unit_blocks'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
 end loop;
end $$;
grant select,insert,update,delete on public.accommodation_room_types,public.accommodation_units,public.accommodation_nightly_rates,public.accommodation_unit_blocks to authenticated;
grant select on public.accommodation_reservations to authenticated;
create policy accommodation_types_owner on public.accommodation_room_types for all to authenticated
 using (public.is_venue_member(venue_id,array['owner','manager']::public.venue_member_role[]))
 with check (public.is_venue_member(venue_id,array['owner','manager']::public.venue_member_role[]));
create policy accommodation_units_owner on public.accommodation_units for all to authenticated
 using (public.is_venue_member(venue_id,array['owner','manager']::public.venue_member_role[]))
 with check (public.is_venue_member(venue_id,array['owner','manager']::public.venue_member_role[]));
create policy accommodation_rates_owner on public.accommodation_nightly_rates for all to authenticated
 using (public.is_venue_member(venue_id,array['owner','manager']::public.venue_member_role[]))
 with check (public.is_venue_member(venue_id,array['owner','manager']::public.venue_member_role[]));
create policy accommodation_blocks_owner on public.accommodation_unit_blocks for all to authenticated
 using (public.is_venue_member(venue_id,array['owner','manager']::public.venue_member_role[]))
 with check (public.is_venue_member(venue_id,array['owner','manager']::public.venue_member_role[]));
create policy accommodation_reservations_owner_read on public.accommodation_reservations for select to authenticated
 using (public.is_venue_member(venue_id,array['owner','manager']::public.venue_member_role[]));

-- Explicit opt-in: importing or claiming a stay never makes it bookable.
create table public.accommodation_booking_settings (
 venue_id uuid primary key references public.venues(id) on delete cascade,
 mode text not null default 'disabled' check (mode in ('disabled','external','request')),
 external_url text,
 notification_email text check(notification_email is null or (char_length(notification_email)<=254 and notification_email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')),
 policy text not null default '' check (char_length(policy) <= 4000),
 check (mode <> 'request' or char_length(btrim(policy)) >= 10),
 check (mode <> 'external' or external_url ~ '^https://[^[:space:]]+$')
);
alter table public.accommodation_reservations
 add column profile_id uuid references public.profiles(id) on delete cascade,
 add column locale text not null default 'es' check (locale in ('en','es')),
 add column updated_at timestamptz not null default now();
create table public.accommodation_quotes (
 id uuid primary key default gen_random_uuid(),
 profile_id uuid not null references public.profiles(id) on delete cascade,
 venue_id uuid not null references public.venues(id) on delete cascade,
 room_type_id uuid not null,
 check_in date not null,
 check_out date not null,
 guests integer not null,
 snapshot jsonb not null,
 expires_at timestamptz not null default now()+interval '15 minutes',
 foreign key (room_type_id,venue_id) references public.accommodation_room_types(id,venue_id)
);
create table public.accommodation_booking_audit (
 id uuid primary key default gen_random_uuid(),
 reservation_id uuid not null references public.accommodation_reservations(id) on delete cascade,
 actor_id uuid references public.profiles(id) on delete set null,
 old_status text,
 new_status text not null,
 happened_at timestamptz not null default now()
);
alter table public.accommodation_booking_settings enable row level security;
alter table public.accommodation_quotes enable row level security;
alter table public.accommodation_booking_audit enable row level security;
revoke all on public.accommodation_booking_settings,public.accommodation_quotes,public.accommodation_booking_audit from anon,authenticated;
grant select,insert,update,delete on public.accommodation_booking_settings to authenticated;
grant select on public.accommodation_quotes,public.accommodation_booking_audit to authenticated;
create policy accommodation_settings_owner on public.accommodation_booking_settings for all to authenticated
 using (public.is_venue_member(venue_id,array['owner','manager']::public.venue_member_role[]))
 with check (public.is_venue_member(venue_id,array['owner','manager']::public.venue_member_role[])
  and exists(select from public.venues v where v.id=venue_id and v.discovery_vertical='accommodation'));
create policy accommodation_quotes_customer on public.accommodation_quotes for select to authenticated using (profile_id=auth.uid());
create policy accommodation_reservations_customer_read on public.accommodation_reservations for select to authenticated using (profile_id=auth.uid());
create policy accommodation_audit_read on public.accommodation_booking_audit for select to authenticated using (
 exists(select from public.accommodation_reservations r where r.id=reservation_id));
create index accommodation_reservations_profile on public.accommodation_reservations(profile_id,created_at desc);
create index accommodation_quotes_profile on public.accommodation_quotes(profile_id,expires_at);
create index accommodation_audit_reservation on public.accommodation_booking_audit(reservation_id,happened_at);

-- Private helpers cannot be invoked through the Data API. Public wrappers expose
-- only aggregate availability and authorize all writes with the authenticated uid.
create schema if not exists accommodation_private;
revoke all on schema accommodation_private from public,anon,authenticated;
create function accommodation_private.snapshot(p_type uuid,p_in date,p_out date,p_guests integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare t public.accommodation_room_types; s public.accommodation_booking_settings;
 nights integer; covered integer; minimum integer; total bigint; prices jsonb;
begin
 nights := p_out-p_in;
 if p_in is null or p_out is null or p_guests is null or nights not between 1 and 365
  or p_in < (now() at time zone 'Europe/Madrid')::date or p_in > (now() at time zone 'Europe/Madrid')::date+730 then
  raise exception 'Invalid stay dates'; end if;
 select * into t from public.accommodation_room_types where id=p_type and active;
 if not found or p_guests not between 1 and t.max_guests then raise exception 'Room unavailable'; end if;
 select * into s from public.accommodation_booking_settings where venue_id=t.venue_id and mode='request';
 if not found or not exists(select from public.venues v where v.id=t.venue_id and v.discovery_vertical='accommodation' and v.status='published')
  then raise exception 'Booking unavailable'; end if;
 select count(*)::integer,max(r.minimum_nights),sum(r.nightly_price_cents),
  jsonb_agg(jsonb_build_object('date',d::date,'price_cents',r.nightly_price_cents,'rate_id',r.id,'minimum_nights',r.minimum_nights) order by d)
 into covered,minimum,total,prices
 from generate_series(p_in::timestamp,(p_out-1)::timestamp,interval '1 day') d
 join public.accommodation_nightly_rates r on r.room_type_id=p_type and d::date>=r.start_date and d::date<r.end_date_exclusive;
 if covered<>nights or nights<minimum or total>2147483647 then raise exception 'Rates unavailable for selected nights'; end if;
 return jsonb_build_object('room_type_id',t.id,'room_name',t.name,'check_in',p_in,'check_out',p_out,'guests',p_guests,
  'nights',nights,'currency','EUR','total_cents',total,'prices',prices,'policy',s.policy,
  'taxes_included',true,'payment','pay_at_property','status','requested');
end $$;

create function public.accommodation_available_rooms(p_venue uuid,p_in date,p_out date,p_guests integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t record; result jsonb := '[]'; snapshot jsonb; available integer;
begin
 if p_in is null or p_out is null or p_guests is null or p_out-p_in not between 1 and 365 or p_guests not between 1 and 30 then raise exception 'Invalid stay dates'; end if;
 for t in select id from public.accommodation_room_types where venue_id=p_venue and active and max_guests>=p_guests order by name,id loop
  begin snapshot := accommodation_private.snapshot(t.id,p_in,p_out,p_guests);
  exception when raise_exception then continue; end;
  select count(*)::integer into available from public.accommodation_units u where u.room_type_id=t.id and u.active
   and not exists(select from public.accommodation_unit_blocks b where b.unit_id=u.id and daterange(b.start_date,b.end_date_exclusive,'[)') && daterange(p_in,p_out,'[)'))
   and not exists(select from public.accommodation_reservations r where r.unit_id=u.id and r.status in ('requested','confirmed','checked_in') and daterange(r.check_in,r.check_out,'[)') && daterange(p_in,p_out,'[)'));
  if available>0 then result := result || jsonb_build_array(snapshot || jsonb_build_object('available',available)); end if;
 end loop;
 return result;
end $$;

create function public.accommodation_create_quote(p_type uuid,p_in date,p_out date,p_guests integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.accommodation_room_types; snapshot jsonb; q public.accommodation_quotes;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select * into t from public.accommodation_room_types where id=p_type;
 snapshot := accommodation_private.snapshot(p_type,p_in,p_out,p_guests);
 if not exists(select from jsonb_array_elements(public.accommodation_available_rooms(t.venue_id,p_in,p_out,p_guests)) a where a->>'room_type_id'=p_type::text)
  then raise exception 'Room unavailable'; end if;
 delete from public.accommodation_quotes where profile_id=auth.uid() and expires_at<now();
 if (select count(*) from public.accommodation_quotes where profile_id=auth.uid())>=30 then raise exception 'Too many quotes'; end if;
 insert into public.accommodation_quotes(profile_id,venue_id,room_type_id,check_in,check_out,guests,snapshot)
 values(auth.uid(),t.venue_id,p_type,p_in,p_out,p_guests,snapshot) returning * into q;
 return jsonb_build_object('id',q.id,'expires_at',q.expires_at,'snapshot',snapshot);
end $$;

create function public.accommodation_request_booking(p_quote uuid,p_key uuid,p_name text,p_email text,p_locale text)
returns uuid language plpgsql security definer set search_path='' as $$
declare q public.accommodation_quotes; r public.accommodation_reservations; chosen uuid; snapshot jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if p_key is null or p_name is null or char_length(btrim(p_name)) not between 2 and 120
  or p_email is null or char_length(p_email)>254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or p_locale not in ('en','es') or p_locale is null then raise exception 'Invalid guest details'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_key::text,0));
 select * into q from public.accommodation_quotes where id=p_quote and profile_id=auth.uid() for update;
 if not found then raise exception 'Quote unavailable'; end if;
 select * into r from public.accommodation_reservations where venue_id=q.venue_id and idempotency_key=p_key;
 if found then
  if r.profile_id is distinct from auth.uid() or r.quote_snapshot<>q.snapshot or r.contact_name<>btrim(p_name) or r.contact_email<>lower(btrim(p_email)) or r.locale<>p_locale
   then raise exception 'Request key reused'; end if;
  return r.id;
 end if;
 if q.expires_at<now() then raise exception 'Quote expired'; end if;
 perform 1 from public.venues where id=q.venue_id for share;
 perform 1 from public.accommodation_booking_settings where venue_id=q.venue_id for share;
 perform 1 from public.accommodation_room_types where id=q.room_type_id for share;
 perform 1 from public.accommodation_nightly_rates where room_type_id=q.room_type_id and daterange(start_date,end_date_exclusive,'[)') && daterange(q.check_in,q.check_out,'[)') for share;
 snapshot := accommodation_private.snapshot(q.room_type_id,q.check_in,q.check_out,q.guests);
 if snapshot<>q.snapshot then raise exception 'Quote changed; request a new quote'; end if;
 select u.id into chosen from public.accommodation_units u where u.room_type_id=q.room_type_id and u.active
  and not exists(select from public.accommodation_unit_blocks b where b.unit_id=u.id and daterange(b.start_date,b.end_date_exclusive,'[)') && daterange(q.check_in,q.check_out,'[)'))
  and not exists(select from public.accommodation_reservations occupied where occupied.unit_id=u.id and occupied.status in ('requested','confirmed','checked_in') and daterange(occupied.check_in,occupied.check_out,'[)') && daterange(q.check_in,q.check_out,'[)'))
  order by u.id for update of u skip locked limit 1;
 if chosen is null then raise exception 'Room unavailable'; end if;
 insert into public.accommodation_reservations(venue_id,unit_id,profile_id,check_in,check_out,guests,contact_name,contact_email,quoted_total_cents,quote_snapshot,idempotency_key,locale)
 values(q.venue_id,chosen,auth.uid(),q.check_in,q.check_out,q.guests,btrim(p_name),lower(btrim(p_email)),(snapshot->>'total_cents')::integer,snapshot,p_key,p_locale) returning * into r;
 insert into public.accommodation_booking_audit(reservation_id,actor_id,new_status) values(r.id,auth.uid(),'requested');
 return r.id;
end $$;

create function public.accommodation_change_status(p_reservation uuid,p_status text)
returns boolean language plpgsql security definer set search_path='' as $$
declare r public.accommodation_reservations; manager boolean; today date := (now() at time zone 'Europe/Madrid')::date;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select * into r from public.accommodation_reservations where id=p_reservation for update;
 if not found then raise exception 'Reservation unavailable'; end if;
 manager := public.is_venue_member(r.venue_id,array['owner','manager']::public.venue_member_role[]);
 if not manager and (r.profile_id is distinct from auth.uid() or p_status<>'cancelled' or r.check_in<=today) then raise exception 'Not authorized'; end if;
 if r.status=p_status then return false; end if;
 if not ((r.status='requested' and p_status in ('confirmed','declined','cancelled'))
  or (r.status='confirmed' and p_status in ('checked_in','cancelled'))
  or (r.status='checked_in' and p_status='completed')) then raise exception 'Invalid reservation transition'; end if;
 if p_status='checked_in' and today not between r.check_in and r.check_out then raise exception 'Check-in date unavailable'; end if;
 update public.accommodation_reservations set status=p_status,updated_at=now() where id=r.id;
 insert into public.accommodation_booking_audit(reservation_id,actor_id,old_status,new_status) values(r.id,auth.uid(),r.status,p_status);
 return true;
end $$;
revoke all on function public.accommodation_available_rooms(uuid,date,date,integer), public.accommodation_create_quote(uuid,date,date,integer),
 public.accommodation_request_booking(uuid,uuid,text,text,text),public.accommodation_change_status(uuid,text) from public,anon,authenticated;
grant execute on function public.accommodation_available_rooms(uuid,date,date,integer) to anon,authenticated;
grant execute on function public.accommodation_create_quote(uuid,date,date,integer),public.accommodation_request_booking(uuid,uuid,text,text,text),public.accommodation_change_status(uuid,text) to authenticated;

create function public.accommodation_public_settings(p_venue uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('mode',s.mode,'external_url',s.external_url,'policy',s.policy)
 from public.accommodation_booking_settings s join public.venues v on v.id=s.venue_id
 where v.id=p_venue and v.status='published' and v.discovery_vertical='accommodation'
$$;
revoke all on function public.accommodation_public_settings(uuid) from public;
grant execute on function public.accommodation_public_settings(uuid) to anon,authenticated;

-- Independent reservation FK; legacy timed-slot outbox stays untouched.
create table public.accommodation_confirmation_emails (
 booking_id uuid not null references public.accommodation_reservations(id) on delete cascade,
 venue_id uuid not null references public.venues(id) on delete cascade,
 audience text not null check(audience in ('customer','venue')),
 recipient text,
 payload jsonb not null,
 status text not null default 'pending' check(status in ('pending','sending','sent','failed','blocked','review','cancelled')),
 attempts integer not null default 0,
 created_at timestamptz not null default now(),available_at timestamptz not null default now(),
 first_attempt_at timestamptz,attempted_at timestamptz,lease_id uuid,sent_at timestamptz,
 provider_message_id text,last_error text,
 primary key(booking_id,audience)
);
alter table public.accommodation_confirmation_emails enable row level security;
revoke all on public.accommodation_confirmation_emails from public,anon,authenticated;
grant select on public.accommodation_confirmation_emails to authenticated;
grant all on public.accommodation_confirmation_emails,public.accommodation_reservations to service_role;
create policy accommodation_mail_read on public.accommodation_confirmation_emails for select to authenticated using (
 public.is_venue_member(venue_id,array['owner','manager']::public.venue_member_role[]) or
 (audience='customer' and exists(select from public.accommodation_reservations r where r.id=booking_id and r.profile_id=auth.uid())));
create index accommodation_mail_due on public.accommodation_confirmation_emails(status,available_at);
create index accommodation_mail_venue on public.accommodation_confirmation_emails(venue_id);
create function accommodation_private.queue_confirmation() returns trigger
language plpgsql security definer set search_path='' as $$
declare payload jsonb; recipient text;
begin
 if new.status in ('cancelled','declined') then
  update public.accommodation_confirmation_emails set status='cancelled' where booking_id=new.id and status<>'sent';
 end if;
 if new.status<>'confirmed' or old.status='confirmed' then return new; end if;
 select jsonb_build_object('bookingId',new.id,'venueId',new.venue_id,'venueName',v.name,'customerName',new.contact_name,
  'customerEmail',new.contact_email,'guestCount',new.guests,'bookingStart',new.check_in,'bookingEnd',new.check_out,
  'offeringName',new.quote_snapshot->>'room_name','locale',new.locale,'product','accommodation','totalCents',new.quoted_total_cents,'policy',new.quote_snapshot->>'policy')
 into payload from public.venues v where v.id=new.venue_id;
 select notification_email into recipient from public.accommodation_booking_settings where venue_id=new.venue_id;
 if recipient is null then
  select u.email into recipient from public.venue_members m join auth.users u on u.id=m.profile_id
   where m.venue_id=new.venue_id and m.role='owner' and u.email_confirmed_at is not null order by m.profile_id limit 1;
 end if;
 insert into public.accommodation_confirmation_emails(booking_id,venue_id,audience,recipient,payload)
 values(new.id,new.venue_id,'customer',new.contact_email,payload) on conflict do nothing;
 insert into public.accommodation_confirmation_emails(booking_id,venue_id,audience,recipient,payload,status,last_error)
 values(new.id,new.venue_id,'venue',recipient,payload,case when recipient is null then 'blocked' else 'pending' end,
  case when recipient is null then 'venue_email_missing' else null end) on conflict do nothing;
 return new;
end $$;
create trigger accommodation_confirmation_queue after update of status on public.accommodation_reservations
 for each row execute function accommodation_private.queue_confirmation();

create function public.claim_accommodation_confirmation_emails()
returns setof public.accommodation_confirmation_emails language plpgsql security definer set search_path='' as $$
begin
 update public.accommodation_confirmation_emails set status='review',last_error='delivery_confirmation_required'
 where status in ('sending','failed') and first_attempt_at<now()-interval '23 hours';
 return query with due as (
  select e.booking_id,e.audience from public.accommodation_confirmation_emails e
  join public.accommodation_reservations r on r.id=e.booking_id and r.status in ('confirmed','checked_in')
  where e.recipient is not null and e.attempts<12 and e.available_at<=now()
   and (e.status in ('pending','failed') or (e.status='sending' and e.attempted_at<now()-interval '10 minutes'))
  order by e.created_at limit 8 for update of e skip locked
 ) update public.accommodation_confirmation_emails e set status='sending',attempts=e.attempts+1,lease_id=gen_random_uuid(),attempted_at=now(),first_attempt_at=coalesce(e.first_attempt_at,now())
 from due where e.booking_id=due.booking_id and e.audience=due.audience returning e.*;
end $$;
create function public.finish_accommodation_confirmation_email(p_booking uuid,p_audience text,p_lease uuid,p_ok boolean,p_message text default null,p_error text default null,p_ambiguous boolean default true)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 update public.accommodation_confirmation_emails set status=case when p_ok then 'sent' when attempts>=12 then 'review' else 'failed' end,
  sent_at=case when p_ok then now() else null end,provider_message_id=case when p_ok then p_message else null end,
  last_error=case when p_ok then null else left(p_error,80) end,
  first_attempt_at=case when not p_ok and not p_ambiguous then null else first_attempt_at end,
  available_at=now()+make_interval(secs=>least(3600,60*power(2,least(attempts,6)))::integer),lease_id=null
 where booking_id=p_booking and audience=p_audience and lease_id=p_lease and status='sending';
 return found;
end $$;
revoke all on function public.claim_accommodation_confirmation_emails(),public.finish_accommodation_confirmation_email(uuid,text,uuid,boolean,text,text,boolean) from public,anon,authenticated;
grant execute on function public.claim_accommodation_confirmation_emails(),public.finish_accommodation_confirmation_email(uuid,text,uuid,boolean,text,text,boolean) to service_role;
commit;

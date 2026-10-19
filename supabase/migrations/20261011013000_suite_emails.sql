begin;

-- AkiSuite one-per-event transactional mail outbox.
-- No historical backfill; legacy booking/claim decision queues remain intact.
create table if not exists public.suite_email_outbox (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique check (length(dedupe_key) between 3 and 240),
  kind text not null check(kind in (
    'claim_received','welcome_akipasa','welcome_akiduermo',
    'welcome_akibusiness','welcome_akihq',
    'event_booking_requested','event_booking_cancelled',
    'stay_booking_requested','stay_booking_cancelled',
    'event_saved_reminder','stay_saved_reminder')),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  recipient text not null check(length(recipient) between 5 and 254),
  locale text not null check(locale in ('en','es')),
  payload jsonb not null default '{}'::jsonb
    check(jsonb_typeof(payload)='object' and octet_length(payload::text) <= 12000),
  available_at timestamptz not null default now(),
  status text not null default 'pending'
    check(status in ('pending','sending','sent','failed','blocked','review','cancelled')),
  attempts integer not null default 0 check(attempts between 0 and 12),
  delivery_uncertain boolean not null default false,
  created_at timestamptz not null default now(),
  first_attempt_at timestamptz,
  attempted_at timestamptz,
  lease_id uuid,
  sent_at timestamptz,
  provider_message_id text,
  last_error text
);
create index if not exists suite_email_due on public.suite_email_outbox(status,available_at);
create index if not exists suite_email_profile_created on public.suite_email_outbox(profile_id,created_at desc);

alter table public.suite_email_outbox enable row level security;
revoke all on public.suite_email_outbox from public,anon,authenticated;
grant all on public.suite_email_outbox to service_role;

create table if not exists public.suite_email_preferences (
 profile_id uuid primary key references public.profiles(id) on delete cascade,
 event_reminders boolean not null default false,
 stay_reminders boolean not null default false,
 updated_at timestamptz not null default now()
);
alter table public.suite_email_preferences enable row level security;
revoke all on public.suite_email_preferences from public,anon,authenticated;
grant all on public.suite_email_preferences to service_role;

-- Only one welcome per user per portal even across devices, languages and logins.
create or replace function public.queue_suite_portal_welcome(p_product text,p_locale text default 'es')
returns boolean language plpgsql security definer set search_path='' as $$
declare u auth.users%rowtype; chosen text;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_product not in ('akipasa','akiduermo','akibusiness','akihq') then raise exception 'Invalid welcome product'; end if;
 select * into u from auth.users where id=auth.uid() and deleted_at is null;
 if u.id is null or u.email_confirmed_at is null or u.email is null then return false; end if;
 -- Legacy AkiPasa users should not receive a first-signup email years later.
 if p_product='akipasa' and u.created_at<'2026-10-11T00:00:00Z'::timestamptz then
   return false;
 end if;
 chosen:=case when p_locale='en' then 'en' else 'es' end;
 insert into public.suite_email_outbox(dedupe_key,kind,profile_id,recipient,locale,payload)
 values('welcome:'||auth.uid()::text||':'||p_product,'welcome_'||p_product,
        auth.uid(),u.email,chosen,
        jsonb_build_object('product',p_product,'displayName',coalesce(u.raw_user_meta_data->>'full_name','')))
 on conflict(dedupe_key) do nothing;
 return true;
end $$;
revoke all on function public.queue_suite_portal_welcome(text,text) from public,anon;
grant execute on function public.queue_suite_portal_welcome(text,text) to authenticated,service_role;

create or replace function public.suite_email_reminder_preferences(p_event boolean default null,p_stay boolean default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result public.suite_email_preferences%rowtype;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 insert into public.suite_email_preferences(profile_id,event_reminders,stay_reminders)
 values(auth.uid(),coalesce(p_event,false),coalesce(p_stay,false))
 on conflict(profile_id) do update set
  event_reminders=coalesce(p_event,public.suite_email_preferences.event_reminders),
  stay_reminders=coalesce(p_stay,public.suite_email_preferences.stay_reminders),
  updated_at=case when p_event is not null or p_stay is not null then now() else public.suite_email_preferences.updated_at end
 returning * into result;
 return jsonb_build_object('event_reminders',result.event_reminders,
                           'stay_reminders',result.stay_reminders);
end $$;
revoke all on function public.suite_email_reminder_preferences(boolean,boolean) from public,anon;
grant execute on function public.suite_email_reminder_preferences(boolean,boolean) to authenticated,service_role;

-- Private server-synchronised save state for stay reminders. Existing anonymous
-- browser favourites are not migrated to the server.
create table if not exists public.suite_saved_stays (
 profile_id uuid not null references public.profiles(id) on delete cascade,
 venue_id uuid not null references public.venues(id) on delete cascade,
 locale text not null default 'es' check(locale in('en','es')),
 saved_at timestamptz not null default now(),
 primary key(profile_id,venue_id)
);
alter table public.suite_saved_stays enable row level security;
revoke all on public.suite_saved_stays from public,anon,authenticated;
grant all on public.suite_saved_stays to service_role;
grant select on public.suite_saved_stays to authenticated;
create policy suite_saved_stays_own_read on public.suite_saved_stays
  for select to authenticated using(profile_id=(select auth.uid()));

create or replace function public.suite_save_stay(p_venue uuid,p_saved boolean,p_locale text default 'es')
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_venue is null then raise exception 'Invalid stay'; end if;
 if p_saved then
  if not exists(select 1 from public.venues v
      where v.id=p_venue and v.discovery_vertical='accommodation'
      and v.status='published') then raise exception 'Stay not available'; end if;
  insert into public.suite_saved_stays(profile_id,venue_id,locale)
   values(auth.uid(),p_venue,case when p_locale='en' then 'en' else 'es' end)
   on conflict (profile_id,venue_id) do nothing;
 else
  delete from public.suite_saved_stays where profile_id=auth.uid() and venue_id=p_venue;
 end if;
 return true;
end $$;
revoke all on function public.suite_save_stay(uuid,boolean,text) from public,anon;
grant execute on function public.suite_save_stay(uuid,boolean,text) to authenticated,service_role;

-- Snapshot locale at the time the claim was submitted, not the user's
-- potentially changed profile locale at the time of delivery.
alter table public.venue_claims add column if not exists claim_locale text;
alter table public.venue_claims drop constraint if exists venue_claim_locale_check;
alter table public.venue_claims add constraint venue_claim_locale_check
 check(claim_locale is null or claim_locale in('en','es'));

create or replace function public.queue_suite_claim_received()
returns trigger language plpgsql security definer set search_path='' as $$
declare address text; lang text; venue_name text;
begin
 if new.status::text <> 'pending' then return new; end if;
 select u.email into address from auth.users u where u.id=new.claimant_id
   and u.email_confirmed_at is not null and u.deleted_at is null;
 if address is null then return new; end if;
 select v.name into venue_name from public.venues v where v.id=new.venue_id;
 select coalesce(new.claim_locale,p.preferred_locale,'es') into lang
 from public.profiles p where p.id=new.claimant_id;
 insert into public.suite_email_outbox(dedupe_key,kind,profile_id,recipient,locale,payload)
 values('claim-received:'||new.id::text,'claim_received',new.claimant_id,address,
   case when lang='en' then 'en' else 'es' end,
   jsonb_build_object('claimId',new.id,'venueId',new.venue_id,
     'venueName',coalesce(venue_name,'Business')))
 on conflict(dedupe_key) do nothing;
 return new;
end $$;
drop trigger if exists suite_claim_received on public.venue_claims;
create trigger suite_claim_received after insert on public.venue_claims
 for each row execute function public.queue_suite_claim_received();
revoke all on function public.queue_suite_claim_received() from public,anon,authenticated;

-- Request acknowledgement and cancellation are distinct from existing
-- manager-confirmed booking confirmation email outboxes.
create or replace function public.queue_suite_booking_lifecycle()
returns trigger language plpgsql security definer set search_path='' as $$
declare kind text; recipient text; locale text; venue_name text; start_at timestamptz;
begin
 if tg_op='INSERT' then
  if new.status <> 'requested' then return new; end if;
  kind:='event_booking_requested';
 elsif tg_op='UPDATE' then
  if new.status<> 'cancelled' or old.status='cancelled' then return new; end if;
  kind:='event_booking_cancelled';
 else return new; end if;
 select u.email into recipient from auth.users u
  where u.id=new.profile_id and u.email_confirmed_at is not null and u.deleted_at is null;
 if recipient is null then return new; end if;
 select v.name into venue_name from public.venues v where v.id=new.venue_id;
 select s.starts_at into start_at from public.venue_availability_slots s where s.id=new.slot_id;
 locale:=case when new.booking_locale='en' then 'en' else 'es' end;
 insert into public.suite_email_outbox(dedupe_key,kind,profile_id,recipient,locale,payload)
 values('event:'||new.id::text||':'||kind,kind,new.profile_id,recipient,locale,
  jsonb_build_object('bookingId',new.id,'eventId',new.event_id,
  'venueName',coalesce(venue_name,'Venue'),'bookingStart',start_at,
  'guestCount',new.party_size))
 on conflict(dedupe_key) do nothing;
 return new;
end $$;
drop trigger if exists suite_event_booking_requested on public.booking_requests;
create trigger suite_event_booking_requested after insert on public.booking_requests
 for each row execute function public.queue_suite_booking_lifecycle();
drop trigger if exists suite_event_booking_cancelled on public.booking_requests;
create trigger suite_event_booking_cancelled after update of status on public.booking_requests
 for each row execute function public.queue_suite_booking_lifecycle();
revoke all on function public.queue_suite_booking_lifecycle() from public,anon,authenticated;

create or replace function public.queue_suite_stay_lifecycle()
returns trigger language plpgsql security definer set search_path='' as $$
declare kind text;recipient text;venue_name text;
begin
 if tg_op='INSERT' then
  if new.status <> 'requested' then return new; end if;
  kind:='stay_booking_requested';
 elsif tg_op='UPDATE' then
  if new.status <> 'cancelled' or old.status='cancelled' then return new; end if;
  kind:='stay_booking_cancelled';
 else return new; end if;
 select u.email into recipient from auth.users u
   where u.id=new.profile_id and u.deleted_at is null and u.email_confirmed_at is not null;
 if recipient is null then return new; end if;
 select v.name into venue_name from public.venues v where v.id=new.venue_id;
 insert into public.suite_email_outbox(dedupe_key,kind,profile_id,recipient,locale,payload)
 values('stay:'||new.id::text||':'||kind,kind,new.profile_id,recipient,
  case when new.locale='en' then 'en' else 'es' end,
  jsonb_build_object('bookingId',new.id,'venueName',coalesce(venue_name,'Stay'),
    'checkIn',new.check_in,'checkOut',new.check_out,'guests',new.guests,
    'totalCents',new.quoted_total_cents,'venueId',new.venue_id))
 on conflict(dedupe_key) do nothing;
 return new;
end $$;
drop trigger if exists suite_stay_booking_requested on public.accommodation_reservations;
create trigger suite_stay_booking_requested after insert on public.accommodation_reservations
 for each row execute function public.queue_suite_stay_lifecycle();
drop trigger if exists suite_stay_booking_cancelled on public.accommodation_reservations;
create trigger suite_stay_booking_cancelled after update of status on public.accommodation_reservations
 for each row execute function public.queue_suite_stay_lifecycle();
revoke all on function public.queue_suite_stay_lifecycle() from public,anon,authenticated;

-- Called every five minutes by the Worker. The sender rechecks conditions
-- before sending; scheduling itself is consent-based and deduplicated.
create or replace function public.queue_due_suite_reminders()
returns integer language plpgsql security definer set search_path='' as $$
declare count_rows integer := 0; n integer;
begin
 with due as (
  select s.profile_id,oc.event_id,oc.id occurrence_id,oc.starts_at,
     e.title_en,e.title_es,e.slug,p.preferred_locale,u.email
  from public.saved_event_refs s
  join public.suite_email_preferences pref on pref.profile_id=s.profile_id and pref.event_reminders=true
  join public.event_occurrences oc on oc.event_id::text=s.event_key
    and oc.starts_at>now()+interval '47 hours'
    and oc.starts_at<=now()+interval '49 hours'
    and s.created_at<=oc.starts_at-interval '48 hours'
  join public.events e on e.id=oc.event_id and e.status::text='published'
  join public.profiles p on p.id=s.profile_id
  join auth.users u on u.id=s.profile_id and u.deleted_at is null and u.email_confirmed_at is not null
  where oc.status::text not in('cancelled','expired')
 )
 insert into public.suite_email_outbox(dedupe_key,kind,profile_id,recipient,locale,payload,available_at)
 select 'event-saved:'||d.profile_id||':'||d.occurrence_id,
  'event_saved_reminder',d.profile_id,d.email,
  case when d.preferred_locale='en' then 'en' else 'es' end,
  jsonb_build_object('eventId',d.event_id,'occurrenceId',d.occurrence_id,
   'eventName',coalesce(d.title_en,d.title_es,'Event'),'startsAt',d.starts_at,
   'slug',d.slug),
  d.starts_at-interval '48 hours'
 from due d on conflict (dedupe_key) do nothing;
 get diagnostics n=row_count;count_rows:=n;
 insert into public.suite_email_outbox(dedupe_key,kind,profile_id,recipient,locale,payload,available_at)
 select 'stay-saved:'||s.profile_id||':'||s.venue_id||':'||md5(s.saved_at::text),
   'stay_saved_reminder',s.profile_id,u.email,s.locale,
   jsonb_build_object('venueId',s.venue_id,'venueName',v.name,'venueSlug',v.slug,'savedAt',s.saved_at),
   s.saved_at+interval '5 days'
 from public.suite_saved_stays s
 join public.suite_email_preferences pref on pref.profile_id=s.profile_id and pref.stay_reminders=true
 join public.venues v on v.id=s.venue_id and v.status='published'
 join auth.users u on u.id=s.profile_id and u.deleted_at is null and u.email_confirmed_at is not null
 where s.saved_at<=now()-interval '5 days'
   and not exists (
     select 1 from public.accommodation_reservations a
     where a.profile_id=s.profile_id and a.venue_id=s.venue_id
       and a.created_at>=s.saved_at and a.status in('requested','confirmed','checked_in')
   )
 on conflict (dedupe_key) do nothing;
 get diagnostics n=row_count;
 return count_rows+n;
end $$;
revoke all on function public.queue_due_suite_reminders() from public,anon,authenticated;
grant execute on function public.queue_due_suite_reminders() to service_role;

create or replace function public.claim_due_suite_emails()
returns setof public.suite_email_outbox language plpgsql security definer set search_path='' as $$
begin
 update public.suite_email_outbox
 set status='review',lease_id=null,last_error='delivery_confirmation_required'
 where status in('sending','failed') and first_attempt_at < now()-interval '23 hours';
 return query with due as (
  select x.id from public.suite_email_outbox x
  where (x.status in('pending','failed') or (x.status='sending' and x.attempted_at<now()-interval '10 minutes'))
    and x.available_at<=now() and x.attempts<12
  order by x.available_at,x.created_at limit 15
  for update of x skip locked
 ) update public.suite_email_outbox q
 set status='sending',attempts=q.attempts+1,lease_id=gen_random_uuid(),
     delivery_uncertain=q.delivery_uncertain or q.status='sending',
     attempted_at=now(),first_attempt_at=coalesce(q.first_attempt_at,now())
 from due where q.id=due.id returning q.*;
end $$;
revoke all on function public.claim_due_suite_emails() from public,anon,authenticated;
grant execute on function public.claim_due_suite_emails() to service_role;

create or replace function public.finish_suite_email(p_id uuid,p_lease uuid,p_ok boolean,
 p_message text default null,p_error text default null,p_retryable boolean default true,
 p_ambiguous boolean default true)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_ok and nullif(btrim(p_message),'') is null then raise exception 'Provider message ID required'; end if;
 update public.suite_email_outbox set
  status=case when p_ok then 'sent' when not p_retryable then 'blocked'
              when attempts>=12 then 'review' else 'failed' end,
  lease_id=null,sent_at=case when p_ok then now() else null end,
  provider_message_id=case when p_ok then p_message else null end,
  last_error=case when p_ok then null else left(p_error,90) end,
  delivery_uncertain=delivery_uncertain or(not p_ok and p_ambiguous),
  first_attempt_at=case when not p_ok and not p_ambiguous and not delivery_uncertain
    then null else first_attempt_at end,
  available_at=now()+make_interval(secs=>least(3600,60*power(2,least(attempts,6)))::integer)
 where id=p_id and lease_id=p_lease and status='sending';
 return found;
end $$;
revoke all on function public.finish_suite_email(uuid,uuid,boolean,text,text,boolean,boolean)
 from public,anon,authenticated;
grant execute on function public.finish_suite_email(uuid,uuid,boolean,text,text,boolean,boolean)
 to service_role;

commit;
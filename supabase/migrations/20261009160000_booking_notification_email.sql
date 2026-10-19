-- Private recipients and durable confirmation delivery. No historical emails are sent.
begin;
create table public.booking_notification_settings (
  venue_id uuid primary key references public.venues(id) on delete cascade,
  notification_email text check(notification_email is null or
    (length(notification_email) between 5 and 254 and notification_email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')),
  locale text not null default 'es' check(locale in ('en','es'))
);
alter table public.booking_notification_settings enable row level security;
revoke all on public.booking_notification_settings from public,anon,authenticated;
grant select,insert,update on public.booking_notification_settings to authenticated;
grant all on public.booking_notification_settings to service_role;
create policy booking_notification_settings_manager on public.booking_notification_settings
  for all to authenticated
  using(public.is_venue_member(venue_id,array['owner','manager']::public.venue_member_role[]))
  with check(public.is_venue_member(venue_id,array['owner','manager']::public.venue_member_role[]));

alter table public.booking_requests add column booking_locale text not null default 'es' check(booking_locale in ('en','es'));
alter table public.booking_requests add column request_key uuid;
create unique index booking_request_idempotency on public.booking_requests(profile_id,request_key) where request_key is not null;
create index if not exists booking_request_slot_status on public.booking_requests(slot_id,status);
create index if not exists booking_request_profile_created on public.booking_requests(profile_id,created_at desc);
-- Customers must not be able to rewrite party size, identity or ownership after capacity checks.
revoke update on public.booking_requests from public,anon,authenticated;
grant update(status,updated_at) on public.booking_requests to authenticated;

create table public.booking_confirmation_emails (
  booking_id uuid not null references public.booking_requests(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  audience text not null check (audience in ('customer','venue')),
  recipient text,
  payload jsonb not null,
  status text not null default 'pending' check(status in ('pending','sending','sent','failed','blocked','review','cancelled')),
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  available_at timestamptz not null default now(),
  first_attempt_at timestamptz,
  attempted_at timestamptz,
  lease_id uuid,
  sent_at timestamptz,
  provider_message_id text,
  last_error text,
  primary key (booking_id,audience)
);
create index booking_mail_due on public.booking_confirmation_emails(status,available_at);
create index booking_mail_venue on public.booking_confirmation_emails(venue_id);
alter table public.booking_confirmation_emails enable row level security;
revoke all on public.booking_confirmation_emails from public,anon,authenticated;
grant select on public.booking_confirmation_emails to authenticated;
grant all on public.booking_confirmation_emails to service_role;
create policy booking_mail_manager_read on public.booking_confirmation_emails
  for select to authenticated using(public.is_venue_member(venue_id,array['owner','manager']::public.venue_member_role[]));

create function public.guard_booking_status_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_manager boolean; v_slot public.venue_availability_slots%rowtype; v_capacity integer; v_booked integer;
begin
  if new.status=old.status then return new; end if;
  v_manager:=public.is_venue_member(old.venue_id,array['owner','manager']::public.venue_member_role[])
    or current_setting('role',true)='service_role';
  if not coalesce(v_manager,false) and not coalesce(auth.uid()=old.profile_id and new.status='cancelled',false) then
    raise exception 'venue manager required' using errcode = '42501';
  end if;
  if not ((old.status='requested' and new.status in ('confirmed','declined','cancelled'))
       or (old.status='confirmed' and new.status in ('completed','cancelled'))) then
    raise exception 'invalid booking transition';
  end if;
  select * into v_slot from public.venue_availability_slots where id=old.slot_id for update;
  if not coalesce(v_manager,false) and (v_slot.id is null or v_slot.starts_at<=now()) then
    raise exception 'booking already started';
  end if;
  if new.status='completed' and v_slot.starts_at>now() then raise exception 'booking not started'; end if;
  if new.status='confirmed' then
    if v_slot.id is null or not v_slot.active or v_slot.starts_at<=now() then raise exception 'slot unavailable'; end if;
    v_capacity:=v_slot.capacity;
    if v_slot.resource_id is not null then
      select least(v_capacity,r.capacity) into v_capacity from public.booking_resources r
        where r.id=v_slot.resource_id and r.venue_id=old.venue_id and r.active;
      if v_capacity is null then raise exception 'resource unavailable'; end if;
    end if;
    if v_slot.offering_id is not null then
      select least(v_capacity,o.capacity) into v_capacity from public.booking_offerings o
        where o.id=v_slot.offering_id and o.venue_id=old.venue_id and o.active;
    end if;
    if v_capacity is null then raise exception 'service unavailable'; end if;
    select coalesce(sum(party_size),0) into v_booked from public.booking_requests
      where slot_id=old.slot_id and status in ('requested','confirmed');
    if v_booked>v_capacity then raise exception 'slot full'; end if;
  end if;
  new.updated_at:=now();
  return new;
end; $$;
create trigger booking_status_guard before update of status on public.booking_requests
  for each row execute function public.guard_booking_status_change();

create function public.queue_booking_confirmation() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_recipient text; v_locale text; v_payload jsonb;
begin
  if new.status='cancelled' or new.status='declined' then
    update public.booking_confirmation_emails set status='cancelled' where booking_id=new.id and status<>'sent';
  end if;
  if new.status<>'confirmed' or old.status='confirmed' then return new; end if;
  select jsonb_build_object('bookingId',new.id,'venueId',new.venue_id,'venueName',v.name,
    'venueSlug',v.slug,'address',v.address,'customerName',new.contact_name,
    'customerEmail',new.contact_email,'guestCount',new.party_size,
    'bookingStart',s.starts_at,'bookingEnd',s.ends_at,'offeringName',o.name,'locale',new.booking_locale)
    into v_payload from public.venues v
    left join public.venue_availability_slots s on s.id=new.slot_id
    left join public.booking_offerings o on o.id=s.offering_id
    where v.id=new.venue_id;
  insert into public.booking_confirmation_emails(booking_id,venue_id,audience,recipient,payload)
    values(new.id,new.venue_id,'customer',new.contact_email,v_payload)
    on conflict (booking_id,audience) do nothing;
  select notification_email,locale into v_recipient,v_locale from public.booking_notification_settings where venue_id=new.venue_id;
  if v_recipient is null then
    select u.email into v_recipient from public.venue_members m join auth.users u on u.id=m.profile_id
      where m.venue_id=new.venue_id and m.role='owner' and u.email_confirmed_at is not null order by m.profile_id limit 1;
  end if;
  insert into public.booking_confirmation_emails(booking_id,venue_id,audience,recipient,payload,status,last_error)
    values(new.id,new.venue_id,'venue',v_recipient,
      jsonb_set(v_payload,'{locale}',to_jsonb(coalesce(v_locale,'es'))),
      case when v_recipient is null then 'blocked' else 'pending' end,
      case when v_recipient is null then 'venue_email_missing' else null end)
      on conflict (booking_id,audience) do nothing;
  return new;
end; $$;
create trigger booking_confirmed_queue after update of status on public.booking_requests
  for each row execute function public.queue_booking_confirmation();
revoke all on function public.guard_booking_status_change(),public.queue_booking_confirmation() from public,anon,authenticated;

create function public.approve_booking_and_queue_emails(p_venue uuid,p_booking uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_status text;
begin
  if auth.uid() is null or not public.is_venue_member(p_venue,array['owner','manager']::public.venue_member_role[]) then
    raise exception 'venue manager required' using errcode='42501';
  end if;
  select status into v_status from public.booking_requests where id=p_booking and venue_id=p_venue for update;
  if v_status is null then raise exception 'booking unavailable'; end if;
  if v_status='confirmed' then return false; end if;
  if v_status<>'requested' then raise exception 'invalid booking transition'; end if;
  update public.booking_requests set status='confirmed',updated_at=now() where id=p_booking;
  return true;
end; $$;
revoke all on function public.approve_booking_and_queue_emails(uuid,uuid) from public,anon;
grant execute on function public.approve_booking_and_queue_emails(uuid,uuid) to authenticated;

-- Only the server/Worker service key can lease or acknowledge outbound deliveries.
create function public.claim_booking_confirmation_emails(p_venue uuid default null,p_booking uuid default null)
returns setof public.booking_confirmation_emails language plpgsql security definer set search_path='' as $$
begin
  -- Resend only retains an idempotency key for 24h. Never blindly retry an ambiguous old send.
  update public.booking_confirmation_emails set status='review',last_error='delivery_confirmation_required'
    where status in ('sending','failed') and first_attempt_at<now()-interval '23 hours';
  return query with due as (
    select e.booking_id,e.audience from public.booking_confirmation_emails e
      join public.booking_requests b on b.id=e.booking_id and b.status='confirmed'
      where (p_venue is null or e.venue_id=p_venue) and (p_booking is null or e.booking_id=p_booking)
        and e.recipient is not null and e.attempts<12 and e.available_at<=now()
        and ((e.status in ('pending','failed')) or (e.status='sending' and e.attempted_at<now()-interval '10 minutes'))
      order by e.created_at limit 8 for update of e skip locked
  ) update public.booking_confirmation_emails e set status='sending',attempts=e.attempts+1,
      lease_id=gen_random_uuid(),attempted_at=now(),first_attempt_at=coalesce(e.first_attempt_at,now())
    from due where e.booking_id=due.booking_id and e.audience=due.audience returning e.*;
end; $$;
create function public.finish_booking_confirmation_email(p_booking uuid,p_audience text,p_lease uuid,
  p_ok boolean,p_message text default null,p_error text default null,p_ambiguous boolean default true)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  update public.booking_confirmation_emails set
    status=case when p_ok then 'sent' when attempts>=12 then 'review' else 'failed' end,
    sent_at=case when p_ok then now() else null end,
    provider_message_id=case when p_ok then p_message else null end,
    last_error=case when p_ok then null else left(p_error,80) end,
    first_attempt_at=case when not p_ok and not p_ambiguous then null else first_attempt_at end,
    available_at=now()+make_interval(secs=>least(3600,60*power(2,least(attempts,6)))::integer),
    lease_id=null
    where booking_id=p_booking and audience=p_audience and lease_id=p_lease and status='sending';
  return found;
end; $$;
revoke all on function public.claim_booking_confirmation_emails(uuid,uuid),
  public.finish_booking_confirmation_email(uuid,text,uuid,boolean,text,text,boolean) from public,anon,authenticated;
grant execute on function public.claim_booking_confirmation_emails(uuid,uuid),
  public.finish_booking_confirmation_email(uuid,text,uuid,boolean,text,text,boolean) to service_role;

create function public.retry_booking_confirmation(p_venue uuid,p_booking uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_email text;
begin
  if auth.uid() is null or not public.is_venue_member(p_venue,array['owner','manager']::public.venue_member_role[]) then
    raise exception 'venue manager required' using errcode='42501';
  end if;
  select notification_email into v_email from public.booking_notification_settings where venue_id=p_venue;
  update public.booking_confirmation_emails set recipient=v_email,status='pending',last_error=null,available_at=now()
    where venue_id=p_venue and booking_id=p_booking and audience='venue' and status='blocked' and v_email is not null;
  update public.booking_confirmation_emails set available_at=now()
    where venue_id=p_venue and booking_id=p_booking and status in ('pending','failed');
end; $$;
revoke all on function public.retry_booking_confirmation(uuid,uuid) from public,anon;
grant execute on function public.retry_booking_confirmation(uuid,uuid) to authenticated;
commit;

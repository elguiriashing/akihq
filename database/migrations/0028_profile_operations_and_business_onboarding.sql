begin;

create or replace function update_own_profile(
  p_display_name text,
  p_preferred_locale text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if char_length(trim(coalesce(p_display_name, ''))) > 100 then
    raise exception 'display name too long';
  end if;
  if p_preferred_locale not in ('es', 'en') then
    raise exception 'invalid preferred locale';
  end if;

  update profiles
  set display_name = nullif(trim(p_display_name), ''),
      preferred_locale = p_preferred_locale,
      updated_at = now()
  where id = auth.uid();

  if not found then raise exception 'profile not found'; end if;
end;
$$;

revoke all on function update_own_profile(text,text) from public;
grant execute on function update_own_profile(text,text) to authenticated;

create table business_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references profiles(id) on delete cascade,
  business_name text not null check (char_length(business_name) between 2 and 160),
  contact_name text not null check (char_length(contact_name) between 2 and 120),
  locality text not null check (char_length(locality) between 2 and 120),
  website_url text,
  message text not null check (char_length(message) between 20 and 2000),
  plan_code text not null default 'standard'
    check (plan_code in ('standard')),
  state text not null default 'submitted'
    check (state in ('submitted','under_review','awaiting_payment','active','rejected')),
  payment_state text not null default 'not_started'
    check (payment_state in ('not_started','pending','paid','waived','failed')),
  reviewed_by uuid references profiles(id),
  review_reason text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index business_applications_one_open_per_applicant
on business_applications(applicant_id)
where state in ('submitted','under_review','awaiting_payment','active');

alter table business_applications enable row level security;

create policy business_applications_read
on business_applications for select
using (
  applicant_id = auth.uid()
  or has_platform_role(array['moderator','administrator']::app_role[])
);

create or replace function submit_business_application(
  p_business_name text,
  p_contact_name text,
  p_locality text,
  p_website_url text,
  p_message text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  application_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if char_length(trim(coalesce(p_business_name, ''))) not between 2 and 160
    or char_length(trim(coalesce(p_contact_name, ''))) not between 2 and 120
    or char_length(trim(coalesce(p_locality, ''))) not between 2 and 120
    or char_length(trim(coalesce(p_message, ''))) not between 20 and 2000
  then
    raise exception 'invalid business application';
  end if;
  if nullif(trim(coalesce(p_website_url, '')), '') is not null
    and p_website_url !~ '^https://'
  then
    raise exception 'website must use https';
  end if;
  if exists(
    select 1 from business_applications
    where applicant_id = auth.uid()
      and state in ('submitted','under_review','awaiting_payment','active')
  ) then
    raise exception 'an active business application already exists';
  end if;

  insert into business_applications(
    applicant_id,
    business_name,
    contact_name,
    locality,
    website_url,
    message
  ) values (
    auth.uid(),
    trim(p_business_name),
    trim(p_contact_name),
    trim(p_locality),
    nullif(trim(coalesce(p_website_url, '')), ''),
    trim(p_message)
  )
  returning id into application_id;

  return application_id;
end;
$$;

create or replace function review_business_application(
  p_application uuid,
  p_state text,
  p_reason text,
  p_waive_payment boolean default false
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  applicant uuid;
begin
  if not has_platform_role(array['moderator','administrator']::app_role[]) then
    raise exception 'staff role required';
  end if;
  if p_state not in ('under_review','awaiting_payment','active','rejected')
    or char_length(trim(coalesce(p_reason, ''))) < 10
  then
    raise exception 'invalid application decision';
  end if;
  if p_state = 'active' and not p_waive_payment then
    raise exception 'payment confirmation or explicit waiver required';
  end if;

  select applicant_id into applicant
  from business_applications
  where id = p_application
  for update;
  if applicant is null then raise exception 'application not found'; end if;

  update business_applications
  set state = p_state,
      payment_state = case
        when p_state = 'active' and p_waive_payment then 'waived'
        when p_state = 'awaiting_payment' then 'pending'
        else payment_state
      end,
      reviewed_by = auth.uid(),
      review_reason = trim(p_reason),
      reviewed_at = now(),
      updated_at = now()
  where id = p_application;

  if p_state = 'active' then
    update profiles
    set app_role = 'organiser', updated_at = now()
    where id = applicant and app_role = 'consumer';
  end if;

  insert into moderation_actions(
    actor_id, action, target_type, target_id, reason, metadata
  ) values (
    auth.uid(),
    'business_application_' || p_state,
    'business_application',
    p_application,
    trim(p_reason),
    jsonb_build_object('payment_waived', p_waive_payment)
  );
end;
$$;

revoke all on function submit_business_application(text,text,text,text,text) from public;
revoke all on function review_business_application(uuid,text,text,boolean) from public;
grant execute on function submit_business_application(text,text,text,text,text) to authenticated;
grant execute on function review_business_application(uuid,text,text,boolean) to authenticated;

create or replace function operator_update_venue(
  p_venue uuid,
  p_name text,
  p_description_es text,
  p_description_en text,
  p_address text,
  p_status content_status,
  p_verified boolean,
  p_reason text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not has_platform_role(array['moderator','administrator']::app_role[]) then
    raise exception 'staff role required';
  end if;
  if char_length(trim(coalesce(p_name, ''))) not between 2 and 120
    or char_length(trim(coalesce(p_description_es, ''))) not between 20 and 2000
    or char_length(trim(coalesce(p_address, ''))) not between 5 and 300
    or char_length(trim(coalesce(p_reason, ''))) < 10
  then
    raise exception 'invalid venue update';
  end if;

  update venues
  set name = trim(p_name),
      description_es = trim(p_description_es),
      description_en = nullif(trim(coalesce(p_description_en, '')), ''),
      address = trim(p_address),
      status = p_status,
      verified = p_verified,
      updated_at = now()
  where id = p_venue;
  if not found then raise exception 'venue not found'; end if;

  insert into moderation_actions(
    actor_id, action, target_type, target_id, reason, metadata
  ) values (
    auth.uid(), 'operator_updated', 'venue', p_venue, trim(p_reason),
    jsonb_build_object('status', p_status, 'verified', p_verified)
  );
end;
$$;

create or replace function operator_update_event(
  p_event uuid,
  p_title_es text,
  p_title_en text,
  p_description_es text,
  p_description_en text,
  p_price_cents integer,
  p_booking_url text,
  p_status content_status,
  p_reason text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not has_platform_role(array['moderator','administrator']::app_role[]) then
    raise exception 'staff role required';
  end if;
  if char_length(trim(coalesce(p_title_es, ''))) not between 3 and 160
    or char_length(trim(coalesce(p_description_es, ''))) not between 20 and 4000
    or p_price_cents not between 0 and 1000000
    or char_length(trim(coalesce(p_reason, ''))) < 10
  then
    raise exception 'invalid event update';
  end if;
  if nullif(trim(coalesce(p_booking_url, '')), '') is not null
    and p_booking_url !~ '^https://'
  then
    raise exception 'booking URL must use https';
  end if;

  update events
  set title_es = trim(p_title_es),
      title_en = nullif(trim(coalesce(p_title_en, '')), ''),
      description_es = trim(p_description_es),
      description_en = nullif(trim(coalesce(p_description_en, '')), ''),
      price_cents = p_price_cents,
      booking_url = nullif(trim(coalesce(p_booking_url, '')), ''),
      status = p_status,
      updated_at = now()
  where id = p_event;
  if not found then raise exception 'event not found'; end if;

  insert into moderation_actions(
    actor_id, action, target_type, target_id, reason, metadata
  ) values (
    auth.uid(), 'operator_updated', 'event', p_event, trim(p_reason),
    jsonb_build_object('status', p_status)
  );
end;
$$;

create or replace function operator_delete_catalogue_item(
  p_target_type text,
  p_target_id uuid,
  p_confirmation text,
  p_reason text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  removed_events uuid[];
begin
  if not has_platform_role(array['moderator','administrator']::app_role[]) then
    raise exception 'staff role required';
  end if;
  if p_target_type not in ('venue','event')
    or p_confirmation <> 'DELETE'
    or char_length(trim(coalesce(p_reason, ''))) < 10
  then
    raise exception 'confirmation and reason required';
  end if;

  if p_target_type = 'event' then
    update event_submissions set duplicate_of = null where duplicate_of = p_target_id;
    delete from events where id = p_target_id;
  else
    select coalesce(array_agg(id), array[]::uuid[])
    into removed_events
    from events
    where venue_id = p_target_id;
    update event_submissions
    set duplicate_of = null
    where duplicate_of = any(removed_events);
    delete from venues where id = p_target_id;
  end if;
  if not found then raise exception 'catalogue item not found'; end if;

  insert into moderation_actions(
    actor_id, action, target_type, target_id, reason, metadata
  ) values (
    auth.uid(), 'operator_deleted', p_target_type, p_target_id, trim(p_reason),
    jsonb_build_object('event_ids', coalesce(removed_events, array[]::uuid[]))
  );
end;
$$;

revoke all on function operator_update_venue(uuid,text,text,text,text,content_status,boolean,text) from public;
revoke all on function operator_update_event(uuid,text,text,text,text,integer,text,content_status,text) from public;
revoke all on function operator_delete_catalogue_item(text,uuid,text,text) from public;
grant execute on function operator_update_venue(uuid,text,text,text,text,content_status,boolean,text) to authenticated;
grant execute on function operator_update_event(uuid,text,text,text,text,integer,text,content_status,text) to authenticated;
grant execute on function operator_delete_catalogue_item(text,uuid,text,text) to authenticated;

create or replace function create_owned_venue_in_spain(
  locality_name text,
  province_name text,
  venue_name text,
  venue_slug text,
  description_es text,
  description_en text,
  venue_address text,
  latitude double precision,
  longitude double precision
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid := gen_random_uuid();
  city_id uuid;
  city_slug text;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not has_platform_role(array['organiser','administrator']::app_role[]) then
    raise exception 'approved business account required';
  end if;
  if latitude not between 27.0 and 44.5
    or longitude not between -19.0 and 5.0
  then
    raise exception 'coordinates must be in Spain';
  end if;
  if char_length(trim(locality_name)) < 2
    or char_length(trim(venue_name)) < 2
  then
    raise exception 'invalid locality or venue';
  end if;

  city_slug := trim(
    both '-' from regexp_replace(
      lower(unaccent(trim(locality_name || '-' || province_name))),
      '[^a-z0-9]+',
      '-',
      'g'
    )
  );
  insert into cities(id,slug,name_es,name_en,center)
  values(
    gen_random_uuid(),
    city_slug,
    trim(locality_name),
    trim(locality_name),
    st_setsrid(st_makepoint(longitude,latitude),4326)::geography
  )
  on conflict(slug) do update set name_es = excluded.name_es
  returning id into city_id;

  insert into venues(
    id,city_id,slug,name,description_es,description_en,address,location,status
  ) values (
    new_id,
    city_id,
    lower(trim(venue_slug)),
    trim(venue_name),
    trim(description_es),
    nullif(trim(description_en),''),
    trim(venue_address),
    st_setsrid(st_makepoint(longitude,latitude),4326)::geography,
    'pending'
  );
  insert into venue_members(venue_id,profile_id,role)
  values(new_id,auth.uid(),'owner');
  return new_id;
end;
$$;

revoke all on function create_owned_venue_in_spain(
  text,text,text,text,text,text,text,double precision,double precision
) from public;
grant execute on function create_owned_venue_in_spain(
  text,text,text,text,text,text,text,double precision,double precision
) to authenticated;

commit;

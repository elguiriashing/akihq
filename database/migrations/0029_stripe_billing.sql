begin;

alter table business_applications
  drop constraint business_applications_payment_state_check;
alter table business_applications
  add constraint business_applications_payment_state_check
  check (payment_state in ('not_started','pending','paid','trial','waived','failed'));

create table billing_customers (
  profile_id uuid primary key references profiles(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table billing_subscriptions (
  stripe_subscription_id text primary key,
  profile_id uuid not null references profiles(id) on delete cascade,
  stripe_customer_id text not null,
  plan_code text not null check (plan_code in ('premium','business')),
  billing_interval text not null check (billing_interval in ('month','year')),
  status text not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index billing_subscriptions_profile_idx
  on billing_subscriptions(profile_id, plan_code, status);

create table staff_billing_grants (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  plan_code text not null check (plan_code in ('premium','business')),
  grant_kind text not null check (grant_kind in ('trial_1_month','trial_3_month','waived')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  active boolean not null default true,
  granted_by uuid not null references profiles(id),
  reason text not null check (char_length(reason) between 10 and 2000),
  created_at timestamptz not null default now()
);
create index staff_billing_grants_active_idx
  on staff_billing_grants(profile_id, plan_code, active);

create table stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  state text not null default 'processing'
    check (state in ('processing','processed','failed')),
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table billing_customers enable row level security;
alter table billing_subscriptions enable row level security;
alter table staff_billing_grants enable row level security;
alter table stripe_webhook_events enable row level security;

create policy billing_customers_read on billing_customers for select
using (
  profile_id = auth.uid()
  or has_platform_role(array['moderator','administrator']::app_role[])
);
create policy billing_subscriptions_read on billing_subscriptions for select
using (
  profile_id = auth.uid()
  or has_platform_role(array['moderator','administrator']::app_role[])
);
create policy staff_billing_grants_read on staff_billing_grants for select
using (
  profile_id = auth.uid()
  or has_platform_role(array['moderator','administrator']::app_role[])
);
create policy stripe_webhook_events_staff_read on stripe_webhook_events for select
using (has_platform_role(array['administrator']::app_role[]));

create or replace function has_active_entitlement(
  p_profile uuid,
  p_plan text
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_plan in ('premium','business') and (
    exists(
      select 1
      from billing_subscriptions
      where profile_id = p_profile
        and plan_code = p_plan
        and status in ('active','trialing')
        and (current_period_end is null or current_period_end > now())
    )
    or exists(
      select 1
      from staff_billing_grants
      where profile_id = p_profile
        and plan_code = p_plan
        and active
        and (expires_at is null or expires_at > now())
    )
  );
$$;

create or replace function grant_staff_billing_access(
  p_profile uuid,
  p_plan text,
  p_grant_kind text,
  p_reason text,
  p_application uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  grant_id uuid;
  expiry timestamptz;
begin
  if not has_platform_role(array['moderator','administrator']::app_role[]) then
    raise exception 'staff role required';
  end if;
  if p_plan not in ('premium','business')
    or p_grant_kind not in ('trial_1_month','trial_3_month','waived')
    or char_length(trim(coalesce(p_reason, ''))) < 10
  then
    raise exception 'invalid billing grant';
  end if;
  if not exists(select 1 from profiles where id = p_profile) then
    raise exception 'profile not found';
  end if;
  if p_application is not null and (
    p_plan <> 'business'
    or not exists(
      select 1 from business_applications
      where id = p_application and applicant_id = p_profile
    )
  ) then
    raise exception 'application does not match profile';
  end if;

  expiry := case p_grant_kind
    when 'trial_1_month' then now() + interval '1 month'
    when 'trial_3_month' then now() + interval '3 months'
    else null
  end;

  update staff_billing_grants
  set active = false
  where profile_id = p_profile and plan_code = p_plan and active;

  insert into staff_billing_grants(
    profile_id, plan_code, grant_kind, expires_at, granted_by, reason
  ) values (
    p_profile, p_plan, p_grant_kind, expiry, auth.uid(), trim(p_reason)
  ) returning id into grant_id;

  if p_plan = 'business' then
    update profiles
    set app_role = 'organiser', updated_at = now()
    where id = p_profile and app_role = 'consumer';

    if p_application is not null then
      update business_applications
      set state = 'active',
          payment_state = case
            when p_grant_kind = 'waived' then 'waived'
            else 'trial'
          end,
          reviewed_by = auth.uid(),
          review_reason = trim(p_reason),
          reviewed_at = now(),
          updated_at = now()
      where id = p_application;
    end if;
  end if;

  insert into moderation_actions(
    actor_id, action, target_type, target_id, reason, metadata
  ) values (
    auth.uid(), 'billing_access_granted', 'profile', p_profile, trim(p_reason),
    jsonb_build_object(
      'grant_id', grant_id,
      'plan_code', p_plan,
      'grant_kind', p_grant_kind,
      'expires_at', expiry,
      'application_id', p_application
    )
  );
  return grant_id;
end;
$$;

create or replace function review_business_application(
  p_application uuid,
  p_state text,
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
  if p_state not in ('under_review','awaiting_payment','rejected')
    or char_length(trim(coalesce(p_reason, ''))) < 10
  then
    raise exception 'invalid application decision';
  end if;

  update business_applications
  set state = p_state,
      payment_state = case
        when p_state = 'awaiting_payment' then 'pending'
        when p_state = 'rejected' then 'not_started'
        else payment_state
      end,
      reviewed_by = auth.uid(),
      review_reason = trim(p_reason),
      reviewed_at = now(),
      updated_at = now()
  where id = p_application;
  if not found then raise exception 'application not found'; end if;

  insert into moderation_actions(
    actor_id, action, target_type, target_id, reason, metadata
  ) values (
    auth.uid(), 'business_application_' || p_state,
    'business_application', p_application, trim(p_reason), '{}'::jsonb
  );
end;
$$;

drop function if exists review_business_application(uuid,text,text,boolean);

revoke all on function has_active_entitlement(uuid,text) from public;
revoke all on function grant_staff_billing_access(uuid,text,text,text,uuid) from public;
revoke all on function review_business_application(uuid,text,text) from public;
grant execute on function has_active_entitlement(uuid,text) to authenticated;
grant execute on function grant_staff_billing_access(uuid,text,text,text,uuid) to authenticated;
grant execute on function review_business_application(uuid,text,text) to authenticated;

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
  if not has_platform_role(array['administrator']::app_role[])
    and not (
      has_platform_role(array['organiser']::app_role[])
      and has_active_entitlement(auth.uid(), 'business')
    )
  then
    raise exception 'active business subscription required';
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
      '[^a-z0-9]+', '-', 'g'
    )
  );
  insert into cities(id,slug,name_es,name_en,center)
  values(
    gen_random_uuid(), city_slug, trim(locality_name), trim(locality_name),
    st_setsrid(st_makepoint(longitude,latitude),4326)::geography
  )
  on conflict(slug) do update set name_es = excluded.name_es
  returning id into city_id;

  insert into venues(
    id,city_id,slug,name,description_es,description_en,address,location,status
  ) values (
    new_id, city_id, lower(trim(venue_slug)), trim(venue_name),
    trim(description_es), nullif(trim(description_en),''),
    trim(venue_address),
    st_setsrid(st_makepoint(longitude,latitude),4326)::geography, 'pending'
  );
  insert into venue_members(venue_id,profile_id,role)
  values(new_id,auth.uid(),'owner');
  return new_id;
end;
$$;

commit;

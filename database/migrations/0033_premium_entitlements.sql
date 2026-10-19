begin;

alter table profiles
  add column membership_tier text not null default 'free'
    check (membership_tier in ('free','premium')),
  add column business_plan_active boolean not null default false;

-- Membership state is webhook-owned. Self-service profile edits continue through
-- update_own_profile and cannot mutate paid fields directly.
revoke update on profiles from anon, authenticated;
grant update(display_name, preferred_locale) on profiles to authenticated;

alter table offers
  add column audience text not null default 'public'
    check (audience in ('public','premium'));

alter table billing_subscriptions
  add column stripe_event_created_at timestamptz;

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
      from profiles
      where id = p_profile and app_role = 'administrator'
    )
    or exists(
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

create or replace function reconcile_profile_entitlements(
  p_profile uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_premium boolean;
  v_business boolean;
  v_paid_business boolean;
  v_business_grant text;
  v_latest_business_status text;
begin
  if p_profile is null or not exists(select 1 from profiles where id = p_profile) then
    raise exception 'profile not found';
  end if;

  v_premium := has_active_entitlement(p_profile, 'premium');
  v_business := has_active_entitlement(p_profile, 'business');

  select exists(
    select 1
    from billing_subscriptions
    where profile_id = p_profile
      and plan_code = 'business'
      and status in ('active','trialing')
      and (current_period_end is null or current_period_end > now())
  ) into v_paid_business;

  select grant_kind
  into v_business_grant
  from staff_billing_grants
  where profile_id = p_profile
    and plan_code = 'business'
    and active
    and (expires_at is null or expires_at > now())
  order by created_at desc
  limit 1;

  select status
  into v_latest_business_status
  from billing_subscriptions
  where profile_id = p_profile and plan_code = 'business'
  order by stripe_event_created_at desc nulls last, updated_at desc
  limit 1;

  update profiles
  set membership_tier = case when v_premium then 'premium' else 'free' end,
      business_plan_active = v_business,
      app_role = case
        when v_business and app_role = 'consumer' then 'organiser'::app_role
        when not v_business
          and app_role = 'organiser'
          and not exists(
            select 1 from venue_members
            where profile_id = p_profile and role in ('manager','owner')
          )
          then 'consumer'::app_role
        else app_role
      end,
      updated_at = now()
  where id = p_profile;

  if v_business then
    update business_applications
    set state = 'active',
        payment_state = case
          when v_paid_business then 'paid'
          when v_business_grant = 'waived' then 'waived'
          else 'trial'
        end,
        updated_at = now()
    where applicant_id = p_profile
      and state in ('under_review','awaiting_payment','active');
  else
    update business_applications
    set state = 'awaiting_payment',
        payment_state = case
          when v_latest_business_status in ('past_due','incomplete','incomplete_expired') then 'failed'
          when v_latest_business_status in ('canceled','unpaid','paused') then 'cancelled'
          else payment_state
        end,
        updated_at = now()
    where applicant_id = p_profile
      and state = 'active'
      and payment_state in ('paid','trial');
  end if;
end;
$$;

alter table business_applications
  drop constraint business_applications_payment_state_check;
alter table business_applications
  add constraint business_applications_payment_state_check
  check (payment_state in ('not_started','pending','paid','trial','waived','failed','cancelled'));

create or replace function sync_profile_entitlements_from_billing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform reconcile_profile_entitlements(old.profile_id);
    return old;
  end if;
  if tg_op = 'UPDATE' and old.profile_id is distinct from new.profile_id then
    perform reconcile_profile_entitlements(old.profile_id);
  end if;
  perform reconcile_profile_entitlements(new.profile_id);
  return new;
end;
$$;

create trigger billing_subscriptions_reconcile_profile
after insert or update or delete on billing_subscriptions
for each row execute function sync_profile_entitlements_from_billing();

create trigger staff_billing_grants_reconcile_profile
after insert or update or delete on staff_billing_grants
for each row execute function sync_profile_entitlements_from_billing();

create or replace function sync_stripe_subscription(
  p_subscription_id text,
  p_profile uuid,
  p_customer_id text,
  p_plan text,
  p_interval text,
  p_status text,
  p_current_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_event_created_at timestamptz
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changed integer := 0;
begin
  if char_length(trim(coalesce(p_subscription_id, ''))) < 3
    or char_length(trim(coalesce(p_customer_id, ''))) < 3
    or p_profile is null
    or p_plan not in ('premium','business')
    or p_interval not in ('month','year')
    or p_status not in (
      'active','trialing','incomplete','incomplete_expired','past_due',
      'canceled','unpaid','paused'
    )
    or p_event_created_at is null
  then
    raise exception 'invalid Stripe subscription';
  end if;

  insert into billing_subscriptions(
    stripe_subscription_id,
    profile_id,
    stripe_customer_id,
    plan_code,
    billing_interval,
    status,
    current_period_end,
    cancel_at_period_end,
    stripe_event_created_at,
    updated_at
  ) values (
    trim(p_subscription_id),
    p_profile,
    trim(p_customer_id),
    p_plan,
    p_interval,
    p_status,
    p_current_period_end,
    coalesce(p_cancel_at_period_end, false),
    p_event_created_at,
    now()
  )
  on conflict(stripe_subscription_id) do update
  set profile_id = excluded.profile_id,
      stripe_customer_id = excluded.stripe_customer_id,
      plan_code = excluded.plan_code,
      billing_interval = excluded.billing_interval,
      status = excluded.status,
      current_period_end = excluded.current_period_end,
      cancel_at_period_end = excluded.cancel_at_period_end,
      stripe_event_created_at = excluded.stripe_event_created_at,
      updated_at = now()
  where billing_subscriptions.stripe_event_created_at is null
     or excluded.stripe_event_created_at >= billing_subscriptions.stripe_event_created_at;

  get diagnostics v_changed = row_count;
  return v_changed > 0;
end;
$$;

create or replace function is_venue_member(
  target_venue uuid,
  allowed_roles venue_member_role[] default array['editor','manager','owner']::venue_member_role[]
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists(
      select 1 from profiles
      where id = auth.uid() and app_role = 'administrator'
    )
    or (
      has_active_entitlement(auth.uid(), 'business')
      and exists(
        select 1
        from venue_members
        where venue_id = target_venue
          and profile_id = auth.uid()
          and role = any(allowed_roles)
      )
    );
$$;

-- A direct Data API insert cannot bypass the paid Business route guard.
drop policy if exists venue_claims_create on venue_claims;
create policy venue_claims_create on venue_claims for insert
to authenticated
with check (
  claimant_id = auth.uid()
  and has_active_entitlement(auth.uid(), 'business')
);

-- Public offers remain public. Premium offers are visible only to an active
-- Premium account, their venue team, or platform operators.
drop policy if exists offers_visible on offers;
create policy offers_visible on offers for select
to anon, authenticated
using (
  (
    status = 'published'
    and (
      audience = 'public'
      or (
        audience = 'premium'
        and auth.uid() is not null
        and has_active_entitlement(auth.uid(), 'premium')
      )
    )
  )
  or is_venue_member(venue_id)
  or has_platform_role(array['moderator','administrator']::app_role[])
);

create or replace function check_in_by_token(
  p_token uuid,
  p_idempotency_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile uuid := auth.uid();
  v_program loyalty_programs%rowtype;
  v_check_in uuid;
  v_existing check_ins%rowtype;
  v_count integer;
  v_step record;
  v_xp integer;
begin
  if v_profile is null then raise exception 'authentication required'; end if;

  select * into v_program
  from loyalty_programs
  where check_in_token = p_token and active
  for update;
  if v_program.id is null then raise exception 'invalid check-in token'; end if;

  select * into v_existing
  from check_ins
  where profile_id = v_profile and idempotency_key = p_idempotency_key;
  if v_existing.id is not null then
    return jsonb_build_object(
      'state', v_existing.state,
      'check_in_id', v_existing.id
    );
  end if;

  select count(*) into v_count
  from check_ins
  where profile_id = v_profile
    and state = 'accepted'
    and created_at > now() - interval '24 hours';
  if v_count >= 20 then
    insert into check_ins(profile_id,venue_id,idempotency_key,state,risk_flags)
    values(v_profile,v_program.venue_id,p_idempotency_key,'rate_limited',array['daily_limit'])
    returning id into v_check_in;
    return jsonb_build_object('state','rate_limited','check_in_id',v_check_in);
  end if;

  if exists(
    select 1 from check_ins
    where profile_id = v_profile
      and venue_id = v_program.venue_id
      and state = 'accepted'
      and created_at > now() - interval '6 hours'
  ) then
    insert into check_ins(profile_id,venue_id,idempotency_key,state,risk_flags)
    values(v_profile,v_program.venue_id,p_idempotency_key,'cooldown',array['venue_cooldown'])
    returning id into v_check_in;
    return jsonb_build_object('state','cooldown','check_in_id',v_check_in);
  end if;

  v_xp := case when has_active_entitlement(v_profile, 'premium') then 20 else 10 end;

  insert into check_ins(profile_id,venue_id,idempotency_key,state)
  values(v_profile,v_program.venue_id,p_idempotency_key,'accepted')
  returning id into v_check_in;

  insert into loyalty_ledger(profile_id,program_id,check_in_id,delta,reason)
  values(v_profile,v_program.id,v_check_in,1,'check_in');

  insert into xp_ledger(profile_id,check_in_id,delta,reason,idempotency_key)
  values(
    v_profile,
    v_check_in,
    v_xp,
    case when v_xp = 20 then 'premium_check_in' else 'check_in' end,
    'check_in:' || v_check_in
  );

  for v_step in
    select s.id
    from passport_steps s
    join passports p on p.id = s.passport_id
    where s.venue_id = v_program.venue_id
      and p.status = 'published'
      and now() between p.starts_at and p.ends_at
  loop
    insert into passport_progress(profile_id,step_id,check_in_id)
    values(v_profile,v_step.id,v_check_in)
    on conflict do nothing;
  end loop;

  return jsonb_build_object(
    'state','accepted',
    'check_in_id',v_check_in,
    'stamps_awarded',1,
    'xp_awarded',v_xp,
    'premium_boost',v_xp = 20
  );
end;
$$;

revoke all on function reconcile_profile_entitlements(uuid) from public;
revoke all on function sync_profile_entitlements_from_billing() from public;
revoke all on function sync_stripe_subscription(text,uuid,text,text,text,text,timestamptz,boolean,timestamptz) from public;
revoke all on function is_venue_member(uuid,venue_member_role[]) from public;
revoke all on function check_in_by_token(uuid,uuid) from public;

grant execute on function reconcile_profile_entitlements(uuid) to service_role;
grant execute on function sync_stripe_subscription(text,uuid,text,text,text,text,timestamptz,boolean,timestamptz) to service_role;
grant execute on function is_venue_member(uuid,venue_member_role[]) to anon, authenticated;
grant execute on function check_in_by_token(uuid,uuid) to authenticated;

-- Ensure every existing profile reflects current billing/grant state.
do $$
declare
  v_profile uuid;
begin
  for v_profile in select id from profiles loop
    perform reconcile_profile_entitlements(v_profile);
  end loop;
end;
$$;

commit;

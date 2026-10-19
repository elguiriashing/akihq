-- Additive repair. Ownership is independent of paid subscriptions.
-- Rollback: restore prior function/trigger definitions; retain billing timestamps.
begin;

alter table public.profiles add column if not exists membership_tier text not null default 'free'
  check (membership_tier in ('free','premium'));
create or replace function public.protect_membership_tier()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated','anon') and new.membership_tier is distinct from old.membership_tier then
    raise exception 'Membership is managed by billing' using errcode='42501';
  end if;
  return new;
end;
$$;
create trigger profiles_protect_membership_tier before update on public.profiles
for each row execute function public.protect_membership_tier();

alter table public.billing_subscriptions add column if not exists stripe_event_created_at timestamptz;
alter table public.stripe_webhook_events add column if not exists processing_started_at timestamptz not null default now();

create or replace function public.has_free_business_access(p_profile uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.venue_members m join public.venues v on v.id=m.venue_id
    where m.profile_id=p_profile and m.role in ('owner','manager') and v.verified and v.status='published'
  );
$$;
revoke all on function public.has_free_business_access(uuid) from public,anon;
grant execute on function public.has_free_business_access(uuid) to authenticated,service_role;

create or replace function public.has_active_entitlement(p_profile uuid,p_plan text)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_plan in ('premium','business','business_pro') and (
    exists(select 1 from public.profiles p where p.id=p_profile and p.app_role='administrator')
    or (p_plan='business' and public.has_free_business_access(p_profile))
    or exists(select 1 from public.billing_subscriptions s where s.profile_id=p_profile
      and (s.plan_code=p_plan or (p_plan='business' and s.plan_code='business_pro'))
      and s.status in ('active','trialing') and (s.current_period_end is null or s.current_period_end>now()))
    or exists(select 1 from public.staff_billing_grants g where g.profile_id=p_profile
      and (g.plan_code=p_plan or (p_plan='business' and g.plan_code='business_pro'))
      and g.active and (g.expires_at is null or g.expires_at>now()))
  );
$$;

create or replace function public.reconcile_profile_entitlements(p_profile uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_premium boolean;
  v_business boolean;
  v_business_pro boolean;
  v_paid_business boolean;
  v_business_grant text;
  v_latest_business_status text;
begin
  if p_profile is null or not exists(select 1 from public.profiles where id = p_profile) then
    raise exception 'profile not found';
  end if;
  v_premium := public.has_active_entitlement(p_profile,'premium');
  v_business_pro := public.has_active_entitlement(p_profile,'business_pro');
  v_business := public.has_active_entitlement(p_profile,'business');

  select exists(
    select 1 from public.billing_subscriptions subscription
    where subscription.profile_id = p_profile
      and subscription.plan_code in ('business','business_pro')
      and subscription.status in ('active','trialing')
      and (subscription.current_period_end is null or subscription.current_period_end > now())
  ) into v_paid_business;
  select grant_record.grant_kind into v_business_grant
  from public.staff_billing_grants grant_record
  where grant_record.profile_id = p_profile
    and grant_record.plan_code in ('business_pro','business')
    and grant_record.active
    and (grant_record.expires_at is null or grant_record.expires_at > now())
  order by case when grant_record.plan_code = 'business_pro' then 0 else 1 end,grant_record.created_at desc
  limit 1;
  select subscription.status into v_latest_business_status
  from public.billing_subscriptions subscription
  where subscription.profile_id = p_profile
    and subscription.plan_code in ('business_pro','business')
  order by subscription.stripe_event_created_at desc nulls last,subscription.updated_at desc
  limit 1;

  update public.profiles profile
  set membership_tier = case when v_premium then 'premium' else 'free' end,
      business_plan_active = v_business,
      business_tier = case when v_business_pro then 'business_pro' when v_business then 'business' else 'none' end,
      app_role = case
        when v_business and profile.app_role = 'consumer'::public.app_role then 'organiser'::public.app_role
        when not v_business and profile.app_role = 'organiser'::public.app_role
          and not exists (
            select 1 from public.venue_members member
            where member.profile_id = p_profile and member.role in ('manager','owner')
          ) then 'consumer'::public.app_role
        else profile.app_role
      end,
      updated_at = now()
  where profile.id = p_profile;

  if v_business then
    update public.business_applications application
    set state = 'active',
        payment_state = case when v_paid_business then 'paid' when v_business_grant = 'waived' or public.has_free_business_access(p_profile) then 'waived' else 'trial' end,
        updated_at = now()
    where application.applicant_id = p_profile
      and application.state in ('under_review','awaiting_payment','active');
  else
    update public.business_applications application
    set state = 'awaiting_payment',
        payment_state = case
          when v_latest_business_status in ('past_due','incomplete','incomplete_expired') then 'failed'
          when v_latest_business_status in ('canceled','unpaid','paused') then 'cancelled'
          else application.payment_state
        end,
        updated_at = now()
    where application.applicant_id = p_profile
      and application.state = 'active'
      and application.payment_state in ('paid','trial');
  end if;
end;
$$;

-- Restore missing live billing reconciliation triggers as well as the column.
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

drop trigger if exists billing_subscriptions_reconcile_profile on public.billing_subscriptions;
create trigger billing_subscriptions_reconcile_profile
after insert or update or delete on billing_subscriptions
for each row execute function sync_profile_entitlements_from_billing();

drop trigger if exists staff_billing_grants_reconcile_profile on public.staff_billing_grants;
create trigger staff_billing_grants_reconcile_profile
after insert or update or delete on staff_billing_grants
for each row execute function sync_profile_entitlements_from_billing();


-- Keep navigation/profile mirrors current on grant AND revocation. Never grant Pro.
create or replace function public.promote_business_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op in ('DELETE','UPDATE') then
    if exists(select 1 from public.profiles where id=old.profile_id) then
      perform public.reconcile_profile_entitlements(old.profile_id);
    end if;
  end if;
  if tg_op in ('INSERT','UPDATE') then
    perform public.reconcile_profile_entitlements(new.profile_id);
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
drop trigger if exists on_business_membership_created on public.venue_members;
create trigger on_business_membership_created after insert or update or delete on public.venue_members
for each row execute function public.promote_business_owner();

-- Claim approval marks a venue verified after inserting membership, so reconcile
-- on venue verification too. Suspension/rejection immediately removes free access.
create or replace function public.reconcile_venue_access()
returns trigger language plpgsql security definer set search_path = '' as $$
declare member record;
begin
  for member in select profile_id from public.venue_members where venue_id=new.id loop
    perform public.reconcile_profile_entitlements(member.profile_id);
  end loop;
  return new;
end;
$$;
create trigger venue_access_changed after update of verified,status on public.venues
for each row when (old.verified is distinct from new.verified or old.status is distinct from new.status)
execute function public.reconcile_venue_access();

-- Consumers must be able to apply before owning a venue or paying. Approval
-- remains staff-only in moderate_item; this grants no ownership on submission.
drop policy if exists venue_claims_create on public.venue_claims;
create policy venue_claims_create on public.venue_claims for insert to authenticated
with check (claimant_id=(select auth.uid()) and status='pending'
  and decided_by is null and decided_at is null and decision_reason is null);

create or replace function public.claim_stripe_webhook_event(p_event_id text,p_event_type text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare event_row public.stripe_webhook_events%rowtype; inserted integer;
begin
  if char_length(trim(coalesce(p_event_id,'')))<3 or char_length(trim(coalesce(p_event_type,'')))<3 then
    raise exception 'invalid stripe event';
  end if;
  insert into public.stripe_webhook_events(event_id,event_type,processing_started_at)
  values(trim(p_event_id),trim(p_event_type),now()) on conflict(event_id) do nothing;
  get diagnostics inserted=row_count;
  if inserted=1 then return true; end if;
  select * into event_row from public.stripe_webhook_events where event_id=trim(p_event_id) for update;
  if event_row.state='processed' then return false; end if;
  if event_row.state='processing' and event_row.processing_started_at>now()-interval '5 minutes' then
    raise exception 'event processing in progress'; -- return non-2xx so Stripe retries
  end if;
  update public.stripe_webhook_events set state='processing',event_type=trim(p_event_type),
    processing_started_at=now(),error=null,processed_at=null where event_id=trim(p_event_id);
  return true;
end;
$$;

-- Backfill existing approved owners without inventing subscriptions or waivers.
do $$ declare member record; begin
  for member in select distinct profile_id from public.venue_members loop
    perform public.reconcile_profile_entitlements(member.profile_id);
  end loop;
end $$;
commit;

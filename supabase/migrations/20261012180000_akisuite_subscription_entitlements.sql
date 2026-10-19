-- Additive AkiSuite ledger. This pending migration has never been applied to production.
-- Business benefits are workspace-owned; legacy personal billing/grants remain authoritative.
begin;
create schema if not exists akisuite_private;
revoke all on schema akisuite_private from public, anon, authenticated;

create table public.akisuite_billing_subscriptions (
  stripe_subscription_id text primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  workspace_id text references public.crm_workspaces(id) on delete restrict,
  stripe_customer_id text not null,
  plan_code text not null check (plan_code in (
    'akipasa_premium','akibusiness_premium','akiduermo_premium',
    'akihq_standard','akihq_pro','akihq_business_addon','aki_enterprise'
  )),
  billing_interval text not null check (billing_interval in ('month','year')),
  status text not null check (status in (
    'active','trialing','incomplete','incomplete_expired','past_due','canceled','unpaid','paused'
  )),
  current_period_end timestamptz not null,
  cancel_at_period_end boolean not null default false,
  stripe_event_created_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint akisuite_billing_scope check (
    (plan_code='akipasa_premium' and workspace_id is null)
    or (plan_code<>'akipasa_premium' and workspace_id is not null)
  )
);
create index akisuite_billing_subscriptions_profile_idx
  on public.akisuite_billing_subscriptions(profile_id,plan_code,status);
create index akisuite_billing_subscriptions_workspace_idx
  on public.akisuite_billing_subscriptions(workspace_id,plan_code,status);
alter table public.akisuite_billing_subscriptions enable row level security;
revoke all on public.akisuite_billing_subscriptions from public,anon,authenticated;
grant select on public.akisuite_billing_subscriptions to authenticated;
grant select,insert,update,delete on public.akisuite_billing_subscriptions to service_role;
create policy akisuite_billing_subscriptions_read on public.akisuite_billing_subscriptions
  for select to authenticated using (profile_id = (select auth.uid()));

-- Internal lookup: never grant EXECUTE or expose this schema to the Data API.
create function akisuite_private.paid_pro(p_workspace text,p_allow_ending boolean default false)
returns boolean language sql stable set search_path='' as $$
  select exists(select 1 from public.akisuite_billing_subscriptions s join public.crm_workspaces w on w.id=s.workspace_id
    where s.workspace_id=p_workspace and s.plan_code='akihq_pro' and s.status='active' and s.current_period_end>now()
      and (p_allow_ending or not s.cancel_at_period_end) and w.owner_profile_id=s.profile_id and w.status in ('active','trial'));
$$;
revoke all on function akisuite_private.paid_pro(text,boolean) from public,anon,authenticated;

create function akisuite_private.plan_active(p_profile uuid,p_workspace text,p_plan text)
returns boolean language sql stable set search_path = '' as $$
  with paid as (
    select s.plan_code from public.akisuite_billing_subscriptions s
    where s.status in ('active','trialing') and s.current_period_end > now()
      and case when p_plan='akipasa_premium' then s.profile_id=p_profile
        else s.workspace_id=p_workspace and exists (
          select 1 from public.crm_workspaces w where w.id=p_workspace
            and w.owner_profile_id=s.profile_id and w.status in ('active','trial')
        ) end
  ), legacy as (
    select s.plan_code from public.billing_subscriptions s
      where s.profile_id=case when p_workspace is null then p_profile
        else (select owner_profile_id from public.crm_workspaces where id=p_workspace) end
        and s.status in ('active','trialing')
        and (s.current_period_end is null or s.current_period_end>now())
    union all
    select g.plan_code from public.staff_billing_grants g
      where g.profile_id=case when p_workspace is null then p_profile
        else (select owner_profile_id from public.crm_workspaces where id=p_workspace) end
        and g.active and g.starts_at<=now() and (g.expires_at is null or g.expires_at>now())
  )
  select
    exists(select 1 from paid where plan_code=p_plan and p_plan<>'akihq_business_addon')
    or (p_plan in ('aki_enterprise','akipasa_premium','akibusiness_premium','akiduermo_premium','akihq_pro','akihq_standard')
      and exists(select 1 from paid where plan_code='aki_enterprise'))
    or (p_plan='akipasa_premium' and exists(select 1 from legacy where plan_code='premium'))
    or (p_plan='akihq_standard' and (
      exists(select 1 from paid where plan_code='akihq_pro')
      or exists(select 1 from legacy where plan_code in ('business','business_pro'))))
    or (p_plan='akihq_pro' and exists(select 1 from legacy where plan_code='business_pro'))
    -- Keep the event/media benefits of pre-rollout Business subscribers and staff grants.
    or (p_plan='akibusiness_premium' and exists(select 1 from legacy where plan_code in ('business','business_pro')))
    or (p_plan in ('akibusiness_premium','akihq_business_addon')
      and exists(select 1 from paid where plan_code='akihq_business_addon')
      and akisuite_private.paid_pro(p_workspace,true));
$$;
revoke all on function akisuite_private.plan_active(uuid,text,text) from public,anon,authenticated;

create function public.has_akisuite_plan(p_profile uuid,p_plan text)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_profile=(select auth.uid()) and p_plan='akipasa_premium'
    and akisuite_private.plan_active(p_profile,null,p_plan);
$$;
revoke all on function public.has_akisuite_plan(uuid,text) from public,anon;
grant execute on function public.has_akisuite_plan(uuid,text) to authenticated;

create function public.has_akisuite_workspace_plan(p_workspace text,p_plan text)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.crm_workspace_members m join public.crm_workspaces w on w.id=m.workspace_id
    where m.workspace_id=p_workspace and m.profile_id=(select auth.uid()) and m.status='active'
      and w.status in ('active','trial')
  ) and akisuite_private.plan_active(null,p_workspace,p_plan);
$$;
revoke all on function public.has_akisuite_workspace_plan(text,text) from public,anon;
grant execute on function public.has_akisuite_workspace_plan(text,text) to authenticated;

create function public.akisuite_addon_eligible(p_workspace text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.crm_workspaces w where w.id=p_workspace and w.owner_profile_id=(select auth.uid()))
    and akisuite_private.paid_pro(p_workspace,false) and not akisuite_private.plan_active(null,p_workspace,'aki_enterprise');
$$;
revoke all on function public.akisuite_addon_eligible(text) from public,anon;
grant execute on function public.akisuite_addon_eligible(text) to authenticated;

-- No user-level AkiHQ upgrade. Free venue access and every legacy paid/staff grant survive.
create or replace function public.has_active_entitlement(p_profile uuid,p_plan text)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_plan in ('premium','business','business_pro') and (
    exists(select 1 from public.profiles p where p.id=p_profile and p.app_role='administrator')
    or (p_plan='business' and public.has_free_business_access(p_profile))
    or (p_plan='premium' and akisuite_private.plan_active(p_profile,null,'akipasa_premium'))
    or exists(select 1 from public.billing_subscriptions s where s.profile_id=p_profile
      and (s.plan_code=p_plan or (p_plan='business' and s.plan_code='business_pro'))
      and s.status in ('active','trialing') and (s.current_period_end is null or s.current_period_end>now()))
    or exists(select 1 from public.staff_billing_grants g where g.profile_id=p_profile
      and (g.plan_code=p_plan or (p_plan='business' and g.plan_code='business_pro'))
      and g.active and (g.expires_at is null or g.expires_at>now()))
  );
$$;

create function public.sync_akisuite_subscription(
  p_subscription_id text,p_profile uuid,p_customer_id text,p_plan text,p_interval text,
  p_status text,p_current_period_end timestamptz,p_cancel_at_period_end boolean,
  p_event_created_at timestamptz,p_workspace text default null
) returns boolean language plpgsql security definer set search_path = '' as $$
declare v_changed integer:=0;
begin
  if p_subscription_id is null or p_subscription_id !~ '^sub_[A-Za-z0-9]+$'
    or p_customer_id is null or p_customer_id !~ '^cus_[A-Za-z0-9]+$'
    or p_profile is null or p_plan is null or p_interval is null or p_status is null
    or p_plan not in ('akipasa_premium','akibusiness_premium','akiduermo_premium','akihq_standard','akihq_pro','akihq_business_addon','aki_enterprise')
    or p_interval not in ('month','year')
    or p_status not in ('active','trialing','incomplete','incomplete_expired','past_due','canceled','unpaid','paused')
    or p_current_period_end is null or p_event_created_at is null then
    raise exception 'invalid AkiSuite subscription';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_subscription_id,0));
  if exists(select 1 from public.akisuite_billing_subscriptions s
    where s.stripe_subscription_id=p_subscription_id and (
      s.profile_id<>p_profile or s.stripe_customer_id<>p_customer_id
      or s.workspace_id is distinct from p_workspace
    )) then raise exception 'AkiSuite subscription ownership mismatch'; end if;
  if p_workspace is not null and not exists(
    select 1 from public.crm_workspaces w where w.id=p_workspace and w.owner_profile_id=p_profile
  ) then raise exception 'AkiSuite workspace owner required'; end if;
  if not exists(select 1 from public.billing_customers c where c.profile_id=p_profile
    and c.stripe_customer_id=p_customer_id) then raise exception 'AkiSuite customer ownership mismatch'; end if;
  insert into public.akisuite_billing_subscriptions(
    stripe_subscription_id,profile_id,workspace_id,stripe_customer_id,plan_code,billing_interval,
    status,current_period_end,cancel_at_period_end,stripe_event_created_at,updated_at
  ) values (
    p_subscription_id,p_profile,p_workspace,p_customer_id,p_plan,p_interval,
    p_status,p_current_period_end,coalesce(p_cancel_at_period_end,false),p_event_created_at,now()
  ) on conflict(stripe_subscription_id) do update set
    plan_code=excluded.plan_code,billing_interval=excluded.billing_interval,status=excluded.status,
    current_period_end=excluded.current_period_end,cancel_at_period_end=excluded.cancel_at_period_end,
    stripe_event_created_at=excluded.stripe_event_created_at,updated_at=now()
  where excluded.stripe_event_created_at >= public.akisuite_billing_subscriptions.stripe_event_created_at
    and not (public.akisuite_billing_subscriptions.status in ('canceled','incomplete_expired')
      and excluded.status not in ('canceled','incomplete_expired'));
  get diagnostics v_changed=row_count;
  if v_changed>0 then perform public.reconcile_profile_entitlements(p_profile); end if;
  return v_changed>0;
end;
$$;
revoke all on function public.sync_akisuite_subscription(text,uuid,text,text,text,text,timestamptz,boolean,timestamptz,text)
  from public,anon,authenticated;
grant execute on function public.sync_akisuite_subscription(text,uuid,text,text,text,text,timestamptz,boolean,timestamptz,text)
  to service_role;

-- One pending Checkout per payer and workspace. Stripe receives the same durable key on retries.
create table public.akisuite_checkout_reservations (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  workspace_id text references public.crm_workspaces(id) on delete restrict,
  token uuid not null unique default gen_random_uuid(),
  plan_code text not null,
  billing_interval text not null,
  expires_at timestamptz not null
);
create unique index akisuite_checkout_workspace_pending on public.akisuite_checkout_reservations(workspace_id);
alter table public.akisuite_checkout_reservations enable row level security;
revoke all on public.akisuite_checkout_reservations from public,anon,authenticated;
grant select,insert,update,delete on public.akisuite_checkout_reservations to service_role;

create function public.reserve_akisuite_checkout(p_workspace text,p_plan text,p_interval text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_profile uuid:=(select auth.uid()); v_old public.akisuite_checkout_reservations%rowtype;
begin
  if v_profile is null or p_plan is null or p_interval is null
    or p_plan not in ('akipasa_premium','akibusiness_premium','akiduermo_premium','akihq_standard','akihq_pro','akihq_business_addon','aki_enterprise')
    or p_interval not in ('month','year') then raise exception 'invalid checkout'; end if;
  if (p_plan='akipasa_premium')<>(p_workspace is null) then raise exception 'workspace required'; end if;
  if p_workspace is not null and not exists(select 1 from public.crm_workspaces w
    where w.id=p_workspace and w.owner_profile_id=v_profile and w.status in ('active','trial'))
    then raise exception 'workspace owner required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_profile::text,0));
  if p_workspace is not null then perform pg_advisory_xact_lock(hashtextextended(p_workspace,1)); end if;
  if exists(select 1 from public.akisuite_billing_subscriptions s
    where s.status not in ('canceled','incomplete_expired') and (
      (s.workspace_id=p_workspace or (s.workspace_id is null and s.profile_id=v_profile)
        or (s.profile_id=v_profile and s.plan_code='aki_enterprise' and p_plan in ('akipasa_premium','aki_enterprise')))
      and (s.plan_code=p_plan or s.plan_code='aki_enterprise' or p_plan='aki_enterprise'
        or (s.plan_code in ('akihq_standard','akihq_pro') and p_plan in ('akihq_standard','akihq_pro'))
        or (s.plan_code in ('akibusiness_premium','akihq_business_addon') and p_plan in ('akibusiness_premium','akihq_business_addon')))
    )) then raise exception 'existing subscription'; end if;
  if exists(select 1 from public.billing_subscriptions s where s.profile_id=v_profile
    and s.status not in ('canceled','incomplete_expired') and (p_plan='aki_enterprise'
      or (p_plan='akipasa_premium' and s.plan_code='premium')
      or (p_plan in ('akihq_standard','akihq_pro','akibusiness_premium','akihq_business_addon') and s.plan_code in ('business','business_pro'))))
    then raise exception 'existing subscription'; end if;
  if p_plan='akihq_business_addon' and (
    not akisuite_private.paid_pro(p_workspace,false)
    or akisuite_private.plan_active(null,p_workspace,'aki_enterprise')) then raise exception 'HQ Pro required'; end if;
  select * into v_old from public.akisuite_checkout_reservations r
    where r.expires_at>now() and (r.profile_id=v_profile or r.workspace_id=p_workspace) for update;
  if v_old.token is not null then
    if v_old.profile_id=v_profile and v_old.workspace_id is not distinct from p_workspace
      and v_old.plan_code=p_plan and v_old.billing_interval=p_interval then
      return jsonb_build_object('token',v_old.token,'expires_at',v_old.expires_at);
    end if;
    raise exception 'checkout in progress';
  end if;
  delete from public.akisuite_checkout_reservations where expires_at<=now()
    and (profile_id=v_profile or workspace_id=p_workspace);
  insert into public.akisuite_checkout_reservations(profile_id,workspace_id,plan_code,billing_interval,expires_at)
    values(v_profile,p_workspace,p_plan,p_interval,now()+interval '31 minutes') returning * into v_old;
  return jsonb_build_object('token',v_old.token,'expires_at',v_old.expires_at);
end;
$$;
revoke all on function public.reserve_akisuite_checkout(text,text,text) from public,anon;
grant execute on function public.reserve_akisuite_checkout(text,text,text) to authenticated;
commit;

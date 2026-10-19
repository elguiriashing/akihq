-- Migration 0074: tenant-safe business workspaces, modular tools, inventory, and POS ledger
begin;

-- Business and Business Pro are distinct paid entitlements. Business Pro
-- includes the public Business portal and is the only customer tier allowed
-- to provision or enter AkiHQ.
alter table public.profiles
  add column if not exists business_tier text not null default 'none';
alter table public.profiles drop constraint if exists profiles_business_tier_check;
alter table public.profiles add constraint profiles_business_tier_check
  check (business_tier in ('none','business','business_pro'));

alter table public.billing_subscriptions
  drop constraint if exists billing_subscriptions_plan_code_check;
alter table public.billing_subscriptions
  add constraint billing_subscriptions_plan_code_check
  check (plan_code in ('premium','business','business_pro'));
alter table public.staff_billing_grants
  drop constraint if exists staff_billing_grants_plan_code_check;
alter table public.staff_billing_grants
  add constraint staff_billing_grants_plan_code_check
  check (plan_code in ('premium','business','business_pro'));

create or replace function public.has_active_entitlement(p_profile uuid,p_plan text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_plan in ('premium','business','business_pro') and (
    exists (
      select 1 from public.profiles profile
      where profile.id = p_profile and profile.app_role = 'administrator'::public.app_role
    )
    or exists (
      select 1 from public.billing_subscriptions subscription
      where subscription.profile_id = p_profile
        and (
          subscription.plan_code = p_plan
          or (p_plan = 'business' and subscription.plan_code = 'business_pro')
        )
        and subscription.status in ('active','trialing')
        and (subscription.current_period_end is null or subscription.current_period_end > now())
    )
    or exists (
      select 1 from public.staff_billing_grants grant_record
      where grant_record.profile_id = p_profile
        and (
          grant_record.plan_code = p_plan
          or (p_plan = 'business' and grant_record.plan_code = 'business_pro')
        )
        and grant_record.active
        and (grant_record.expires_at is null or grant_record.expires_at > now())
    )
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
        payment_state = case when v_paid_business then 'paid' when v_business_grant = 'waived' then 'waived' else 'trial' end,
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

create or replace function public.sync_stripe_subscription(
  p_subscription_id text,
  p_profile uuid,
  p_customer_id text,
  p_plan text,
  p_interval text,
  p_status text,
  p_current_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_event_created_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changed integer := 0;
begin
  if char_length(btrim(coalesce(p_subscription_id,''))) < 3
    or char_length(btrim(coalesce(p_customer_id,''))) < 3
    or p_profile is null
    or p_plan not in ('premium','business','business_pro')
    or p_interval not in ('month','year')
    or p_status not in ('active','trialing','incomplete','incomplete_expired','past_due','canceled','unpaid','paused')
    or p_event_created_at is null
  then raise exception 'invalid Stripe subscription'; end if;
  insert into public.billing_subscriptions (
    stripe_subscription_id,profile_id,stripe_customer_id,plan_code,billing_interval,
    status,current_period_end,cancel_at_period_end,stripe_event_created_at,updated_at
  ) values (
    btrim(p_subscription_id),p_profile,btrim(p_customer_id),p_plan,p_interval,
    p_status,p_current_period_end,coalesce(p_cancel_at_period_end,false),p_event_created_at,now()
  )
  on conflict (stripe_subscription_id) do update set
    profile_id = excluded.profile_id,
    stripe_customer_id = excluded.stripe_customer_id,
    plan_code = excluded.plan_code,
    billing_interval = excluded.billing_interval,
    status = excluded.status,
    current_period_end = excluded.current_period_end,
    cancel_at_period_end = excluded.cancel_at_period_end,
    stripe_event_created_at = excluded.stripe_event_created_at,
    updated_at = now()
  where public.billing_subscriptions.stripe_event_created_at is null
     or excluded.stripe_event_created_at >= public.billing_subscriptions.stripe_event_created_at;
  get diagnostics v_changed = row_count;
  return v_changed > 0;
end;
$$;

revoke all on function public.has_active_entitlement(uuid,text) from public;
revoke all on function public.reconcile_profile_entitlements(uuid) from public;
revoke all on function public.sync_stripe_subscription(text,uuid,text,text,text,text,timestamptz,boolean,timestamptz) from public;
grant execute on function public.has_active_entitlement(uuid,text) to authenticated;
grant execute on function public.reconcile_profile_entitlements(uuid) to service_role;
grant execute on function public.sync_stripe_subscription(text,uuid,text,text,text,text,timestamptz,boolean,timestamptz) to service_role;

create table if not exists public.crm_workspaces (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9_-]{2,79}$'),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  owner_profile_id uuid references public.profiles(id) on delete set null,
  source_venue_id uuid unique references public.venues(id) on delete set null,
  plan text not null default 'starter' check (plan in ('starter','growth','pro','platform')),
  status text not null default 'active' check (status in ('active','trial','suspended','closed')),
  seat_limit integer not null default 4 check (seat_limit between 1 and 100),
  timezone text not null default 'Europe/Madrid',
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_workspace_members (
  workspace_id text not null references public.crm_workspaces(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner','admin','manager','staff','viewer')),
  status text not null default 'active' check (status in ('active','suspended')),
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, profile_id)
);

create table if not exists public.crm_workspace_venues (
  workspace_id text not null references public.crm_workspaces(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (workspace_id, venue_id)
);

create table if not exists public.crm_tool_catalog (
  tool_key text primary key check (tool_key ~ '^[a-z][a-z0-9_-]{1,47}$'),
  name text not null,
  description text not null default '',
  category text not null default 'workspace',
  billable boolean not null default false,
  sort_order integer not null default 0,
  active boolean not null default true
);

create table if not exists public.crm_workspace_entitlements (
  workspace_id text not null references public.crm_workspaces(id) on delete cascade,
  tool_key text not null references public.crm_tool_catalog(tool_key) on delete restrict,
  active boolean not null default true,
  source text not null default 'plan' check (source in ('plan','trial','purchase','manual','platform')),
  limits jsonb not null default '{}'::jsonb check (jsonb_typeof(limits) = 'object'),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, tool_key),
  check (ends_at is null or ends_at > starts_at)
);

create index if not exists crm_workspace_members_profile_idx
  on public.crm_workspace_members (profile_id, status, workspace_id);
create index if not exists crm_workspace_venues_venue_idx
  on public.crm_workspace_venues (venue_id, workspace_id);
create index if not exists crm_workspace_entitlements_active_idx
  on public.crm_workspace_entitlements (workspace_id, active, tool_key);

create or replace function public.crm_can_access_workspace(p_workspace text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and (
    exists (
      select 1
      from public.crm_workspace_members member
      join public.crm_workspaces workspace on workspace.id = member.workspace_id
      where member.workspace_id = p_workspace
        and member.profile_id = (select auth.uid())
        and member.status = 'active'
        and workspace.status in ('active','trial')
        and (
          workspace.id = 'ws_akipasa'
          or public.has_active_entitlement(workspace.owner_profile_id,'business_pro')
        )
    )
    or exists (
      select 1
      from public.profiles profile
      where profile.id = (select auth.uid())
        and profile.app_role = 'administrator'::public.app_role
    )
  );
$$;

create or replace function public.crm_can_manage_workspace(p_workspace text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and (
    exists (
      select 1
      from public.crm_workspace_members member
      where member.workspace_id = p_workspace
        and member.profile_id = (select auth.uid())
        and member.status = 'active'
        and member.role in ('owner','admin','manager')
    )
    or exists (
      select 1
      from public.profiles profile
      where profile.id = (select auth.uid())
        and profile.app_role = 'administrator'::public.app_role
    )
  );
$$;

create or replace function public.crm_can_operate_workspace(p_workspace text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and (
    exists (
      select 1
      from public.crm_workspace_members member
      where member.workspace_id = p_workspace
        and member.profile_id = (select auth.uid())
        and member.status = 'active'
        and member.role in ('owner','admin','manager','staff')
    )
    or exists (
      select 1
      from public.profiles profile
      where profile.id = (select auth.uid())
        and profile.app_role = 'administrator'::public.app_role
    )
  );
$$;

create or replace function public.crm_has_tool(p_workspace text, p_tool text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.crm_can_access_workspace(p_workspace) and exists (
    select 1
    from public.crm_workspace_entitlements entitlement
    where entitlement.workspace_id = p_workspace
      and entitlement.tool_key = p_tool
      and entitlement.active
      and entitlement.starts_at <= now()
      and (entitlement.ends_at is null or entitlement.ends_at > now())
  );
$$;

revoke all on function public.crm_can_access_workspace(text) from public;
revoke all on function public.crm_can_manage_workspace(text) from public;
revoke all on function public.crm_can_operate_workspace(text) from public;
revoke all on function public.crm_has_tool(text,text) from public;
grant execute on function public.crm_can_access_workspace(text) to authenticated;
grant execute on function public.crm_can_manage_workspace(text) to authenticated;
grant execute on function public.crm_can_operate_workspace(text) to authenticated;
grant execute on function public.crm_has_tool(text,text) to authenticated;

alter table public.crm_workspaces enable row level security;
alter table public.crm_workspace_members enable row level security;
alter table public.crm_workspace_venues enable row level security;
alter table public.crm_tool_catalog enable row level security;
alter table public.crm_workspace_entitlements enable row level security;

create policy crm_workspaces_member_read on public.crm_workspaces
for select to authenticated using (public.crm_can_access_workspace(id));
create policy crm_workspace_members_member_read on public.crm_workspace_members
for select to authenticated using (public.crm_can_access_workspace(workspace_id));
create policy crm_workspace_venues_member_read on public.crm_workspace_venues
for select to authenticated using (public.crm_can_access_workspace(workspace_id));
create policy crm_tool_catalog_authenticated_read on public.crm_tool_catalog
for select to authenticated using (active);
create policy crm_workspace_entitlements_member_read on public.crm_workspace_entitlements
for select to authenticated using (public.crm_can_access_workspace(workspace_id));

revoke all on public.crm_workspaces, public.crm_workspace_members,
  public.crm_workspace_venues, public.crm_tool_catalog,
  public.crm_workspace_entitlements from public, anon;
grant select on public.crm_workspaces, public.crm_workspace_members,
  public.crm_workspace_venues, public.crm_tool_catalog,
  public.crm_workspace_entitlements to authenticated;
grant all on public.crm_workspaces, public.crm_workspace_members,
  public.crm_workspace_venues, public.crm_tool_catalog,
  public.crm_workspace_entitlements to service_role;

insert into public.crm_tool_catalog (tool_key,name,description,category,billable,sort_order) values
  ('dashboard','Dashboard','Workspace overview and alerts.','core',false,10),
  ('crm','CRM','Contacts, companies, leads, and deals.','core',false,20),
  ('inbox','Inbox','Shared customer conversations.','communications',true,30),
  ('tasks','Tasks','Projects, tasks, ownership, and deadlines.','operations',false,40),
  ('calendar','Calendar','Bookings, meetings, and deadlines.','operations',false,50),
  ('inventory','Smart inventory','Stock ledger, forecasting, and reorder guidance.','commerce',true,60),
  ('pos','Point of sale','Provider-connected sales and till attribution.','commerce',true,70),
  ('sales','Sales and billing','Quotes, invoices, and payment operations.','commerce',true,80),
  ('marketing','Marketing','Campaign planning and consent-aware audiences.','growth',true,90),
  ('sites','Sites and forms','Landing pages and lead forms.','growth',true,100),
  ('automation','Automation','Triggers, rules, and actions.','operations',true,110),
  ('collaboration','Team chat','Workspace channels and collaboration.','team',true,120),
  ('telegram','Telegram','AkiPasa platform Telegram operations.','platform',false,130),
  ('employees','People','Team directory, roles, and presence.','team',false,140),
  ('knowledge','Knowledge','Business documentation and playbooks.','team',true,150),
  ('analytics','Analytics','Workspace performance and trends.','insight',true,160),
  ('integrations','Integrations','External provider connections.','core',false,170),
  ('ai-team','AI Team','Governed AkiPasa platform agents.','platform',false,180),
  ('business-admin','Business CRM administration','Business Pro workspace and feature controls.','platform',false,190)
on conflict (tool_key) do update set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  billable = excluded.billable,
  sort_order = excluded.sort_order,
  active = true;

insert into public.crm_workspaces (
  id,name,slug,owner_profile_id,plan,status,seat_limit,timezone,currency
)
select 'ws_akipasa','AkiPasa HQ','akipasa-hq',profile.id,'platform','active',100,'Europe/Madrid','EUR'
from public.profiles profile
where profile.app_role = 'administrator'::public.app_role
order by profile.created_at
limit 1
on conflict (id) do nothing;

insert into public.crm_workspace_members (workspace_id,profile_id,role,status)
select 'ws_akipasa',profile.id,
  case when profile.app_role = 'administrator'::public.app_role then 'owner' else 'staff' end,
  'active'
from public.profiles profile
where profile.app_role in ('moderator','administrator')
on conflict (workspace_id,profile_id) do update set status = 'active';

insert into public.crm_workspace_entitlements (workspace_id,tool_key,active,source)
select 'ws_akipasa',catalog.tool_key,true,'platform'
from public.crm_tool_catalog catalog
on conflict (workspace_id,tool_key) do update set active = true, source = 'platform';

-- Existing Business Pro venue owners receive an isolated workspace without
-- changing their public catalogue data. Standard Business never receives CRM access.
insert into public.crm_workspaces (
  id,name,slug,owner_profile_id,source_venue_id,plan,status,seat_limit
)
select
  'venue-' || venue.id::text,
  venue.name,
  'venue-' || replace(venue.id::text,'-',''),
  min(member.profile_id::text)::uuid,
  venue.id,
  'pro',
  'active',
  4
from public.venues venue
join public.venue_members member on member.venue_id = venue.id and member.role = 'owner'::public.venue_member_role
where public.has_active_entitlement(member.profile_id,'business_pro')
group by venue.id,venue.name
on conflict (source_venue_id) do nothing;

insert into public.crm_workspace_members (workspace_id,profile_id,role,status)
select workspace.id,member.profile_id,'owner','active'
from public.crm_workspaces workspace
join public.venue_members member
  on member.venue_id = workspace.source_venue_id
 and member.role = 'owner'::public.venue_member_role
on conflict (workspace_id,profile_id) do nothing;

insert into public.crm_workspace_venues (workspace_id,venue_id)
select workspace.id,workspace.source_venue_id
from public.crm_workspaces workspace
where workspace.source_venue_id is not null
on conflict do nothing;

insert into public.crm_workspace_entitlements (workspace_id,tool_key,active,source)
select workspace.id,catalog.tool_key,true,'plan'
from public.crm_workspaces workspace
cross join public.crm_tool_catalog catalog
where workspace.plan = 'pro'
  and catalog.tool_key in ('dashboard','crm','tasks','calendar','inventory','employees','integrations')
on conflict (workspace_id,tool_key) do nothing;

create or replace function public.crm_provision_workspace_for_venue(p_venue uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace text;
  v_name text;
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  if not public.has_active_entitlement((select auth.uid()),'business_pro')
    and not exists (
      select 1 from public.profiles profile
      where profile.id = (select auth.uid())
        and profile.app_role = 'administrator'::public.app_role
    )
  then raise exception 'Business Pro subscription required'; end if;
  if not exists (
    select 1 from public.venue_members member
    where member.venue_id = p_venue
      and member.profile_id = (select auth.uid())
      and member.role = 'owner'::public.venue_member_role
  ) and not exists (
    select 1 from public.profiles profile
    where profile.id = (select auth.uid())
      and profile.app_role = 'administrator'::public.app_role
  ) then
    raise exception 'venue owner required';
  end if;

  select workspace.id into v_workspace
  from public.crm_workspaces workspace
  where workspace.source_venue_id = p_venue;
  if v_workspace is not null then return v_workspace; end if;

  select venue.name into strict v_name from public.venues venue where venue.id = p_venue;
  v_workspace := 'venue-' || p_venue::text;
  insert into public.crm_workspaces (
    id,name,slug,owner_profile_id,source_venue_id,plan,status,seat_limit
  ) values (
    v_workspace,v_name,'venue-' || replace(p_venue::text,'-',''),
    (select auth.uid()),p_venue,'pro','active',4
  );
  insert into public.crm_workspace_members (workspace_id,profile_id,role,status)
  values (v_workspace,(select auth.uid()),'owner','active');
  insert into public.crm_workspace_venues (workspace_id,venue_id)
  values (v_workspace,p_venue);
  insert into public.crm_workspace_entitlements (workspace_id,tool_key,active,source)
  select v_workspace,catalog.tool_key,true,'plan'
  from public.crm_tool_catalog catalog
  where catalog.tool_key in ('dashboard','crm','tasks','calendar','inventory','employees','integrations');
  return v_workspace;
end;
$$;

create or replace function public.crm_add_workspace_member(
  p_workspace text,
  p_email text,
  p_role text default 'staff'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile uuid;
  v_limit integer;
  v_count integer;
begin
  if not public.crm_can_manage_workspace(p_workspace) then raise exception 'workspace manager required'; end if;
  if p_role not in ('admin','manager','staff','viewer') then raise exception 'invalid workspace role'; end if;
  select user_record.id into v_profile
  from auth.users user_record
  where lower(user_record.email) = lower(btrim(p_email))
  limit 1;
  if v_profile is null then raise exception 'that account must sign in to AkiPasa once before it can be added'; end if;
  select workspace.seat_limit into strict v_limit
  from public.crm_workspaces workspace where workspace.id = p_workspace for update;
  select count(*) into v_count
  from public.crm_workspace_members member
  where member.workspace_id = p_workspace and member.status = 'active';
  if v_count >= v_limit and not exists (
    select 1 from public.crm_workspace_members member
    where member.workspace_id = p_workspace and member.profile_id = v_profile
  ) then raise exception 'workspace seat limit reached'; end if;
  insert into public.crm_workspace_members (workspace_id,profile_id,role,status,invited_by)
  values (p_workspace,v_profile,p_role,'active',(select auth.uid()))
  on conflict (workspace_id,profile_id) do update
  set role = excluded.role,status = 'active',invited_by = excluded.invited_by,updated_at = now();
  return jsonb_build_object('workspace_id',p_workspace,'profile_id',v_profile,'role',p_role);
end;
$$;

create or replace function public.crm_remove_workspace_member(p_workspace text,p_profile uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.crm_can_manage_workspace(p_workspace) then raise exception 'workspace manager required'; end if;
  if exists (
    select 1 from public.crm_workspace_members member
    where member.workspace_id = p_workspace and member.profile_id = p_profile and member.role = 'owner'
  ) then raise exception 'workspace owners cannot be removed'; end if;
  delete from public.crm_workspace_members member
  where member.workspace_id = p_workspace and member.profile_id = p_profile;
end;
$$;

revoke all on function public.crm_provision_workspace_for_venue(uuid) from public;
revoke all on function public.crm_add_workspace_member(text,text,text) from public;
revoke all on function public.crm_remove_workspace_member(text,uuid) from public;
grant execute on function public.crm_provision_workspace_for_venue(uuid) to authenticated;
grant execute on function public.crm_add_workspace_member(text,text,text) to authenticated;
grant execute on function public.crm_remove_workspace_member(text,uuid) to authenticated;

-- Tenant access replaces the previous platform-role-only policies on shared snapshots.
drop policy if exists "Staff can read workspace snapshots" on public.workspace_snapshots;
drop policy if exists "Staff can insert workspace snapshots" on public.workspace_snapshots;
drop policy if exists "Staff can update workspace snapshots" on public.workspace_snapshots;
create policy "Workspace members can read snapshots" on public.workspace_snapshots
for select to authenticated using (public.crm_can_access_workspace(workspace_id));
create policy "Workspace operators can insert snapshots" on public.workspace_snapshots
for insert to authenticated with check (
  public.crm_can_operate_workspace(workspace_id) and updated_by = (select auth.uid())
);
create policy "Workspace operators can update snapshots" on public.workspace_snapshots
for update to authenticated using (public.crm_can_operate_workspace(workspace_id))
with check (public.crm_can_operate_workspace(workspace_id) and updated_by = (select auth.uid()));

drop policy if exists "Staff can read CRM workspace records" on public.crm_workspace_records;
drop policy if exists "Staff can insert CRM workspace records" on public.crm_workspace_records;
drop policy if exists "Staff can update CRM workspace records" on public.crm_workspace_records;
drop policy if exists "Staff can delete CRM workspace records" on public.crm_workspace_records;
create policy "Workspace members can read CRM records" on public.crm_workspace_records
for select to authenticated using (public.crm_can_access_workspace(workspace_id));
create policy "Workspace operators can insert CRM records" on public.crm_workspace_records
for insert to authenticated with check (
  public.crm_can_operate_workspace(workspace_id) and updated_by = (select auth.uid())
);
create policy "Workspace operators can update CRM records" on public.crm_workspace_records
for update to authenticated using (public.crm_can_operate_workspace(workspace_id))
with check (public.crm_can_operate_workspace(workspace_id) and updated_by = (select auth.uid()));
create policy "Workspace managers can delete CRM records" on public.crm_workspace_records
for delete to authenticated using (public.crm_can_manage_workspace(workspace_id));

create table if not exists public.crm_inventory_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.crm_workspaces(id) on delete cascade,
  sku text not null,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  unit text not null default 'unit',
  on_hand numeric(14,3) not null default 0 check (on_hand >= 0),
  reorder_point numeric(14,3) not null default 0,
  safety_stock numeric(14,3) not null default 0,
  lead_time_days integer not null default 3 check (lead_time_days between 0 and 365),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id,sku)
);

create table if not exists public.crm_inventory_movements (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.crm_workspaces(id) on delete cascade,
  item_id uuid not null references public.crm_inventory_items(id) on delete restrict,
  quantity_delta numeric(14,3) not null check (quantity_delta <> 0),
  movement_type text not null check (movement_type in ('opening','purchase','sale','waste','count','transfer','return','adjustment')),
  source_type text,
  source_id text,
  employee_profile_id uuid references public.profiles(id) on delete set null,
  notes text not null default '',
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict
);

create table if not exists public.crm_demand_signals (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.crm_workspaces(id) on delete cascade,
  item_id uuid not null references public.crm_inventory_items(id) on delete cascade,
  signal_date date not null,
  signal_type text not null check (signal_type in ('booking','event','seasonality','weather','manual')),
  expected_quantity numeric(14,3) not null check (expected_quantity >= 0),
  confidence numeric(5,4) not null default 0.5 check (confidence between 0 and 1),
  source_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.crm_pos_sales (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.crm_workspaces(id) on delete cascade,
  provider text not null,
  external_id text not null,
  status text not null default 'completed' check (status in ('completed','voided','refunded')),
  employee_profile_id uuid references public.profiles(id) on delete set null,
  total_cents integer not null check (total_cents >= 0),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  sold_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  unique (workspace_id,provider,external_id)
);

create table if not exists public.crm_pos_sale_lines (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.crm_pos_sales(id) on delete restrict,
  workspace_id text not null references public.crm_workspaces(id) on delete cascade,
  item_id uuid not null references public.crm_inventory_items(id) on delete restrict,
  quantity numeric(14,3) not null check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  created_at timestamptz not null default now()
);

create index if not exists crm_inventory_movements_item_time_idx
  on public.crm_inventory_movements (workspace_id,item_id,occurred_at desc);
create index if not exists crm_demand_signals_item_date_idx
  on public.crm_demand_signals (workspace_id,item_id,signal_date);
create index if not exists crm_pos_sales_time_idx
  on public.crm_pos_sales (workspace_id,sold_at desc);

alter table public.crm_inventory_items enable row level security;
alter table public.crm_inventory_movements enable row level security;
alter table public.crm_demand_signals enable row level security;
alter table public.crm_pos_sales enable row level security;
alter table public.crm_pos_sale_lines enable row level security;

create policy crm_inventory_items_read on public.crm_inventory_items for select to authenticated
using (public.crm_has_tool(workspace_id,'inventory'));
create policy crm_inventory_items_write on public.crm_inventory_items for all to authenticated
using (public.crm_can_operate_workspace(workspace_id) and public.crm_has_tool(workspace_id,'inventory'))
with check (public.crm_can_operate_workspace(workspace_id) and public.crm_has_tool(workspace_id,'inventory'));
create policy crm_inventory_movements_read on public.crm_inventory_movements for select to authenticated
using (public.crm_has_tool(workspace_id,'inventory'));
create policy crm_inventory_movements_insert on public.crm_inventory_movements for insert to authenticated
with check (
  public.crm_can_operate_workspace(workspace_id)
  and public.crm_has_tool(workspace_id,'inventory')
  and created_by = (select auth.uid())
);
create policy crm_demand_signals_read on public.crm_demand_signals for select to authenticated
using (public.crm_has_tool(workspace_id,'inventory'));
create policy crm_demand_signals_write on public.crm_demand_signals for all to authenticated
using (public.crm_can_operate_workspace(workspace_id) and public.crm_has_tool(workspace_id,'inventory'))
with check (public.crm_can_operate_workspace(workspace_id) and public.crm_has_tool(workspace_id,'inventory'));
create policy crm_pos_sales_read on public.crm_pos_sales for select to authenticated
using (public.crm_has_tool(workspace_id,'pos'));
create policy crm_pos_sale_lines_read on public.crm_pos_sale_lines for select to authenticated
using (public.crm_has_tool(workspace_id,'pos'));

revoke all on public.crm_inventory_items, public.crm_inventory_movements,
  public.crm_demand_signals, public.crm_pos_sales, public.crm_pos_sale_lines from public, anon;
grant select,delete on public.crm_inventory_items to authenticated;
grant insert (
  workspace_id,sku,name,unit,reorder_point,safety_stock,lead_time_days,active
) on public.crm_inventory_items to authenticated;
grant update (
  sku,name,unit,reorder_point,safety_stock,lead_time_days,active
) on public.crm_inventory_items to authenticated;
grant select,insert on public.crm_inventory_movements to authenticated;
grant select,insert,update,delete on public.crm_demand_signals to authenticated;
grant select on public.crm_pos_sales, public.crm_pos_sale_lines to authenticated;
grant all on public.crm_inventory_items, public.crm_inventory_movements,
  public.crm_demand_signals, public.crm_pos_sales, public.crm_pos_sale_lines to service_role;

create or replace function public.crm_apply_inventory_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.crm_inventory_items item
  set on_hand = item.on_hand + new.quantity_delta, updated_at = now()
  where item.id = new.item_id and item.workspace_id = new.workspace_id;
  if not found then raise exception 'inventory item does not belong to workspace'; end if;
  return new;
end;
$$;

drop trigger if exists crm_inventory_movement_apply on public.crm_inventory_movements;
create trigger crm_inventory_movement_apply
after insert on public.crm_inventory_movements
for each row execute function public.crm_apply_inventory_movement();

create or replace function public.crm_inventory_recommendations(p_workspace text)
returns table (
  item_id uuid,
  sku text,
  item_name text,
  on_hand numeric,
  expected_daily numeric,
  days_remaining numeric,
  suggested_order numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.crm_has_tool(p_workspace,'inventory') then raise exception 'inventory access required'; end if;
  return query
  with usage as (
    select movement.item_id,
      coalesce(sum(abs(movement.quantity_delta)) filter (
        where movement.quantity_delta < 0
          and movement.occurred_at >= now() - interval '28 days'
      ) / 28,0) as daily
    from public.crm_inventory_movements movement
    where movement.workspace_id = p_workspace
    group by movement.item_id
  ), signals as (
    select signal.item_id,
      coalesce(sum(signal.expected_quantity * signal.confidence) / 7,0) as daily
    from public.crm_demand_signals signal
    where signal.workspace_id = p_workspace
      and signal.signal_date between current_date and current_date + 6
    group by signal.item_id
  )
  select item.id,item.sku,item.name,item.on_hand,
    round((coalesce(usage.daily,0) + coalesce(signals.daily,0))::numeric,3),
    case when coalesce(usage.daily,0) + coalesce(signals.daily,0) > 0
      then round((item.on_hand / (coalesce(usage.daily,0) + coalesce(signals.daily,0)))::numeric,1)
      else null end,
    greatest(
      0,
      round((item.safety_stock + item.lead_time_days * (coalesce(usage.daily,0) + coalesce(signals.daily,0)) - item.on_hand)::numeric,3)
    )
  from public.crm_inventory_items item
  left join usage on usage.item_id = item.id
  left join signals on signals.item_id = item.id
  where item.workspace_id = p_workspace and item.active
  order by 7 desc, item.name;
end;
$$;

create or replace function public.crm_record_pos_sale(
  p_workspace text,
  p_provider text,
  p_external_id text,
  p_total_cents integer,
  p_currency text,
  p_employee_profile uuid,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale uuid;
  v_line record;
  v_actor uuid := coalesce(p_employee_profile,(select auth.uid()));
begin
  if not public.crm_can_operate_workspace(p_workspace) or not public.crm_has_tool(p_workspace,'pos') then
    raise exception 'point-of-sale access required';
  end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then raise exception 'sale lines required'; end if;
  if p_total_cents < 0 or p_currency !~ '^[A-Z]{3}$' then raise exception 'invalid sale total'; end if;
  if not exists (
    select 1 from public.crm_workspace_members member
    where member.workspace_id = p_workspace and member.profile_id = v_actor and member.status = 'active'
  ) and not exists (
    select 1 from public.profiles profile
    where profile.id = (select auth.uid()) and profile.app_role = 'administrator'::public.app_role
  ) then raise exception 'employee is not an active workspace member'; end if;
  select sale.id into v_sale from public.crm_pos_sales sale
  where sale.workspace_id = p_workspace and sale.provider = btrim(p_provider) and sale.external_id = btrim(p_external_id);
  if v_sale is not null then return v_sale; end if;
  insert into public.crm_pos_sales (
    workspace_id,provider,external_id,total_cents,currency,employee_profile_id,created_by
  ) values (
    p_workspace,btrim(p_provider),btrim(p_external_id),p_total_cents,p_currency,v_actor,(select auth.uid())
  ) returning id into v_sale;
  for v_line in
    select * from jsonb_to_recordset(p_lines) as line(item_id uuid,quantity numeric,unit_price_cents integer)
  loop
    if v_line.quantity <= 0 or v_line.unit_price_cents < 0 or not exists (
      select 1 from public.crm_inventory_items item
      where item.id = v_line.item_id and item.workspace_id = p_workspace and item.active
    ) then raise exception 'invalid sale line'; end if;
    insert into public.crm_pos_sale_lines (sale_id,workspace_id,item_id,quantity,unit_price_cents)
    values (v_sale,p_workspace,v_line.item_id,v_line.quantity,v_line.unit_price_cents);
    insert into public.crm_inventory_movements (
      workspace_id,item_id,quantity_delta,movement_type,source_type,source_id,
      employee_profile_id,notes,created_by
    ) values (
      p_workspace,v_line.item_id,-v_line.quantity,'sale','pos_sale',v_sale::text,
      v_actor,'Recorded by ' || btrim(p_provider),(select auth.uid())
    );
  end loop;
  return v_sale;
end;
$$;

revoke all on function public.crm_apply_inventory_movement() from public;
revoke all on function public.crm_inventory_recommendations(text) from public;
revoke all on function public.crm_record_pos_sale(text,text,text,integer,text,uuid,jsonb) from public;
grant execute on function public.crm_inventory_recommendations(text) to authenticated;
grant execute on function public.crm_record_pos_sale(text,text,text,integer,text,uuid,jsonb) to authenticated;

create or replace function public.crm_shares_workspace(p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.crm_workspace_members mine
    join public.crm_workspace_members theirs on theirs.workspace_id = mine.workspace_id
    where mine.profile_id = (select auth.uid())
      and mine.status = 'active'
      and theirs.profile_id = p_profile
      and theirs.status = 'active'
      and public.crm_can_access_workspace(mine.workspace_id)
  );
$$;

revoke all on function public.crm_shares_workspace(uuid) from public;
grant execute on function public.crm_shares_workspace(uuid) to authenticated;
create policy profiles_crm_workspace_member_read on public.profiles
for select to authenticated using (public.crm_shares_workspace(id));

create or replace function public.crm_staff_business_overview()
returns table (
  profile_id uuid,
  display_name text,
  business_tier text,
  venue_count bigint,
  workspaces jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_platform_role(array['moderator','administrator']::public.app_role[]) then
    raise exception 'platform staff required';
  end if;
  return query
  select profile.id,
    coalesce(nullif(btrim(profile.display_name),''),'Business account'),
    profile.business_tier,
    count(distinct member.venue_id),
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',workspace.id,
          'name',workspace.name,
          'status',workspace.status,
          'seat_limit',workspace.seat_limit,
          'seat_count',(select count(*) from public.crm_workspace_members seat where seat.workspace_id = workspace.id and seat.status = 'active'),
          'venue_id',workspace.source_venue_id,
          'tools',coalesce((
            select jsonb_object_agg(catalog.tool_key,coalesce(entitlement.active,false) order by catalog.sort_order)
            from public.crm_tool_catalog catalog
            left join public.crm_workspace_entitlements entitlement
              on entitlement.workspace_id = workspace.id and entitlement.tool_key = catalog.tool_key
            where catalog.active and catalog.category <> 'platform'
          ),'{}'::jsonb)
        ) order by workspace.created_at
      )
      from public.crm_workspaces workspace
      where workspace.owner_profile_id = profile.id and workspace.id <> 'ws_akipasa'
    ),'[]'::jsonb)
  from public.profiles profile
  left join public.venue_members member
    on member.profile_id = profile.id and member.role = 'owner'::public.venue_member_role
  where profile.business_plan_active
     or profile.app_role = 'organiser'::public.app_role
     or member.profile_id is not null
  group by profile.id,profile.display_name,profile.business_tier
  order by profile.business_tier = 'business_pro' desc,coalesce(profile.display_name,''),profile.id;
end;
$$;

create or replace function public.crm_staff_set_business_pro(
  p_profile uuid,
  p_active boolean,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  venue_record record;
  v_workspace text;
begin
  if not public.has_platform_role(array['moderator','administrator']::public.app_role[]) then
    raise exception 'platform staff required';
  end if;
  if char_length(btrim(coalesce(p_reason,''))) < 10 then raise exception 'reason required'; end if;
  if not exists (select 1 from public.profiles profile where profile.id = p_profile) then raise exception 'profile not found'; end if;

  if p_active then
    update public.staff_billing_grants grant_record
    set active = false
    where grant_record.profile_id = p_profile and grant_record.plan_code = 'business_pro' and grant_record.active;
    insert into public.staff_billing_grants (
      profile_id,plan_code,grant_kind,active,granted_by,reason
    ) values (
      p_profile,'business_pro','waived',true,(select auth.uid()),btrim(p_reason)
    );
  else
    update public.staff_billing_grants grant_record
    set active = false
    where grant_record.profile_id = p_profile and grant_record.plan_code = 'business_pro' and grant_record.active;
  end if;
  perform public.reconcile_profile_entitlements(p_profile);

  if p_active then
    for venue_record in
      select venue.id,venue.name
      from public.venues venue
      join public.venue_members member on member.venue_id = venue.id
      where member.profile_id = p_profile and member.role = 'owner'::public.venue_member_role
    loop
      v_workspace := 'venue-' || venue_record.id::text;
      insert into public.crm_workspaces (
        id,name,slug,owner_profile_id,source_venue_id,plan,status,seat_limit
      ) values (
        v_workspace,venue_record.name,'venue-' || replace(venue_record.id::text,'-',''),
        p_profile,venue_record.id,'pro','active',4
      )
      on conflict (source_venue_id) do update set
        owner_profile_id = excluded.owner_profile_id,
        name = excluded.name,
        plan = 'pro',
        status = 'active';
      select workspace.id into v_workspace from public.crm_workspaces workspace where workspace.source_venue_id = venue_record.id;
      insert into public.crm_workspace_members (workspace_id,profile_id,role,status,invited_by)
      values (v_workspace,p_profile,'owner','active',(select auth.uid()))
      on conflict (workspace_id,profile_id) do update set role = 'owner',status = 'active';
      insert into public.crm_workspace_venues (workspace_id,venue_id)
      values (v_workspace,venue_record.id) on conflict do nothing;
      insert into public.crm_workspace_entitlements (workspace_id,tool_key,active,source)
      select v_workspace,catalog.tool_key,true,'manual'
      from public.crm_tool_catalog catalog
      where catalog.tool_key in ('dashboard','crm','tasks','calendar','inventory','employees','integrations')
      on conflict (workspace_id,tool_key) do update set active = true,source = 'manual',updated_at = now();
    end loop;
  else
    update public.crm_workspaces workspace set status = 'suspended'
    where workspace.owner_profile_id = p_profile and workspace.id <> 'ws_akipasa';
  end if;

  insert into public.moderation_actions (actor_id,action,target_type,target_id,reason,metadata)
  values (
    (select auth.uid()),case when p_active then 'business_pro_enabled' else 'business_pro_disabled' end,
    'crm_business',p_profile,btrim(p_reason),jsonb_build_object('active',p_active)
  );
end;
$$;

create or replace function public.crm_staff_set_workspace_tool(
  p_workspace text,
  p_tool text,
  p_active boolean,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target uuid;
begin
  if not public.has_platform_role(array['moderator','administrator']::public.app_role[]) then
    raise exception 'platform staff required';
  end if;
  if char_length(btrim(coalesce(p_reason,''))) < 10 then raise exception 'reason required'; end if;
  if p_workspace = 'ws_akipasa' then raise exception 'platform tools are managed by deployment'; end if;
  if not exists (
    select 1 from public.crm_tool_catalog catalog
    where catalog.tool_key = p_tool and catalog.active and catalog.category <> 'platform'
  ) then raise exception 'invalid business tool'; end if;
  select coalesce(workspace.source_venue_id,workspace.owner_profile_id) into v_target
  from public.crm_workspaces workspace where workspace.id = p_workspace;
  if v_target is null then raise exception 'workspace not found'; end if;
  insert into public.crm_workspace_entitlements (workspace_id,tool_key,active,source)
  values (p_workspace,p_tool,p_active,'manual')
  on conflict (workspace_id,tool_key) do update
  set active = excluded.active,source = 'manual',updated_at = now();
  insert into public.moderation_actions (actor_id,action,target_type,target_id,reason,metadata)
  values (
    (select auth.uid()),case when p_active then 'crm_tool_enabled' else 'crm_tool_disabled' end,
    'crm_workspace',v_target,btrim(p_reason),
    jsonb_build_object('workspace_id',p_workspace,'tool',p_tool,'active',p_active)
  );
end;
$$;

revoke all on function public.crm_staff_business_overview() from public;
revoke all on function public.crm_staff_set_business_pro(uuid,boolean,text) from public;
revoke all on function public.crm_staff_set_workspace_tool(text,text,boolean,text) from public;
grant execute on function public.crm_staff_business_overview() to authenticated;
grant execute on function public.crm_staff_set_business_pro(uuid,boolean,text) to authenticated;
grant execute on function public.crm_staff_set_workspace_tool(text,text,boolean,text) to authenticated;

drop trigger if exists crm_workspaces_set_updated_at on public.crm_workspaces;
create trigger crm_workspaces_set_updated_at before update on public.crm_workspaces
for each row execute function public.set_updated_at();
drop trigger if exists crm_workspace_members_set_updated_at on public.crm_workspace_members;
create trigger crm_workspace_members_set_updated_at before update on public.crm_workspace_members
for each row execute function public.set_updated_at();
drop trigger if exists crm_workspace_entitlements_set_updated_at on public.crm_workspace_entitlements;
create trigger crm_workspace_entitlements_set_updated_at before update on public.crm_workspace_entitlements
for each row execute function public.set_updated_at();
drop trigger if exists crm_inventory_items_set_updated_at on public.crm_inventory_items;
create trigger crm_inventory_items_set_updated_at before update on public.crm_inventory_items
for each row execute function public.set_updated_at();

commit;

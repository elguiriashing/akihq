begin;

insert into public.crm_tool_catalog(tool_key,name,description,category,billable,sort_order,active)
values('crm-social','CRM Social Media','Social accounts and conversations inside CRM.','communications',true,25,true)
on conflict(tool_key) do update set name=excluded.name,description=excluded.description,category=excluded.category,billable=true,active=true;
update public.crm_tool_catalog set category='platform',billable=false where tool_key in ('sites','analytics','telegram','marketing');

-- CRM membership is venue-scoped and deliberately independent from personal,
-- creator, business-owner, and platform-staff roles.
create table public.crm_role_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.crm_workspaces(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 60),
  description text not null default '' check (char_length(description) <= 240),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create table public.crm_role_template_tools (
  template_id uuid not null references public.crm_role_templates(id) on delete cascade,
  tool_key text not null references public.crm_tool_catalog(tool_key),
  primary key (template_id, tool_key)
);

alter table public.crm_workspace_members
  add column if not exists role_template_id uuid references public.crm_role_templates(id) on delete set null;
create index if not exists crm_workspace_members_template_idx on public.crm_workspace_members(role_template_id);

create or replace function public.crm_can_administer_people(p_workspace text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.crm_workspace_members member
    where member.workspace_id = p_workspace
      and member.profile_id = (select auth.uid())
      and member.status = 'active'
      and member.role in ('owner','admin')
  ) or exists (
    select 1 from public.profiles profile
    where profile.id = (select auth.uid()) and profile.app_role = 'administrator'
  );
$$;

create or replace function public.crm_member_has_tool(p_workspace text,p_tool text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.crm_has_tool(p_workspace,p_tool) and exists (
    select 1 from public.crm_workspace_members member
    where member.workspace_id = p_workspace
      and member.profile_id = (select auth.uid())
      and member.status = 'active'
      and (
        member.role = 'owner'
        or (member.role = 'admin' and member.role_template_id is null)
        or exists (
          select 1 from public.crm_role_template_tools permitted
          where permitted.template_id = member.role_template_id and permitted.tool_key = p_tool
        )
      )
  );
$$;

create or replace function public.crm_save_role_template(
  p_workspace text,p_template uuid,p_name text,p_description text,p_tools text[]
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_tool text;
begin
  if not public.crm_can_administer_people(p_workspace) then raise exception 'workspace owner or admin required'; end if;
  if char_length(btrim(coalesce(p_name,''))) not between 2 and 60 then raise exception 'invalid role name'; end if;
  if coalesce(cardinality(p_tools),0) = 0 then raise exception 'select at least one feature'; end if;
  if exists (
    select 1 from unnest(p_tools) requested(tool_key)
    where not exists (
      select 1 from public.crm_workspace_entitlements entitlement
      join public.crm_tool_catalog catalog on catalog.tool_key = entitlement.tool_key
      where entitlement.workspace_id = p_workspace and entitlement.tool_key = requested.tool_key
        and entitlement.active and catalog.active and catalog.category <> 'platform'
    )
  ) then raise exception 'role contains a feature unavailable to this workspace'; end if;
  if p_template is null then
    insert into public.crm_role_templates(workspace_id,name,description,created_by)
    values(p_workspace,btrim(p_name),btrim(coalesce(p_description,'')),(select auth.uid())) returning id into v_id;
  else
    update public.crm_role_templates set name=btrim(p_name),description=btrim(coalesce(p_description,'')),updated_at=now()
    where id=p_template and workspace_id=p_workspace returning id into v_id;
    if v_id is null then raise exception 'role template not found'; end if;
    delete from public.crm_role_template_tools where template_id=v_id;
  end if;
  foreach v_tool in array p_tools loop
    insert into public.crm_role_template_tools(template_id,tool_key) values(v_id,v_tool) on conflict do nothing;
  end loop;
  return v_id;
end;
$$;

create or replace function public.crm_add_workspace_member(
  p_workspace text,p_email text,p_role_template uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_profile uuid; v_limit integer; v_count integer;
begin
  if not public.crm_can_administer_people(p_workspace) then raise exception 'workspace owner or admin required'; end if;
  if not exists(select 1 from public.crm_role_templates where id=p_role_template and workspace_id=p_workspace) then raise exception 'role template not found'; end if;
  select id into v_profile from auth.users where lower(email)=lower(btrim(p_email)) limit 1;
  if v_profile is null then raise exception 'that account must sign in to AkiPasa once before it can be added'; end if;
  select seat_limit into strict v_limit from public.crm_workspaces where id=p_workspace for update;
  select count(*) into v_count from public.crm_workspace_members where workspace_id=p_workspace and status='active';
  if v_count >= v_limit and not exists(select 1 from public.crm_workspace_members where workspace_id=p_workspace and profile_id=v_profile)
    then raise exception 'workspace seat limit reached'; end if;
  insert into public.crm_workspace_members(workspace_id,profile_id,role,role_template_id,status,invited_by)
  values(p_workspace,v_profile,'staff',p_role_template,'active',(select auth.uid()))
  on conflict(workspace_id,profile_id) do update set role='staff',role_template_id=excluded.role_template_id,status='active',invited_by=excluded.invited_by,updated_at=now();
  return jsonb_build_object('workspace_id',p_workspace,'profile_id',v_profile,'role_template_id',p_role_template);
end;
$$;

alter table public.crm_role_templates enable row level security;
alter table public.crm_role_template_tools enable row level security;
create policy crm_role_templates_member_read on public.crm_role_templates for select to authenticated using(public.crm_can_access_workspace(workspace_id));
create policy crm_role_template_tools_member_read on public.crm_role_template_tools for select to authenticated using(exists(select 1 from public.crm_role_templates template where template.id=template_id and public.crm_can_access_workspace(template.workspace_id)));
revoke all on public.crm_role_templates,public.crm_role_template_tools from public,anon,authenticated;
grant select on public.crm_role_templates,public.crm_role_template_tools to authenticated;
grant all on public.crm_role_templates,public.crm_role_template_tools to service_role;
revoke all on function public.crm_can_administer_people(text),public.crm_member_has_tool(text,text),public.crm_save_role_template(text,uuid,text,text,text[]),public.crm_add_workspace_member(text,text,uuid) from public,anon;
grant execute on function public.crm_can_administer_people(text),public.crm_member_has_tool(text,text),public.crm_save_role_template(text,uuid,text,text,text[]),public.crm_add_workspace_member(text,text,uuid) to authenticated;

-- Customer workspaces store each module separately so a hidden navigation item
-- cannot be recovered by reading one all-tools snapshot.
create table public.crm_module_snapshots (
  workspace_id text not null references public.crm_workspaces(id) on delete cascade,
  tool_key text not null references public.crm_tool_catalog(tool_key),
  data jsonb not null default '{}'::jsonb check(jsonb_typeof(data)='object'),
  updated_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  primary key(workspace_id,tool_key)
);
alter table public.crm_module_snapshots enable row level security;
create policy crm_module_snapshots_tool_read on public.crm_module_snapshots for select to authenticated using(public.crm_member_has_tool(workspace_id,tool_key));
create policy crm_module_snapshots_tool_insert on public.crm_module_snapshots for insert to authenticated with check(public.crm_member_has_tool(workspace_id,tool_key) and updated_by=(select auth.uid()));
create policy crm_module_snapshots_tool_update on public.crm_module_snapshots for update to authenticated using(public.crm_member_has_tool(workspace_id,tool_key)) with check(public.crm_member_has_tool(workspace_id,tool_key) and updated_by=(select auth.uid()));
revoke all on public.crm_module_snapshots from public,anon,authenticated;
grant select,insert,update on public.crm_module_snapshots to authenticated;
grant all on public.crm_module_snapshots to service_role;

insert into public.crm_module_snapshots(workspace_id,tool_key,data,updated_by,updated_at)
select snapshot.workspace_id,module.tool_key,
  (select coalesce(jsonb_object_agg(key,snapshot.data->key),'{}'::jsonb) from unnest(module.keys) key where snapshot.data ? key),
  snapshot.updated_by,snapshot.updated_at
from public.workspace_snapshots snapshot
cross join (values
 ('dashboard',array['activities','notificationReadIds']::text[]),('crm',array['pipelines','contacts','companies','deals','leads']::text[]),
 ('inbox',array['conversations']::text[]),('tasks',array['tasks','projects']::text[]),('calendar',array['events']::text[]),
 ('sales',array['invoices']::text[]),('marketing',array['campaigns']::text[]),('sites',array['pages','forms']::text[]),
 ('automation',array['automations']::text[]),('collaboration',array['feed']::text[]),('integrations',array['integrations']::text[])
) module(tool_key,keys)
where snapshot.workspace_id <> 'ws_akipasa'
on conflict(workspace_id,tool_key) do nothing;

drop policy if exists "Workspace members can read snapshots" on public.workspace_snapshots;
create policy "Workspace administrators can read legacy snapshots" on public.workspace_snapshots for select to authenticated
using(workspace_id='ws_akipasa' or public.crm_can_administer_people(workspace_id));

-- Basico now receives CRM access too; the workspace entitlements define the package.
create or replace function public.crm_can_access_workspace(p_workspace text)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and (
    exists(select 1 from public.crm_workspace_members member join public.crm_workspaces workspace on workspace.id=member.workspace_id
      where member.workspace_id=p_workspace and member.profile_id=(select auth.uid()) and member.status='active'
        and workspace.status in ('active','trial') and (workspace.id='ws_akipasa' or public.has_active_entitlement(workspace.owner_profile_id,'business')))
    or exists(select 1 from public.profiles where id=(select auth.uid()) and app_role='administrator')
  );
$$;

-- Package definitions are data, not hard-coded UI permissions.
create table public.crm_business_categories (
  key text primary key check(key ~ '^[a-z][a-z0-9_-]{1,47}$'), name_es text not null, name_en text not null,
  recommended_tools text[] not null default '{}'
);
alter table public.business_applications add column if not exists business_category text references public.crm_business_categories(key);
alter table public.business_applications drop constraint if exists business_applications_plan_code_check;
alter table public.business_applications add constraint business_applications_plan_code_check check(plan_code in ('standard','business','business_pro'));

create or replace function public.submit_business_application(
  p_business_name text,p_contact_name text,p_locality text,p_website_url text,p_message text,p_business_category text,p_plan_code text
) returns uuid language plpgsql security definer set search_path='' as $$
declare application_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  if char_length(btrim(coalesce(p_business_name,''))) not between 2 and 160
    or char_length(btrim(coalesce(p_contact_name,''))) not between 2 and 120
    or char_length(btrim(coalesce(p_locality,''))) not between 2 and 120
    or char_length(btrim(coalesce(p_message,''))) not between 20 and 2000 then raise exception 'invalid business application'; end if;
  if nullif(btrim(coalesce(p_website_url,'')),'') is not null and p_website_url !~ '^https://' then raise exception 'website must use https'; end if;
  if p_plan_code not in ('business','business_pro') then raise exception 'invalid business plan'; end if;
  if not exists(select 1 from public.crm_business_categories where key=p_business_category) then raise exception 'invalid business category'; end if;
  if exists(select 1 from public.business_applications where applicant_id=(select auth.uid()) and state in ('submitted','under_review','awaiting_payment','active')) then raise exception 'an active business application already exists'; end if;
  insert into public.business_applications(applicant_id,business_name,contact_name,locality,website_url,message,business_category,plan_code)
  values((select auth.uid()),btrim(p_business_name),btrim(p_contact_name),btrim(p_locality),nullif(btrim(coalesce(p_website_url,'')),''),btrim(p_message),p_business_category,p_plan_code)
  returning id into application_id;
  return application_id;
end;
$$;
revoke all on function public.submit_business_application(text,text,text,text,text,text,text) from public,anon;
grant execute on function public.submit_business_application(text,text,text,text,text,text,text) to authenticated;

create or replace function public.update_business_application_package(p_business_category text,p_plan_code text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if p_plan_code not in ('business','business_pro') or not exists(select 1 from public.crm_business_categories where key=p_business_category) then raise exception 'invalid business package'; end if;
  update public.business_applications set business_category=p_business_category,plan_code=p_plan_code,updated_at=now()
  where applicant_id=(select auth.uid()) and state='awaiting_payment';
  if not found then raise exception 'approved business application required'; end if;
end;
$$;
revoke all on function public.update_business_application_package(text,text) from public,anon;
grant execute on function public.update_business_application_package(text,text) to authenticated;
create table public.crm_package_tools (
  plan text not null check(plan in ('business','business_pro')), business_category text not null references public.crm_business_categories(key),
  tool_key text not null references public.crm_tool_catalog(tool_key), primary key(plan,business_category,tool_key)
);
alter table public.crm_workspaces add column if not exists business_category text references public.crm_business_categories(key);
insert into public.crm_business_categories(key,name_es,name_en,recommended_tools) values
 ('food','Gastronomía y hostelería','Food & hospitality',array['pos','inventory','sales']),
 ('music','Música y ocio nocturno','Music & nightlife',array['calendar','employees','collaboration']),
 ('social','Local social','Social venue',array['crm','inbox','calendar']),
 ('workshop','Clases y talleres','Classes & workshops',array['employees','tasks','knowledge']),
 ('family','Actividades familiares','Family activities',array['calendar','knowledge','inbox']),
 ('sport','Deporte y fitness','Sport & fitness',array['employees','calendar','sales']) on conflict(key) do update set name_es=excluded.name_es,name_en=excluded.name_en,recommended_tools=excluded.recommended_tools;
insert into public.crm_package_tools(plan,business_category,tool_key)
select plan,category.key,tool from (values
 ('business',array['crm','employees','dashboard','tasks','calendar','sales','knowledge']::text[]),
 ('business_pro',array['crm','crm-social','employees','dashboard','tasks','calendar','sales','knowledge','inventory','inbox','pos','collaboration']::text[])
) package(plan,tools) cross join public.crm_business_categories category cross join lateral unnest(package.tools) tool on conflict do nothing;
alter table public.crm_business_categories enable row level security;
alter table public.crm_package_tools enable row level security;
create policy crm_business_categories_public_read on public.crm_business_categories for select to anon,authenticated using(true);
create policy crm_package_tools_public_read on public.crm_package_tools for select to anon,authenticated using(true);
revoke all on public.crm_business_categories,public.crm_package_tools from public;
grant select on public.crm_business_categories,public.crm_package_tools to anon,authenticated;
grant all on public.crm_business_categories,public.crm_package_tools to service_role;

create or replace function public.crm_apply_profile_package(p_profile uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare venue_record record; v_workspace text; v_plan text; v_category text;
begin
  select business_tier into v_plan from public.profiles where id=p_profile;
  if v_plan not in ('business','business_pro') then
    update public.crm_workspaces set status='suspended' where owner_profile_id=p_profile and id<>'ws_akipasa';
    return;
  end if;
  select coalesce(business_category,'social') into v_category from public.business_applications
  where applicant_id=p_profile order by created_at desc limit 1;
  v_category := coalesce(v_category,'social');
  for venue_record in select venue.id,venue.name from public.venues venue join public.venue_members member on member.venue_id=venue.id where member.profile_id=p_profile and member.role='owner' loop
    insert into public.crm_workspaces(id,name,slug,owner_profile_id,source_venue_id,plan,status,seat_limit,business_category)
    values('venue-'||venue_record.id,venue_record.name,'venue-'||replace(venue_record.id::text,'-',''),p_profile,venue_record.id,case when v_plan='business_pro' then 'pro' else 'growth' end,'active',4,v_category)
    on conflict(source_venue_id) do update set owner_profile_id=excluded.owner_profile_id,name=excluded.name,plan=excluded.plan,status='active',business_category=excluded.business_category;
    select id into v_workspace from public.crm_workspaces where source_venue_id=venue_record.id;
    insert into public.crm_workspace_members(workspace_id,profile_id,role,status) values(v_workspace,p_profile,'owner','active')
    on conflict(workspace_id,profile_id) do update set role='owner',role_template_id=null,status='active';
    insert into public.crm_workspace_venues(workspace_id,venue_id) values(v_workspace,venue_record.id) on conflict do nothing;
    insert into public.crm_workspace_entitlements(workspace_id,tool_key,active,source)
    select v_workspace,package.tool_key,true,'plan' from public.crm_package_tools package
    where package.plan=v_plan and package.business_category=coalesce((select business_category from public.crm_workspaces where id=v_workspace),'social')
    on conflict(workspace_id,tool_key) do update set active=true,source='plan',updated_at=now();
    update public.crm_workspace_entitlements entitlement set active=false,updated_at=now()
    where entitlement.workspace_id=v_workspace and entitlement.source='plan' and not exists(
      select 1 from public.crm_package_tools package where package.plan=v_plan and package.business_category=coalesce((select business_category from public.crm_workspaces where id=v_workspace),'social') and package.tool_key=entitlement.tool_key
    );
  end loop;
end;
$$;
create or replace function public.crm_sync_profile_package_trigger() returns trigger language plpgsql security definer set search_path='' as $$ begin perform public.crm_apply_profile_package(new.id); return new; end; $$;
drop trigger if exists crm_profiles_apply_package on public.profiles;
create trigger crm_profiles_apply_package after update of business_tier on public.profiles for each row when(old.business_tier is distinct from new.business_tier) execute function public.crm_sync_profile_package_trigger();
revoke all on function public.crm_apply_profile_package(uuid),public.crm_sync_profile_package_trigger() from public,anon,authenticated;
grant execute on function public.crm_apply_profile_package(uuid) to service_role;

create or replace function public.crm_provision_workspace_for_venue(p_venue uuid)
returns text language plpgsql security definer set search_path='' as $$
declare v_profile uuid:=(select auth.uid()); v_workspace text; v_name text; v_plan text; v_category text;
begin
  if v_profile is null or not public.has_active_entitlement(v_profile,'business') then raise exception 'active Business plan required'; end if;
  select venue.name into v_name from public.venues venue join public.venue_members member on member.venue_id=venue.id
  where venue.id=p_venue and member.profile_id=v_profile and member.role='owner';
  if v_name is null then raise exception 'venue owner required'; end if;
  select business_tier into v_plan from public.profiles where id=v_profile;
  select coalesce(business_category,'social') into v_category from public.business_applications where applicant_id=v_profile order by created_at desc limit 1;
  v_category:=coalesce(v_category,'social'); v_workspace:='venue-'||p_venue;
  insert into public.crm_workspaces(id,name,slug,owner_profile_id,source_venue_id,plan,status,seat_limit,business_category)
  values(v_workspace,v_name,'venue-'||replace(p_venue::text,'-',''),v_profile,p_venue,case when v_plan='business_pro' then 'pro' else 'growth' end,'active',4,v_category)
  on conflict(source_venue_id) do update set owner_profile_id=excluded.owner_profile_id,name=excluded.name,plan=excluded.plan,status='active',business_category=excluded.business_category
  returning id into v_workspace;
  insert into public.crm_workspace_members(workspace_id,profile_id,role,status) values(v_workspace,v_profile,'owner','active') on conflict(workspace_id,profile_id) do update set role='owner',role_template_id=null,status='active';
  insert into public.crm_workspace_venues(workspace_id,venue_id) values(v_workspace,p_venue) on conflict do nothing;
  insert into public.crm_workspace_entitlements(workspace_id,tool_key,active,source)
  select v_workspace,tool_key,true,'plan' from public.crm_package_tools where plan=v_plan and business_category=v_category
  on conflict(workspace_id,tool_key) do update set active=true,source='plan',updated_at=now();
  return v_workspace;
end;
$$;
revoke all on function public.crm_provision_workspace_for_venue(uuid) from public,anon;
grant execute on function public.crm_provision_workspace_for_venue(uuid) to authenticated;

commit;

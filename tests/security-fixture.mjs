// Representative pre-migration schema for local PostgreSQL authorization tests.
export function securityFixture(ids) { return `
    create role authenticated; create role anon; create role service_role bypassrls;
    create schema auth; grant usage on schema auth,public to authenticated,anon,service_role;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.user_id',true),'')::uuid$$;
    grant execute on function auth.uid() to public;
    create table auth.users(id uuid primary key,email text);
    create table public.profiles(id uuid primary key,display_name text,preferred_locale text,app_role text default 'consumer',
      terms_version text,terms_accepted_at timestamptz,created_at timestamptz default now(),updated_at timestamptz default now(),username text,avatar_url text,banner_url text,bio text,
      public_email text,phone text,website_url text,instagram_url text,locality text,province text,birth_year smallint,gender text,
      profile_visibility text,contact_visibility text,attendance_visibility text,business_tier text default 'none',business_plan_active boolean default false);
    alter table public.profiles enable row level security;
    create policy "Users can update their own profile" on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
    create policy profiles_read_self on public.profiles for select to authenticated using(id=auth.uid());
    create policy profiles_update_self on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
    create policy profiles_crm_workspace_member_read on public.profiles for select to authenticated using(true);
    grant select,update on public.profiles to authenticated;
    create table public.crm_workspaces(id text primary key,name text,slug text,timezone text,currency text,status text);
    create table public.crm_workspace_members(workspace_id text,profile_id uuid,role text,status text default 'active',role_template_id uuid,created_at timestamptz default now(),updated_at timestamptz default now(),primary key(workspace_id,profile_id));
    create table public.crm_tool_catalog(tool_key text primary key,active boolean default true);
    create table public.crm_workspace_entitlements(workspace_id text,tool_key text,active boolean default true,starts_at timestamptz default now(),ends_at timestamptz);
    create table public.crm_role_templates(id uuid primary key,workspace_id text,name text);
    create table public.crm_role_template_tools(template_id uuid,tool_key text);
    create table public.crm_inventory_items(id uuid primary key,workspace_id text,sku text,name text,unit text,on_hand numeric,category text,sale_price_cents integer,cost_cents integer,active boolean,updated_at timestamptz default now());
    alter table public.crm_inventory_items enable row level security;
    grant select on public.crm_inventory_items to authenticated;
    create table public.workspace_snapshots(workspace_id text primary key,updated_by uuid,data jsonb,updated_at timestamptz default now());
    alter table public.workspace_snapshots enable row level security;
    create policy "Workspace administrators can read legacy snapshots" on public.workspace_snapshots for select to authenticated using(workspace_id='ws_akipasa');
    grant all on public.workspace_snapshots to authenticated,service_role;
    create table public.crm_workspace_records(workspace_id text,record_type text,record_id text,data jsonb,updated_by uuid,created_at timestamptz default now(),updated_at timestamptz default now(),primary key(workspace_id,record_type,record_id));
    alter table public.crm_workspace_records enable row level security;
    grant all on public.crm_workspace_records to authenticated,service_role;
    create function public.crm_can_access_workspace(p_workspace text) returns boolean language sql stable security definer set search_path='' as $$
      select auth.uid() is not null and (exists(select 1 from public.crm_workspace_members where workspace_id=p_workspace and profile_id=auth.uid() and status='active') or exists(select 1 from public.profiles where id=auth.uid() and app_role='administrator'))$$;
    create function public.crm_can_operate_workspace(p_workspace text) returns boolean language sql stable security definer set search_path='' as $$
      select auth.uid() is not null and (exists(select 1 from public.crm_workspace_members where workspace_id=p_workspace and profile_id=auth.uid() and status='active' and role in('owner','admin','manager','staff')) or exists(select 1 from public.profiles where id=auth.uid() and app_role='administrator'))$$;
    create function public.crm_can_manage_workspace(p_workspace text) returns boolean language sql stable security definer set search_path='' as $$
      select auth.uid() is not null and (exists(select 1 from public.crm_workspace_members where workspace_id=p_workspace and profile_id=auth.uid() and status='active' and role in('owner','admin','manager')) or exists(select 1 from public.profiles where id=auth.uid() and app_role='administrator'))$$;
    create function public.crm_can_administer_people(p_workspace text) returns boolean language sql stable security definer set search_path='' as $$
      select auth.uid() is not null and (exists(select 1 from public.crm_workspace_members where workspace_id=p_workspace and profile_id=auth.uid() and status='active' and role in('owner','admin')) or exists(select 1 from public.profiles where id=auth.uid() and app_role='administrator'))$$;
    create function public.crm_has_tool(p_workspace text,p_tool text) returns boolean language sql stable security definer set search_path='' as $$
      select public.crm_can_access_workspace(p_workspace) and exists(select 1 from public.crm_workspace_entitlements where workspace_id=p_workspace and tool_key=p_tool and active)$$;
    create function public.crm_member_has_tool(p_workspace text,p_tool text) returns boolean language sql stable security definer set search_path='' as $$
      select public.crm_has_tool(p_workspace,p_tool) and exists(select 1 from public.crm_workspace_members m where workspace_id=p_workspace and profile_id=auth.uid() and status='active' and (role='owner' or (role='admin' and role_template_id is null) or exists(select 1 from public.crm_role_template_tools where template_id=m.role_template_id and tool_key=p_tool)))$$;
    create policy inventory_read on public.crm_inventory_items for select to authenticated using(public.crm_has_tool(workspace_id,'inventory'));
    create policy legacy_records on public.crm_workspace_records to authenticated using(public.crm_can_access_workspace(workspace_id)) with check(public.crm_can_operate_workspace(workspace_id));
    create function public.crm_add_workspace_member(p_workspace text,p_email text,p_role text default 'staff') returns jsonb language plpgsql security definer set search_path='' as $$begin
      if not public.crm_can_manage_workspace(p_workspace) then raise exception 'manager required'; end if;
      insert into public.crm_workspace_members(workspace_id,profile_id,role) select p_workspace,id,p_role from auth.users where email=p_email on conflict(workspace_id,profile_id) do update set role=excluded.role;
      return jsonb_build_object('ok',true); end$$;
    create function public.crm_add_workspace_member(p_workspace text,p_email text,p_role_template uuid) returns jsonb language plpgsql security definer set search_path='' as $$begin
      if not public.crm_can_administer_people(p_workspace) then raise exception 'admin required'; end if;
      insert into public.crm_workspace_members(workspace_id,profile_id,role,role_template_id) select p_workspace,id,'staff',p_role_template from auth.users where email=p_email on conflict(workspace_id,profile_id) do update set role='staff',role_template_id=excluded.role_template_id;
      return jsonb_build_object('ok',true); end$$;
    create function public.crm_remove_workspace_member(p_workspace text,p_profile uuid) returns void language plpgsql security definer set search_path='' as $$begin
      if not public.crm_can_manage_workspace(p_workspace) then raise exception 'manager required'; end if;
      if exists(select 1 from public.crm_workspace_members where workspace_id=p_workspace and profile_id=p_profile and role='owner') then raise exception 'owner protected'; end if;
      delete from public.crm_workspace_members where workspace_id=p_workspace and profile_id=p_profile; end$$;
    insert into public.profiles(id,display_name,app_role,phone,birth_year) values
      ('${ids.owner}','Owner','consumer','SECRET_PHONE',1980),('${ids.staff}','Staff','consumer','STAFF_PHONE',1995),
      ('${ids.outsider}','Outsider','consumer',null,null),('${ids.manager}','Manager','consumer',null,null),
      ('${ids.admin}','Platform admin','administrator',null,null),('${ids.viewer}','Viewer','consumer',null,null);
    insert into auth.users select id,display_name||'@test.invalid' from public.profiles;
    insert into public.crm_workspaces values('tenant-a','Tenant A','a','Europe/Madrid','EUR','active'),('tenant-b','Tenant B','b','Europe/Madrid','EUR','active'),('ws_akipasa','HQ','hq','Europe/Madrid','EUR','active');
    insert into public.crm_role_templates values('10000000-0000-0000-0000-000000000001','tenant-a','Calendar staff');
    insert into public.crm_role_template_tools values('10000000-0000-0000-0000-000000000001','calendar');
    insert into public.crm_workspace_members(workspace_id,profile_id,role,role_template_id) values
      ('tenant-a','${ids.owner}','owner',null),('tenant-a','${ids.staff}','staff','10000000-0000-0000-0000-000000000001'),
      ('tenant-a','${ids.manager}','manager','10000000-0000-0000-0000-000000000001'),
      ('tenant-a','${ids.viewer}','viewer','10000000-0000-0000-0000-000000000001');
    insert into public.crm_tool_catalog values('calendar'),('knowledge'),('employees'),('crm'),('inventory'),('sales'),('pos');
    insert into public.crm_workspace_entitlements(workspace_id,tool_key,active) select 'tenant-a',tool_key,true from public.crm_tool_catalog;
    insert into public.crm_workspace_entitlements(workspace_id,tool_key,active) select 'ws_akipasa',tool_key,true from public.crm_tool_catalog;
    insert into public.crm_inventory_items values('20000000-0000-0000-0000-000000000001','tenant-a','SKU','Product','unit',10,'General',121,50,true,now());
    insert into public.workspace_snapshots(workspace_id,data,updated_by) values
      ('tenant-a','{"events":[{"id":"e1"}],"employees":[{"salary":100}],"contacts":[{"phone":"PRIVATE"}],"integrations":{"provider":{"config":{"apiKey":"OLD_SECRET","nested":[{"access_token":"OLD_TOKEN","senderEmail":"public@test.invalid"}]}}},"workspace":{"role":"owner","toolKeys":["employees"]}}','${ids.owner}'),
      ('ws_akipasa','{"contacts":[{"name":"HQ_SECRET"}]}','${ids.admin}');
    insert into public.crm_workspace_records(workspace_id,record_type,record_id,data,updated_by) values
      ('tenant-a','event','e1','{"title":"Calendar"}','${ids.owner}'),('tenant-a','article','k1','{"title":"Knowledge"}','${ids.owner}'),('tenant-a','employee','h1','{"salary":100}','${ids.owner}');
`; }

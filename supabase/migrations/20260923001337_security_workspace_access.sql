-- AkiHQ authorization boundary. Existing data is preserved; no destructive backfill.
-- Deploy with the RPC-based frontend in the same release. Never restore the legacy
-- permissive policies to roll back an application release.
begin;

create schema if not exists akihq_security;
revoke all on schema akihq_security from public, anon;
grant usage on schema akihq_security to authenticated, service_role;

-- An authenticated browser must not change its role, subscription or identity.
-- Existing checked SECURITY DEFINER administration/billing RPCs retain access.
drop policy if exists "Users can update their own profile" on public.profiles;
revoke update on public.profiles from public, anon, authenticated;
grant update(display_name,preferred_locale,terms_version,terms_accepted_at,updated_at,
  username,avatar_url,banner_url,bio,public_email,phone,website_url,instagram_url,
  locality,province,birth_year,gender,profile_visibility,contact_visibility,attendance_visibility)
  on public.profiles to authenticated;

create function akihq_security.protect_profile_authority() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if current_user in ('authenticated','anon') and (
    new.id is distinct from old.id or new.app_role is distinct from old.app_role
    or new.business_tier is distinct from old.business_tier
    or new.business_plan_active is distinct from old.business_plan_active
    or new.created_at is distinct from old.created_at
  ) then raise exception 'Profile authority can only be changed by a trusted administration operation' using errcode='42501'; end if;
  return new;
end $$;
revoke all on function akihq_security.protect_profile_authority() from public;
create trigger akihq_protect_profile_authority before update on public.profiles
for each row execute function akihq_security.protect_profile_authority();

-- Existing commerce policies and RPCs call this shared helper. A subscription
-- entitlement is necessary but never sufficient: a member also needs the tool
-- in their role template. This keeps older entry points inside the same boundary.
create or replace function public.crm_has_tool(p_workspace text,p_tool text) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and public.crm_can_access_workspace(p_workspace)
    and exists(select 1 from public.crm_workspaces w where w.id=p_workspace and w.status in ('active','trial'))
    and exists(select 1 from public.crm_workspace_entitlements e
      join public.crm_tool_catalog c on c.tool_key=e.tool_key and c.active
      where e.workspace_id=p_workspace and e.tool_key=p_tool and e.active
        and e.starts_at<=now() and (e.ends_at is null or e.ends_at>now()))
    and (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.app_role='administrator')
      or exists(select 1 from public.crm_workspace_members m where m.workspace_id=p_workspace
        and m.profile_id=(select auth.uid()) and m.status='active' and (
          m.role='owner' or (m.role='admin' and m.role_template_id is null)
          or exists(select 1 from public.crm_role_templates t join public.crm_role_template_tools tt on tt.template_id=t.id
            where t.id=m.role_template_id and t.workspace_id=p_workspace and tt.tool_key=p_tool))));
$$;
revoke all on function public.crm_has_tool(text,text) from public,anon;
grant execute on function public.crm_has_tool(text,text) to authenticated,service_role;

create function akihq_security.can_tool(p_workspace text,p_tool text) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null
    and public.crm_can_access_workspace(p_workspace)
    and exists(select 1 from public.crm_workspaces w where w.id=p_workspace and w.status in ('active','trial'))
    and public.crm_has_tool(p_workspace,p_tool)
    and (public.crm_member_has_tool(p_workspace,p_tool)
      or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.app_role='administrator'));
$$;
revoke all on function akihq_security.can_tool(text,text) from public,anon;
grant execute on function akihq_security.can_tool(text,text) to authenticated,service_role;

create function akihq_security.can_administer(p_workspace text) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and public.crm_can_access_workspace(p_workspace)
    and exists(select 1 from public.crm_workspaces w where w.id=p_workspace and w.status in ('active','trial'))
    and public.crm_can_administer_people(p_workspace);
$$;
revoke all on function akihq_security.can_administer(text) from public,anon;
grant execute on function akihq_security.can_administer(text) to authenticated,service_role;

create function akihq_security.can_export(p_workspace text,p_tool text) returns boolean
language sql stable security definer set search_path = '' as $$
  select akihq_security.can_tool(p_workspace,p_tool) and (
    akihq_security.can_administer(p_workspace) or (p_tool <> 'employees' and exists(
      select 1 from public.crm_workspace_members m where m.workspace_id=p_workspace
      and m.profile_id=(select auth.uid()) and m.status='active' and m.role='manager')));
$$;
revoke all on function akihq_security.can_export(text,text) from public,anon;
grant execute on function akihq_security.can_export(text,text) to authenticated,service_role;

create function akihq_security.workspace_access(p_workspace text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_tools jsonb; v_exports jsonb; v_admin boolean;
begin
  if (select auth.uid()) is null or not public.crm_can_access_workspace(p_workspace)
    or not exists(select 1 from public.crm_workspaces w where w.id=p_workspace and w.status in ('active','trial'))
    then raise exception 'Workspace access required' using errcode='42501'; end if;
  select coalesce(jsonb_agg(c.tool_key order by c.tool_key),'[]'::jsonb) into v_tools
    from public.crm_tool_catalog c where c.active and akihq_security.can_tool(p_workspace,c.tool_key);
  select coalesce(jsonb_agg(c.tool_key order by c.tool_key),'[]'::jsonb) into v_exports
    from public.crm_tool_catalog c where c.active and akihq_security.can_export(p_workspace,c.tool_key);
  v_admin:=akihq_security.can_administer(p_workspace);
  return jsonb_build_object('tool_keys',v_tools,'can_administer',v_admin,
    'can_operate',public.crm_can_operate_workspace(p_workspace),'can_export',jsonb_array_length(v_exports)>0,
    'export_tool_keys',v_exports);
end $$;
revoke all on function akihq_security.workspace_access(text) from public,anon;
grant execute on function akihq_security.workspace_access(text) to authenticated,service_role;
create function public.crm_workspace_access(p_workspace text) returns jsonb
language sql stable security invoker set search_path = '' as $$ select akihq_security.workspace_access(p_workspace) $$;
revoke all on function public.crm_workspace_access(text) from public,anon;
grant execute on function public.crm_workspace_access(text) to authenticated;

-- Cashiers need sale prices and available quantities, not supplier costs or
-- whole inventory rows. The raw table remains inventory-module protected.
create function akihq_security.pos_catalogue(p_workspace text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not akihq_security.can_tool(p_workspace,'pos') then raise exception 'Point-of-sale access required' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'workspace_id',i.workspace_id,'sku',i.sku,
    'name',i.name,'unit',i.unit,'on_hand',case
      when l.id is not null and not l.active then 0
      when b.item_id is not null then b.quantity
      -- Once location tracking exists, missing MAIN stock must not fall back to
      -- aggregate stock held elsewhere. Legacy uninitialised items use on_hand.
      when exists(select 1 from public.crm_inventory_location_balances any_balance
        where any_balance.workspace_id=i.workspace_id and any_balance.item_id=i.id) then 0
      else i.on_hand end,'category',i.category,'sale_price_cents',i.sale_price_cents,
    'active',i.active,'updated_at',i.updated_at) order by i.name,i.id),'[]'::jsonb)
    from public.crm_inventory_items i
    left join public.crm_inventory_locations l on l.workspace_id=i.workspace_id and l.is_default
    left join public.crm_inventory_location_balances b on b.workspace_id=i.workspace_id and b.item_id=i.id and b.location_id=l.id
    where i.workspace_id=p_workspace and i.active);
end $$;
revoke all on function akihq_security.pos_catalogue(text) from public,anon;
grant execute on function akihq_security.pos_catalogue(text) to authenticated,service_role;
create function public.crm_pos_catalogue(p_workspace text) returns jsonb
language sql stable security invoker set search_path = '' as $$ select akihq_security.pos_catalogue(p_workspace) $$;
revoke all on function public.crm_pos_catalogue(text) from public,anon;
grant execute on function public.crm_pos_catalogue(text) to authenticated;

-- Mixed-module snapshots cannot be safely authorized one row at a time. They are
-- internal storage; clients use the filtered RPCs below. Existing rows stay intact.
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='workspace_snapshots' loop
    execute format('drop policy %I on public.workspace_snapshots',p.policyname);
  end loop;
end $$;
alter table public.workspace_snapshots enable row level security;
revoke all on public.workspace_snapshots from public,anon,authenticated;
grant all on public.workspace_snapshots to service_role;

create function akihq_security.snapshot_module(p_key text) returns text
language sql immutable security invoker set search_path = '' as $$
  select case
    when p_key in ('tasks','projects') then 'tasks'
    when p_key in ('contacts','companies','deals','leads','pipelines') then 'crm'
    when p_key in ('products','warehouses') then 'inventory'
    when p_key='invoices' then 'sales'
    when p_key='campaigns' then 'marketing'
    when p_key in ('pages','forms') then 'sites'
    when p_key='automations' then 'automation'
    when p_key='conversations' then 'inbox'
    when p_key='feed' then 'collaboration'
    when p_key='events' then 'calendar'
    when p_key='knowledge' then 'knowledge'
    when p_key='employees' then 'employees'
    else null end;
$$;
revoke all on function akihq_security.snapshot_module(text) from public,anon;
grant execute on function akihq_security.snapshot_module(text) to authenticated,service_role;

create function akihq_security.redact_secrets(p_value jsonb) returns jsonb
language plpgsql immutable security invoker set search_path = '' as $$
declare v_result jsonb; v_key text; v_child jsonb;
begin
  if jsonb_typeof(p_value)='object' then
    v_result:='{}'::jsonb;
    for v_key,v_child in select key,value from jsonb_each(p_value) loop
      if lower(regexp_replace(v_key,'[^a-zA-Z0-9]','','g')) !~ '(apikey|token|secret|password|credential|authorization|privatekey)' then
        v_result:=v_result||jsonb_build_object(v_key,akihq_security.redact_secrets(v_child));
      end if;
    end loop;
    return v_result;
  elsif jsonb_typeof(p_value)='array' then
    return coalesce((select jsonb_agg(akihq_security.redact_secrets(value) order by ordinality) from jsonb_array_elements(p_value) with ordinality),'[]'::jsonb);
  end if;
  return p_value;
end $$;
revoke all on function akihq_security.redact_secrets(jsonb) from public,anon;
grant execute on function akihq_security.redact_secrets(jsonb) to authenticated,service_role;

create function akihq_security.filtered_snapshot(p_workspace text,p_data jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_data jsonb:='{}'; v_key text; v_tool text; v_admin boolean;
begin
  perform akihq_security.workspace_access(p_workspace);
  v_admin:=akihq_security.can_administer(p_workspace);
  foreach v_key in array array['tasks','projects','contacts','companies','deals','leads','pipelines',
    'products','warehouses','invoices','campaigns','pages','forms','automations','conversations','feed',
    'events','knowledge','employees'] loop
    v_tool:=akihq_security.snapshot_module(v_key);
    v_data:=v_data||jsonb_build_object(v_key,case when akihq_security.can_tool(p_workspace,v_tool)
      then coalesce(p_data->v_key,'[]'::jsonb) else '[]'::jsonb end);
  end loop;
  foreach v_key in array array['activities','audit'] loop
    v_data:=v_data||jsonb_build_object(v_key,case when v_admin then coalesce(p_data->v_key,'[]'::jsonb) else '[]'::jsonb end);
  end loop;
  foreach v_key in array array['integrations','settings'] loop
    v_data:=v_data||jsonb_build_object(v_key,case when v_admin then akihq_security.redact_secrets(coalesce(p_data->v_key,'{}'::jsonb)) else '{}'::jsonb end);
  end loop;
  v_data:=v_data||jsonb_build_object('workspace',(select jsonb_build_object('id',w.id,'name',w.name,
    'slug',w.slug,'timezone',w.timezone,'currency',w.currency) from public.crm_workspaces w where w.id=p_workspace));
  return v_data;
end $$;
revoke all on function akihq_security.filtered_snapshot(text,jsonb) from public,anon;
grant execute on function akihq_security.filtered_snapshot(text,jsonb) to authenticated,service_role;

create function akihq_security.read_workspace_snapshot(p_workspace text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_row public.workspace_snapshots%rowtype; v_access jsonb;
begin
  v_access:=akihq_security.workspace_access(p_workspace);
  select * into v_row from public.workspace_snapshots where workspace_id=p_workspace;
  return jsonb_build_object('data',akihq_security.filtered_snapshot(p_workspace,coalesce(v_row.data,'{}'::jsonb)),
    'updated_at',v_row.updated_at,'updated_by',v_row.updated_by,'access',v_access);
end $$;
revoke all on function akihq_security.read_workspace_snapshot(text) from public,anon;
grant execute on function akihq_security.read_workspace_snapshot(text) to authenticated,service_role;
create function public.crm_read_workspace_snapshot(p_workspace text) returns jsonb
language sql stable security invoker set search_path = '' as $$ select akihq_security.read_workspace_snapshot(p_workspace) $$;
revoke all on function public.crm_read_workspace_snapshot(text) from public,anon;
grant execute on function public.crm_read_workspace_snapshot(text) to authenticated;

create function akihq_security.write_workspace_snapshot(p_workspace text,p_data jsonb,p_expected_updated_at timestamptz default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_current public.workspace_snapshots%rowtype; v_next jsonb; v_key text; v_value jsonb;
  v_tool text; v_admin boolean; v_now timestamptz;
begin
  perform akihq_security.workspace_access(p_workspace);
  if not public.crm_can_operate_workspace(p_workspace) then raise exception 'Workspace write access required' using errcode='42501'; end if;
  if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Snapshot must be an object' using errcode='22023'; end if;
  -- Lock the parent as well so simultaneous first saves cannot bypass version checks.
  perform 1 from public.crm_workspaces where id=p_workspace for update;
  select * into v_current from public.workspace_snapshots where workspace_id=p_workspace for update;
  if v_current.workspace_id is not null and (p_expected_updated_at is null or v_current.updated_at is distinct from p_expected_updated_at)
    then raise exception 'Workspace changed. Reload the latest data before saving.' using errcode='40001'; end if;
  if v_current.workspace_id is null and p_expected_updated_at is not null
    then raise exception 'Workspace snapshot changed. Reload before saving.' using errcode='40001'; end if;
  v_admin:=akihq_security.can_administer(p_workspace);
  v_next:=coalesce(v_current.data,'{}'::jsonb);
  for v_key,v_value in select key,value from jsonb_each(p_data) loop
    v_tool:=akihq_security.snapshot_module(v_key);
    if (v_tool is not null and akihq_security.can_tool(p_workspace,v_tool)) or (v_admin and v_key in ('activities','audit')) then
      if jsonb_typeof(v_value)<>'array' then raise exception 'Snapshot collection % must be an array',v_key using errcode='22023'; end if;
      v_next:=v_next||jsonb_build_object(v_key,v_value);
    elsif v_admin and v_key in ('integrations','settings') then
      if jsonb_typeof(v_value)<>'object' then raise exception 'Snapshot setting % must be an object',v_key using errcode='22023'; end if;
      v_next:=v_next||jsonb_build_object(v_key,akihq_security.redact_secrets(v_value));
    end if;
  end loop;
  -- Keep only display metadata in legacy state. Roles and entitlements never come
  -- from JSON, including privileged callers and imported browser backups.
  v_next:=v_next||jsonb_build_object('workspace',(akihq_security.filtered_snapshot(p_workspace,'{}'::jsonb))->'workspace');
  insert into public.workspace_snapshots(workspace_id,data,updated_by,updated_at)
    values(p_workspace,v_next,(select auth.uid()),clock_timestamp())
    on conflict(workspace_id) do update set data=excluded.data,updated_by=excluded.updated_by,updated_at=excluded.updated_at
    returning updated_at into v_now;
  return jsonb_build_object('updated_at',v_now,'updated_by',(select auth.uid()),'data',akihq_security.filtered_snapshot(p_workspace,v_next),
    'access',akihq_security.workspace_access(p_workspace));
end $$;
revoke all on function akihq_security.write_workspace_snapshot(text,jsonb,timestamptz) from public,anon;
grant execute on function akihq_security.write_workspace_snapshot(text,jsonb,timestamptz) to authenticated,service_role;
create function public.crm_write_workspace_snapshot(p_workspace text,p_data jsonb,p_expected_updated_at timestamptz default null) returns jsonb
language sql security invoker set search_path = '' as $$ select akihq_security.write_workspace_snapshot(p_workspace,p_data,p_expected_updated_at) $$;
revoke all on function public.crm_write_workspace_snapshot(text,jsonb,timestamptz) from public,anon;
grant execute on function public.crm_write_workspace_snapshot(text,jsonb,timestamptz) to authenticated;

-- Durable records enforce module permissions independently of frontend routes.
create function akihq_security.record_tool(p_type text) returns text
language sql immutable security invoker set search_path = '' as $$
  select case p_type when 'event' then 'calendar' when 'article' then 'knowledge'
    when 'task' then 'tasks' when 'project' then 'tasks' when 'contact' then 'crm'
    when 'company' then 'crm' when 'deal' then 'crm' when 'lead' then 'crm'
    when 'product' then 'inventory' when 'invoice' then 'sales' when 'employee' then 'employees'
    when 'campaign' then 'marketing' when 'page' then 'sites' when 'form' then 'sites'
    when 'automation' then 'automation' else null end;
$$;
revoke all on function akihq_security.record_tool(text) from public,anon;
grant execute on function akihq_security.record_tool(text) to authenticated,service_role;
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='crm_workspace_records' loop
    execute format('drop policy %I on public.crm_workspace_records',p.policyname);
  end loop;
end $$;
alter table public.crm_workspace_records enable row level security;
revoke all on public.crm_workspace_records from public,anon,authenticated;
grant select,insert,update,delete on public.crm_workspace_records to authenticated;
create policy akihq_records_read on public.crm_workspace_records for select to authenticated
  using(akihq_security.can_tool(workspace_id,akihq_security.record_tool(record_type)));
create policy akihq_records_insert on public.crm_workspace_records for insert to authenticated
  with check(akihq_security.can_tool(workspace_id,akihq_security.record_tool(record_type)) and public.crm_can_operate_workspace(workspace_id) and updated_by=(select auth.uid()));
create policy akihq_records_update on public.crm_workspace_records for update to authenticated
  using(akihq_security.can_tool(workspace_id,akihq_security.record_tool(record_type)) and public.crm_can_operate_workspace(workspace_id))
  with check(akihq_security.can_tool(workspace_id,akihq_security.record_tool(record_type)) and public.crm_can_operate_workspace(workspace_id) and updated_by=(select auth.uid()));
create policy akihq_records_delete on public.crm_workspace_records for delete to authenticated
  using(akihq_security.can_tool(workspace_id,akihq_security.record_tool(record_type)) and public.crm_can_manage_workspace(workspace_id));

create function akihq_security.protect_record_identity() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.workspace_id is distinct from old.workspace_id or new.record_type is distinct from old.record_type
    or new.record_id is distinct from old.record_id or new.created_at is distinct from old.created_at then
    raise exception 'Record identity and creation time cannot be reassigned' using errcode='42501';
  end if;
  return new;
end $$;
revoke all on function akihq_security.protect_record_identity() from public,anon;
create trigger akihq_protect_record_identity before update on public.crm_workspace_records
for each row execute function akihq_security.protect_record_identity();

-- Shared membership does not justify disclosing peers' personal profile columns.
drop policy if exists profiles_crm_workspace_member_read on public.profiles;
create function akihq_security.workspace_directory(p_workspace text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform akihq_security.workspace_access(p_workspace);
  return (select coalesce(jsonb_agg(jsonb_build_object('workspace_id',m.workspace_id,'profile_id',m.profile_id,
    'role',m.role,'status',m.status,'role_template_id',m.role_template_id,'created_at',m.created_at,'updated_at',m.updated_at,
    'profiles',jsonb_build_object('id',p.id,'display_name',p.display_name,'created_at',p.created_at,'updated_at',p.updated_at))
    order by p.display_name),'[]'::jsonb)
    from public.crm_workspace_members m join public.profiles p on p.id=m.profile_id
    where m.workspace_id=p_workspace and (m.status='active' or akihq_security.can_administer(p_workspace)));
end $$;
revoke all on function akihq_security.workspace_directory(text) from public,anon;
grant execute on function akihq_security.workspace_directory(text) to authenticated,service_role;
create function public.crm_workspace_directory(p_workspace text) returns jsonb
language sql stable security invoker set search_path = '' as $$ select akihq_security.workspace_directory(p_workspace) $$;
revoke all on function public.crm_workspace_directory(text) from public,anon;
grant execute on function public.crm_workspace_directory(text) to authenticated;

-- Preserve existing provisioning/venue synchronization triggers. Harden the
-- user-facing membership RPCs without blocking first-time workspace creation.
alter function public.crm_add_workspace_member(text,text,text) set schema akihq_security;
alter function public.crm_add_workspace_member(text,text,uuid) set schema akihq_security;
alter function public.crm_remove_workspace_member(text,uuid) set schema akihq_security;
revoke all on function akihq_security.crm_add_workspace_member(text,text,text) from public,anon,authenticated;
revoke all on function akihq_security.crm_add_workspace_member(text,text,uuid) from public,anon,authenticated;
revoke all on function akihq_security.crm_remove_workspace_member(text,uuid) from public,anon,authenticated;

create function akihq_security.check_member_change(p_workspace text,p_email text) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not akihq_security.can_administer(p_workspace) then raise exception 'Workspace owner or administrator required' using errcode='42501'; end if;
  if exists(select 1 from public.crm_workspace_members m join auth.users u on u.id=m.profile_id
    where m.workspace_id=p_workspace and m.role='owner' and lower(u.email)=lower(btrim(p_email)))
    then raise exception 'Use the verified ownership transfer workflow to change a workspace owner' using errcode='42501'; end if;
end $$;
revoke all on function akihq_security.check_member_change(text,text) from public,anon,authenticated;

create function akihq_security.add_member(p_workspace text,p_email text,p_role text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform akihq_security.check_member_change(p_workspace,p_email);
  return akihq_security.crm_add_workspace_member(p_workspace,p_email,p_role);
end $$;
create function akihq_security.add_member_template(p_workspace text,p_email text,p_role_template uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform akihq_security.check_member_change(p_workspace,p_email);
  return akihq_security.crm_add_workspace_member(p_workspace,p_email,p_role_template);
end $$;
create function akihq_security.remove_member(p_workspace text,p_profile uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not akihq_security.can_administer(p_workspace) then raise exception 'Workspace owner or administrator required' using errcode='42501'; end if;
  perform akihq_security.crm_remove_workspace_member(p_workspace,p_profile);
end $$;
revoke all on function akihq_security.add_member(text,text,text),akihq_security.add_member_template(text,text,uuid),akihq_security.remove_member(text,uuid) from public,anon;
grant execute on function akihq_security.add_member(text,text,text),akihq_security.add_member_template(text,text,uuid),akihq_security.remove_member(text,uuid) to authenticated;
create function public.crm_add_workspace_member(p_workspace text,p_email text,p_role text default 'staff') returns jsonb
language sql security invoker set search_path = '' as $$ select akihq_security.add_member(p_workspace,p_email,p_role) $$;
create function public.crm_add_workspace_member(p_workspace text,p_email text,p_role_template uuid) returns jsonb
language sql security invoker set search_path = '' as $$ select akihq_security.add_member_template(p_workspace,p_email,p_role_template) $$;
create function public.crm_remove_workspace_member(p_workspace text,p_profile uuid) returns void
language sql security invoker set search_path = '' as $$ select akihq_security.remove_member(p_workspace,p_profile) $$;
revoke all on function public.crm_add_workspace_member(text,text,text),public.crm_add_workspace_member(text,text,uuid),public.crm_remove_workspace_member(text,uuid) from public,anon;
grant execute on function public.crm_add_workspace_member(text,text,text),public.crm_add_workspace_member(text,text,uuid),public.crm_remove_workspace_member(text,uuid) to authenticated;

-- Server-authored audit stores metadata and hashes, never CRM/HR/contact content.
create table public.crm_security_audit_events (
  id bigint generated always as identity primary key,
  workspace_id text not null references public.crm_workspaces(id),
  actor_id uuid,
  action text not null,
  target_type text not null,
  target_id text,
  before_sha256 text,
  after_sha256 text,
  detail jsonb not null default '{}'::jsonb check(jsonb_typeof(detail)='object'),
  created_at timestamptz not null default clock_timestamp()
);
create index crm_security_audit_workspace_created on public.crm_security_audit_events(workspace_id,created_at desc,id desc);
alter table public.crm_security_audit_events enable row level security;
revoke all on public.crm_security_audit_events from public,anon,authenticated,service_role;
grant select on public.crm_security_audit_events to authenticated,service_role;
create policy akihq_security_audit_read on public.crm_security_audit_events for select to authenticated
using(akihq_security.can_administer(workspace_id));

create function akihq_security.audit_workspace_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_old jsonb; v_new jsonb; v_row jsonb; v_id text;
begin
  if tg_op<>'INSERT' then v_old:=to_jsonb(old); end if;
  if tg_op<>'DELETE' then v_new:=to_jsonb(new); end if;
  v_row:=coalesce(v_new,v_old);
  if tg_op='UPDATE' and (v_old-'updated_at') is not distinct from (v_new-'updated_at') then return new; end if;
  v_id:=coalesce(v_row->>'record_id',v_row->>'profile_id',v_row->>'id',v_row->>'workspace_id');
  insert into public.crm_security_audit_events(workspace_id,actor_id,action,target_type,target_id,before_sha256,after_sha256,detail)
  values(v_row->>'workspace_id',(select auth.uid()),lower(tg_op),tg_table_name,v_id,
    case when v_old is not null then encode(sha256(convert_to(v_old::text,'UTF8')),'hex') end,
    case when v_new is not null then encode(sha256(convert_to(v_new::text,'UTF8')),'hex') end,
    jsonb_strip_nulls(jsonb_build_object('record_type',v_row->>'record_type',
      'old_role',case when tg_table_name='crm_workspace_members' then v_old->>'role' end,
      'new_role',case when tg_table_name='crm_workspace_members' then v_new->>'role' end)));
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
revoke all on function akihq_security.audit_workspace_change() from public,anon;
create trigger akihq_audit_snapshot after insert or update or delete on public.workspace_snapshots
for each row execute function akihq_security.audit_workspace_change();
create trigger akihq_audit_records after insert or update or delete on public.crm_workspace_records
for each row execute function akihq_security.audit_workspace_change();
create trigger akihq_audit_members after insert or update or delete on public.crm_workspace_members
for each row execute function akihq_security.audit_workspace_change();
create trigger akihq_audit_roles after insert or update or delete on public.crm_role_templates
for each row execute function akihq_security.audit_workspace_change();

create function akihq_security.audit_role_tool_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_row jsonb; v_workspace text;
begin
  v_row:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  select t.workspace_id into v_workspace from public.crm_role_templates t where t.id=(v_row->>'template_id')::uuid;
  -- A cascading template deletion is already captured by the parent audit.
  if v_workspace is not null then
    insert into public.crm_security_audit_events(workspace_id,actor_id,action,target_type,target_id,detail)
      values(v_workspace,(select auth.uid()),lower(tg_op),'crm_role_template_tools',v_row->>'template_id',
        jsonb_build_object('tool_key',v_row->>'tool_key'));
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
revoke all on function akihq_security.audit_role_tool_change() from public,anon;
create trigger akihq_audit_role_tools after insert or update or delete on public.crm_role_template_tools
for each row execute function akihq_security.audit_role_tool_change();

create function akihq_security.record_export(p_workspace text,p_tool text,p_rows integer,p_from date default null,p_to date default null) returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_id bigint;
begin
  if not akihq_security.can_export(p_workspace,p_tool) then raise exception 'Export permission required' using errcode='42501'; end if;
  if p_rows is null or p_rows<0 or p_rows>10000000 or (p_from is not null and p_to is not null and p_from>p_to)
    then raise exception 'Invalid export metadata' using errcode='22023'; end if;
  insert into public.crm_security_audit_events(workspace_id,actor_id,action,target_type,detail)
    values(p_workspace,(select auth.uid()),'export_requested',p_tool,jsonb_build_object('rows',p_rows,'from',p_from,'to',p_to)) returning id into v_id;
  return v_id;
end $$;
revoke all on function akihq_security.record_export(text,text,integer,date,date) from public,anon;
grant execute on function akihq_security.record_export(text,text,integer,date,date) to authenticated,service_role;
create function public.crm_record_export_event(p_workspace text,p_tool text,p_rows integer,p_from date default null,p_to date default null) returns bigint
language sql security invoker set search_path = '' as $$ select akihq_security.record_export(p_workspace,p_tool,p_rows,p_from,p_to) $$;
revoke all on function public.crm_record_export_event(text,text,integer,date,date) from public,anon;
grant execute on function public.crm_record_export_event(text,text,integer,date,date) to authenticated;

comment on table public.crm_security_audit_events is 'Append-only application audit metadata. Access restricted to workspace administrators. Retention and legal holds require an approved operational policy; no automatic deletion is enabled.';
notify pgrst,'reload schema';
commit;

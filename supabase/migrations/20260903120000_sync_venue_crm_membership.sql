begin;

-- A venue membership is the source of truth for every venue-backed CRM workspace.
-- The extra predicate below is deliberate defence in depth: even if an old CRM
-- membership row survives, it cannot grant access after the venue link is removed.
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
          or (
            workspace.source_venue_id is not null
            and public.has_active_entitlement(workspace.owner_profile_id,'business_pro')
            and exists (
              select 1
              from public.venue_members venue_member
              where venue_member.venue_id = workspace.source_venue_id
                and venue_member.profile_id = (select auth.uid())
            )
          )
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

create or replace function public.crm_sync_venue_workspace_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace text;
  v_replacement_owner uuid;
begin
  if tg_op in ('DELETE','UPDATE') then
    select workspace.id into v_workspace
    from public.crm_workspaces workspace
    where workspace.source_venue_id = old.venue_id;

    if v_workspace is not null
      and (tg_op = 'DELETE' or old.venue_id <> new.venue_id or old.profile_id <> new.profile_id)
    then
      delete from public.crm_workspace_members member
      where member.workspace_id = v_workspace
        and member.profile_id = old.profile_id;

      if exists (
        select 1 from public.crm_workspaces workspace
        where workspace.id = v_workspace and workspace.owner_profile_id = old.profile_id
      ) then
        select member.profile_id into v_replacement_owner
        from public.venue_members member
        where member.venue_id = old.venue_id
          and member.role = 'owner'::public.venue_member_role
          and member.profile_id <> old.profile_id
        order by member.profile_id
        limit 1;

        if v_replacement_owner is null then
          update public.crm_workspaces workspace
          set status = 'suspended'
          where workspace.id = v_workspace;
        else
          update public.crm_workspaces workspace
          set owner_profile_id = v_replacement_owner
          where workspace.id = v_workspace;
        end if;
      end if;
    end if;
  end if;

  if tg_op in ('INSERT','UPDATE') then
    select workspace.id into v_workspace
    from public.crm_workspaces workspace
    where workspace.source_venue_id = new.venue_id;

    if v_workspace is not null then
      insert into public.crm_workspace_members (workspace_id,profile_id,role,status)
      values (
        v_workspace,
        new.profile_id,
        case new.role
          when 'owner'::public.venue_member_role then 'owner'
          when 'manager'::public.venue_member_role then 'manager'
          else 'staff'
        end,
        'active'
      )
      on conflict (workspace_id,profile_id) do update
      set role = excluded.role,status = 'active',updated_at = now();
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists crm_sync_venue_workspace_membership on public.venue_members;
create trigger crm_sync_venue_workspace_membership
after insert or update or delete on public.venue_members
for each row execute function public.crm_sync_venue_workspace_membership();

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
  v_venue uuid;
  v_venue_role public.venue_member_role;
begin
  if not public.crm_can_manage_workspace(p_workspace) then raise exception 'workspace manager required'; end if;
  if p_role not in ('admin','manager','staff','viewer') then raise exception 'invalid workspace role'; end if;
  select user_record.id into v_profile
  from auth.users user_record
  where lower(user_record.email) = lower(btrim(p_email))
  limit 1;
  if v_profile is null then raise exception 'that account must sign in to AkiPasa once before it can be added'; end if;
  select workspace.seat_limit,workspace.source_venue_id into strict v_limit,v_venue
  from public.crm_workspaces workspace where workspace.id = p_workspace for update;
  if v_venue is null then raise exception 'venue-backed workspace required'; end if;
  select count(*) into v_count
  from public.crm_workspace_members member
  where member.workspace_id = p_workspace and member.status = 'active';
  if v_count >= v_limit and not exists (
    select 1 from public.crm_workspace_members member
    where member.workspace_id = p_workspace and member.profile_id = v_profile
  ) then raise exception 'workspace seat limit reached'; end if;

  v_venue_role := case when p_role in ('admin','manager')
    then 'manager'::public.venue_member_role else 'editor'::public.venue_member_role end;
  insert into public.venue_members as venue_member (venue_id,profile_id,role)
  values (v_venue,v_profile,v_venue_role)
  on conflict (venue_id,profile_id) do update
  set role = case
    when venue_member.role = 'owner'::public.venue_member_role then venue_member.role
    else excluded.role
  end;

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
declare
  v_venue uuid;
begin
  if not public.crm_can_manage_workspace(p_workspace) then raise exception 'workspace manager required'; end if;
  if exists (
    select 1 from public.crm_workspace_members member
    where member.workspace_id = p_workspace and member.profile_id = p_profile and member.role = 'owner'
  ) then raise exception 'workspace owners cannot be removed'; end if;

  select workspace.source_venue_id into v_venue
  from public.crm_workspaces workspace where workspace.id = p_workspace;
  if v_venue is not null then
    delete from public.venue_members member
    where member.venue_id = v_venue and member.profile_id = p_profile;
  end if;
  delete from public.crm_workspace_members member
  where member.workspace_id = p_workspace and member.profile_id = p_profile;
end;
$$;

-- Reconcile any existing orphaned or missing rows before enforcing the new path.
delete from public.crm_workspace_members crm_member
using public.crm_workspaces workspace
where workspace.id = crm_member.workspace_id
  and workspace.source_venue_id is not null
  and not exists (
    select 1 from public.venue_members venue_member
    where venue_member.venue_id = workspace.source_venue_id
      and venue_member.profile_id = crm_member.profile_id
  );

insert into public.crm_workspace_members (workspace_id,profile_id,role,status)
select workspace.id,venue_member.profile_id,
  case venue_member.role
    when 'owner'::public.venue_member_role then 'owner'
    when 'manager'::public.venue_member_role then 'manager'
    else 'staff'
  end,
  'active'
from public.crm_workspaces workspace
join public.venue_members venue_member on venue_member.venue_id = workspace.source_venue_id
on conflict (workspace_id,profile_id) do update
set role = excluded.role,status = 'active',updated_at = now();

revoke all on function public.crm_sync_venue_workspace_membership() from public,anon,authenticated;
revoke all on function public.crm_add_workspace_member(text,text,text) from public,anon,authenticated;
revoke all on function public.crm_remove_workspace_member(text,uuid) from public,anon,authenticated;
grant execute on function public.crm_add_workspace_member(text,text,text) to authenticated;
grant execute on function public.crm_remove_workspace_member(text,uuid) to authenticated;

commit;

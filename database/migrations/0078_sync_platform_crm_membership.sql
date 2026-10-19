begin;

create or replace function public.crm_sync_platform_workspace_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.app_role in ('moderator','administrator') then
    insert into public.crm_workspace_members (workspace_id,profile_id,role,status)
    select 'ws_akipasa',new.id,
      case when new.app_role = 'administrator' then 'owner' else 'staff' end,
      'active'
    where exists (
      select 1 from public.crm_workspaces workspace where workspace.id = 'ws_akipasa'
    )
    on conflict (workspace_id,profile_id) do update set
      role = excluded.role,
      status = 'active';
  else
    delete from public.crm_workspace_members
    where workspace_id = 'ws_akipasa' and profile_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists crm_profiles_sync_platform_workspace_membership on public.profiles;
create trigger crm_profiles_sync_platform_workspace_membership
after insert or update of app_role on public.profiles
for each row execute function public.crm_sync_platform_workspace_membership();

insert into public.crm_workspace_members (workspace_id,profile_id,role,status)
select 'ws_akipasa',profile.id,
  case when profile.app_role = 'administrator' then 'owner' else 'staff' end,
  'active'
from public.profiles profile
where profile.app_role in ('moderator','administrator')
  and exists (
    select 1 from public.crm_workspaces workspace where workspace.id = 'ws_akipasa'
  )
on conflict (workspace_id,profile_id) do update set
  role = excluded.role,
  status = 'active';

delete from public.crm_workspace_members member
using public.profiles profile
where member.workspace_id = 'ws_akipasa'
  and member.profile_id = profile.id
  and profile.app_role not in ('moderator','administrator');

revoke all on function public.crm_sync_platform_workspace_membership() from public,anon,authenticated;

commit;

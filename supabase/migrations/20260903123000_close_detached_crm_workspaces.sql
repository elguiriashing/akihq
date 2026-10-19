begin;

create or replace function public.crm_close_detached_workspace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.source_venue_id is not null and new.source_venue_id is null then
    new.status := 'suspended';
    delete from public.crm_workspace_members member
    where member.workspace_id = old.id;
  end if;
  return new;
end;
$$;

drop trigger if exists crm_close_detached_workspace on public.crm_workspaces;
create trigger crm_close_detached_workspace
before update of source_venue_id on public.crm_workspaces
for each row execute function public.crm_close_detached_workspace();

-- Repair the detached Pipo Park workspace reported in this incident. Other
-- legacy detached workspaces are intentionally left untouched for manual review.
delete from public.crm_workspace_members member
using public.crm_workspaces workspace
where member.workspace_id = workspace.id
  and workspace.id = 'venue-08824b48-6b33-439a-b934-c0df6f4bbf37'
  and workspace.source_venue_id is null;

update public.crm_workspaces workspace
set status = 'suspended'
where workspace.id = 'venue-08824b48-6b33-439a-b934-c0df6f4bbf37'
  and workspace.source_venue_id is null
  and workspace.status <> 'suspended';

revoke all on function public.crm_close_detached_workspace() from public,anon,authenticated;

commit;

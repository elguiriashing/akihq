begin;

create or replace function public.crm_seed_workspace_chat_channel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.crm_team_channels (workspace_id, id, name, description)
  values (new.id, 'ch_general', 'general', 'General staff announcements')
  on conflict (workspace_id, id) do nothing;
  return new;
end;
$$;

revoke all on function public.crm_seed_workspace_chat_channel() from public, anon, authenticated;

drop trigger if exists crm_seed_workspace_chat_channel on public.crm_workspaces;
create trigger crm_seed_workspace_chat_channel
after insert on public.crm_workspaces
for each row execute function public.crm_seed_workspace_chat_channel();

commit;

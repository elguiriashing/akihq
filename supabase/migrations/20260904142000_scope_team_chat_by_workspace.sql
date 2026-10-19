begin;

create or replace function public.crm_is_workspace_chat_member(p_workspace text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.crm_workspace_members member
      join public.crm_workspaces workspace on workspace.id = member.workspace_id
      where member.workspace_id = p_workspace
        and member.profile_id = (select auth.uid())
        and member.status = 'active'
        and workspace.status in ('active', 'trial')
        and public.crm_has_tool(p_workspace, 'collaboration')
        and (
          workspace.id = 'ws_akipasa'
          or (
            workspace.source_venue_id is not null
            and public.has_active_entitlement(workspace.owner_profile_id, 'business_pro')
            and exists (
              select 1 from public.venue_members venue_member
              where venue_member.venue_id = workspace.source_venue_id
                and venue_member.profile_id = (select auth.uid())
            )
          )
        )
    );
$$;

create or replace function public.crm_can_manage_workspace_chat(p_workspace text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.crm_is_workspace_chat_member(p_workspace)
    and exists (
      select 1 from public.crm_workspace_members member
      where member.workspace_id = p_workspace
        and member.profile_id = (select auth.uid())
        and member.status = 'active'
        and member.role in ('owner', 'admin', 'manager')
    );
$$;

revoke all on function public.crm_is_workspace_chat_member(text) from public, anon;
revoke all on function public.crm_can_manage_workspace_chat(text) from public, anon;
grant execute on function public.crm_is_workspace_chat_member(text) to authenticated;
grant execute on function public.crm_can_manage_workspace_chat(text) to authenticated;

alter table public.crm_team_messages
  add column if not exists workspace_id text references public.crm_workspaces(id) on delete cascade;

update public.crm_team_messages set workspace_id = 'ws_akipasa' where workspace_id is null;
alter table public.crm_team_messages alter column workspace_id set not null;

create table if not exists public.crm_team_channels (
  workspace_id text not null references public.crm_workspaces(id) on delete cascade,
  id text not null,
  name text not null,
  description text not null default 'Custom team channel',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, id),
  unique (workspace_id, name)
);

alter table public.crm_team_channels enable row level security;

insert into public.crm_team_channels (workspace_id, id, name, description)
select workspace.id, 'ch_general', 'general', 'General staff announcements'
from public.crm_workspaces workspace
on conflict (workspace_id, id) do nothing;

insert into public.crm_team_channels (workspace_id, id, name, description)
values ('ws_akipasa', 'ch_crm_sales', 'crm-sales', 'Sales tracking and lead conversions')
on conflict (workspace_id, id) do nothing;

drop policy if exists "Platform members can read team messages" on public.crm_team_messages;
drop policy if exists "Platform members can insert team messages" on public.crm_team_messages;
drop policy if exists "Platform members can update team message reactions" on public.crm_team_messages;

create policy "Workspace members can read team messages"
on public.crm_team_messages for select to authenticated
using (public.crm_is_workspace_chat_member(workspace_id));

create policy "Workspace members can insert own team messages"
on public.crm_team_messages for insert to authenticated
with check (
  public.crm_is_workspace_chat_member(workspace_id)
  and author_id = (select auth.uid())
);

create policy "Workspace members can update team message reactions"
on public.crm_team_messages for update to authenticated
using (public.crm_is_workspace_chat_member(workspace_id))
with check (public.crm_is_workspace_chat_member(workspace_id));

create policy "Authors and managers can delete team messages"
on public.crm_team_messages for delete to authenticated
using (
  public.crm_is_workspace_chat_member(workspace_id)
  and (
    author_id = (select auth.uid())
    or public.crm_can_manage_workspace_chat(workspace_id)
  )
);

create policy "Workspace members can read team channels"
on public.crm_team_channels for select to authenticated
using (public.crm_is_workspace_chat_member(workspace_id));

create policy "Workspace managers can create team channels"
on public.crm_team_channels for insert to authenticated
with check (
  public.crm_can_manage_workspace_chat(workspace_id)
  and created_by = (select auth.uid())
);

create policy "Workspace managers can delete team channels"
on public.crm_team_channels for delete to authenticated
using (public.crm_can_manage_workspace_chat(workspace_id));

revoke all on public.crm_team_messages from anon, authenticated;
grant select, insert, delete on public.crm_team_messages to authenticated;
grant update (reactions) on public.crm_team_messages to authenticated;

revoke all on public.crm_team_channels from anon, authenticated;
grant select, insert, delete on public.crm_team_channels to authenticated;

drop index if exists public.crm_team_messages_channel_created_idx;
create index crm_team_messages_workspace_channel_created_idx
  on public.crm_team_messages (workspace_id, channel_id, created_at asc);

commit;

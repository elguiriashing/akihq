begin;

-- Remove permissive policies and broad default grants left by the original
-- single-workspace AkiHQ schema. RLS does not protect TRUNCATE, so table-level
-- ALL grants must not survive on tenant data.
drop policy if exists "Authenticated users can read workspace snapshots" on public.workspace_snapshots;
drop policy if exists "Authenticated users can insert workspace snapshots" on public.workspace_snapshots;
drop policy if exists "Authenticated users can update workspace snapshots" on public.workspace_snapshots;

revoke all on public.workspace_snapshots from anon, authenticated;
grant select, insert, update on public.workspace_snapshots to authenticated;

revoke all on public.crm_workspace_records from anon, authenticated;
grant select, insert, update, delete on public.crm_workspace_records to authenticated;

revoke all on public.crm_catalogue_venues from anon, authenticated;
grant select on public.crm_catalogue_venues to authenticated;

-- Team chat is currently an AkiPasa HQ capability. Restrict its legacy table
-- to authenticated members of the platform workspace and expose only the
-- columns each operation needs. Reaction updates cannot rewrite message text.
drop policy if exists "Authenticated users can read team messages" on public.crm_team_messages;
drop policy if exists "Authenticated users can insert team messages" on public.crm_team_messages;
drop policy if exists "Platform members can read team messages" on public.crm_team_messages;
drop policy if exists "Platform members can insert team messages" on public.crm_team_messages;
drop policy if exists "Platform members can update team message reactions" on public.crm_team_messages;

create policy "Platform members can read team messages"
on public.crm_team_messages for select to authenticated
using (public.crm_has_tool('ws_akipasa','collaboration'));

create policy "Platform members can insert team messages"
on public.crm_team_messages for insert to authenticated
with check (
  public.crm_has_tool('ws_akipasa','collaboration')
  and author_id = (select auth.uid())
);

create policy "Platform members can update team message reactions"
on public.crm_team_messages for update to authenticated
using (public.crm_has_tool('ws_akipasa','collaboration'))
with check (public.crm_has_tool('ws_akipasa','collaboration'));

revoke all on public.crm_team_messages from anon, authenticated;
grant select on public.crm_team_messages to authenticated;
grant insert (id,channel_id,author_id,author_name,role,text,reactions,created_at)
  on public.crm_team_messages to authenticated;
grant update (reactions) on public.crm_team_messages to authenticated;

commit;

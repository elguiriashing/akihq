-- Recorded from applied migration 20261003213755; do not reapply to the linked project.
create table if not exists public.pals_preview_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '90 days'),
  created_at timestamptz not null default now()
);
create table if not exists public.pals_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  version integer not null default 0 check (version >= 0),
  updated_at timestamptz not null default now(),
  constraint pals_state_size check (octet_length(state::text) <= 131072),
  constraint pals_state_object check (jsonb_typeof(state) = 'object')
);
create table if not exists public.pals_commands (
  user_id uuid not null references auth.users(id) on delete cascade,
  command_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, command_id)
);
alter table public.pals_preview_access enable row level security;
alter table public.pals_states enable row level security;
alter table public.pals_commands enable row level security;
revoke all on public.pals_preview_access, public.pals_states, public.pals_commands from anon, authenticated;
grant select on public.pals_preview_access, public.pals_states to authenticated;
grant select, insert, update, delete on public.pals_preview_access, public.pals_states, public.pals_commands to service_role;
create policy pals_access_own_read on public.pals_preview_access for select to authenticated using ((select auth.uid()) = user_id);
create policy pals_state_own_read on public.pals_states for select to authenticated using ((select auth.uid()) = user_id);
create or replace function public.pals_commit(p_user_id uuid, p_command_id uuid, p_expected_version integer, p_state jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare current_row public.pals_states%rowtype;
begin
  select * into current_row from public.pals_states where user_id = p_user_id for update;
  if not found then raise exception 'PALS_STATE_MISSING'; end if;
  if exists (select 1 from public.pals_commands where user_id = p_user_id and command_id = p_command_id) then
    return jsonb_build_object('state', current_row.state, 'version', current_row.version, 'duplicate', true);
  end if;
  if current_row.version <> p_expected_version then return null; end if;
  update public.pals_states set state = p_state, version = version + 1, updated_at = now() where user_id = p_user_id;
  insert into public.pals_commands(user_id, command_id) values(p_user_id, p_command_id);
  return jsonb_build_object('state', p_state, 'version', current_row.version + 1, 'duplicate', false);
end;
$$;
revoke all on function public.pals_commit(uuid, uuid, integer, jsonb) from public, anon, authenticated;
grant execute on function public.pals_commit(uuid, uuid, integer, jsonb) to service_role;
comment on table public.pals_states is 'Restricted AkiPals preview. Only trusted server actions may mutate game state. Own-account reads only; no location data.';
comment on table public.pals_commands is 'Idempotency ledger for atomic AkiPals state mutations. Not exposed to clients.';

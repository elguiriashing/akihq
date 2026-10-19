-- Migration 0032: Shared Workspace Snapshots & Profile Privileges
begin;

-- 0. Ensure updated_at trigger function exists
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 1. Shared workspace snapshots table
create table if not exists public.workspace_snapshots (
  workspace_id text primary key,
  updated_by uuid references auth.users(id) on delete set null,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now()
);

comment on table public.workspace_snapshots is
  'Shared AkiHQ workspace snapshot accessible by all authenticated workspace staff.';

alter table public.workspace_snapshots enable row level security;

drop policy if exists "Users can read their own AkiHQ snapshot" on public.workspace_snapshots;
drop policy if exists "Users can create their own AkiHQ snapshot" on public.workspace_snapshots;
drop policy if exists "Users can update their own AkiHQ snapshot" on public.workspace_snapshots;
drop policy if exists "Users can delete their own AkiHQ snapshot" on public.workspace_snapshots;
drop policy if exists "Authenticated users can read workspace snapshots" on public.workspace_snapshots;
drop policy if exists "Authenticated users can insert workspace snapshots" on public.workspace_snapshots;
drop policy if exists "Authenticated users can update workspace snapshots" on public.workspace_snapshots;
drop policy if exists "Staff can read workspace snapshots" on public.workspace_snapshots;
drop policy if exists "Staff can insert workspace snapshots" on public.workspace_snapshots;
drop policy if exists "Staff can update workspace snapshots" on public.workspace_snapshots;

create policy "Staff can read workspace snapshots"
on public.workspace_snapshots for select
to authenticated
using (has_platform_role(array['moderator','administrator']::app_role[]));

create policy "Staff can insert workspace snapshots"
on public.workspace_snapshots for insert
to authenticated
with check (has_platform_role(array['moderator','administrator']::app_role[]));

create policy "Staff can update workspace snapshots"
on public.workspace_snapshots for update
to authenticated
using (has_platform_role(array['moderator','administrator']::app_role[]))
with check (has_platform_role(array['moderator','administrator']::app_role[]));

grant select, insert, update on public.workspace_snapshots to authenticated;

create index if not exists workspace_snapshots_updated_at_idx
  on public.workspace_snapshots (updated_at desc);

drop trigger if exists workspace_snapshots_set_updated_at on public.workspace_snapshots;
create trigger workspace_snapshots_set_updated_at
before update on public.workspace_snapshots
for each row execute function public.set_updated_at();

-- Enable Supabase Realtime Postgres replication on workspace_snapshots table
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.workspace_snapshots;
  end if;
exception when others then
  null;
end $$;

-- 2. Profile presence update privileges. The existing profiles_update_self RLS
-- policy permits self-updates while preventing app_role escalation.
grant select, update on public.profiles to authenticated;

commit;

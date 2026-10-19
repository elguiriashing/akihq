-- Migration 0050: durable record-level storage for AkiHQ calendar and knowledge
begin;

create table if not exists public.crm_workspace_records (
  workspace_id text not null,
  record_type text not null check (record_type in ('event', 'article')),
  record_id text not null,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, record_type, record_id)
);

comment on table public.crm_workspace_records is
  'Record-level AkiHQ persistence for data that must not be overwritten by whole-workspace snapshot races.';

alter table public.crm_workspace_records enable row level security;
alter table public.crm_workspace_records replica identity full;

drop policy if exists "Staff can read CRM workspace records" on public.crm_workspace_records;
drop policy if exists "Staff can insert CRM workspace records" on public.crm_workspace_records;
drop policy if exists "Staff can update CRM workspace records" on public.crm_workspace_records;
drop policy if exists "Staff can delete CRM workspace records" on public.crm_workspace_records;

create policy "Staff can read CRM workspace records"
on public.crm_workspace_records for select
to authenticated
using (has_platform_role(array['moderator','administrator']::app_role[]));

create policy "Staff can insert CRM workspace records"
on public.crm_workspace_records for insert
to authenticated
with check (
  has_platform_role(array['moderator','administrator']::app_role[])
  and updated_by = (select auth.uid())
);

create policy "Staff can update CRM workspace records"
on public.crm_workspace_records for update
to authenticated
using (has_platform_role(array['moderator','administrator']::app_role[]))
with check (
  has_platform_role(array['moderator','administrator']::app_role[])
  and updated_by = (select auth.uid())
);

create policy "Staff can delete CRM workspace records"
on public.crm_workspace_records for delete
to authenticated
using (has_platform_role(array['moderator','administrator']::app_role[]));

revoke all on public.crm_workspace_records from public, anon;
grant select, insert, update, delete on public.crm_workspace_records to authenticated;
grant all on public.crm_workspace_records to service_role;

create index if not exists crm_workspace_records_updated_at_idx
  on public.crm_workspace_records (workspace_id, record_type, updated_at desc);

drop trigger if exists crm_workspace_records_set_updated_at on public.crm_workspace_records;
create trigger crm_workspace_records_set_updated_at
before update on public.crm_workspace_records
for each row execute function public.set_updated_at();

-- Preserve all currently stored calendar events and knowledge articles.
insert into public.crm_workspace_records (workspace_id, record_type, record_id, data, updated_by)
select snapshot.workspace_id, 'event', item.value->>'id', item.value, snapshot.updated_by
from public.workspace_snapshots snapshot
cross join lateral jsonb_array_elements(coalesce(snapshot.data->'events', '[]'::jsonb)) item(value)
where coalesce(item.value->>'id', '') <> ''
on conflict (workspace_id, record_type, record_id) do update
set data = excluded.data,
    updated_by = excluded.updated_by,
    updated_at = now();

insert into public.crm_workspace_records (workspace_id, record_type, record_id, data, updated_by)
select snapshot.workspace_id, 'article', item.value->>'id', item.value, snapshot.updated_by
from public.workspace_snapshots snapshot
cross join lateral jsonb_array_elements(coalesce(snapshot.data->'knowledge', '[]'::jsonb)) item(value)
where coalesce(item.value->>'id', '') <> ''
on conflict (workspace_id, record_type, record_id) do update
set data = excluded.data,
    updated_by = excluded.updated_by,
    updated_at = now();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'crm_workspace_records'
     ) then
    alter publication supabase_realtime add table public.crm_workspace_records;
  end if;
end $$;

commit;

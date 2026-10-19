-- Reusable resource pools for appointments, tours, courts, tables, equipment, rooms.
-- Nullable slot assignment leaves all legacy availability and requests untouched.
create extension if not exists btree_gist;

create table if not exists public.booking_resources (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 100),
  kind text not null check (kind in ('table','staff','vehicle','equipment','court','room','other')),
  capacity integer not null check (capacity between 1 and 10000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id,venue_id)
);
create index if not exists booking_resources_venue_idx
  on public.booking_resources(venue_id,active);

alter table public.booking_resources enable row level security;
revoke all on public.booking_resources from anon,authenticated;
grant select,insert,update,delete on public.booking_resources to authenticated;
create policy booking_resources_manage on public.booking_resources
  for all to authenticated
  using (public.is_venue_member(venue_id,array['owner','manager']::public.venue_member_role[]))
  with check (public.is_venue_member(venue_id,array['owner','manager']::public.venue_member_role[]));

alter table public.venue_availability_slots
  add column if not exists resource_id uuid;
alter table public.venue_availability_slots
  add constraint booking_slots_resource_same_venue
  foreign key (resource_id,venue_id) references public.booking_resources(id,venue_id);

-- A specific resource cannot be promised in overlapping availability windows.
-- Legacy slots without resource_id are unaffected.
alter table public.venue_availability_slots
  add constraint booking_resource_nonoverlap
  exclude using gist (resource_id with =, tstzrange(starts_at,ends_at,'[)') with &&)
  where (active and resource_id is not null);

create or replace function public.validate_booking_slot_resource()
returns trigger language plpgsql security invoker set search_path=public as $$
declare v_capacity integer;
begin
  if new.resource_id is null then return new; end if;
  select capacity into v_capacity
  from public.booking_resources
  where id=new.resource_id and venue_id=new.venue_id and active
  for share;
  if v_capacity is null or new.capacity>v_capacity then
    raise exception 'resource unavailable or slot capacity exceeds resource capacity';
  end if;
  return new;
end;
$$;
create trigger booking_slot_resource_validation
before insert or update of resource_id,venue_id,capacity on public.venue_availability_slots
for each row execute function public.validate_booking_slot_resource();

comment on table public.booking_resources is 'Venue-owned bookable resource pools; booking slot is canonical inventory promise.';

-- Optional offerings turn one venue booking calendar into several distinct services.
-- Legacy slots and requests retain NULL offering_id and work unchanged.
create table public.booking_offerings (
 id uuid primary key default gen_random_uuid(),
 venue_id uuid not null references public.venues(id) on delete cascade,
 name text not null check (char_length(btrim(name)) between 2 and 120),
 kind text not null check (kind in ('dining','experience','resource','appointment','ticket','class','stay')),
 duration_minutes integer not null check (duration_minutes between 15 and 1440),
 capacity integer not null check (capacity between 1 and 10000),
 active boolean not null default true,
 created_at timestamptz not null default now(),
 unique(id,venue_id)
);
create index booking_offerings_venue_idx on public.booking_offerings(venue_id,active);
alter table public.booking_offerings enable row level security;
revoke all on public.booking_offerings from anon,authenticated;
grant select on public.booking_offerings to anon,authenticated;
grant insert,update,delete on public.booking_offerings to authenticated;
create policy booking_offerings_public_read on public.booking_offerings
 for select to anon,authenticated using (
  (active and exists(select 1 from public.venue_booking_settings s
     where s.venue_id=booking_offerings.venue_id and s.active and s.mode='request'))
  or public.is_venue_member(venue_id,array['owner','manager']::public.venue_member_role[])
 );
create policy booking_offerings_manage on public.booking_offerings
 for all to authenticated
 using (public.is_venue_member(venue_id,array['owner','manager']::public.venue_member_role[]))
 with check (public.is_venue_member(venue_id,array['owner','manager']::public.venue_member_role[]));

alter table public.venue_availability_slots add column offering_id uuid;
alter table public.venue_availability_slots
 add constraint booking_slot_offering_venue_fk foreign key (offering_id,venue_id)
 references public.booking_offerings(id,venue_id);

create or replace function public.validate_booking_slot_offering()
returns trigger language plpgsql security invoker set search_path=public as $$
declare v_capacity integer; v_duration integer;
begin
 if new.offering_id is null then return new; end if;
 select capacity,duration_minutes into v_capacity,v_duration
 from public.booking_offerings
 where id=new.offering_id and venue_id=new.venue_id and active
 for share;
 if v_capacity is null or new.capacity > v_capacity then
  raise exception 'offering unavailable or slot capacity exceeds offering capacity';
 end if;
 if new.ends_at <= new.starts_at then
  raise exception 'invalid offering booking window';
 end if;
 return new;
end;
$$;
create trigger booking_slot_offering_validation
before insert or update of offering_id,venue_id,capacity on public.venue_availability_slots
for each row execute function public.validate_booking_slot_offering();

comment on table public.booking_offerings is 'Separate bookable services with per-offering capacities; not a payment or ticket entitlement.';

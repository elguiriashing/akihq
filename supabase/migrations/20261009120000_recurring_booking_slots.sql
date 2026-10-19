-- Recurring booking availability, atomically generated in Europe/Madrid civil time.
-- Existing single slots and requests remain unchanged.
create or replace function public.create_recurring_booking_slots(
  p_venue uuid,
  p_start_date date,
  p_end_date date,
  p_weekdays integer[],
  p_start_time time without time zone,
  p_duration_minutes integer,
  p_capacity integer,
  p_resource uuid default null,
  p_offering uuid default null
) returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_venue_member(p_venue, array['owner','manager']::public.venue_member_role[]) then
    raise exception 'not authorized';
  end if;
  if not exists (
    select 1 from public.venue_booking_settings
    where venue_id = p_venue and mode = 'request' and active
  ) then
    raise exception 'enable native bookings first';
  end if;
  if p_start_date is null or p_end_date is null
     or p_start_date < (now() at time zone 'Europe/Madrid')::date
     or p_end_date < p_start_date or p_end_date > p_start_date + 90 then
    raise exception 'invalid booking schedule window';
  end if;
  if p_weekdays is null or cardinality(p_weekdays) = 0
    or exists (select 1 from unnest(p_weekdays) as w(day) where day not between 1 and 7)
    or p_start_time is null or p_duration_minutes not between 15 and 1440
    or p_capacity not between 1 and 10000 then
    raise exception 'invalid schedule parameters';
  end if;

  -- Serialize schedule writers per venue to avoid duplicate rows on retries.
  perform pg_advisory_xact_lock(hashtextextended(p_venue::text, 0));

  -- Reject DST-normalized/nonexistent local times rather than silently shifting them.
  if exists (
    select 1
    from generate_series(0,p_end_date-p_start_date) g(day_offset)
    where extract(isodow from (p_start_date + g.day_offset))::int = any(p_weekdays)
      and (((p_start_date + g.day_offset + p_start_time) at time zone 'Europe/Madrid')
           at time zone 'Europe/Madrid')::timestamp
          <> (p_start_date + g.day_offset + p_start_time)
  ) then
    raise exception 'schedule contains nonexistent local time';
  end if;

  -- Atomic insert. Duplicate identical slot times are skipped for safe retry.
  insert into public.venue_availability_slots
      (venue_id,starts_at,ends_at,capacity,resource_id,offering_id)
  select p_venue, at_start, at_start + make_interval(mins => p_duration_minutes),p_capacity,p_resource,p_offering
  from (
    select ((p_start_date + g.day_offset + p_start_time) at time zone 'Europe/Madrid') at_start
    from generate_series(0,p_end_date-p_start_date) g(day_offset)
    where extract(isodow from (p_start_date + g.day_offset))::int = any(p_weekdays)
  ) proposed
  where not exists (
    select 1 from public.venue_availability_slots existing
    where existing.venue_id = p_venue and existing.starts_at = proposed.at_start
      and existing.resource_id is not distinct from p_resource
      and existing.offering_id is not distinct from p_offering
  );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.create_recurring_booking_slots(uuid,date,date,integer[],time,integer,integer,uuid,uuid) from public,anon;
grant execute on function public.create_recurring_booking_slots(uuid,date,date,integer[],time,integer,integer,uuid,uuid) to authenticated;

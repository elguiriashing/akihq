begin;

create or replace function set_owned_event_recurrence(
  p_event uuid,
  p_starts timestamptz,
  p_ends timestamptz,
  p_frequency text,
  p_interval integer,
  p_occurrences integer
)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_step interval;
  v_inserted integer;
begin
  if not exists (
    select 1
    from events e
    where e.id=p_event and is_venue_member(e.venue_id)
  ) then
    raise exception 'venue membership required';
  end if;
  if p_ends <= p_starts then raise exception 'invalid occurrence time'; end if;
  if p_frequency not in ('daily','weekly') then raise exception 'invalid frequency'; end if;
  if p_interval not between 1 and 12 then raise exception 'invalid interval'; end if;
  if p_occurrences not between 2 and 52 then raise exception 'invalid occurrence count'; end if;

  v_step := case
    when p_frequency='daily' then make_interval(days => p_interval)
    else make_interval(days => 7 * p_interval)
  end;

  insert into recurrence_rules(event_id,rrule,timezone,generation_horizon_days)
  values (
    p_event,
    'FREQ=' || upper(p_frequency) || ';INTERVAL=' || p_interval || ';COUNT=' || p_occurrences,
    'Europe/Madrid',
    least(366, greatest(1, ceil(extract(epoch from (v_step * p_occurrences)) / 86400)::integer))
  )
  on conflict(event_id) do update set
    rrule=excluded.rrule,
    timezone=excluded.timezone,
    generation_horizon_days=excluded.generation_horizon_days;

  insert into event_occurrences(id,event_id,starts_at,ends_at,status)
  select
    gen_random_uuid(),
    p_event,
    p_starts + (series.n * v_step),
    p_ends + (series.n * v_step),
    'scheduled'
  from generate_series(0,p_occurrences - 1) as series(n)
  where not exists (
    select 1
    from event_occurrences existing
    where existing.event_id=p_event
      and existing.starts_at=p_starts + (series.n * v_step)
  );

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke all on function set_owned_event_recurrence(uuid,timestamptz,timestamptz,text,integer,integer) from public;
grant execute on function set_owned_event_recurrence(uuid,timestamptz,timestamptz,text,integer,integer) to authenticated;

commit;

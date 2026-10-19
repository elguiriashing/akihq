begin;

create or replace function expire_finished_events(
  reference_time timestamptz default now()
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  if auth.role() <> 'service_role'
    and not has_platform_role(array['moderator','administrator']::app_role[]) then
    raise exception 'operator role required';
  end if;
  update events e
  set status = 'archived', updated_at = now()
  where e.status = 'published'
    and not exists (
      select 1
      from event_occurrences o
      where o.event_id = e.id
        and o.ends_at >= expire_finished_events.reference_time
        and o.status in ('scheduled','postponed')
    );
  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function expire_finished_events_scheduled()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update events e
  set status = 'archived', updated_at = now()
  where e.status = 'published'
    and not exists (
      select 1
      from event_occurrences o
      where o.event_id = e.id
        and o.ends_at >= now()
        and o.status in ('scheduled','postponed')
    );
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function expire_finished_events_scheduled() from public;
revoke all on function expire_finished_events_scheduled() from anon;
revoke all on function expire_finished_events_scheduled() from authenticated;

commit;

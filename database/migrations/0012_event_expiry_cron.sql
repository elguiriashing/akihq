begin;

create extension if not exists pg_cron;

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
  set status = 'expired', updated_at = now()
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

select cron.schedule(
  'akipasa-expire-finished-events',
  '17 * * * *',
  'select public.expire_finished_events_scheduled()'
);

commit;

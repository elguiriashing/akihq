begin;

-- The limits are deliberately enforced below the application layer so a
-- caller cannot bypass them by inserting through the Supabase data API.
create index if not exists event_submissions_submitter_time_idx
  on event_submissions(submitter_id, created_at desc);
create index if not exists reports_reporter_time_idx
  on reports(reporter_id, created_at desc);

create or replace function enforce_community_submission_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or new.submitter_id <> auth.uid() then
    raise exception 'submission identity mismatch';
  end if;
  if (
    select count(*)
    from event_submissions
    where submitter_id = new.submitter_id
      and created_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception 'community submission rate limit exceeded';
  end if;
  if (
    select count(*)
    from event_submissions
    where submitter_id = new.submitter_id
      and created_at > now() - interval '24 hours'
  ) >= 20 then
    raise exception 'community submission daily limit exceeded';
  end if;
  return new;
end;
$$;

create or replace function enforce_report_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or new.reporter_id <> auth.uid() then
    raise exception 'report identity mismatch';
  end if;
  if (
    select count(*)
    from reports
    where reporter_id = new.reporter_id
      and created_at > now() - interval '1 hour'
  ) >= 10 then
    raise exception 'report rate limit exceeded';
  end if;
  if (
    select count(*)
    from reports
    where reporter_id = new.reporter_id
      and created_at > now() - interval '24 hours'
  ) >= 30 then
    raise exception 'report daily limit exceeded';
  end if;
  return new;
end;
$$;

drop trigger if exists event_submissions_rate_limit on event_submissions;
create trigger event_submissions_rate_limit
before insert on event_submissions
for each row execute function enforce_community_submission_rate_limit();

drop trigger if exists reports_rate_limit on reports;
create trigger reports_rate_limit
before insert on reports
for each row execute function enforce_report_rate_limit();

revoke all on function enforce_community_submission_rate_limit() from public;
revoke all on function enforce_report_rate_limit() from public;

commit;

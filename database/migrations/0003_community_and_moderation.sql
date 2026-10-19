begin;

create type moderation_state as enum ('pending','approved','rejected');
create type report_state as enum ('open','resolved','dismissed');
create type report_reason as enum ('cancelled','duplicate','incorrect','scam','other');

create table event_submissions (
  id uuid primary key default gen_random_uuid(),
  submitter_id uuid not null references profiles(id) on delete cascade,
  venue_name text not null check (char_length(venue_name) between 2 and 160),
  venue_address text not null check (char_length(venue_address) between 5 and 300),
  title text not null check (char_length(title) between 3 and 160),
  description text not null check (char_length(description) between 20 and 4000),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  source_url text check (source_url is null or source_url ~ '^https://'),
  state moderation_state not null default 'pending',
  duplicate_of uuid references events(id),
  reviewed_by uuid references profiles(id),
  review_reason text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles(id) on delete cascade,
  target_type text not null check (target_type in ('event','venue')),
  target_id uuid not null,
  reason report_reason not null,
  details text not null check (char_length(details) between 10 and 2000),
  state report_state not null default 'open',
  resolved_by uuid references profiles(id),
  resolution text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id, reason)
);

create table moderation_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references profiles(id),
  action text not null,
  target_type text not null,
  target_id uuid not null,
  reason text not null check (char_length(reason) between 3 and 2000),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index event_submissions_queue_idx on event_submissions(state, created_at);
create index reports_queue_idx on reports(state, created_at);
create index moderation_actions_target_idx on moderation_actions(target_type, target_id, created_at desc);
create index event_occurrences_expiry_idx on event_occurrences(ends_at, status);

create or replace function submit_community_event(
  venue_name text, venue_address text, event_title text, event_description text,
  starts_at timestamptz, ends_at timestamptz, source_url text
) returns uuid language plpgsql security definer set search_path = public
as $$
declare new_id uuid := gen_random_uuid();
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if ends_at <= starts_at then raise exception 'invalid occurrence time'; end if;
  insert into event_submissions(id,submitter_id,venue_name,venue_address,title,description,starts_at,ends_at,source_url)
  values(new_id,auth.uid(),trim(venue_name),trim(venue_address),trim(event_title),trim(event_description),starts_at,ends_at,nullif(trim(source_url),''));
  return new_id;
end;
$$;

create or replace function submit_report(target_type text, target_id uuid, reason report_reason, details text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare new_id uuid := gen_random_uuid(); target_exists boolean;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if target_type = 'event' then select exists(select 1 from events where id=target_id) into target_exists;
  elsif target_type = 'venue' then select exists(select 1 from venues where id=target_id) into target_exists;
  else raise exception 'invalid target type'; end if;
  if not target_exists then raise exception 'target not found'; end if;
  insert into reports(id,reporter_id,target_type,target_id,reason,details)
  values(new_id,auth.uid(),target_type,target_id,reason,trim(details));
  return new_id;
end;
$$;

create or replace function moderate_item(target_type text, target_id uuid, decision text, reason text, p_duplicate_of uuid default null)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not has_platform_role(array['moderator','administrator']::app_role[]) then raise exception 'moderator role required'; end if;
  if char_length(trim(reason)) < 3 then raise exception 'reason required'; end if;
  if target_type = 'submission' then
    if decision not in ('approved','rejected') then raise exception 'invalid decision'; end if;
    update event_submissions set state=decision::moderation_state, duplicate_of=p_duplicate_of,
      reviewed_by=auth.uid(), review_reason=trim(reason), reviewed_at=now()
    where id=target_id and state='pending';
  elsif target_type = 'event' then
    if decision not in ('published','rejected') then raise exception 'invalid decision'; end if;
    update events set status=decision::content_status, updated_at=now() where id=target_id and status='pending';
  elsif target_type = 'venue_claim' then
    if decision not in ('approved','rejected') then raise exception 'invalid decision'; end if;
    update venue_claims set status=decision::claim_status, decided_by=auth.uid(), decision_reason=trim(reason), decided_at=now()
      where id=target_id and status='pending';
    if decision='approved' then
      insert into venue_members(venue_id,profile_id,role)
      select venue_id,claimant_id,'owner'::venue_member_role from venue_claims where id=target_id
      on conflict (venue_id,profile_id) do update set role='owner';
      update venues set verified=true,status='published' where id=(select venue_id from venue_claims where id=target_id);
    end if;
  else raise exception 'invalid target type'; end if;
  if not found then raise exception 'item not pending or not found'; end if;
  insert into moderation_actions(actor_id,action,target_type,target_id,reason,metadata)
  values(auth.uid(),decision,target_type,target_id,trim(reason),jsonb_build_object('duplicate_of',p_duplicate_of));
end;
$$;

create or replace function resolve_report(report_id uuid, decision report_state, resolution text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not has_platform_role(array['moderator','administrator']::app_role[]) then raise exception 'moderator role required'; end if;
  if decision not in ('resolved','dismissed') or char_length(trim(resolution)) < 3 then raise exception 'invalid resolution'; end if;
  update reports set state=decision,resolved_by=auth.uid(),resolution=trim(resolution),resolved_at=now()
    where id=report_id and state='open';
  if not found then raise exception 'report not open or not found'; end if;
  insert into moderation_actions(actor_id,action,target_type,target_id,reason)
  values(auth.uid(),decision::text,'report',report_id,trim(resolution));
end;
$$;

create or replace function expire_finished_events(reference_time timestamptz default now())
returns integer language plpgsql security definer set search_path = public
as $$
declare affected integer;
begin
  if auth.role() <> 'service_role' and not has_platform_role(array['moderator','administrator']::app_role[]) then raise exception 'operator role required'; end if;
  update events e set status='expired',updated_at=now()
  where e.status='published' and not exists(select 1 from event_occurrences o where o.event_id=e.id and o.ends_at >= reference_time and o.status in ('scheduled','postponed'));
  get diagnostics affected = row_count;
  return affected;
end;
$$;

alter table event_submissions enable row level security;
alter table reports enable row level security;
alter table moderation_actions enable row level security;

create policy submissions_create on event_submissions for insert to authenticated with check (submitter_id=auth.uid());
create policy submissions_read on event_submissions for select using (submitter_id=auth.uid() or has_platform_role(array['moderator','administrator']::app_role[]));
create policy reports_create on reports for insert to authenticated with check (reporter_id=auth.uid());
create policy reports_read on reports for select using (reporter_id=auth.uid() or has_platform_role(array['moderator','administrator']::app_role[]));
create policy moderation_actions_operator_read on moderation_actions for select using (has_platform_role(array['moderator','administrator']::app_role[]));

grant execute on function submit_community_event(text,text,text,text,timestamptz,timestamptz,text) to authenticated;
grant execute on function submit_report(text,uuid,report_reason,text) to authenticated;
grant execute on function moderate_item(text,uuid,text,text,uuid) to authenticated;
grant execute on function resolve_report(uuid,report_state,text) to authenticated;
grant execute on function expire_finished_events(timestamptz) to authenticated;
revoke execute on function submit_community_event(text,text,text,text,timestamptz,timestamptz,text) from anon;
revoke execute on function submit_report(text,uuid,report_reason,text) from anon;
revoke execute on function moderate_item(text,uuid,text,text,uuid) from anon;
revoke execute on function resolve_report(uuid,report_state,text) from anon;
revoke execute on function expire_finished_events(timestamptz) from anon;

commit;

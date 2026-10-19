begin;

create type promotion_state as enum ('new','contacted','qualified','won','lost');
create type analytics_action as enum ('event_view','venue_view','directions_click','booking_click','share','event_saved','venue_followed','check_in_accepted','check_in_rejected','promotion_requested');

create table promotion_requests (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references venues(id) on delete cascade,
  event_id uuid references events(id) on delete set null,
  requester_id uuid not null references profiles(id),
  service text not null check(service in ('featured_listing','social_campaign','content_package','other')),
  message text not null check(char_length(message) between 20 and 2000),
  state promotion_state not null default 'new',
  operator_notes text,
  updated_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table analytics_events (
  id bigint generated always as identity primary key,
  action analytics_action not null,
  venue_id uuid references venues(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  profile_id uuid references profiles(id) on delete set null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  check(jsonb_typeof(metadata) = 'object')
);
create index analytics_venue_time_idx on analytics_events(venue_id,occurred_at,action);

create table feature_slots (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  label_es text not null default 'Patrocinado',
  label_en text not null default 'Sponsored',
  starts_at timestamptz not null,
  ends_at timestamptz not null check(ends_at > starts_at),
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

alter table promotion_requests enable row level security;
alter table analytics_events enable row level security;
alter table feature_slots enable row level security;
create policy promotion_requests_create on promotion_requests for insert with check(requester_id=auth.uid() and is_venue_member(venue_id));
create policy promotion_requests_read on promotion_requests for select using(is_venue_member(venue_id) or has_platform_role(array['moderator','administrator']::app_role[]));
create policy promotion_requests_operator_update on promotion_requests for update using(has_platform_role(array['moderator','administrator']::app_role[])) with check(has_platform_role(array['moderator','administrator']::app_role[]));
create policy analytics_operator_read on analytics_events for select using((venue_id is not null and is_venue_member(venue_id)) or has_platform_role(array['administrator']::app_role[]));
create policy feature_slots_public_read on feature_slots for select using(now() between starts_at and ends_at or has_platform_role(array['administrator']::app_role[]));
create policy feature_slots_admin_manage on feature_slots for all using(has_platform_role(array['administrator']::app_role[])) with check(has_platform_role(array['administrator']::app_role[]));

create or replace function record_analytics(p_action analytics_action,p_venue uuid default null,p_event uuid default null,p_metadata jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path=public
as $$
declare v_key_count integer;
begin
  if p_metadata ?| array['latitude','longitude','email','phone','name','ip'] then raise exception 'personal metadata not allowed'; end if;
  select count(*) into v_key_count from jsonb_object_keys(p_metadata);
  if v_key_count > 8 then raise exception 'too many metadata properties'; end if;
  insert into analytics_events(action,venue_id,event_id,profile_id,metadata) values(p_action,p_venue,p_event,auth.uid(),p_metadata);
end;
$$;

create or replace function venue_analytics(p_venue uuid,p_since timestamptz default now()-interval '30 days')
returns table(action analytics_action,total bigint) language plpgsql security definer set search_path=public
as $$
begin
  if not is_venue_member(p_venue) then raise exception 'venue membership required'; end if;
  return query select a.action,count(*) from analytics_events a where a.venue_id=p_venue and a.occurred_at>=p_since group by a.action order by a.action;
end;
$$;

grant execute on function record_analytics(analytics_action,uuid,uuid,jsonb) to anon,authenticated;
grant execute on function venue_analytics(uuid,timestamptz) to authenticated;

commit;

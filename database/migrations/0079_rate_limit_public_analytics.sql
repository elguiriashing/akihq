begin;

create table if not exists public.analytics_ingestion_limits (
  source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  window_start timestamptz not null,
  event_count integer not null default 0 check (event_count >= 0),
  primary key (source_hash, window_start)
);

alter table public.analytics_ingestion_limits enable row level security;
revoke all on public.analytics_ingestion_limits from public, anon, authenticated;
grant all on public.analytics_ingestion_limits to service_role;

create or replace function public.record_analytics_limited(
  p_action analytics_action,
  p_venue uuid default null,
  p_event uuid default null,
  p_metadata jsonb default '{}'::jsonb,
  p_profile uuid default null,
  p_session uuid default null,
  p_source_hash text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz := date_trunc('hour', now());
  v_count integer;
  v_key_count integer;
begin
  if p_session is null then raise exception 'analytics session required'; end if;
  if p_source_hash is null or p_source_hash !~ '^[0-9a-f]{64}$' then raise exception 'analytics source required'; end if;
  if p_profile is not null and not exists (select 1 from profiles where id = p_profile) then
    raise exception 'invalid analytics profile';
  end if;
  if p_metadata ?| array['latitude','longitude','email','phone','name','ip'] then
    raise exception 'personal metadata not allowed';
  end if;
  select count(*) into v_key_count from jsonb_object_keys(p_metadata);
  if v_key_count > 8 then raise exception 'too many metadata properties'; end if;

  insert into analytics_ingestion_limits(source_hash, window_start, event_count)
  values (p_source_hash, v_window, 1)
  on conflict (source_hash, window_start) do update
    set event_count = analytics_ingestion_limits.event_count + 1
  returning event_count into v_count;
  if v_count > 120 then raise exception 'analytics rate limit exceeded'; end if;

  insert into analytics_events(action,venue_id,event_id,profile_id,metadata)
  values(p_action,p_venue,p_event,p_profile,p_metadata);
end;
$$;

revoke all on function public.record_analytics(analytics_action,uuid,uuid,jsonb) from public, anon;
grant execute on function public.record_analytics(analytics_action,uuid,uuid,jsonb) to authenticated;
revoke all on function public.record_analytics_limited(analytics_action,uuid,uuid,jsonb,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.record_analytics_limited(analytics_action,uuid,uuid,jsonb,uuid,uuid,text) to service_role;

commit;

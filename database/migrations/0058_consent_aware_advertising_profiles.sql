-- Migration 0058: consent-aware advertising profile coverage and aggregate CRM analytics
begin;

create table if not exists public.advertising_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  collection_status text not null default 'awaiting_consent'
    check (collection_status in ('awaiting_consent', 'eligible', 'opted_out')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.advertising_profiles enable row level security;

drop policy if exists advertising_profiles_own_read on public.advertising_profiles;
create policy advertising_profiles_own_read
  on public.advertising_profiles for select to authenticated
  using ((select auth.uid()) = profile_id);

create or replace function public.seed_advertising_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.advertising_profiles(profile_id)
  values (new.id)
  on conflict (profile_id) do nothing;
  return new;
end;
$$;

drop trigger if exists profiles_seed_advertising_profile on public.profiles;
create trigger profiles_seed_advertising_profile
after insert on public.profiles
for each row execute function public.seed_advertising_profile();

insert into public.advertising_profiles(profile_id)
select id from public.profiles
on conflict (profile_id) do nothing;

create or replace function public.sync_advertising_profile_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.advertising_profiles(profile_id, collection_status, updated_at)
  values (
    new.profile_id,
    case when new.personalisation_enabled and new.marketing_enabled then 'eligible' else 'opted_out' end,
    now()
  )
  on conflict (profile_id) do update
  set collection_status = excluded.collection_status,
      updated_at = excluded.updated_at;
  return new;
end;
$$;

drop trigger if exists personalisation_sync_advertising_consent on public.personalisation_settings;
create trigger personalisation_sync_advertising_consent
after insert or update of personalisation_enabled, marketing_enabled on public.personalisation_settings
for each row execute function public.sync_advertising_profile_consent();

update public.advertising_profiles ap
set collection_status = case
      when ps.personalisation_enabled and ps.marketing_enabled then 'eligible'
      else 'opted_out'
    end,
    updated_at = now()
from public.personalisation_settings ps
where ps.profile_id = ap.profile_id;

create or replace function public.crm_advertising_profile_overview(
  p_since timestamptz default now() - interval '30 days'
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not public.has_platform_role(array['administrator']::public.app_role[]) then
    raise exception 'administrator role required';
  end if;
  if p_since < now() - interval '366 days' or p_since > now() then
    raise exception 'invalid metrics period';
  end if;

  with eligible as (
    select ap.profile_id
    from public.advertising_profiles ap
    join public.personalisation_settings ps on ps.profile_id = ap.profile_id
    where ap.collection_status = 'eligible'
      and ps.personalisation_enabled
      and ps.marketing_enabled
  ), signal_stats as (
    select pp.profile_id, count(s.preference_profile_id)::bigint as signal_count,
      max(s.last_signal_at) as last_signal_at,
      round(avg(s.confidence)::numeric, 3) as average_confidence
    from eligible e
    join public.preference_profiles pp on pp.profile_id = e.profile_id
    left join public.user_preference_signals s on s.preference_profile_id = pp.id
    group by pp.profile_id
  ), top_segments as (
    select s.dimension, s.key, count(distinct pp.profile_id)::bigint as profiles,
      round(avg(s.confidence)::numeric, 3) as confidence
    from eligible e
    join public.preference_profiles pp on pp.profile_id = e.profile_id
    join public.user_preference_signals s on s.preference_profile_id = pp.id
    where s.dimension in ('category', 'subcategory', 'venue', 'price', 'time', 'weekday', 'planning_horizon', 'search_intent')
      and s.confidence >= 0.20
      and greatest(s.short_term_score, s.long_term_score) > 0
    group by s.dimension, s.key
    order by profiles desc, confidence desc
    limit 12
  ), source_mix as (
    select b.event_type as source, count(*)::bigint as signals,
      count(distinct b.profile_id)::bigint as profiles
    from eligible e
    join public.behaviour_events b on b.profile_id = e.profile_id
    where b.received_at >= p_since
    group by b.event_type
    order by signals desc, source
    limit 10
  )
  select jsonb_build_object(
    'generated_at', now(),
    'coverage', jsonb_build_object(
      'registered_users', (select count(*) from public.profiles),
      'profile_shells', (select count(*) from public.advertising_profiles),
      'awaiting_consent', (select count(*) from public.advertising_profiles where collection_status = 'awaiting_consent'),
      'opted_out', (select count(*) from public.advertising_profiles where collection_status = 'opted_out'),
      'eligible', (select count(*) from eligible),
      'learning', (select count(*) from signal_stats where signal_count between 1 and 4),
      'ready', (select count(*) from signal_stats where signal_count >= 5),
      'fresh_30d', (select count(*) from signal_stats where last_signal_at >= now() - interval '30 days')
    ),
    'quality', jsonb_build_object(
      'total_signals', (select coalesce(sum(signal_count), 0) from signal_stats),
      'average_confidence', (select coalesce(round(avg(average_confidence)::numeric, 3), 0) from signal_stats where signal_count > 0),
      'profiles_with_signals', (select count(*) from signal_stats where signal_count > 0)
    ),
    'top_segments', coalesce((select jsonb_agg(to_jsonb(top_segments) order by profiles desc, confidence desc) from top_segments), '[]'::jsonb),
    'source_mix', coalesce((select jsonb_agg(to_jsonb(source_mix) order by signals desc, source) from source_mix), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.seed_advertising_profile() from public, anon, authenticated;
revoke all on function public.sync_advertising_profile_consent() from public, anon, authenticated;
revoke all on function public.crm_advertising_profile_overview(timestamptz) from public, anon, authenticated;
grant execute on function public.crm_advertising_profile_overview(timestamptz) to authenticated;
grant select on public.advertising_profiles to authenticated;

commit;

-- Migration 0049: privacy-safe CRM analytics over personalisation and catalogue data
begin;

create or replace function public.crm_analytics_overview(
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

  with
  behaviour as (
    select *
    from public.behaviour_events
    where received_at >= p_since
  ),
  recommendations as (
    select *
    from public.recommendation_requests
    where created_at >= p_since
  ),
  legacy_analytics as (
    select *
    from public.analytics_events
    where occurred_at >= p_since
  ),
  daily as (
    select
      day::date as day,
      (select count(*) from behaviour b where b.received_at >= day and b.received_at < day + interval '1 day') as interactions,
      (select count(*) from recommendations r where r.created_at >= day and r.created_at < day + interval '1 day') as recommendations,
      (select count(*) from legacy_analytics a where a.occurred_at >= day and a.occurred_at < day + interval '1 day') as analytics_events
    from generate_series(date_trunc('day', p_since), date_trunc('day', now()), interval '1 day') day
  ),
  event_breakdown as (
    select event_type as key, count(*)::bigint as total
    from behaviour
    group by event_type
    union all
    select action::text as key, count(*)::bigint as total
    from legacy_analytics
    group by action
  ),
  combined_breakdown as (
    select key, sum(total)::bigint as total
    from event_breakdown
    group by key
  ),
  surface_breakdown as (
    select surface as key, count(*)::bigint as total
    from behaviour
    group by surface
    union all
    select coalesce(nullif(metadata->>'surface', ''), 'legacy_analytics') as key, count(*)::bigint as total
    from legacy_analytics
    group by coalesce(nullif(metadata->>'surface', ''), 'legacy_analytics')
  ),
  combined_surfaces as (
    select key, sum(total)::bigint as total
    from surface_breakdown
    group by key
  ),
  entity_activity as (
    select entity_type, entity_id, count(*)::bigint as interactions
    from behaviour
    where entity_id is not null and entity_type in ('event', 'venue')
    group by entity_type, entity_id
  ),
  top_entities as (
    select
      ea.entity_type,
      ea.entity_id,
      case
        when ea.entity_type = 'event' then coalesce(e.title_en, e.title_es, 'Event')
        when ea.entity_type = 'venue' then coalesce(v.name, 'Venue')
        else initcap(ea.entity_type)
      end as label,
      ea.interactions
    from entity_activity ea
    left join public.events e on ea.entity_type = 'event' and e.id = ea.entity_id
    left join public.venues v on ea.entity_type = 'venue' and v.id = ea.entity_id
    order by ea.interactions desc, label
    limit 8
  ),
  preference_activity as (
    select dimension, key, count(*)::bigint as profiles,
      round(avg(greatest(short_term_score, long_term_score))::numeric, 3) as score,
      round(avg(confidence)::numeric, 3) as confidence
    from public.user_preference_signals
    group by dimension, key
    order by profiles desc, confidence desc, score desc
    limit 10
  )
  select jsonb_build_object(
    'since', p_since,
    'generated_at', now(),
    'summary', jsonb_build_object(
      'tracked_events', (select count(*) from behaviour) + (select count(*) from legacy_analytics),
      'behaviour_events', (select count(*) from behaviour),
      'analytics_events', (select count(*) from legacy_analytics),
      'known_visitors', (select count(distinct profile_id) from behaviour where profile_id is not null),
      'anonymous_visitors', (select count(distinct anonymous_id) from behaviour where profile_id is null),
      'recommendation_requests', (select count(*) from recommendations),
      'recommendation_items', (
        select count(*)
        from public.recommendation_items i
        join recommendations r on r.id = i.recommendation_request_id
      ),
      'average_latency_ms', (select coalesce(round(avg(latency_ms)), 0) from recommendations),
      'fallback_requests', (select count(*) from recommendations where fallback_used),
      'impressions', (select count(*) from behaviour where event_type in ('event_impression', 'venue_impression')),
      'opens', (select count(*) from behaviour where event_type in ('event_opened', 'venue_opened', 'recommendation_clicked')),
      'saves', (select count(*) from behaviour where event_type = 'event_saved'),
      'going', (select count(*) from behaviour where event_type = 'event_going'),
      'directions', (select count(*) from behaviour where event_type in ('event_directions_clicked', 'venue_directions_clicked')),
      'verified_check_ins', (select count(*) from behaviour where event_type = 'event_checked_in' and verified),
      'negative_signals', (select count(*) from behaviour where event_type in ('event_skipped', 'event_quick_exit', 'event_not_interested', 'venue_hidden'))
    ),
    'catalogue', jsonb_build_object(
      'venues', (select count(*) from public.venues),
      'published_events', (select count(*) from public.events where status = 'published'),
      'upcoming_occurrences', (select count(*) from public.event_occurrences where starts_at >= now() and status = 'scheduled'),
      'preference_profiles', (select count(*) from public.preference_profiles)
    ),
    'daily', coalesce((select jsonb_agg(jsonb_build_object(
      'date', to_char(day, 'YYYY-MM-DD'),
      'interactions', interactions,
      'recommendations', recommendations,
      'analytics_events', analytics_events
    ) order by day) from daily), '[]'::jsonb),
    'event_types', coalesce((select jsonb_agg(jsonb_build_object('key', key, 'total', total) order by total desc, key) from (select * from combined_breakdown order by total desc, key limit 12) ranked), '[]'::jsonb),
    'surfaces', coalesce((select jsonb_agg(jsonb_build_object('key', key, 'total', total) order by total desc, key) from (select * from combined_surfaces order by total desc, key limit 8) ranked), '[]'::jsonb),
    'top_entities', coalesce((select jsonb_agg(to_jsonb(top_entities) order by interactions desc, label) from top_entities), '[]'::jsonb),
    'preferences', coalesce((select jsonb_agg(to_jsonb(preference_activity) order by profiles desc, confidence desc, score desc) from preference_activity), '[]'::jsonb),
    'active_ranking', (
      select jsonb_build_object(
        'key', key,
        'version', version,
        'exploration_ratio', exploration_ratio,
        'sponsored_multiplier', sponsored_multiplier,
        'sponsored_minimum_relevance', sponsored_minimum_relevance,
        'weights', weights
      )
      from public.ranking_configs
      where active
      order by created_at desc
      limit 1
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.crm_analytics_overview(timestamptz) from public, anon, authenticated;
grant execute on function public.crm_analytics_overview(timestamptz) to authenticated;

commit;

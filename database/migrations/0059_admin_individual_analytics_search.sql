-- Migration 0059: bounded administrator lookup for individual analytics summaries
begin;

create or replace function public.crm_user_analytics_search(
  p_query text,
  p_since timestamptz default now() - interval '30 days',
  p_limit integer default 12
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_query text := lower(trim(coalesce(p_query, '')));
  v_result jsonb;
begin
  if not public.has_platform_role(array['administrator']::public.app_role[]) then
    raise exception 'administrator role required';
  end if;
  if char_length(v_query) < 2 or char_length(v_query) > 120 then
    raise exception 'search query must contain between 2 and 120 characters';
  end if;
  if p_limit < 1 or p_limit > 25 then
    raise exception 'invalid result limit';
  end if;
  if p_since < now() - interval '366 days' or p_since > now() then
    raise exception 'invalid metrics period';
  end if;

  with matches as (
    select p.id, coalesce(nullif(trim(p.display_name), ''), 'AkiPasa user') as display_name,
      coalesce(u.email::text, '') as email, p.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
    where position(v_query in lower(coalesce(p.display_name, ''))) > 0
       or position(v_query in lower(coalesce(u.email::text, ''))) > 0
       or p.id::text = v_query
    order by p.created_at desc, p.id
    limit p_limit
  ), summaries as (
    select m.id, m.display_name, m.email, m.created_at,
      coalesce(ap.collection_status, 'awaiting_consent') as advertising_status,
      coalesce(ps.analytics_enabled, false) as analytics_enabled,
      coalesce(ps.personalisation_enabled, false) as personalisation_enabled,
      coalesce(ps.marketing_enabled, false) as marketing_enabled,
      coalesce(activity.event_count, 0) as event_count,
      activity.last_active_at,
      coalesce(recommendations.request_count, 0) as recommendation_count,
      coalesce(signals.signal_count, 0) as signal_count,
      coalesce(signals.average_confidence, 0) as average_confidence,
      signals.last_signal_at,
      coalesce(signals.top_affinities, '[]'::jsonb) as top_affinities
    from matches m
    left join public.personalisation_settings ps on ps.profile_id = m.id
    left join public.advertising_profiles ap on ap.profile_id = m.id
    left join public.preference_profiles pp on pp.profile_id = m.id
    left join lateral (
      select count(*)::bigint as event_count, max(b.occurred_at) as last_active_at
      from public.behaviour_events b
      where b.profile_id = m.id and b.received_at >= p_since
    ) activity on true
    left join lateral (
      select count(*)::bigint as request_count
      from public.recommendation_requests r
      where r.preference_profile_id = pp.id and r.created_at >= p_since
    ) recommendations on true
    left join lateral (
      select count(*)::bigint as signal_count,
        round(avg(s.confidence)::numeric, 3) as average_confidence,
        max(s.last_signal_at) as last_signal_at,
        coalesce((
          select jsonb_agg(jsonb_build_object(
            'dimension', ranked.dimension,
            'key', ranked.key,
            'confidence', ranked.confidence,
            'score', ranked.score
          ) order by ranked.confidence desc, ranked.score desc)
          from (
            select ups.dimension, ups.key, ups.confidence,
              greatest(ups.short_term_score, ups.long_term_score) as score
            from public.user_preference_signals ups
            where ups.preference_profile_id = pp.id
              and ups.dimension in ('category', 'subcategory', 'venue', 'price', 'time', 'weekday', 'planning_horizon', 'search_intent')
              and ups.confidence >= 0.20
            order by ups.confidence desc, score desc
            limit 6
          ) ranked
        ), '[]'::jsonb) as top_affinities
      from public.user_preference_signals s
      where s.preference_profile_id = pp.id
    ) signals on true
  )
  select coalesce(jsonb_agg(to_jsonb(summaries) order by display_name, email), '[]'::jsonb)
  into v_result
  from summaries;

  return v_result;
end;
$$;

revoke all on function public.crm_user_analytics_search(text, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.crm_user_analytics_search(text, timestamptz, integer) to authenticated;

commit;

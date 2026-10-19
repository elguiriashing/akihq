-- Avoid repeated full-table duplicate scans (and PostgREST statement timeouts)
-- while preserving published/sanitised activity filters, winner selection,
-- 80m duplicate resolution, sorting and 20-item pagination.
create or replace function public.public_nearby_venue_page(
  p_lat double precision,
  p_lng double precision,
  p_radius double precision,
  p_page integer default 1,
  p_unclaimed boolean default false
)
returns jsonb
language plpgsql
stable
set search_path to ''
as $function$
declare
  origin public.geography;
  result jsonb;
begin
  if p_lat is null or p_lng is null or p_radius is null or p_page is null
    or not (p_lat between -90 and 90)
    or not (p_lng between -180 and 180)
    or not (p_radius between 0.1 and 100)
    or p_page not between 1 and 100000 then
    raise exception 'Invalid discovery parameters' using errcode='22023';
  end if;

  origin := public.st_setsrid(public.st_makepoint(p_lng,p_lat),4326)::public.geography;

  with candidates as materialized (
    select
      v.id,
      v.slug,
      v.name,
      v.address,
      v.location,
      public.st_y(v.location::public.geometry) as latitude,
      public.st_x(v.location::public.geometry) as longitude,
      public.st_distance(v.location,origin) as distance_m,
      case when (select public.venue_relevance_enabled())
        then v.recommendation_weight else 1 end as recommendation_weight,
      public.venue_search_normalize(v.name) as normalized_name,
      case when v.accessibility->>'claim_status'='unclaimed'
        then 0 else 1 end as claim_rank,
      case when v.accessibility->>'claim_status'='unclaimed'
        then 'unclaimed' else 'claimed' end as claim_status,
      coalesce(v.verified,false) as verified
    from public.venues v
    where v.status='published'
      and not v.map_location_suspect
      and (not (select public.venue_relevance_enabled()) or v.discovery_enabled)
      and v.discovery_vertical='activities'
      -- Include the 80m boundary so deduplication preserves the old winners.
      and public.st_dwithin(v.location,origin,p_radius*1000 + 80)
  ),
  matches as materialized (
    select v.*
    from candidates v
    where v.distance_m <= p_radius*1000
      and (not coalesce(p_unclaimed,false) or v.claim_rank=0)
      and not exists (
        select 1 from candidates d
        where d.id<>v.id
          and d.normalized_name=v.normalized_name
          and public.st_dwithin(d.location,v.location,80)
          and (
            d.claim_rank>v.claim_rank
            or (d.claim_rank=v.claim_rank and d.verified>v.verified)
            or (d.claim_rank=v.claim_rank and d.verified=v.verified and d.id<v.id)
          )
      )
  ),
  totals as (select count(*) as total from matches)
  select jsonb_build_object(
    'rows', coalesce((
      select jsonb_agg(to_jsonb(r) order by
        r."distanceKm"/r."recommendationWeight", r."distanceKm", r.id)
      from (
        select v.id, v.slug, v.name, v.address,
          v.recommendation_weight as "recommendationWeight",
          v.latitude, v.longitude,
          v.distance_m/1000.0 as "distanceKm",
          v.claim_status as "claimStatus"
        from matches v
        order by v.distance_m/v.recommendation_weight,v.distance_m,v.id
        limit 20
        offset (least(p_page,greatest(1,ceil((select total from totals)/20.0)::integer))-1)*20
      ) r
    ), '[]'::jsonb),
    'total',(select total from totals),
    'page',least(p_page,greatest(1,ceil((select total from totals)/20.0)::integer))
  ) into result;

  return result;
end;
$function$;

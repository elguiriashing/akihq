-- Claimable venue search for AkiBusiness.
-- Returns only published, geolocated, non-suspect, unclaimed activity venues.
create or replace function public.search_claimable_venues(
  p_query text,
  p_limit integer default 24
)
returns table (
  id uuid,
  slug text,
  name text,
  address text,
  locality text,
  latitude double precision,
  longitude double precision
)
language sql
stable
security definer
set search_path = public
as $$
  with matches as (
    select s.id
    from public.search_public_venues(
      p_query,
      0,
      greatest(1, least(coalesce(p_limit, 24), 50))
    ) s
  )
  select
    v.id,
    v.slug,
    v.name,
    v.address,
    c.name_es as locality,
    st_y(v.location::geometry) as latitude,
    st_x(v.location::geometry) as longitude
  from matches m
  join public.venues v on v.id = m.id
  left join public.cities c on c.id = v.city_id
  where v.status = 'published'
    and v.discovery_vertical = 'activities'
    and v.discovery_enabled = true
    and v.map_location_suspect = false
    and v.location is not null
    and v.accessibility @> '{"claim_status":"unclaimed"}'::jsonb
  limit greatest(1, least(coalesce(p_limit, 24), 50));
$$;

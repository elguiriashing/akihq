create or replace function public.claimable_venue_cards_in_bounds(
  p_west double precision,
  p_east double precision,
  p_south double precision,
  p_north double precision,
  p_limit integer default 1500
)
returns table (
  id uuid,
  slug text,
  name text,
  address text,
  locality text,
  longitude double precision,
  latitude double precision
)
language sql
stable
security definer
set search_path = public
as $$
  select
    v.id,
    v.slug,
    v.name,
    v.address,
    c.name_es as locality,
    st_x(v.location::geometry) as longitude,
    st_y(v.location::geometry) as latitude
  from public.venues v
  left join public.cities c on c.id = v.city_id
  where v.status = 'published'
    and v.discovery_vertical = 'activities'
    and v.discovery_enabled = true
    and v.map_location_suspect = false
    and v.location is not null
    and v.accessibility @> '{"claim_status":"unclaimed"}'::jsonb
    and st_x(v.location::geometry) between p_west and p_east
    and st_y(v.location::geometry) between p_south and p_north
  limit greatest(1, least(coalesce(p_limit, 1500), 3000));
$$;

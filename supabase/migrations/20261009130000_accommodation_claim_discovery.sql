-- Accommodation claim discovery deliberately separate from activity search.
create or replace function public.search_claimable_accommodations(p_query text,p_limit integer default 24)
returns table(id uuid,slug text,name text,address text,locality text,latitude double precision,longitude double precision)
language sql stable security definer set search_path=public as $$
select v.id,v.slug,v.name,v.address,c.name_es,
 st_y(v.location::geometry),st_x(v.location::geometry)
from public.venues v left join public.cities c on c.id=v.city_id
where v.status='published' and v.discovery_vertical='accommodation'
 and v.discovery_enabled=true and v.map_location_suspect=false and v.location is not null
 and v.accessibility @> '{"claim_status":"unclaimed"}'::jsonb
 and (v.name ilike '%'||trim(p_query)||'%' or v.address ilike '%'||trim(p_query)||'%' or c.name_es ilike '%'||trim(p_query)||'%')
order by (lower(v.name)=lower(trim(p_query))) desc,v.name
limit greatest(1,least(coalesce(p_limit,24),50));
$$;
create or replace function public.claimable_accommodation_cards_in_bounds(p_west double precision,p_east double precision,p_south double precision,p_north double precision,p_limit integer default 1500)
returns table(id uuid,slug text,name text,address text,locality text,longitude double precision,latitude double precision)
language sql stable security definer set search_path=public as $$
select v.id,v.slug,v.name,v.address,c.name_es,
 st_x(v.location::geometry),st_y(v.location::geometry)
from public.venues v left join public.cities c on c.id=v.city_id
where v.status='published' and v.discovery_vertical='accommodation'
 and v.discovery_enabled=true and v.map_location_suspect=false and v.location is not null
 and v.accessibility @> '{"claim_status":"unclaimed"}'::jsonb
 and st_x(v.location::geometry) between p_west and p_east
 and st_y(v.location::geometry) between p_south and p_north
limit greatest(1,least(coalesce(p_limit,1500),3000));
$$;
revoke all on function public.search_claimable_accommodations(text,integer) from public;
revoke all on function public.claimable_accommodation_cards_in_bounds(double precision,double precision,double precision,double precision,integer) from public;
grant execute on function public.search_claimable_accommodations(text,integer) to anon,authenticated;
grant execute on function public.claimable_accommodation_cards_in_bounds(double precision,double precision,double precision,double precision,integer) to anon,authenticated;

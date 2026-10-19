begin;

-- The expensive near-duplicate subquery made fresh nationwide snapshots too slow
-- to rebuild at the edge. Exact duplicates are already archived and questionable
-- geocodes are materialized in map_location_suspect, so the snapshot can safely
-- be a simple indexed read of sanitized published venues.
create or replace function public.public_map_marker_snapshot_v2()
returns jsonb
language sql
stable
set search_path to ''
as $function$
 with markers as (
  select coalesce(jsonb_agg(jsonb_build_array(
    v.id,
    round(public.st_x(v.location::public.geometry)::numeric,6),
    round(public.st_y(v.location::public.geometry)::numeric,6),
    case when v.accessibility->>'claim_status'='unclaimed' then 1 else 0 end,
    case when v.discovery_vertical='accommodation' then 1 else 0 end
  ) order by v.id),'[]'::jsonb) as rows
  from public.venues v
  where v.status='published'
    and not v.map_location_suspect
    and (not (select public.venue_relevance_enabled()) or v.discovery_enabled)
    and public.st_x(v.location::public.geometry) between -19 and 5
    and public.st_y(v.location::public.geometry) between 27 and 45
 )
 select jsonb_build_object(
   'version',2,
   'generatedAt',now(),
   'count',jsonb_array_length(rows),
   'markers',rows
 ) from markers;
$function$;

create or replace function public.public_map_marker_snapshot()
returns jsonb
language sql
stable
set search_path to ''
as $function$
 with markers as (
  select coalesce(jsonb_agg(jsonb_build_array(
    v.id,
    round(public.st_x(v.location::public.geometry)::numeric,6),
    round(public.st_y(v.location::public.geometry)::numeric,6),
    case when v.accessibility->>'claim_status'='unclaimed' then 1 else 0 end
  ) order by v.id),'[]'::jsonb) as rows
  from public.venues v
  where v.status='published'
    and v.discovery_vertical='activities'
    and not v.map_location_suspect
    and (not (select public.venue_relevance_enabled()) or v.discovery_enabled)
    and public.st_x(v.location::public.geometry) between -19 and 5
    and public.st_y(v.location::public.geometry) between 27 and 45
 )
 select jsonb_build_object(
   'version',1,
   'generatedAt',now(),
   'count',jsonb_array_length(rows),
   'markers',rows
 ) from markers;
$function$;

commit;

-- Public-only compact nationwide markers. One statement supplies a consistent
-- snapshot, with no paging/row cap. SECURITY INVOKER preserves venue RLS.
create or replace function public.public_map_marker_snapshot()
returns jsonb language sql stable security invoker set search_path='' as $$
 with markers as (
  select coalesce(jsonb_agg(jsonb_build_array(
    v.id,
    round(public.st_x(v.location::public.geometry)::numeric,6),
    round(public.st_y(v.location::public.geometry)::numeric,6),
    case when v.accessibility->>'claim_status'='unclaimed' then 1 else 0 end
  ) order by v.id),'[]'::jsonb) as rows
  from public.venues v
  where v.status='published'
   and public.st_x(v.location::public.geometry) between -19 and 5
   and public.st_y(v.location::public.geometry) between 27 and 45
 )
 select jsonb_build_object('version',1,'generatedAt',now(),
   'count',jsonb_array_length(rows),'markers',rows) from markers;
$$;
revoke all on function public.public_map_marker_snapshot() from public;
grant execute on function public.public_map_marker_snapshot() to anon,authenticated,service_role;
-- Rollback: revert the map client/Worker first, then drop this new function.

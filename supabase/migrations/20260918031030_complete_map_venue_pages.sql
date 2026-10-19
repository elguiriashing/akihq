-- Complete viewport coverage using UUID keyset pagination. No total marker cap.
-- Keep the old RPC for clients open during rollout. Existing RLS remains in force.
create or replace function public.public_map_venue_page(
 p_west double precision,p_east double precision,p_south double precision,p_north double precision,
 p_after uuid default null
) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare box public.geography; result jsonb; w double precision; e double precision; s double precision; n double precision;
begin
 if p_west is null or p_east is null or p_south is null or p_north is null
 or not (p_west between -180 and 180) or not (p_east between -180 and 180)
 or not (p_south between -85 and 85) or not (p_north between -85 and 85)
 or p_west>=p_east or p_south>=p_north then
  raise exception 'Invalid map bounds' using errcode='22023';
 end if;
 -- Spain including the Canary and Balearic islands, Ceuta and Melilla.
 w:=greatest(p_west,-19);e:=least(p_east,5);s:=greatest(p_south,27);n:=least(p_north,45);
 if w>=e or s>=n then return jsonb_build_object('rows','[]'::jsonb,'hasMore',false,'nextCursor',null);end if;
 box:=public.st_makeenvelope(w,s,e,n,4326)::public.geography;
 select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]'::jsonb) into result from (
  select v.id,v.slug,v.name,v.address,
   public.st_y(v.location::public.geometry) as latitude,
   public.st_x(v.location::public.geometry) as longitude,
   case when v.accessibility->>'claim_status'='unclaimed' then 'unclaimed' else 'claimed' end as "claimStatus"
  from public.venues v where v.status='published'
  and (p_after is null or v.id>p_after)
  and v.location operator(public.&&) box
  and public.st_x(v.location::public.geometry) between w and e
  and public.st_y(v.location::public.geometry) between s and n
  order by v.id limit 2001
 )r;
 return jsonb_build_object('rows',case when jsonb_array_length(result)>2000 then result-2000 else result end,'hasMore',jsonb_array_length(result)>2000,
  'nextCursor',case when jsonb_array_length(result)>2000 then result->1999->>'id' else null end);
end $$;
revoke all on function public.public_map_venue_page(double precision,double precision,double precision,double precision,uuid) from public;
grant execute on function public.public_map_venue_page(double precision,double precision,double precision,double precision,uuid) to anon,authenticated,service_role;
-- Rollback: revert the frontend, then drop this function using the signature above.

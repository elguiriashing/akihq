-- Read-only APIs: preserve venue RLS and use the existing geography GiST index.
create or replace function public.public_nearby_venue_page(
 p_lat double precision,p_lng double precision,p_radius double precision,
 p_page integer default 1,p_unclaimed boolean default false
) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare origin public.geography; total bigint; current_page integer; result jsonb;
begin
 if p_lat is null or p_lng is null or p_radius is null or p_page is null
 or not (p_lat between -90 and 90) or not (p_lng between -180 and 180)
 or not (p_radius between 0.1 and 100) or p_page not between 1 and 100000 then
  raise exception 'Invalid discovery parameters' using errcode='22023';
 end if;
 origin:=public.st_setsrid(public.st_makepoint(p_lng,p_lat),4326)::public.geography;
 select count(*) into total from public.venues v
 where v.status='published' and public.st_dwithin(v.location,origin,p_radius*1000)
 and (not coalesce(p_unclaimed,false) or v.accessibility->>'claim_status'='unclaimed');
 current_page:=least(p_page,greatest(1,ceil(total/20.0)::integer));
 select coalesce(jsonb_agg(to_jsonb(r) order by r."distanceKm",r.id),'[]'::jsonb) into result from (
  select v.id,v.slug,v.name,v.address,
   public.st_y(v.location::public.geometry) as latitude,
   public.st_x(v.location::public.geometry) as longitude,
   public.st_distance(v.location,origin)/1000 as "distanceKm",
   case when v.accessibility->>'claim_status'='unclaimed' then 'unclaimed' else 'claimed' end as "claimStatus"
  from public.venues v where v.status='published' and public.st_dwithin(v.location,origin,p_radius*1000)
  and (not coalesce(p_unclaimed,false) or v.accessibility->>'claim_status'='unclaimed')
  order by public.st_distance(v.location,origin),v.id limit 20 offset (current_page-1)*20
 )r;
 return jsonb_build_object('rows',result,'total',total,'page',current_page);
end $$;

create or replace function public.public_map_venue_window(
 p_west double precision,p_east double precision,p_south double precision,p_north double precision
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
 if w>=e or s>=n then return jsonb_build_object('rows','[]'::jsonb,'hasMore',false);end if;
 box:=public.st_makeenvelope(w,s,e,n,4326)::public.geography;
 select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]'::jsonb) into result from (
  select v.id,v.slug,v.name,v.address,
   public.st_y(v.location::public.geometry) as latitude,
   public.st_x(v.location::public.geometry) as longitude,
   case when v.accessibility->>'claim_status'='unclaimed' then 'unclaimed' else 'claimed' end as "claimStatus"
  from public.venues v where v.status='published'
  and v.location operator(public.&&) box
  and public.st_x(v.location::public.geometry) between w and e
  and public.st_y(v.location::public.geometry) between s and n
  order by v.id limit 2001
 )r;
 return jsonb_build_object('rows',case when jsonb_array_length(result)>2000 then result-2000 else result end,'hasMore',jsonb_array_length(result)>2000);
end $$;
revoke all on function public.public_nearby_venue_page(double precision,double precision,double precision,integer,boolean) from public;
revoke all on function public.public_map_venue_window(double precision,double precision,double precision,double precision) from public;
grant execute on function public.public_nearby_venue_page(double precision,double precision,double precision,integer,boolean) to anon,authenticated,service_role;
grant execute on function public.public_map_venue_window(double precision,double precision,double precision,double precision) to anon,authenticated,service_role;

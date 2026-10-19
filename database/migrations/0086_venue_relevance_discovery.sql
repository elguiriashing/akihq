begin;
CREATE OR REPLACE FUNCTION public.public_map_marker_snapshot()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 with markers as (
  select coalesce(jsonb_agg(jsonb_build_array(
    v.id,
    round(public.st_x(v.location::public.geometry)::numeric,6),
    round(public.st_y(v.location::public.geometry)::numeric,6),
    case when v.accessibility->>'claim_status'='unclaimed' then 1 else 0 end
  ) order by v.id),'[]'::jsonb) as rows
  from public.venues v
  where v.status='published' and (not (select public.venue_relevance_enabled()) or v.discovery_enabled)
   and public.st_x(v.location::public.geometry) between -19 and 5
   and public.st_y(v.location::public.geometry) between 27 and 45
 )
 select jsonb_build_object('version',1,'generatedAt',now(),
   'count',jsonb_array_length(rows),'markers',rows) from markers;
$function$
;
CREATE OR REPLACE FUNCTION public.public_map_marker_snapshot_v2()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 with markers as (
  select coalesce(jsonb_agg(jsonb_build_array(
    v.id,
    round(public.st_x(v.location::public.geometry)::numeric,6),
    round(public.st_y(v.location::public.geometry)::numeric,6),
    case when v.accessibility->>'claim_status'='unclaimed' then 1 else 0 end,
    case when v.discovery_vertical='accommodation' then 1 else 0 end
  ) order by v.id),'[]'::jsonb) as rows
  from public.venues v
  where v.status='published' and (not (select public.venue_relevance_enabled()) or v.discovery_enabled)
   and public.st_x(v.location::public.geometry) between -19 and 5
   and public.st_y(v.location::public.geometry) between 27 and 45
 )
 select jsonb_build_object('version',2,'generatedAt',now(),
   'count',jsonb_array_length(rows),'markers',rows) from markers;
$function$
;
CREATE OR REPLACE FUNCTION public.public_map_venue_page(p_west double precision, p_east double precision, p_south double precision, p_north double precision, p_after uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
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
  from public.venues v where v.status='published' and (not (select public.venue_relevance_enabled()) or v.discovery_enabled)
  and (p_after is null or v.id>p_after)
  and v.location operator(public.&&) box
  and public.st_x(v.location::public.geometry) between w and e
  and public.st_y(v.location::public.geometry) between s and n
  order by v.id limit 2001
 )r;
 return jsonb_build_object('rows',case when jsonb_array_length(result)>2000 then result-2000 else result end,'hasMore',jsonb_array_length(result)>2000,
  'nextCursor',case when jsonb_array_length(result)>2000 then result->1999->>'id' else null end);
end $function$
;
CREATE OR REPLACE FUNCTION public.public_map_venue_window(p_west double precision, p_east double precision, p_south double precision, p_north double precision)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
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
  from public.venues v where v.status='published' and (not (select public.venue_relevance_enabled()) or v.discovery_enabled)
  and v.location operator(public.&&) box
  and public.st_x(v.location::public.geometry) between w and e
  and public.st_y(v.location::public.geometry) between s and n
  order by v.id limit 2001
 )r;
 return jsonb_build_object('rows',case when jsonb_array_length(result)>2000 then result-2000 else result end,'hasMore',jsonb_array_length(result)>2000);
end $function$
;
CREATE OR REPLACE FUNCTION public.public_nearby_venue_page(p_lat double precision, p_lng double precision, p_radius double precision, p_page integer DEFAULT 1, p_unclaimed boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare origin public.geography; total bigint; current_page integer; result jsonb;
begin
 if p_lat is null or p_lng is null or p_radius is null or p_page is null
 or not (p_lat between -90 and 90) or not (p_lng between -180 and 180)
 or not (p_radius between 0.1 and 100) or p_page not between 1 and 100000 then
  raise exception 'Invalid discovery parameters' using errcode='22023';
 end if;
 origin:=public.st_setsrid(public.st_makepoint(p_lng,p_lat),4326)::public.geography;
 select count(*) into total from public.venues v
 where v.status='published' and (not (select public.venue_relevance_enabled()) or v.discovery_enabled) and v.discovery_vertical='activities' and public.st_dwithin(v.location,origin,p_radius*1000)
 and (not coalesce(p_unclaimed,false) or v.accessibility->>'claim_status'='unclaimed');
 current_page:=least(p_page,greatest(1,ceil(total/20.0)::integer));
 select coalesce(jsonb_agg(to_jsonb(r) order by r."distanceKm"/r."recommendationWeight",r."distanceKm",r.id),'[]'::jsonb) into result from (
  select v.id,v.slug,v.name,v.address,
   case when (select public.venue_relevance_enabled()) then v.recommendation_weight else 1 end as "recommendationWeight",
   public.st_y(v.location::public.geometry) as latitude,
   public.st_x(v.location::public.geometry) as longitude,
   public.st_distance(v.location,origin)/1000 as "distanceKm",
   case when v.accessibility->>'claim_status'='unclaimed' then 'unclaimed' else 'claimed' end as "claimStatus"
  from public.venues v where v.status='published' and (not (select public.venue_relevance_enabled()) or v.discovery_enabled) and v.discovery_vertical='activities' and public.st_dwithin(v.location,origin,p_radius*1000)
  and (not coalesce(p_unclaimed,false) or v.accessibility->>'claim_status'='unclaimed')
  order by public.st_distance(v.location,origin)/(case when (select public.venue_relevance_enabled()) then v.recommendation_weight else 1 end),public.st_distance(v.location,origin),v.id limit 20 offset (current_page-1)*20
 )r;
 return jsonb_build_object('rows',result,'total',total,'page',current_page);
end $function$
;
CREATE OR REPLACE FUNCTION public.public_stay_viewport(p_west double precision, p_east double precision, p_south double precision, p_north double precision, p_type text DEFAULT 'all'::text, p_query text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
declare result jsonb;
begin
 if p_west is null or p_east is null or p_south is null or p_north is null or not(p_west between -180 and 180 and p_east between -180 and 180 and p_south between -85 and 85 and p_north between -85 and 85 and p_west<p_east and p_south<p_north) then raise exception 'invalid bounds';end if;
 select jsonb_build_object('markers',coalesce(jsonb_agg(jsonb_build_array(v.id,st_x(v.location::geometry),st_y(v.location::geometry),case when v.verified then 1 else 0 end,1)),'[]'::jsonb),'truncated',count(*)>1000) into result from (
 select id,location,verified from venues where status='published' and discovery_vertical='accommodation' and (p_type='all' or accommodation_type=p_type)
 and location && st_makeenvelope(p_west,p_south,p_east,p_north,4326)::geography
 and (coalesce(trim(p_query),'')='' or venue_search_normalize(name||' '||coalesce(address,'')) like '%'||replace(replace(venue_search_normalize(left(p_query,100)),'%',''), '_','')||'%')
 order by id limit 1001) v;
 return result;
end $function$
;
CREATE OR REPLACE FUNCTION public.search_public_venues(p_query text, p_offset integer DEFAULT 0, p_limit integer DEFAULT 25)
 RETURNS TABLE(id uuid, slug text, name text, address text, discovery_vertical text, total bigint)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare normalized text; query_text text; terms tsquery;
begin
  if p_offset is null or p_offset<0 or p_offset>1000000 or p_limit is null or p_limit<1 or p_limit>50 then
    raise exception 'invalid pagination';
  end if;
  normalized:=public.venue_search_normalize(left(p_query,160));
  if length(normalized)<2 then return; end if;
  select string_agg(quote_literal(token)||':*',' & ') into query_text
  from regexp_split_to_table(normalized,' +') token
  where (length(token)>=2 or token ~ '^[0-9]+$') and token not in ('de','del','el','la','las','los','en','al','the','of','and');
  if query_text is null then return; end if;
  terms:=to_tsquery('simple'::regconfig,query_text);
  return query
  select v.id,v.slug,v.name,v.address,v.discovery_vertical::text,count(*) over()
  from public.venues v where v.status='published' and (not (select public.venue_relevance_enabled()) or v.search_enabled) and v.search_document @@ terms
  order by case when public.venue_search_normalize(v.name)=normalized then 0
    when public.venue_search_normalize(v.name) like normalized||'%' then 1 else 2 end,
    public.venue_search_normalize(v.name),v.id
  offset p_offset limit p_limit;
end;
$function$
;
commit;

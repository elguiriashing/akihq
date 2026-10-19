begin;

alter table public.venues
  add column if not exists map_location_suspect boolean not null default false;

create index if not exists venues_map_location_suspect_idx
  on public.venues (map_location_suspect)
  where map_location_suspect = false;

with bad_provider as (
  select accessibility->>'address_provider_id' pid
  from public.venues
  where status='published'
    and discovery_vertical='activities'
    and nullif(accessibility->>'address_provider_id','') is not null
  group by 1
  having count(distinct lower(trim(name))) >= 2
     and count(distinct lower(trim(coalesce(address,'')))) >= 2
),
bad_coord as (
  select round(public.st_y(location::public.geometry)::numeric,6) lat,
         round(public.st_x(location::public.geometry)::numeric,6) lng
  from public.venues
  where status='published'
    and discovery_vertical='activities'
  group by 1,2
  having count(*) >= 2
     and count(distinct lower(trim(name))) >= 2
     and count(distinct lower(trim(coalesce(address,'')))) >= 2
)
update public.venues v
set map_location_suspect = true
where v.status='published'
  and v.discovery_vertical='activities'
  and (
    v.accessibility->>'address_provider_id' in (select pid from bad_provider)
    or exists (
      select 1 from bad_coord c
      where round(public.st_y(v.location::public.geometry)::numeric,6)=c.lat
        and round(public.st_x(v.location::public.geometry)::numeric,6)=c.lng
    )
  );

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
   and not exists (
    select 1 from public.venues d
    where d.id<>v.id
      and d.status='published'
      and not d.map_location_suspect
      and (not (select public.venue_relevance_enabled()) or d.discovery_enabled)
      and d.discovery_vertical=v.discovery_vertical
      and public.venue_search_normalize(d.name)=public.venue_search_normalize(v.name)
      and public.st_dwithin(d.location,v.location,80)
      and (
        (case when d.accessibility->>'claim_status'='unclaimed' then 0 else 1 end)
          > (case when v.accessibility->>'claim_status'='unclaimed' then 0 else 1 end)
        or (
          (case when d.accessibility->>'claim_status'='unclaimed' then 0 else 1 end)
            = (case when v.accessibility->>'claim_status'='unclaimed' then 0 else 1 end)
          and coalesce(d.verified,false)::int > coalesce(v.verified,false)::int
        )
        or (
          (case when d.accessibility->>'claim_status'='unclaimed' then 0 else 1 end)
            = (case when v.accessibility->>'claim_status'='unclaimed' then 0 else 1 end)
          and coalesce(d.verified,false)=coalesce(v.verified,false)
          and d.id<v.id
        )
      )
   )
 )
 select jsonb_build_object('version',2,'generatedAt',now(),
   'count',jsonb_array_length(rows),'markers',rows) from markers;
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
   and not v.map_location_suspect
   and (not (select public.venue_relevance_enabled()) or v.discovery_enabled)
   and v.discovery_vertical='activities'
   and public.st_x(v.location::public.geometry) between -19 and 5
   and public.st_y(v.location::public.geometry) between 27 and 45
   and not exists (
    select 1 from public.venues d
    where d.id<>v.id
      and d.status='published'
      and not d.map_location_suspect
      and (not (select public.venue_relevance_enabled()) or d.discovery_enabled)
      and d.discovery_vertical='activities'
      and public.venue_search_normalize(d.name)=public.venue_search_normalize(v.name)
      and public.st_dwithin(d.location,v.location,80)
      and (
        (case when d.accessibility->>'claim_status'='unclaimed' then 0 else 1 end)
          > (case when v.accessibility->>'claim_status'='unclaimed' then 0 else 1 end)
        or (
          (case when d.accessibility->>'claim_status'='unclaimed' then 0 else 1 end)
            = (case when v.accessibility->>'claim_status'='unclaimed' then 0 else 1 end)
          and coalesce(d.verified,false)::int > coalesce(v.verified,false)::int
        )
        or (
          (case when d.accessibility->>'claim_status'='unclaimed' then 0 else 1 end)
            = (case when v.accessibility->>'claim_status'='unclaimed' then 0 else 1 end)
          and coalesce(d.verified,false)=coalesce(v.verified,false)
          and d.id<v.id
        )
      )
   )
 )
 select jsonb_build_object('version',1,'generatedAt',now(),
   'count',jsonb_array_length(rows),'markers',rows) from markers;
$function$;

create or replace function public.public_nearby_venue_page(
 p_lat double precision,p_lng double precision,p_radius double precision,
 p_page integer default 1,p_unclaimed boolean default false
) returns jsonb
language plpgsql
stable
set search_path to ''
as $function$
declare origin public.geography; total bigint; current_page integer; result jsonb;
begin
 if p_lat is null or p_lng is null or p_radius is null or p_page is null
 or not (p_lat between -90 and 90) or not (p_lng between -180 and 180)
 or not (p_radius between 0.1 and 100) or p_page not between 1 and 100000 then
  raise exception 'Invalid discovery parameters' using errcode='22023';
 end if;
 origin:=public.st_setsrid(public.st_makepoint(p_lng,p_lat),4326)::public.geography;

 select count(*) into total from public.venues v
 where v.status='published'
  and not v.map_location_suspect
  and (not (select public.venue_relevance_enabled()) or v.discovery_enabled)
  and v.discovery_vertical='activities'
  and public.st_dwithin(v.location,origin,p_radius*1000)
  and (not coalesce(p_unclaimed,false) or v.accessibility->>'claim_status'='unclaimed')
  and not exists (
   select 1 from public.venues d
   where d.id<>v.id and d.status='published' and not d.map_location_suspect
    and (not (select public.venue_relevance_enabled()) or d.discovery_enabled)
    and d.discovery_vertical='activities'
    and public.venue_search_normalize(d.name)=public.venue_search_normalize(v.name)
    and public.st_dwithin(d.location,v.location,80)
    and (
      (case when d.accessibility->>'claim_status'='unclaimed' then 0 else 1 end)
        > (case when v.accessibility->>'claim_status'='unclaimed' then 0 else 1 end)
      or (
        (case when d.accessibility->>'claim_status'='unclaimed' then 0 else 1 end)
          = (case when v.accessibility->>'claim_status'='unclaimed' then 0 else 1 end)
        and coalesce(d.verified,false)::int > coalesce(v.verified,false)::int
      )
      or (
        (case when d.accessibility->>'claim_status'='unclaimed' then 0 else 1 end)
          = (case when v.accessibility->>'claim_status'='unclaimed' then 0 else 1 end)
        and coalesce(d.verified,false)=coalesce(v.verified,false)
        and d.id<v.id
      )
    )
  );

 current_page:=least(p_page,greatest(1,ceil(total/20.0)::integer));

 select coalesce(jsonb_agg(to_jsonb(r)
   order by r."distanceKm"/r."recommendationWeight",r."distanceKm",r.id),'[]'::jsonb)
 into result
 from (
  select v.id,v.slug,v.name,v.address,
   case when (select public.venue_relevance_enabled()) then v.recommendation_weight else 1 end as "recommendationWeight",
   public.st_y(v.location::public.geometry) as latitude,
   public.st_x(v.location::public.geometry) as longitude,
   public.st_distance(v.location,origin)/1000 as "distanceKm",
   case when v.accessibility->>'claim_status'='unclaimed' then 'unclaimed' else 'claimed' end as "claimStatus"
  from public.venues v
  where v.status='published'
   and not v.map_location_suspect
   and (not (select public.venue_relevance_enabled()) or v.discovery_enabled)
   and v.discovery_vertical='activities'
   and public.st_dwithin(v.location,origin,p_radius*1000)
   and (not coalesce(p_unclaimed,false) or v.accessibility->>'claim_status'='unclaimed')
   and not exists (
    select 1 from public.venues d
    where d.id<>v.id and d.status='published' and not d.map_location_suspect
     and (not (select public.venue_relevance_enabled()) or d.discovery_enabled)
     and d.discovery_vertical='activities'
     and public.venue_search_normalize(d.name)=public.venue_search_normalize(v.name)
     and public.st_dwithin(d.location,v.location,80)
     and (
       (case when d.accessibility->>'claim_status'='unclaimed' then 0 else 1 end)
         > (case when v.accessibility->>'claim_status'='unclaimed' then 0 else 1 end)
       or (
         (case when d.accessibility->>'claim_status'='unclaimed' then 0 else 1 end)
           = (case when v.accessibility->>'claim_status'='unclaimed' then 0 else 1 end)
         and coalesce(d.verified,false)::int > coalesce(v.verified,false)::int
       )
       or (
         (case when d.accessibility->>'claim_status'='unclaimed' then 0 else 1 end)
           = (case when v.accessibility->>'claim_status'='unclaimed' then 0 else 1 end)
         and coalesce(d.verified,false)=coalesce(v.verified,false)
         and d.id<v.id
       )
     )
   )
  order by public.st_distance(v.location,origin)
    /(case when (select public.venue_relevance_enabled()) then v.recommendation_weight else 1 end),
    public.st_distance(v.location,origin),v.id
  limit 20 offset (current_page-1)*20
 )r;
 return jsonb_build_object('rows',result,'total',total,'page',current_page);
end;
$function$;

create or replace function public.public_map_venue_page(
 p_west double precision,p_east double precision,p_south double precision,p_north double precision,
 p_after uuid default null
) returns jsonb
language plpgsql
stable
set search_path to ''
as $function$
declare box public.geography; result jsonb; w double precision; e double precision; s double precision; n double precision;
begin
 if p_west is null or p_east is null or p_south is null or p_north is null
 or not (p_west between -180 and 180) or not (p_east between -180 and 180)
 or not (p_south between -85 and 85) or not (p_north between -85 and 85)
 or p_west>=p_east or p_south>=p_north then
  raise exception 'Invalid map bounds' using errcode='22023';
 end if;
 w:=greatest(p_west,-19);e:=least(p_east,5);s:=greatest(p_south,27);n:=least(p_north,45);
 if w>=e or s>=n then return jsonb_build_object('rows','[]'::jsonb,'hasMore',false,'nextCursor',null);end if;
 box:=public.st_makeenvelope(w,s,e,n,4326)::public.geography;
 select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]'::jsonb) into result from (
  select v.id,v.slug,v.name,v.address,
   public.st_y(v.location::public.geometry) as latitude,
   public.st_x(v.location::public.geometry) as longitude,
   case when v.accessibility->>'claim_status'='unclaimed' then 'unclaimed' else 'claimed' end as "claimStatus"
  from public.venues v
  where v.status='published'
   and not v.map_location_suspect
   and (not (select public.venue_relevance_enabled()) or v.discovery_enabled)
   and (p_after is null or v.id>p_after)
   and v.location operator(public.&&) box
   and public.st_x(v.location::public.geometry) between w and e
   and public.st_y(v.location::public.geometry) between s and n
  order by v.id limit 2001
 )r;
 return jsonb_build_object('rows',
  case when jsonb_array_length(result)>2000 then result-2000 else result end,
  'hasMore',jsonb_array_length(result)>2000,
  'nextCursor',case when jsonb_array_length(result)>2000 then result->1999->>'id' else null end);
end;
$function$;

create or replace function public.public_map_venue_window(
 p_west double precision,p_east double precision,p_south double precision,p_north double precision
) returns jsonb
language plpgsql
stable
set search_path to ''
as $function$
declare box public.geography; result jsonb; w double precision; e double precision; s double precision; n double precision;
begin
 if p_west is null or p_east is null or p_south is null or p_north is null
 or not (p_west between -180 and 180) or not (p_east between -180 and 180)
 or not (p_south between -85 and 85) or not (p_north between -85 and 85)
 or p_west>=p_east or p_south>=p_north then
  raise exception 'Invalid map bounds' using errcode='22023';
 end if;
 w:=greatest(p_west,-19);e:=least(p_east,5);s:=greatest(p_south,27);n:=least(p_north,45);
 if w>=e or s>=n then return jsonb_build_object('rows','[]'::jsonb,'hasMore',false);end if;
 box:=public.st_makeenvelope(w,s,e,n,4326)::public.geography;
 select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]'::jsonb) into result from (
  select v.id,v.slug,v.name,v.address,
   public.st_y(v.location::public.geometry) as latitude,
   public.st_x(v.location::public.geometry) as longitude,
   case when v.accessibility->>'claim_status'='unclaimed' then 'unclaimed' else 'claimed' end as "claimStatus"
  from public.venues v
  where v.status='published'
   and not v.map_location_suspect
   and (not (select public.venue_relevance_enabled()) or v.discovery_enabled)
   and v.location operator(public.&&) box
   and public.st_x(v.location::public.geometry) between w and e
   and public.st_y(v.location::public.geometry) between s and n
  order by v.id limit 2001
 )r;
 return jsonb_build_object('rows',
  case when jsonb_array_length(result)>2000 then result-2000 else result end,
  'hasMore',jsonb_array_length(result)>2000);
end;
$function$;

drop function if exists public.venue_map_location_is_suspect(uuid);

commit;

-- Accommodation is a separate discovery vertical; existing venue IDs/URLs survive.
alter table public.venues add column discovery_vertical text not null default 'activities'
 check (discovery_vertical in ('activities','accommodation'));
alter table public.venues add column accommodation_type text;
create index venues_discovery_vertical_published_idx on public.venues(discovery_vertical,id) where status='published';

-- Dormant backend only: this schema is not exposed through PostgREST.
create schema akiduermo;
revoke all on schema akiduermo from public,anon,authenticated;
grant usage on schema akiduermo to service_role;
create table akiduermo.source_categories (
 external_id text primary key, category text not null, accommodation_type text,
 source_file text not null default 'AkiPasa_Spain_Source_Details_2026-09-17.xlsx'
);
alter table akiduermo.source_categories enable row level security;
create table akiduermo.classification_audit (
 venue_id uuid primary key references public.venues(id) on delete restrict,
 previous_vertical text not null, previous_type text,
 accommodation_type text not null, evidence jsonb not null,
 classified_at timestamptz not null default now()
);
alter table akiduermo.classification_audit enable row level security;
create table akiduermo.company_classification_audit (
 workspace_id text not null, company_id text not null, previous_fields jsonb not null,
 classified_at timestamptz not null default now(), primary key(workspace_id,company_id)
);
alter table akiduermo.company_classification_audit enable row level security;
grant select,insert,update,delete on all tables in schema akiduermo to service_role;
create view akiduermo.accommodation_catalogue with (security_invoker=true) as
 select id,slug,name,city_id,address,location,accommodation_type,status,accessibility
 from public.venues where discovery_vertical='accommodation';
grant select on akiduermo.accommodation_catalogue to service_role;
insert into public.feature_flags(key,enabled,label_es,label_en)
 values('akiduermo_public',false,'AkiDuermo (sin publicar)','AkiDuermo (unreleased)')
 on conflict(key) do nothing;

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
 where v.status='published' and v.discovery_vertical='activities' and public.st_dwithin(v.location,origin,p_radius*1000)
 and (not coalesce(p_unclaimed,false) or v.accessibility->>'claim_status'='unclaimed');
 current_page:=least(p_page,greatest(1,ceil(total/20.0)::integer));
 select coalesce(jsonb_agg(to_jsonb(r) order by r."distanceKm",r.id),'[]'::jsonb) into result from (
  select v.id,v.slug,v.name,v.address,
   public.st_y(v.location::public.geometry) as latitude,
   public.st_x(v.location::public.geometry) as longitude,
   public.st_distance(v.location,origin)/1000 as "distanceKm",
   case when v.accessibility->>'claim_status'='unclaimed' then 'unclaimed' else 'claimed' end as "claimStatus"
  from public.venues v where v.status='published' and v.discovery_vertical='activities' and public.st_dwithin(v.location,origin,p_radius*1000)
  and (not coalesce(p_unclaimed,false) or v.accessibility->>'claim_status'='unclaimed')
  order by public.st_distance(v.location,origin),v.id limit 20 offset (current_page-1)*20
 )r;
 return jsonb_build_object('rows',result,'total',total,'page',current_page);
end $function$
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
  where v.status='published'
   and public.st_x(v.location::public.geometry) between -19 and 5
   and public.st_y(v.location::public.geometry) between 27 and 45
 )
 select jsonb_build_object('version',2,'generatedAt',now(),
   'count',jsonb_array_length(rows),'markers',rows) from markers;
$function$
;
CREATE OR REPLACE FUNCTION public.crm_company_list(p_search text DEFAULT ''::text, p_view text DEFAULT 'all'::text, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n integer; rows jsonb;
begin
 if not public.crm_company_access() then raise exception 'Company access denied' using errcode='42501'; end if;
 if p_view not in ('all','unpublished','review','imported','activities','accommodation') or p_offset < 0 or length(p_search)>200 then raise exception 'Invalid filter'; end if;
 select count(*) into n from public.crm_company_records r where workspace_id='ws_akipasa' and deleted_at is null
 and (p_search='' or concat_ws(' ',data->>'name',data->>'city',data->>'address') ilike '%'||p_search||'%')
 and (p_view='all' or p_view='imported' and import_id is not null or p_view='review' and publish_state='skipped'
 or p_view='unpublished' and nullif(data->>'catalogueVenueId','') is null
 or p_view='accommodation' and exists(select 1 from public.crm_catalogue_venues l join public.venues v on v.id=l.venue_id where l.workspace_id=r.workspace_id and l.lead_id=r.id and v.discovery_vertical='accommodation')
 or p_view='activities' and exists(select 1 from public.crm_catalogue_venues l join public.venues v on v.id=l.venue_id where l.workspace_id=r.workspace_id and l.lead_id=r.id and v.discovery_vertical='activities'));
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into rows from (
 select id,data,revision,publish_state,publish_error,
 (select v.discovery_vertical from public.crm_catalogue_venues l join public.venues v on v.id=l.venue_id where l.workspace_id=crm_company_records.workspace_id and l.lead_id=crm_company_records.id limit 1) as discovery_vertical
 from public.crm_company_records
 where workspace_id='ws_akipasa' and deleted_at is null
 and (p_search='' or concat_ws(' ',data->>'name',data->>'city',data->>'address') ilike '%'||p_search||'%')
 and (p_view='all' or p_view='imported' and import_id is not null or p_view='review' and publish_state='skipped'
 or p_view='unpublished' and nullif(data->>'catalogueVenueId','') is null
 or p_view='accommodation' and exists(select 1 from public.crm_catalogue_venues l join public.venues v on v.id=l.venue_id where l.workspace_id=crm_company_records.workspace_id and l.lead_id=crm_company_records.id and v.discovery_vertical='accommodation')
 or p_view='activities' and exists(select 1 from public.crm_catalogue_venues l join public.venues v on v.id=l.venue_id where l.workspace_id=crm_company_records.workspace_id and l.lead_id=crm_company_records.id and v.discovery_vertical='activities'))
 order by seq desc limit 50 offset p_offset) x;
 return jsonb_build_object('total',n,'rows',rows);
end $function$
;

revoke all on function public.public_map_marker_snapshot_v2() from public;
grant execute on function public.public_map_marker_snapshot_v2() to anon,authenticated,service_role;
-- The existing CRM function retains its explicit workspace authorization and grants.

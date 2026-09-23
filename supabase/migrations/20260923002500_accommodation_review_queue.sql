-- Mixed business labels stay in activities until reviewed; no name-only recategorisation.
create table akiduermo.classification_review (
 venue_id uuid primary key references public.venues(id) on delete cascade,
 source_category text, reason text not null,
 status text not null default 'pending' check(status in ('pending','resolved')),
 created_at timestamptz not null default now()
);
alter table akiduermo.classification_review enable row level security;
grant select,insert,update,delete on akiduermo.classification_review to service_role;
CREATE OR REPLACE FUNCTION public.crm_company_list(p_search text DEFAULT ''::text, p_view text DEFAULT 'all'::text, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n integer; rows jsonb;
begin
 if not public.crm_company_access() then raise exception 'Company access denied' using errcode='42501'; end if;
 if p_view not in ('all','unpublished','review','imported','activities','accommodation','accommodation_review') or p_offset < 0 or length(p_search)>200 then raise exception 'Invalid filter'; end if;
 select count(*) into n from public.crm_company_records r where workspace_id='ws_akipasa' and deleted_at is null
 and (p_search='' or concat_ws(' ',data->>'name',data->>'city',data->>'address') ilike '%'||p_search||'%')
 and (p_view='accommodation_review' and exists(select 1 from public.crm_catalogue_venues l join akiduermo.classification_review ar on ar.venue_id=l.venue_id where l.workspace_id=r.workspace_id and l.lead_id=r.id and ar.status='pending') or p_view='all' or p_view='imported' and import_id is not null or p_view='review' and publish_state='skipped'
 or p_view='unpublished' and nullif(data->>'catalogueVenueId','') is null
 or p_view='accommodation' and exists(select 1 from public.crm_catalogue_venues l join public.venues v on v.id=l.venue_id where l.workspace_id=r.workspace_id and l.lead_id=r.id and v.discovery_vertical='accommodation')
 or p_view='activities' and exists(select 1 from public.crm_catalogue_venues l join public.venues v on v.id=l.venue_id where l.workspace_id=r.workspace_id and l.lead_id=r.id and v.discovery_vertical='activities'));
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into rows from (
 select id,data,revision,publish_state,publish_error,
 (select v.discovery_vertical from public.crm_catalogue_venues l join public.venues v on v.id=l.venue_id where l.workspace_id=crm_company_records.workspace_id and l.lead_id=crm_company_records.id limit 1) as discovery_vertical,
 (select jsonb_build_object('reason',ar.reason,'category',ar.source_category) from public.crm_catalogue_venues l join akiduermo.classification_review ar on ar.venue_id=l.venue_id where l.workspace_id=crm_company_records.workspace_id and l.lead_id=crm_company_records.id and ar.status='pending' limit 1) as accommodation_review
 from public.crm_company_records
 where workspace_id='ws_akipasa' and deleted_at is null
 and (p_search='' or concat_ws(' ',data->>'name',data->>'city',data->>'address') ilike '%'||p_search||'%')
 and (p_view='accommodation_review' and exists(select 1 from public.crm_catalogue_venues l join akiduermo.classification_review ar on ar.venue_id=l.venue_id where l.workspace_id=crm_company_records.workspace_id and l.lead_id=crm_company_records.id and ar.status='pending') or p_view='all' or p_view='imported' and import_id is not null or p_view='review' and publish_state='skipped'
 or p_view='unpublished' and nullif(data->>'catalogueVenueId','') is null
 or p_view='accommodation' and exists(select 1 from public.crm_catalogue_venues l join public.venues v on v.id=l.venue_id where l.workspace_id=crm_company_records.workspace_id and l.lead_id=crm_company_records.id and v.discovery_vertical='accommodation')
 or p_view='activities' and exists(select 1 from public.crm_catalogue_venues l join public.venues v on v.id=l.venue_id where l.workspace_id=crm_company_records.workspace_id and l.lead_id=crm_company_records.id and v.discovery_vertical='activities'))
 order by seq desc limit 50 offset p_offset) x;
 return jsonb_build_object('total',n,'rows',rows);
end $function$
;


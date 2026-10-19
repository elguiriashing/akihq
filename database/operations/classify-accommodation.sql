-- Authorized one-off cleanup. Run after loading the original source categories.
-- Existing source IDs are matched exactly; no business data belongs in this file.
begin;
create temporary table accommodation_targets on commit drop as
select distinct v.id,v.discovery_vertical as previous_vertical,v.accommodation_type as previous_type,
 s.accommodation_type,s.category,s.external_id
from public.venues v
join public.crm_catalogue_venues l on l.venue_id=v.id
join public.crm_company_records c on c.workspace_id=l.workspace_id and c.id=l.lead_id and c.deleted_at is null
join akiduermo.source_categories s on s.external_id=coalesce(nullif(c.data->>'externalId',''),c.id)
where s.accommodation_type is not null and v.status='published'
 and v.accessibility->>'claim_status'='unclaimed' and not v.verified
 and v.discovery_vertical='activities'
 and not exists(select 1 from public.venue_members m where m.venue_id=v.id)
 and not exists(select 1 from public.venue_claims cl where cl.venue_id=v.id and cl.status::text in ('pending','approved'));
-- Lock venue rows before updating and recheck ownership after acquiring locks.
select count(*) from (select v.id from public.venues v join accommodation_targets t on t.id=v.id for update of v) locked;
delete from accommodation_targets t where exists(select 1 from public.venue_members m where m.venue_id=t.id)
 or exists(select 1 from public.venue_claims cl where cl.venue_id=t.id and cl.status::text in ('pending','approved'));
insert into akiduermo.classification_audit(venue_id,previous_vertical,previous_type,accommodation_type,evidence)
select id,previous_vertical,previous_type,accommodation_type,jsonb_build_object('method','original_source_category','externalId',external_id,'category',category)
from accommodation_targets on conflict(venue_id) do nothing;
update public.venues v set discovery_vertical='accommodation',accommodation_type=t.accommodation_type,updated_at=now()
from accommodation_targets t where v.id=t.id and v.status='published' and v.accessibility->>'claim_status'='unclaimed' and not v.verified;
insert into akiduermo.company_classification_audit(workspace_id,company_id,previous_fields)
select c.workspace_id,c.id,jsonb_build_object('category',c.data->'category','discoveryVertical',c.data->'discoveryVertical','accommodationType',c.data->'accommodationType')
from public.crm_company_records c join public.crm_catalogue_venues l on l.workspace_id=c.workspace_id and l.lead_id=c.id
join accommodation_targets t on t.id=l.venue_id where c.deleted_at is null
on conflict(workspace_id,company_id) do nothing;
update public.crm_company_records c set data=c.data||jsonb_build_object('category','Accommodation','discoveryVertical','accommodation','accommodationType',t.accommodation_type),revision=c.revision+1,updated_at=now()
from public.crm_catalogue_venues l join accommodation_targets t on t.id=l.venue_id
where c.workspace_id=l.workspace_id and c.id=l.lead_id and c.deleted_at is null;
commit;
select discovery_vertical,count(*) from public.venues group by 1;

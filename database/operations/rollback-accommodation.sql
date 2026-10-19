-- Restore only classifications still matching this operation. Never delete venues.
begin;
update public.venues v set discovery_vertical=a.previous_vertical,accommodation_type=a.previous_type,updated_at=now()
from akiduermo.classification_audit a
where v.id=a.venue_id and v.discovery_vertical='accommodation' and v.accommodation_type=a.accommodation_type;
update public.crm_company_records c set data=(c.data-array['category','discoveryVertical','accommodationType'])||jsonb_strip_nulls(a.previous_fields),revision=c.revision+1,updated_at=now()
from akiduermo.company_classification_audit a
where c.workspace_id=a.workspace_id and c.id=a.company_id and c.data->>'discoveryVertical'='accommodation';
commit;
-- Keep the audit and source tables. Revert application code before dropping columns.

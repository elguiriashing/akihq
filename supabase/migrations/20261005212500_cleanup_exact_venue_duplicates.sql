begin;

-- Archive exact duplicate activity listings that have no user/business data
-- attached. Keep one deterministic survivor and record the relationship in
-- accessibility for auditability.
with ranked as (
  select
    id,
    first_value(id) over (
      partition by public.venue_search_normalize(name),
                   public.venue_search_normalize(coalesce(address,''))
      order by
        (case when accessibility->>'claim_status'='unclaimed' then 0 else 1 end) desc,
        coalesce(verified,false) desc,
        id
    ) as survivor_id,
    row_number() over (
      partition by public.venue_search_normalize(name),
                   public.venue_search_normalize(coalesce(address,''))
      order by
        (case when accessibility->>'claim_status'='unclaimed' then 0 else 1 end) desc,
        coalesce(verified,false) desc,
        id
    ) as rn
  from public.venues
  where status='published'
    and discovery_vertical='activities'
    and coalesce(trim(name),'')<>''
    and coalesce(trim(address),'')<>''
),
safe_dupes as (
  select r.id,r.survivor_id
  from ranked r
  where r.rn>1
    and not exists(select 1 from public.events x where x.venue_id=r.id)
    and not exists(select 1 from public.venue_claims x where x.venue_id=r.id)
    and not exists(select 1 from public.venue_members x where x.venue_id=r.id)
    and not exists(select 1 from public.check_ins x where x.venue_id=r.id)
    and not exists(select 1 from public.followed_venues x where x.venue_id=r.id)
    and not exists(select 1 from public.loyalty_programs x where x.venue_id=r.id)
    and not exists(select 1 from public.offers x where x.venue_id=r.id)
    and not exists(select 1 from public.booking_requests x where x.venue_id=r.id)
)
update public.venues v
set status='archived',
    discovery_enabled=false,
    search_enabled=false,
    map_location_suspect=true,
    accessibility=coalesce(v.accessibility,'{}'::jsonb)
      || jsonb_build_object('duplicate_of',d.survivor_id::text)
from safe_dupes d
where v.id=d.id;

-- Two quarantined records have an exact normalized street address matching one
-- unique non-suspect published venue. Reuse that address-level coordinate.
with reliable as (
  select public.venue_search_normalize(address) addr_key,
         (array_agg(id order by id))[1] source_id
  from public.venues
  where status='published'
    and discovery_vertical='activities'
    and not map_location_suspect
    and coalesce(trim(address),'')<>''
  group by 1
  having count(*)=1
),
repair as (
  select v.id,s.location,s.accessibility->>'address_provider_id' provider_id
  from public.venues v
  join reliable r
    on r.addr_key=public.venue_search_normalize(v.address)
  join public.venues s on s.id=r.source_id
  where v.status='published'
    and v.discovery_vertical='activities'
    and v.map_location_suspect
)
update public.venues v
set location=r.location,
    map_location_suspect=false,
    accessibility=case
      when r.provider_id is null then v.accessibility
      else coalesce(v.accessibility,'{}'::jsonb)
        || jsonb_build_object('address_provider_id',r.provider_id)
    end
from repair r
where v.id=r.id;

commit;

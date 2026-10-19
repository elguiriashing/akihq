begin;

alter table public.venue_location_repairs
  drop constraint if exists venue_location_repairs_status_check;
alter table public.venue_location_repairs
  add constraint venue_location_repairs_status_check
  check (status in ('processing','resolved','unresolved','error'));

create or replace function public.claim_venue_location_repair_batch(
  p_provider text,
  p_limit integer default 100
)
returns table(id uuid, name text, address text)
language plpgsql
security definer
set search_path=''
as $function$
begin
  if p_provider is null or length(trim(p_provider)) < 2
     or p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception 'invalid repair batch parameters';
  end if;

  return query
  with picked as (
    select v.id,v.name,v.address
    from public.venues v
    left join public.venue_location_repairs r on r.venue_id=v.id
    where v.status='published'
      and v.discovery_vertical='activities'
      and v.map_location_suspect
      and coalesce(trim(v.address),'')<>''
      and (
        r.venue_id is null
        or r.provider<>p_provider
        or (r.status='processing' and r.checked_at < now()-interval '30 minutes')
      )
    order by v.id
    for update of v skip locked
    limit p_limit
  ),
  reserved as (
    insert into public.venue_location_repairs(
      venue_id,status,provider,attempted_query,reason,checked_at
    )
    select p.id,'processing',p_provider,p.address,'claimed_for_repair',now()
    from picked p
    on conflict (venue_id) do update
      set status='processing',
          provider=excluded.provider,
          attempted_query=excluded.attempted_query,
          candidate_lat=null,
          candidate_lng=null,
          confidence=null,
          precision=null,
          formatted_address=null,
          reason='claimed_for_repair',
          checked_at=now()
    returning venue_id
  )
  select p.id,p.name,p.address
  from picked p
  join reserved r on r.venue_id=p.id;
end;
$function$;

revoke all on function public.claim_venue_location_repair_batch(text,integer)
  from public,anon,authenticated;
grant execute on function public.claim_venue_location_repair_batch(text,integer)
  to service_role;

commit;

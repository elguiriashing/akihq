begin;
create or replace function public.repair_venue_locations_bulk(p_items jsonb)
returns integer
language plpgsql
security definer
set search_path=''
as $function$
declare item jsonb; changed integer:=0;
begin
  if jsonb_typeof(p_items) <> 'array' then raise exception 'items must be array'; end if;
  for item in select * from jsonb_array_elements(p_items)
  loop
    update public.venues
    set location=public.st_setsrid(
          public.st_makepoint(
            (item->>'lng')::double precision,
            (item->>'lat')::double precision
          ),4326
        )::public.geography,
        map_location_suspect=false,
        accessibility=coalesce(accessibility,'{}'::jsonb)
          || jsonb_build_object(
            'address_provider_id',item->>'provider_id',
            'location_repaired_at',now(),
            'location_repair_provider',split_part(item->>'provider_id',':',1),
            'location_repair_confidence',(item->>'confidence')::numeric,
            'location_repair_precision',item->>'precision'
          )
    where id=(item->>'venue_id')::uuid
      and status='published'
      and map_location_suspect
      and (item->>'lat')::double precision between 27 and 44.5
      and (item->>'lng')::double precision between -19 and 5;
    changed:=changed+found::int;
  end loop;
  return changed;
end;
$function$;
revoke all on function public.repair_venue_locations_bulk(jsonb) from public,anon,authenticated;
grant execute on function public.repair_venue_locations_bulk(jsonb) to service_role;

-- Correct metadata on repairs already performed by CartoCiudad.
update public.venues
set accessibility=jsonb_set(
  coalesce(accessibility,'{}'::jsonb),
  '{location_repair_provider}',
  to_jsonb('cartociudad'::text),
  true
)
where accessibility->>'address_provider_id' like 'cartociudad:%'
  and accessibility->>'location_repair_provider'='mygeocode';

commit;
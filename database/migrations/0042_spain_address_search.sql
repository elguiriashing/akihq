begin;

create or replace function update_venue_location_in_spain(
  p_venue uuid,
  p_locality_name text,
  p_province_name text,
  p_address text,
  p_latitude double precision,
  p_longitude double precision
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_city uuid;
  target_slug text;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not (
    is_venue_member(
      p_venue,
      array['manager','owner']::venue_member_role[]
    )
    or has_platform_role(array['moderator','administrator']::app_role[])
  ) then
    raise exception 'venue management permission required';
  end if;
  if p_latitude not between 27.0 and 44.5
    or p_longitude not between -19.0 and 5.0
    or char_length(trim(coalesce(p_locality_name, ''))) not between 2 and 120
    or char_length(trim(coalesce(p_province_name, ''))) not between 2 and 120
    or char_length(trim(coalesce(p_address, ''))) not between 5 and 300
  then
    raise exception 'invalid Spanish venue location';
  end if;

  target_slug := trim(
    both '-' from regexp_replace(
      lower(unaccent(trim(p_locality_name || '-' || p_province_name))),
      '[^a-z0-9]+',
      '-',
      'g'
    )
  );
  if target_slug = '' then raise exception 'invalid locality slug'; end if;

  insert into cities(id, slug, name_es, name_en, center)
  values(
    gen_random_uuid(),
    target_slug,
    trim(p_locality_name),
    trim(p_locality_name),
    st_setsrid(st_makepoint(p_longitude, p_latitude), 4326)::geography
  )
  on conflict(slug) do update
    set name_es = excluded.name_es,
        name_en = excluded.name_en
  returning id into target_city;

  update venues
  set city_id = target_city,
      address = trim(p_address),
      location = st_setsrid(
        st_makepoint(p_longitude, p_latitude),
        4326
      )::geography,
      updated_at = now()
  where id = p_venue;
  if not found then raise exception 'venue not found'; end if;
end;
$$;

revoke all on function update_venue_location_in_spain(
  uuid,text,text,text,double precision,double precision
) from public;
revoke all on function update_venue_location_in_spain(
  uuid,text,text,text,double precision,double precision
) from anon;
grant execute on function update_venue_location_in_spain(
  uuid,text,text,text,double precision,double precision
) to authenticated;

commit;

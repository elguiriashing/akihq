-- Make Selección AkiPasa publishing reliable for every platform staff/admin
-- account and avoid title/slug collisions when recurring town events share names.

create or replace function public.create_akipasa_selection_event_v2(
  p_category uuid,
  p_slug text,
  p_title_es text,
  p_title_en text,
  p_description_es text,
  p_description_en text,
  p_price_cents integer,
  p_booking_url text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_location_label text,
  p_directions_address text,
  p_latitude double precision,
  p_longitude double precision
)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_id uuid := gen_random_uuid();
  v_actor uuid := auth.uid();
  v_venue constant uuid := 'a1a1a1a1-2026-4000-8000-000000000001'::uuid;
  v_slug text := lower(trim(coalesce(p_slug, '')));
begin
  if v_actor is null or not exists (
    select 1
    from public.profiles
    where id = v_actor
      and app_role = any(
        array['moderator','administrator']::public.app_role[]
      )
  ) then
    raise exception 'staff role required' using errcode='42501';
  end if;

  if p_ends_at <= p_starts_at
    or p_latitude not between 27 and 44.5
    or p_longitude not between -19 and 5
    or char_length(trim(coalesce(p_location_label,''))) not between 2 and 160
    or char_length(trim(coalesce(p_directions_address,''))) > 300
    or char_length(v_slug) < 2
  then
    raise exception 'invalid official event';
  end if;

  -- Event titles such as annual fairs are routinely reused. A global slug
  -- collision should never prevent staff from publishing a valid event.
  if exists (select 1 from public.events where slug = v_slug) then
    v_slug := left(v_slug, 140) || '-' || left(v_id::text, 8);
  end if;

  insert into public.events(
    id,
    venue_id,
    slug,
    title_es,
    title_en,
    description_es,
    description_en,
    category_id,
    price_cents,
    booking_url,
    source,
    status,
    location,
    location_label,
    directions_address
  )
  values(
    v_id,
    v_venue,
    v_slug,
    trim(p_title_es),
    nullif(trim(p_title_en),''),
    trim(p_description_es),
    nullif(trim(p_description_en),''),
    p_category,
    greatest(p_price_cents,0),
    nullif(trim(p_booking_url),''),
    'akipasa_selection',
    'published',
    public.st_setsrid(
      public.st_makepoint(p_longitude,p_latitude),
      4326
    )::public.geography,
    trim(p_location_label),
    nullif(trim(p_directions_address),'')
  );

  insert into public.event_occurrences(id,event_id,starts_at,ends_at)
  values(gen_random_uuid(),v_id,p_starts_at,p_ends_at);

  return v_id;
end;
$function$;

revoke all on function public.create_akipasa_selection_event_v2(
  uuid,text,text,text,text,text,integer,text,timestamptz,timestamptz,text,text,double precision,double precision
) from public,anon;

grant execute on function public.create_akipasa_selection_event_v2(
  uuid,text,text,text,text,text,integer,text,timestamptz,timestamptz,text,text,double precision,double precision
) to authenticated;

begin;

create or replace function promote_launch_catalogue(p_owner_email text)
returns table(venues_added integer, events_added integer, memberships_added integer)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  owner_id uuid;
  venue_count integer;
  event_count integer;
  membership_count integer;
begin
  if current_user not in ('postgres', 'supabase_admin')
    and coalesce(auth.role(), '') <> 'service_role'
  then
    raise exception 'service role required';
  end if;

  select id into owner_id
  from auth.users
  where lower(email) = lower(trim(p_owner_email))
  limit 1;

  if owner_id is null then raise exception 'owner account not found'; end if;

  insert into categories(id,slug,name_es,name_en) values
    ('20000000-0000-4000-8000-000000000001','music','Musica','Music'),
    ('20000000-0000-4000-8000-000000000002','social','Social','Social'),
    ('20000000-0000-4000-8000-000000000003','workshop','Taller','Workshop'),
    ('20000000-0000-4000-8000-000000000004','culture','Cultura','Culture'),
    ('20000000-0000-4000-8000-000000000005','market','Mercado','Market'),
    ('20000000-0000-4000-8000-000000000006','food','Gastronomia','Food')
  on conflict (slug) do update
  set name_es=excluded.name_es,name_en=excluded.name_en;

  insert into cities(id,slug,name_es,name_en,center,timezone) values
    ('a0000000-0000-4000-8000-000000000001','fuengirola','Fuengirola','Fuengirola',st_setsrid(st_makepoint(-4.624,36.539),4326)::geography,'Europe/Madrid'),
    ('a0000000-0000-4000-8000-000000000002','boliches','Los Boliches','Los Boliches',st_setsrid(st_makepoint(-4.614,36.552),4326)::geography,'Europe/Madrid'),
    ('a0000000-0000-4000-8000-000000000003','carvajal','Carvajal','Carvajal',st_setsrid(st_makepoint(-4.596,36.568),4326)::geography,'Europe/Madrid'),
    ('a0000000-0000-4000-8000-000000000004','madrid','Madrid','Madrid',st_setsrid(st_makepoint(-3.706,40.421),4326)::geography,'Europe/Madrid'),
    ('a0000000-0000-4000-8000-000000000005','barcelona','Barcelona','Barcelona',st_setsrid(st_makepoint(2.177,41.392),4326)::geography,'Europe/Madrid'),
    ('a0000000-0000-4000-8000-000000000006','valencia','Valencia','Valencia',st_setsrid(st_makepoint(-0.384,39.476),4326)::geography,'Europe/Madrid'),
    ('a0000000-0000-4000-8000-000000000007','sevilla','Sevilla','Seville',st_setsrid(st_makepoint(-5.993,37.399),4326)::geography,'Europe/Madrid'),
    ('a0000000-0000-4000-8000-000000000008','bilbao','Bilbao','Bilbao',st_setsrid(st_makepoint(-2.929,43.267),4326)::geography,'Europe/Madrid'),
    ('a0000000-0000-4000-8000-000000000009','palma','Palma','Palma',st_setsrid(st_makepoint(2.646,39.572),4326)::geography,'Europe/Madrid')
  on conflict (slug) do update
  set name_es=excluded.name_es,
      name_en=excluded.name_en,
      center=excluded.center,
      timezone=excluded.timezone;

  insert into venues(
    id,city_id,slug,name,description_es,description_en,address,location,
    verified,accessibility,status
  )
  select
    source.id,
    cities.id,
    source.slug,
    source.name,
    source.description_es,
    source.description_en,
    source.address,
    st_setsrid(
      st_makepoint(source.longitude,source.latitude),
      4326
    )::geography,
    source.verified,
    jsonb_build_object('step_free',source.step_free),
    'published'::content_status
  from (values
    ('a1000000-0000-4000-8000-000000000001'::uuid,'fuengirola','la-salina-social','La Salina Social','Registro historico de musica y cultura junto al paseo.','Historical music and culture record near the promenade.','Paseo Maritimo, zona centro',-4.622,36.5405,true,true),
    ('a1000000-0000-4000-8000-000000000002'::uuid,'boliches','patio-limon','Patio Limon','Registro historico de cafe con talleres y encuentros.','Historical cafe record for workshops and meetups.','Calle del Mercado',-4.614,36.552,true,true),
    ('a1000000-0000-4000-8000-000000000003'::uuid,'carvajal','el-faro-lab','El Faro Lab','Registro creativo historico en Carvajal.','Historical creative-space record in Carvajal.','Avenida del Sol',-4.596,36.568,false,false),
    ('a1000000-0000-4000-8000-000000000004'::uuid,'madrid','azotea-cobalto','Azotea Cobalto','Registro cultural historico en Madrid.','Historical cultural-venue record in Madrid.','Calle de la Luna, Madrid',-3.706,40.421,true,true),
    ('a1000000-0000-4000-8000-000000000005'::uuid,'barcelona','taller-mar-blau','Taller Mar Blau','Registro creativo historico en Barcelona.','Historical creative-workshop record in Barcelona.','Carrer de la Marina, Barcelona',2.177,41.392,true,true),
    ('a1000000-0000-4000-8000-000000000006'::uuid,'valencia','patio-turia','Patio Turia','Registro gastronomico historico en Valencia.','Historical food-courtyard record in Valencia.','Carrer del Turia, Valencia',-0.384,39.476,true,true),
    ('a1000000-0000-4000-8000-000000000007'::uuid,'sevilla','corral-naranja','Corral Naranja','Registro vecinal historico en Sevilla.','Historical neighbourhood-stage record in Seville.','Alameda, Sevilla',-5.993,37.399,true,false),
    ('a1000000-0000-4000-8000-000000000008'::uuid,'bilbao','ria-sonora','Ria Sonora','Registro musical historico en Bilbao.','Historical music-room record in Bilbao.','Muelle de la Ria, Bilbao',-2.929,43.267,true,true),
    ('a1000000-0000-4000-8000-000000000009'::uuid,'palma','illa-oberta','Illa Oberta','Registro social historico en Palma.','Historical social-venue record in Palma.','Carrer de la Mar, Palma',2.646,39.572,true,true)
  ) as source(id,city_slug,slug,name,description_es,description_en,address,longitude,latitude,verified,step_free)
  join cities on cities.slug=source.city_slug
  on conflict (slug) do nothing;
  get diagnostics venue_count = row_count;

  insert into venue_members(venue_id,profile_id,role)
  select id,owner_id,'owner'::venue_member_role
  from venues
  where slug in (
    'la-salina-social','patio-limon','el-faro-lab','azotea-cobalto',
    'taller-mar-blau','patio-turia','corral-naranja','ria-sonora','illa-oberta'
  )
  on conflict (venue_id,profile_id) do update set role='owner';
  get diagnostics membership_count = row_count;

  insert into events(
    id,venue_id,slug,title_es,title_en,description_es,description_en,
    category_id,price_cents,currency,source,sponsored,booking_url,status
  )
  select
    source.id,
    venues.id,
    source.slug,
    source.title_es,
    source.title_en,
    source.description_es,
    source.description_en,
    categories.id,
    source.price_cents,
    'EUR',
    source.event_source,
    source.sponsored,
    source.booking_url,
    'published'::content_status
  from (values
    ('a3000000-0000-4000-8000-000000000001'::uuid,'la-salina-social','atardecer-jazz','Jazz al atardecer','Sunset jazz','Registro historico de una sesion acustica.','Historical acoustic-session record.','music',0,'verified_venue',false,null),
    ('a3000000-0000-4000-8000-000000000002'::uuid,'patio-limon','quiz-bilingue','Quiz bilingue','Bilingual quiz','Preguntas en espanol e ingles, sin premio en efectivo.','Questions in Spanish and English, with no cash prize.','social',500,'verified_venue',false,null),
    ('a3000000-0000-4000-8000-000000000003'::uuid,'el-faro-lab','taller-carteles','Taller de carteles','Poster workshop','Actividad comunitaria pendiente de verificacion.','Community activity awaiting verification.','workshop',1200,'community',false,null),
    ('a3000000-0000-4000-8000-000000000004'::uuid,'azotea-cobalto','cine-cobalto','Cine bajo las estrellas','Cinema under the stars','Registro historico de una proyeccion con coloquio.','Historical screening record with a discussion.','culture',800,'verified_venue',false,null),
    ('a3000000-0000-4000-8000-000000000005'::uuid,'taller-mar-blau','mercado-diseno-local','Mercado de diseno local','Local design market','Registro historico de una muestra de diseno independiente.','Historical independent-design record.','market',0,'verified_venue',false,null),
    ('a3000000-0000-4000-8000-000000000006'::uuid,'patio-turia','ruta-tapas-turia','Ruta de tapas del Turia','Turia tapas trail','Registro historico de un encuentro gastronomico.','Historical food-gathering record.','food',1500,'verified_venue',true,null),
    ('a3000000-0000-4000-8000-000000000007'::uuid,'corral-naranja','patio-flamenco-abierto','Patio flamenco abierto','Open flamenco courtyard','Registro historico de artistas emergentes.','Historical emerging-artist record.','music',1000,'verified_venue',false,null),
    ('a3000000-0000-4000-8000-000000000008'::uuid,'ria-sonora','ria-en-directo','La ria en directo','Live by the river','Registro historico de grupos locales.','Historical local-band record.','music',0,'verified_venue',false,null),
    ('a3000000-0000-4000-8000-000000000009'::uuid,'illa-oberta','intercambio-illa','Intercambio de idiomas','Language exchange','Registro historico de un encuentro social gratuito.','Historical free social-meetup record.','social',0,'verified_venue',false,null)
  ) as source(id,venue_slug,slug,title_es,title_en,description_es,description_en,category_slug,price_cents,event_source,sponsored,booking_url)
  join venues on venues.slug=source.venue_slug
  join categories on categories.slug=source.category_slug
  on conflict (slug) do nothing;
  get diagnostics event_count = row_count;

  with schedules(event_slug,day_offset,start_hour,duration_hours) as (
    values
      ('atardecer-jazz',1,19,2),
      ('quiz-bilingue',1,20,2),
      ('taller-carteles',2,18,3),
      ('cine-cobalto',1,21,2),
      ('mercado-diseno-local',2,11,5),
      ('ruta-tapas-turia',2,13,3),
      ('patio-flamenco-abierto',1,20,2),
      ('ria-en-directo',2,19,3),
      ('intercambio-illa',1,19,2)
  ),
  occurrences as (
    select
      events.id as event_id,
      (
        date_trunc('day',now() at time zone 'Europe/Madrid')
        + make_interval(days => schedules.day_offset + series.week_number * 7)
        + make_interval(hours => schedules.start_hour)
      ) at time zone 'Europe/Madrid' as starts_at,
      schedules.duration_hours
    from schedules
    join events on events.slug=schedules.event_slug
    cross join generate_series(0,7) as series(week_number)
  )
  insert into event_occurrences(id,event_id,starts_at,ends_at,status)
  select
    gen_random_uuid(),
    occurrences.event_id,
    occurrences.starts_at,
    occurrences.starts_at + make_interval(hours => occurrences.duration_hours),
    'scheduled'::occurrence_status
  from occurrences
  where not exists (
    select 1
    from event_occurrences existing
    where existing.event_id=occurrences.event_id
      and existing.starts_at=occurrences.starts_at
  );

  return query select venue_count,event_count,membership_count;
end;
$$;

revoke all on function promote_launch_catalogue(text) from public;
grant execute on function promote_launch_catalogue(text) to service_role;

commit;

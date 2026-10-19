begin;

create table saved_event_refs (
  profile_id uuid not null references profiles(id) on delete cascade,
  event_key text not null check (char_length(event_key) between 2 and 160),
  title text not null check (char_length(title) between 2 and 200),
  href text not null check (href ~ '^/(es|en)/events/'),
  created_at timestamptz not null default now(),
  primary key (profile_id, event_key)
);

create table followed_venue_refs (
  profile_id uuid not null references profiles(id) on delete cascade,
  venue_key text not null check (char_length(venue_key) between 2 and 160),
  name text not null check (char_length(name) between 2 and 200),
  href text not null check (href ~ '^/(es|en)/venues/'),
  created_at timestamptz not null default now(),
  primary key (profile_id, venue_key)
);

create type deletion_request_state as enum ('requested','processing','completed','cancelled');
create table account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  state deletion_request_state not null default 'requested',
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(profile_id, state)
);

alter table saved_event_refs enable row level security;
alter table followed_venue_refs enable row level security;
alter table account_deletion_requests enable row level security;
create policy saved_event_refs_own on saved_event_refs for all using (profile_id=auth.uid()) with check (profile_id=auth.uid());
create policy followed_venue_refs_own on followed_venue_refs for all using (profile_id=auth.uid()) with check (profile_id=auth.uid());
create policy deletion_requests_create on account_deletion_requests for insert with check (profile_id=auth.uid());
create policy deletion_requests_read on account_deletion_requests for select using (profile_id=auth.uid() or has_platform_role(array['administrator']::app_role[]));

create or replace function create_owned_venue_in_spain(
  locality_name text, province_name text, venue_name text, venue_slug text,
  description_es text, description_en text, venue_address text,
  latitude double precision, longitude double precision
) returns uuid language plpgsql security definer set search_path = public
as $$
declare
  new_id uuid := gen_random_uuid();
  city_id uuid;
  city_slug text;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if latitude not between 27.0 and 44.5 or longitude not between -19.0 and 5.0 then raise exception 'coordinates must be in Spain'; end if;
  if char_length(trim(locality_name)) < 2 or char_length(trim(venue_name)) < 2 then raise exception 'invalid locality or venue'; end if;
  city_slug := trim(both '-' from regexp_replace(lower(unaccent(trim(locality_name || '-' || province_name))), '[^a-z0-9]+', '-', 'g'));
  insert into cities(id,slug,name_es,name_en,center)
  values(gen_random_uuid(),city_slug,trim(locality_name),trim(locality_name),st_setsrid(st_makepoint(longitude,latitude),4326)::geography)
  on conflict(slug) do update set name_es=excluded.name_es
  returning id into city_id;
  insert into venues(id,city_id,slug,name,description_es,description_en,address,location,status)
  values(new_id,city_id,lower(trim(venue_slug)),trim(venue_name),trim(description_es),nullif(trim(description_en),''),trim(venue_address),st_setsrid(st_makepoint(longitude,latitude),4326)::geography,'pending');
  insert into venue_members(venue_id,profile_id,role) values(new_id,auth.uid(),'owner');
  return new_id;
end;
$$;

create extension if not exists unaccent;
grant execute on function create_owned_venue_in_spain(text,text,text,text,text,text,text,double precision,double precision) to authenticated;
revoke execute on function create_owned_venue_in_spain(text,text,text,text,text,text,text,double precision,double precision) from anon;

commit;

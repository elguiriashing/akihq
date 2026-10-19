begin;

create type app_role as enum ('consumer','organiser','moderator','administrator');
create type venue_member_role as enum ('editor','manager','owner');
create type claim_status as enum ('pending','approved','rejected');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  preferred_locale text not null default 'es' check (preferred_locale in ('es','en')),
  app_role app_role not null default 'consumer',
  terms_version text,
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table venue_members (
  venue_id uuid not null references venues(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  role venue_member_role not null,
  created_at timestamptz not null default now(),
  primary key (venue_id, profile_id)
);

create table venue_claims (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references venues(id) on delete cascade,
  claimant_id uuid not null references profiles(id) on delete cascade,
  evidence text not null check (char_length(evidence) between 20 and 2000),
  status claim_status not null default 'pending',
  decided_by uuid references profiles(id),
  decision_reason text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table venue_media (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references venues(id) on delete cascade,
  storage_path text unique not null,
  alt_es text not null check (char_length(alt_es) between 3 and 300),
  alt_en text,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  sort_order integer not null default 0,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into profiles(id, display_name, preferred_locale)
  values (new.id, nullif(new.raw_user_meta_data->>'display_name',''), coalesce(nullif(new.raw_user_meta_data->>'preferred_locale',''),'es'))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users for each row execute function handle_new_user();

create or replace function is_venue_member(target_venue uuid, allowed_roles venue_member_role[] default array['editor','manager','owner']::venue_member_role[])
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from venue_members where venue_id=target_venue and profile_id=auth.uid() and role=any(allowed_roles)); $$;

create or replace function has_platform_role(allowed_roles app_role[])
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from profiles where id=auth.uid() and app_role=any(allowed_roles)); $$;

create or replace function current_app_role()
returns app_role language sql stable security definer set search_path = public
as $$ select app_role from profiles where id=auth.uid(); $$;

create or replace function create_owned_venue(
  city uuid, venue_name text, venue_slug text, description_es text, description_en text,
  venue_address text, latitude double precision, longitude double precision
) returns uuid language plpgsql security definer set search_path = public
as $$
declare new_id uuid := gen_random_uuid();
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if char_length(trim(venue_name)) < 2 or char_length(trim(venue_slug)) < 2 then raise exception 'invalid venue'; end if;
  insert into venues(id,city_id,slug,name,description_es,description_en,address,location,status)
  values(new_id,city,lower(trim(venue_slug)),trim(venue_name),trim(description_es),nullif(trim(description_en),''),trim(venue_address),st_setsrid(st_makepoint(longitude,latitude),4326)::geography,'pending');
  insert into venue_members(venue_id,profile_id,role) values(new_id,auth.uid(),'owner');
  return new_id;
end;
$$;

create or replace function create_event_with_occurrence(
  target_venue uuid, category uuid, event_slug text, title_es text, title_en text,
  description_es text, description_en text, price_cents integer, booking_url text,
  starts_at timestamptz, ends_at timestamptz
) returns uuid language plpgsql security definer set search_path = public
as $$
declare new_id uuid := gen_random_uuid(); trusted boolean;
begin
  if not is_venue_member(target_venue) then raise exception 'venue membership required'; end if;
  if ends_at <= starts_at then raise exception 'invalid occurrence time'; end if;
  select verified into trusted from venues where id=target_venue;
  insert into events(id,venue_id,slug,title_es,title_en,description_es,description_en,category_id,price_cents,booking_url,source,status)
  values(new_id,target_venue,lower(trim(event_slug)),trim(title_es),nullif(trim(title_en),''),trim(description_es),nullif(trim(description_en),''),category,greatest(price_cents,0),nullif(trim(booking_url),''),'verified_venue',case when trusted then 'published'::content_status else 'pending'::content_status end);
  insert into event_occurrences(id,event_id,starts_at,ends_at) values(gen_random_uuid(),new_id,starts_at,ends_at);
  return new_id;
end;
$$;

alter table profiles enable row level security;
alter table venue_members enable row level security;
alter table venue_claims enable row level security;
alter table venue_media enable row level security;

create policy profiles_read_self on profiles for select using (id=auth.uid() or has_platform_role(array['moderator','administrator']::app_role[]));
create policy profiles_update_self on profiles for update using (id=auth.uid()) with check (id=auth.uid() and app_role=current_app_role());

create policy cities_public_read on cities for select using (true);
create policy categories_public_read on categories for select using (true);
create policy venues_public_or_member_read on venues for select using (status='published' or is_venue_member(id) or has_platform_role(array['moderator','administrator']::app_role[]));
create policy venues_member_update on venues for update using (is_venue_member(id,array['manager','owner']::venue_member_role[])) with check (is_venue_member(id,array['manager','owner']::venue_member_role[]));
create policy venue_members_read on venue_members for select using (profile_id=auth.uid() or is_venue_member(venue_id,array['manager','owner']::venue_member_role[]) or has_platform_role(array['moderator','administrator']::app_role[]));
create policy venue_members_manage on venue_members for all using (is_venue_member(venue_id,array['owner']::venue_member_role[])) with check (is_venue_member(venue_id,array['owner']::venue_member_role[]));
create policy venue_claims_create on venue_claims for insert with check (claimant_id=auth.uid());
create policy venue_claims_read on venue_claims for select using (claimant_id=auth.uid() or has_platform_role(array['moderator','administrator']::app_role[]));
create policy venue_media_read on venue_media for select using (exists(select 1 from venues v where v.id=venue_id and (v.status='published' or is_venue_member(v.id))));
create policy venue_media_manage on venue_media for all using (is_venue_member(venue_id)) with check (is_venue_member(venue_id) and created_by=auth.uid());

create policy events_public_or_member_read on events for select using (status='published' or is_venue_member(venue_id) or has_platform_role(array['moderator','administrator']::app_role[]));
create policy events_member_insert on events for insert with check (is_venue_member(venue_id) and (status in ('draft','pending') or exists(select 1 from venues v where v.id=venue_id and v.verified)));
create policy events_member_update on events for update using (is_venue_member(venue_id)) with check (is_venue_member(venue_id));
create policy events_member_delete on events for delete using (is_venue_member(venue_id,array['manager','owner']::venue_member_role[]));
create policy occurrences_visible on event_occurrences for select using (exists(select 1 from events e where e.id=event_id and (e.status='published' or is_venue_member(e.venue_id))));
create policy occurrences_manage on event_occurrences for all using (exists(select 1 from events e where e.id=event_id and is_venue_member(e.venue_id))) with check (exists(select 1 from events e where e.id=event_id and is_venue_member(e.venue_id)));
create policy recurrence_visible on recurrence_rules for select using (exists(select 1 from events e where e.id=event_id and (e.status='published' or is_venue_member(e.venue_id))));
create policy recurrence_manage on recurrence_rules for all using (exists(select 1 from events e where e.id=event_id and is_venue_member(e.venue_id))) with check (exists(select 1 from events e where e.id=event_id and is_venue_member(e.venue_id)));
create policy offers_visible on offers for select using (status='published' or is_venue_member(venue_id));
create policy offers_manage on offers for all using (is_venue_member(venue_id)) with check (is_venue_member(venue_id));

create policy event_media_member_insert on storage.objects for insert to authenticated with check (bucket_id='event-media' and is_venue_member((storage.foldername(name))[1]::uuid));
create policy event_media_member_update on storage.objects for update to authenticated using (bucket_id='event-media' and is_venue_member((storage.foldername(name))[1]::uuid));
create policy event_media_member_delete on storage.objects for delete to authenticated using (bucket_id='event-media' and is_venue_member((storage.foldername(name))[1]::uuid));

grant execute on function create_owned_venue(uuid,text,text,text,text,text,double precision,double precision) to authenticated;
revoke execute on function create_owned_venue(uuid,text,text,text,text,text,double precision,double precision) from anon;
grant execute on function create_event_with_occurrence(uuid,uuid,text,text,text,text,text,integer,text,timestamptz,timestamptz) to authenticated;
revoke execute on function create_event_with_occurrence(uuid,uuid,text,text,text,text,text,integer,text,timestamptz,timestamptz) from anon;

commit;

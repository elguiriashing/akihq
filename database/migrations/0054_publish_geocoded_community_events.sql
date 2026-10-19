begin;

alter table event_submissions
  add column if not exists category_id uuid references categories(id),
  add column if not exists locality_name text,
  add column if not exists province_name text,
  add column if not exists postal_code text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists address_provider_id text,
  add column if not exists published_event_id uuid references events(id),
  add column if not exists published_venue_id uuid references venues(id);

alter table event_submissions
  drop constraint if exists event_submissions_coordinate_pair_check;
alter table event_submissions
  add constraint event_submissions_coordinate_pair_check check (
    (latitude is null and longitude is null)
    or (latitude between 27.0 and 44.5 and longitude between -19.0 and 5.0)
  );

drop function if exists submit_community_event(
  text,text,text,text,timestamptz,timestamptz,text
);

create function submit_community_event(
  p_venue_name text,
  p_venue_address text,
  p_address_provider_id text,
  p_locality_name text,
  p_province_name text,
  p_postal_code text,
  p_latitude double precision,
  p_longitude double precision,
  p_category_id uuid,
  p_event_title text,
  p_event_description text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_source_url text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid := gen_random_uuid();
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_ends_at <= p_starts_at then raise exception 'invalid occurrence time'; end if;
  if p_latitude not between 27.0 and 44.5
    or p_longitude not between -19.0 and 5.0
    or char_length(trim(coalesce(p_locality_name, ''))) not between 2 and 120
    or char_length(trim(coalesce(p_province_name, ''))) not between 2 and 120
    or char_length(trim(coalesce(p_venue_address, ''))) not between 5 and 300
    or char_length(trim(coalesce(p_address_provider_id, ''))) not between 1 and 160
  then
    raise exception 'invalid Spanish event location';
  end if;
  if not exists(select 1 from categories where id = p_category_id) then
    raise exception 'invalid event category';
  end if;

  insert into event_submissions(
    id,submitter_id,venue_name,venue_address,title,description,
    category_id,locality_name,province_name,postal_code,latitude,longitude,
    address_provider_id,starts_at,ends_at,source_url
  ) values(
    new_id,auth.uid(),trim(p_venue_name),trim(p_venue_address),
    trim(p_event_title),trim(p_event_description),p_category_id,
    trim(p_locality_name),trim(p_province_name),nullif(trim(p_postal_code),''),
    p_latitude,p_longitude,trim(p_address_provider_id),p_starts_at,p_ends_at,
    nullif(trim(p_source_url),'')
  );
  return new_id;
end;
$$;

create or replace function publish_community_submission(p_submission_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  submission event_submissions%rowtype;
  target_city uuid;
  target_venue uuid;
  target_event uuid;
  city_slug text;
  venue_slug text;
  event_slug text;
  event_point geography(point,4326);
begin
  select * into submission
  from event_submissions
  where id = p_submission_id
  for update;
  if not found then raise exception 'submission not found'; end if;
  if submission.state <> 'approved' then raise exception 'submission not approved'; end if;
  if submission.published_event_id is not null then return submission.published_event_id; end if;
  if submission.category_id is null
    or submission.latitude is null
    or submission.longitude is null
    or submission.locality_name is null
    or submission.province_name is null
  then
    raise exception 'submission location and category are required';
  end if;

  event_point := st_setsrid(
    st_makepoint(submission.longitude, submission.latitude), 4326
  )::geography;
  city_slug := trim(both '-' from regexp_replace(
    lower(unaccent(trim(submission.locality_name || '-' || submission.province_name))),
    '[^a-z0-9]+', '-', 'g'
  ));
  if city_slug = '' then raise exception 'invalid locality slug'; end if;

  insert into cities(id,slug,name_es,name_en,center)
  values(
    gen_random_uuid(),city_slug,trim(submission.locality_name),
    trim(submission.locality_name),event_point
  )
  on conflict(slug) do update
    set name_es=excluded.name_es, name_en=excluded.name_en
  returning id into target_city;

  select id into target_venue
  from venues
  where status='published'
    and lower(name)=lower(submission.venue_name)
    and st_dwithin(location,event_point,75)
  order by verified desc, created_at
  limit 1;

  if target_venue is null then
    target_venue := gen_random_uuid();
    venue_slug := 'community-' || trim(both '-' from regexp_replace(
      lower(unaccent(submission.venue_name)), '[^a-z0-9]+', '-', 'g'
    )) || '-' || left(replace(target_venue::text,'-',''),8);
    insert into venues(
      id,city_id,slug,name,description_es,description_en,address,location,
      verified,status
    ) values(
      target_venue,target_city,venue_slug,submission.venue_name,
      submission.description,submission.description,submission.venue_address,
      event_point,false,'published'
    );
  end if;

  target_event := gen_random_uuid();
  event_slug := 'community-' || trim(both '-' from regexp_replace(
    lower(unaccent(submission.title)), '[^a-z0-9]+', '-', 'g'
  )) || '-' || left(replace(target_event::text,'-',''),8);
  insert into events(
    id,venue_id,slug,title_es,title_en,description_es,description_en,
    category_id,price_cents,currency,source,sponsored,booking_url,status
  ) values(
    target_event,target_venue,event_slug,submission.title,submission.title,
    submission.description,submission.description,submission.category_id,
    0,'EUR','community',false,submission.source_url,'published'
  );
  insert into event_occurrences(
    id,event_id,starts_at,ends_at,status,booking_url
  ) values(
    gen_random_uuid(),target_event,submission.starts_at,submission.ends_at,
    'scheduled',submission.source_url
  );
  update event_submissions
  set published_event_id=target_event,published_venue_id=target_venue
  where id=submission.id;
  return target_event;
end;
$$;

create or replace function moderate_item(
  target_type text,
  target_id uuid,
  decision text,
  reason text,
  p_duplicate_of uuid default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item_changed boolean := false;
begin
  if not has_platform_role(array['moderator','administrator']::app_role[]) then
    raise exception 'moderator role required';
  end if;
  if char_length(trim(reason)) < 3 then raise exception 'reason required'; end if;

  if target_type = 'submission' then
    if decision not in ('approved','rejected') then raise exception 'invalid decision'; end if;
    update event_submissions
    set state=decision::moderation_state,
      duplicate_of=p_duplicate_of,
      published_event_id=case when decision='approved' then p_duplicate_of else null end,
      reviewed_by=auth.uid(),review_reason=trim(reason),reviewed_at=now()
    where id=target_id and state='pending';
    item_changed := found;
    if item_changed and decision='approved' and p_duplicate_of is null then
      perform publish_community_submission(target_id);
    end if;
  elsif target_type = 'venue' then
    if decision not in ('published','rejected') then raise exception 'invalid decision'; end if;
    update venues set status=decision::content_status,
      verified=(decision='published'),updated_at=now()
    where id=target_id and status='pending';
    item_changed := found;
  elsif target_type = 'event' then
    if decision not in ('published','rejected') then raise exception 'invalid decision'; end if;
    update events set status=decision::content_status,updated_at=now()
    where id=target_id and status='pending';
    item_changed := found;
  elsif target_type = 'offer' then
    if decision not in ('published','rejected') then raise exception 'invalid decision'; end if;
    update offers set status=decision::content_status
    where id=target_id and status='pending';
    item_changed := found;
  elsif target_type = 'venue_claim' then
    if decision not in ('approved','rejected') then raise exception 'invalid decision'; end if;
    update venue_claims set status=decision::claim_status,decided_by=auth.uid(),
      decision_reason=trim(reason),decided_at=now()
    where id=target_id and status='pending';
    item_changed := found;
    if item_changed and decision='approved' then
      insert into venue_members(venue_id,profile_id,role)
      select venue_id,claimant_id,'owner'::venue_member_role
      from venue_claims where id=target_id
      on conflict (venue_id,profile_id) do update set role='owner';
      update venues set verified=true,status='published',updated_at=now()
      where id=(select venue_id from venue_claims where id=target_id);
    end if;
  else
    raise exception 'invalid target type';
  end if;

  if not item_changed then raise exception 'item not pending or not found'; end if;
  insert into moderation_actions(actor_id,action,target_type,target_id,reason,metadata)
  values(auth.uid(),decision,target_type,target_id,trim(reason),
    jsonb_build_object('duplicate_of',p_duplicate_of));
end;
$$;

revoke all on function submit_community_event(
  text,text,text,text,text,text,double precision,double precision,uuid,
  text,text,timestamptz,timestamptz,text
) from public;
revoke all on function submit_community_event(
  text,text,text,text,text,text,double precision,double precision,uuid,
  text,text,timestamptz,timestamptz,text
) from anon;
grant execute on function submit_community_event(
  text,text,text,text,text,text,double precision,double precision,uuid,
  text,text,timestamptz,timestamptz,text
) to authenticated;
revoke all on function publish_community_submission(uuid) from public;
revoke all on function publish_community_submission(uuid) from anon, authenticated;
revoke all on function moderate_item(text,uuid,text,text,uuid) from public;
grant execute on function moderate_item(text,uuid,text,text,uuid) to authenticated;

commit;

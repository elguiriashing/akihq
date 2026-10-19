begin;

create or replace function duplicate_owned_event(p_event uuid,p_slug text)
returns uuid language plpgsql security definer set search_path=public
as $$
declare v_event events%rowtype; v_new uuid:=gen_random_uuid();
begin
  select * into v_event from events where id=p_event;
  if v_event.id is null or not is_venue_member(v_event.venue_id) then raise exception 'event access required'; end if;
  if p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'invalid slug'; end if;
  insert into events(id,venue_id,slug,title_es,title_en,description_es,description_en,category_id,price_cents,currency,source,sponsored,booking_url,status)
  values(v_new,v_event.venue_id,p_slug,v_event.title_es||' (copia)',v_event.title_en,v_event.description_es,v_event.description_en,v_event.category_id,v_event.price_cents,v_event.currency,v_event.source,false,v_event.booking_url,'draft');
  insert into event_occurrences(id,event_id,starts_at,ends_at,status,booking_url)
  select gen_random_uuid(),v_new,starts_at+interval '7 days',ends_at+interval '7 days','scheduled',booking_url from event_occurrences where event_id=p_event;
  return v_new;
end;
$$;

create or replace function add_owned_event_occurrence(p_event uuid,p_starts timestamptz,p_ends timestamptz)
returns uuid language plpgsql security definer set search_path=public
as $$
declare v_venue uuid; v_id uuid:=gen_random_uuid();
begin
  select venue_id into v_venue from events where id=p_event;
  if v_venue is null or not is_venue_member(v_venue) then raise exception 'event access required'; end if;
  if p_ends<=p_starts then raise exception 'invalid occurrence time'; end if;
  insert into event_occurrences(id,event_id,starts_at,ends_at) values(v_id,p_event,p_starts,p_ends);
  return v_id;
end;
$$;

create or replace function add_venue_member(p_venue uuid,p_profile uuid,p_role venue_member_role)
returns void language plpgsql security definer set search_path=public
as $$
begin
  if not is_venue_member(p_venue,array['owner']::venue_member_role[]) then raise exception 'venue owner required'; end if;
  if p_role='owner' then raise exception 'ownership transfer requires administrator review'; end if;
  insert into venue_members(venue_id,profile_id,role) values(p_venue,p_profile,p_role)
  on conflict(venue_id,profile_id) do update set role=excluded.role;
end;
$$;

grant execute on function duplicate_owned_event(uuid,text) to authenticated;
grant execute on function add_owned_event_occurrence(uuid,timestamptz,timestamptz) to authenticated;
grant execute on function add_venue_member(uuid,uuid,venue_member_role) to authenticated;
revoke execute on function duplicate_owned_event(uuid,text) from anon;
revoke execute on function add_owned_event_occurrence(uuid,timestamptz,timestamptz) from anon;
revoke execute on function add_venue_member(uuid,uuid,venue_member_role) from anon;

commit;

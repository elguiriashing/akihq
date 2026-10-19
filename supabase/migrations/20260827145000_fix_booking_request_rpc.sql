begin;
create or replace function request_booking(p_slot uuid,p_event uuid,p_party_size integer,p_name text,p_email text,p_phone text,p_notes text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_profile uuid:=auth.uid();v_slot venue_availability_slots%rowtype;v_venue uuid;v_booked integer;v_id uuid;
begin
 if v_profile is null then raise exception 'authentication required';end if;
 if p_party_size not between 1 and 100 or char_length(trim(p_name)) not between 2 and 120 or position('@' in p_email)<2 then raise exception 'invalid booking details';end if;
 select * into v_slot from venue_availability_slots where id=p_slot and active and starts_at>now() for update;
 if v_slot.id is null then raise exception 'slot unavailable';end if;
 select venue_id into v_venue from venue_booking_settings where venue_id=v_slot.venue_id and active and mode='request';
 if v_venue is null then raise exception 'booking unavailable';end if;
 if p_event is not null and not exists(select 1 from events where id=p_event and venue_id=v_venue and status='published') then raise exception 'event unavailable';end if;
 select coalesce(sum(party_size),0)::integer into v_booked from booking_requests where slot_id=p_slot and status in('requested','confirmed');
 if v_booked+p_party_size>v_slot.capacity then raise exception 'slot full';end if;
 insert into booking_requests(profile_id,venue_id,event_id,slot_id,party_size,contact_name,contact_email,contact_phone,notes)
 values(v_profile,v_venue,p_event,p_slot,p_party_size,trim(p_name),lower(trim(p_email)),nullif(trim(p_phone),''),nullif(trim(p_notes),'')) returning id into v_id;
 return v_id;
end$$;
revoke all on function request_booking(uuid,uuid,integer,text,text,text,text) from public,anon;
grant execute on function request_booking(uuid,uuid,integer,text,text,text,text) to authenticated;
commit;

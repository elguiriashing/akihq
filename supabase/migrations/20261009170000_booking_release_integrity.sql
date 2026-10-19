begin;
-- This RPC is also used by the legacy event booking wrapper below.
create function public.request_booking_v2(p_slot uuid,p_event uuid,p_party_size integer,p_name text,
 p_email text,p_phone text,p_notes text,p_key uuid,p_locale text,p_venue uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_profile uuid:=auth.uid(); v_slot public.venue_availability_slots%rowtype;
 v_existing public.booking_requests%rowtype; v_capacity integer; v_booked integer; v_id uuid;
begin
 if v_profile is null then raise exception 'authentication required' using errcode='42501'; end if;
 if p_party_size is null or p_party_size not between 1 and 100 or p_name is null
   or char_length(btrim(p_name)) not between 2 and 120 or p_email is null or char_length(p_email)>254
   or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
   or char_length(coalesce(p_phone,''))>40 or char_length(coalesce(p_notes,''))>1000
   or p_locale is null or p_locale not in ('en','es') then raise exception 'invalid booking details'; end if;
 if p_key is not null then
   perform pg_advisory_xact_lock(hashtextextended(v_profile::text||p_key::text,0));
   select * into v_existing from public.booking_requests where profile_id=v_profile and request_key=p_key;
   if v_existing.id is not null then
     if v_existing.slot_id is distinct from p_slot or v_existing.party_size<>p_party_size
       or v_existing.event_id is distinct from p_event
       or (p_venue is not null and v_existing.venue_id<>p_venue)
       or v_existing.contact_email<>lower(btrim(p_email)) or v_existing.contact_name<>btrim(p_name)
       or coalesce(v_existing.contact_phone,'')<>btrim(coalesce(p_phone,''))
       or coalesce(v_existing.notes,'')<>btrim(coalesce(p_notes,'')) then raise exception 'request key reused'; end if;
     return v_existing.id;
   end if;
 end if;
 if (select count(*) from public.booking_requests where profile_id=v_profile and created_at>now()-interval '1 minute')>=20 then
   raise exception 'too many booking requests';
 end if;
 select * into v_slot from public.venue_availability_slots where id=p_slot and active and starts_at>now() for update;
 if v_slot.id is null or (p_venue is not null and v_slot.venue_id<>p_venue) then raise exception 'slot unavailable'; end if;
 if not exists(select 1 from public.venues v join public.venue_booking_settings s on s.venue_id=v.id
   where v.id=v_slot.venue_id and v.status='published' and s.active and s.mode='request') then raise exception 'booking unavailable'; end if;
 if p_event is not null and not exists(select 1 from public.events where id=p_event and venue_id=v_slot.venue_id and status='published') then
   raise exception 'event unavailable'; end if;
 v_capacity:=v_slot.capacity;
 if v_slot.resource_id is not null then
   select least(v_capacity,r.capacity) into v_capacity from public.booking_resources r
     where r.id=v_slot.resource_id and r.venue_id=v_slot.venue_id and r.active;
   if v_capacity is null then raise exception 'resource unavailable'; end if;
 end if;
 if v_slot.offering_id is not null then
   select least(v_capacity,o.capacity) into v_capacity from public.booking_offerings o
     where o.id=v_slot.offering_id and o.venue_id=v_slot.venue_id and o.active;
   if v_capacity is null then raise exception 'offering unavailable'; end if;
 end if;
 select coalesce(sum(party_size),0)::integer into v_booked from public.booking_requests
   where slot_id=p_slot and status in ('requested','confirmed');
 if v_booked+p_party_size>v_capacity then raise exception 'slot full'; end if;
 insert into public.booking_requests(profile_id,venue_id,event_id,slot_id,party_size,contact_name,
   contact_email,contact_phone,notes,booking_locale,request_key)
 values(v_profile,v_slot.venue_id,p_event,p_slot,p_party_size,btrim(p_name),lower(btrim(p_email)),
   nullif(btrim(p_phone),''),nullif(btrim(p_notes),''),p_locale,p_key) returning id into v_id;
 return v_id;
end; $$;
revoke all on function public.request_booking_v2(uuid,uuid,integer,text,text,text,text,uuid,text,uuid) from public,anon;
grant execute on function public.request_booking_v2(uuid,uuid,integer,text,text,text,text,uuid,text,uuid) to authenticated;
create or replace function public.request_booking(p_slot uuid,p_event uuid,p_party_size integer,p_name text,p_email text,p_phone text,p_notes text)
returns uuid language sql security definer set search_path='' as $$
 select public.request_booking_v2(p_slot,p_event,p_party_size,p_name,p_email,p_phone,p_notes,null,'es',null);
$$;
revoke all on function public.request_booking(uuid,uuid,integer,text,text,text,text) from public,anon;
grant execute on function public.request_booking(uuid,uuid,integer,text,text,text,text) to authenticated;

-- Aggregate inventory only. Never expose reservation identities through public availability.
create function public.booking_available_slots(p_venue uuid)
returns table(id uuid,starts_at timestamptz,ends_at timestamptz,capacity integer,remaining integer,
 offering_id uuid,offering_name text,resource_name text)
language sql stable security definer set search_path='' as $$
 select s.id,s.starts_at,s.ends_at,s.capacity,
   least(100,greatest(0,least(s.capacity,coalesce(o.capacity,s.capacity),coalesce(r.capacity,s.capacity))
     -coalesce((select sum(b.party_size) from public.booking_requests b where b.slot_id=s.id and b.status in ('requested','confirmed')),0)))::integer,
   s.offering_id,o.name,r.name
 from public.venue_availability_slots s
 join public.venue_booking_settings cfg on cfg.venue_id=s.venue_id and cfg.active and cfg.mode='request'
 join public.venues v on v.id=s.venue_id and v.status='published'
 left join public.booking_offerings o on o.id=s.offering_id
 left join public.booking_resources r on r.id=s.resource_id
 where s.venue_id=p_venue and s.active and s.starts_at>now()
   and (s.offering_id is null or o.active) and (s.resource_id is null or r.active)
 order by s.starts_at,s.id limit 1000;
$$;
revoke all on function public.booking_available_slots(uuid) from public;
grant execute on function public.booking_available_slots(uuid) to anon,authenticated;

-- Scope by auth.uid() inside the function, including historical/inactive slot metadata.
create function public.my_booking_history(p_tab text default 'upcoming',p_page integer default 0)
returns jsonb language sql stable security definer set search_path='' as $$
 with owned as (
   select b.id,b.party_size,b.status,b.created_at,v.name,v.slug,v.address,s.starts_at,s.ends_at,o.name as offering_name,
     case when b.status in ('cancelled','declined','completed') or s.ends_at<=now() or s.id is null then 'past'
       when s.starts_at<=now() then 'active' else 'upcoming' end as tab
   from public.booking_requests b join public.venues v on v.id=b.venue_id
   left join public.venue_availability_slots s on s.id=b.slot_id
   left join public.booking_offerings o on o.id=s.offering_id
   where b.profile_id=auth.uid()
 ), selected as (
   select * from owned where tab=p_tab
   order by case when p_tab='past' then -extract(epoch from coalesce(starts_at,created_at))
     else extract(epoch from coalesce(starts_at,created_at)) end,id
   limit 20 offset greatest(0,least(p_page,10000))*20
 ) select jsonb_build_object('counts',jsonb_build_object(
   'upcoming',(select count(*) from owned where tab='upcoming'),
   'active',(select count(*) from owned where tab='active'),
   'past',(select count(*) from owned where tab='past')),
   'bookings',coalesce((select jsonb_agg(jsonb_build_object('id',id,'party_size',party_size,'status',status,
     'created_at',created_at,'venue',jsonb_build_object('name',name,'slug',slug,'address',address),
     'slot',case when starts_at is null then null else jsonb_build_object('starts_at',starts_at,'ends_at',ends_at) end,
     'offeringName',offering_name)) from selected),'[]'::jsonb));
$$;
revoke all on function public.my_booking_history(text,integer) from public,anon;
grant execute on function public.my_booking_history(text,integer) to authenticated;
-- Customer-owned delivery snapshots are exportable without revealing the venue recipient.
create function public.my_booking_email_export() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('booking_id',e.booking_id,'status',e.status,
   'created_at',e.created_at,'sent_at',e.sent_at,'payload',e.payload)),'[]'::jsonb)
 from public.booking_confirmation_emails e join public.booking_requests b on b.id=e.booking_id
 where b.profile_id=auth.uid() and e.audience='customer';
$$;
revoke all on function public.my_booking_email_export() from public,anon;
grant execute on function public.my_booking_email_export() to authenticated;
commit;

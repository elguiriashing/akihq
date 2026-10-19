-- AkiConduzco is a separate rental marketplace, not a venue discovery vertical.
create table if not exists public.car_rental_companies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 120),
  description_es text not null default '' check (char_length(description_es) <= 3000),
  description_en text check (description_en is null or char_length(description_en) <= 3000),
  city text not null check (char_length(city) between 2 and 100),
  address text not null check (char_length(address) between 4 and 240),
  latitude double precision not null check (latitude between 27 and 44),
  longitude double precision not null check (longitude between -19 and 5),
  phone text check (phone is null or char_length(phone) <= 40),
  website_url text check (website_url is null or website_url ~ '^https://'),
  submitted_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'pending_review'
    check (status in ('pending_review','published','paused','rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text check (review_note is null or char_length(review_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists car_rental_companies_one_per_owner_idx
  on public.car_rental_companies(submitted_by);

create table if not exists public.car_rental_company_reviews (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.car_rental_companies(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  previous_status text not null,
  new_status text not null check (new_status in ('published','rejected','paused')),
  note text check (note is null or char_length(note) <= 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.car_rental_vehicles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.car_rental_companies(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  category text not null check (category in ('mini','economy','compact','suv','people_carrier','premium','electric','van')),
  transmission text not null check (transmission in ('manual','automatic')),
  fuel text not null check (fuel in ('petrol','diesel','hybrid','electric','other')),
  seats smallint not null check (seats between 2 and 9),
  luggage smallint not null default 2 check (luggage between 0 and 12),
  daily_price_cents integer not null check (daily_price_cents between 100 and 1000000),
  deposit_cents integer not null default 0 check (deposit_cents between 0 and 5000000),
  currency char(3) not null default 'EUR' check (currency = 'EUR'),
  image_url text check (image_url is null or image_url ~ '^https://'),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Holds owner-maintained maintenance/unavailable periods and confirmed rentals.
-- Only vehicle ID and dates are visible to the public; renter details stay private.
create table if not exists public.car_rental_calendar_blocks (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.car_rental_vehicles(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text not null default 'maintenance' check (reason in ('maintenance','booking')),
  created_at timestamptz not null default now(),
  check (end_date > start_date),
  check (reason in ('maintenance','booking'))
);

create table if not exists public.car_rental_bookings (
  id uuid primary key default gen_random_uuid(),
  idempotency_key uuid not null,
  vehicle_id uuid not null references public.car_rental_vehicles(id) on delete restrict,
  renter_id uuid not null references auth.users(id) on delete restrict,
  start_date date not null,
  end_date date not null,
  contact_name text not null check (char_length(contact_name) between 2 and 120),
  contact_email text not null check (char_length(contact_email) between 3 and 254),
  contact_phone text check (contact_phone is null or char_length(contact_phone) <= 40),
  note text check (note is null or char_length(note) <= 1000),
  quoted_total_cents integer not null check (quoted_total_cents between 100 and 30000000),
  currency char(3) not null default 'EUR' check (currency = 'EUR'),
  status text not null default 'requested'
    check (status in ('requested','confirmed','declined','cancelled','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date > start_date and end_date <= start_date + 30),
  unique (renter_id,idempotency_key)
);

create index if not exists car_rental_companies_status_city_idx
  on public.car_rental_companies(status, city);
create index if not exists car_rental_vehicles_company_active_idx
  on public.car_rental_vehicles(company_id, active);
create index if not exists car_rental_calendar_vehicle_dates_idx
  on public.car_rental_calendar_blocks(vehicle_id, start_date, end_date);
create index if not exists car_rental_bookings_renter_created_idx
  on public.car_rental_bookings(renter_id, created_at desc);
create index if not exists car_rental_bookings_vehicle_dates_idx
  on public.car_rental_bookings(vehicle_id, start_date, end_date)
  where status in ('requested','confirmed');

create or replace function public.guard_car_rental_calendar_overlap()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.vehicle_id::text, 0)
  );
  if exists (
    select 1 from public.car_rental_calendar_blocks b
    where b.vehicle_id=new.vehicle_id and b.start_date < new.end_date
      and b.end_date > new.start_date
  ) then
    raise exception 'vehicle dates are no longer available' using errcode = 'PT409';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_car_rental_calendar_overlap() from public, anon, authenticated;
create trigger car_rental_calendar_no_overlap
before insert on public.car_rental_calendar_blocks
for each row execute function public.guard_car_rental_calendar_overlap();

alter table public.car_rental_companies enable row level security;
alter table public.car_rental_vehicles enable row level security;
alter table public.car_rental_calendar_blocks enable row level security;
alter table public.car_rental_bookings enable row level security;

create policy car_rental_companies_public_read
  on public.car_rental_companies for select to anon, authenticated
  using (status = 'published' or submitted_by = (select auth.uid())
    or public.has_platform_role(array['moderator','administrator']::public.app_role[]));
create policy car_rental_companies_owner_insert
  on public.car_rental_companies for insert to authenticated
  with check (submitted_by = (select auth.uid()) and status = 'pending_review');
create policy car_rental_companies_owner_update
  on public.car_rental_companies for update to authenticated
  using (submitted_by = (select auth.uid()) or public.has_platform_role(array['moderator','administrator']::public.app_role[]))
  with check (submitted_by = (select auth.uid()) or public.has_platform_role(array['moderator','administrator']::public.app_role[]));

revoke update on public.car_rental_companies from authenticated;
grant update (name,description_es,description_en,city,address,latitude,longitude,phone,website_url)
  on public.car_rental_companies to authenticated;

create or replace function public.guard_car_rental_company_review_state()
returns trigger language plpgsql set search_path = '' as $$
begin
  if public.has_platform_role(array['moderator','administrator']::public.app_role[]) then
    return new;
  end if;
  if old.submitted_by = (select auth.uid()) and new.status is not distinct from old.status then
    return new;
  end if;
  raise exception 'listing review state is staff-controlled' using errcode = '42501';
end;
$$;
create trigger car_rental_company_review_state
before update on public.car_rental_companies
for each row execute function public.guard_car_rental_company_review_state();

create or replace function public.clear_car_rental_review_metadata()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.reviewed_by := null;
  new.reviewed_at := null;
  new.review_note := null;
  new.status := 'pending_review';
  return new;
end;
$$;
create trigger car_rental_company_pending_insert
before insert on public.car_rental_companies
for each row execute function public.clear_car_rental_review_metadata();

alter table public.car_rental_company_reviews enable row level security;
create policy car_rental_company_reviews_owner_or_staff_read
  on public.car_rental_company_reviews for select to authenticated
  using (exists (
    select 1 from public.car_rental_companies c where c.id=company_id
      and (c.submitted_by=(select auth.uid()) or public.has_platform_role(array['moderator','administrator']::public.app_role[]))
  ));

create or replace function public.review_car_rental_company(
  p_company uuid, p_status text, p_note text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  previous text;
begin
  if actor is null or not public.has_platform_role(array['moderator','administrator']::public.app_role[]) then
    raise exception 'moderator role required' using errcode = '42501';
  end if;
  if p_status not in ('published','rejected') or (p_note is not null and char_length(p_note)>1000) then
    raise exception 'invalid rental review decision' using errcode = '22023';
  end if;
  select status into previous from public.car_rental_companies where id=p_company for update;
  if previous is distinct from 'pending_review' then raise exception 'listing is no longer pending' using errcode = 'PT409'; end if;
  update public.car_rental_companies set status=p_status,reviewed_by=actor,reviewed_at=now(),review_note=nullif(btrim(p_note),'') where id=p_company;
  insert into public.car_rental_company_reviews(company_id,reviewer_id,previous_status,new_status,note)
    values(p_company,actor,previous,p_status,nullif(btrim(p_note),''));
end;
$$;
revoke all on function public.review_car_rental_company(uuid,text,text) from public, anon;
grant execute on function public.review_car_rental_company(uuid,text,text) to authenticated;

create policy car_rental_vehicles_public_read
  on public.car_rental_vehicles for select to anon, authenticated
  using (active and exists (
    select 1 from public.car_rental_companies c
    where c.id = company_id and c.status = 'published'
  ));
create policy car_rental_vehicles_operator_read
  on public.car_rental_vehicles for select to authenticated
  using (exists (
    select 1 from public.car_rental_companies c
    where c.id = company_id and (c.submitted_by = (select auth.uid())
      or public.has_platform_role(array['moderator','administrator']::public.app_role[]))
  ));
create policy car_rental_vehicles_operator_insert
  on public.car_rental_vehicles for insert to authenticated
  with check (exists (
    select 1 from public.car_rental_companies c
    where c.id = company_id and c.submitted_by = (select auth.uid())
      and c.status in ('pending_review','published','paused')
  ));
create policy car_rental_vehicles_operator_update
  on public.car_rental_vehicles for update to authenticated
  using (exists (
    select 1 from public.car_rental_companies c
    where c.id = company_id and (c.submitted_by = (select auth.uid())
      or public.has_platform_role(array['moderator','administrator']::public.app_role[]))
  ))
  with check (exists (
    select 1 from public.car_rental_companies c
    where c.id = company_id and (c.submitted_by = (select auth.uid())
      or public.has_platform_role(array['moderator','administrator']::public.app_role[]))
  ));
create policy car_rental_vehicles_operator_delete
  on public.car_rental_vehicles for delete to authenticated
  using (exists (
    select 1 from public.car_rental_companies c
    where c.id = company_id and c.submitted_by = (select auth.uid())
  ));

create policy car_rental_calendar_public_read
  on public.car_rental_calendar_blocks for select to anon, authenticated
  using (exists (
    select 1 from public.car_rental_vehicles v
    join public.car_rental_companies c on c.id = v.company_id
    where v.id = vehicle_id and v.active and c.status = 'published'
  ));
create policy car_rental_calendar_operator_read
  on public.car_rental_calendar_blocks for select to authenticated
  using (exists (
    select 1 from public.car_rental_vehicles v
    join public.car_rental_companies c on c.id = v.company_id
    where v.id = vehicle_id and (c.submitted_by = (select auth.uid())
      or public.has_platform_role(array['moderator','administrator']::public.app_role[]))
  ));
create policy car_rental_calendar_operator_insert
  on public.car_rental_calendar_blocks for insert to authenticated
  with check (reason = 'maintenance' and exists (
    select 1 from public.car_rental_vehicles v
    join public.car_rental_companies c on c.id = v.company_id
    where v.id = vehicle_id and c.submitted_by = (select auth.uid())
  ));
create policy car_rental_calendar_operator_delete
  on public.car_rental_calendar_blocks for delete to authenticated
  using (reason = 'maintenance' and exists (
    select 1 from public.car_rental_vehicles v
    join public.car_rental_companies c on c.id = v.company_id
    where v.id = vehicle_id and c.submitted_by = (select auth.uid())
  ));

create policy car_rental_bookings_customer_read
  on public.car_rental_bookings for select to authenticated
  using (renter_id = (select auth.uid()));
create policy car_rental_bookings_operator_read
  on public.car_rental_bookings for select to authenticated
  using (exists (
    select 1 from public.car_rental_vehicles v
    join public.car_rental_companies c on c.id = v.company_id
    where v.id = vehicle_id and c.submitted_by = (select auth.uid())
  ));
-- No direct INSERT/UPDATE: requests and state changes use the atomic RPCs below.

create or replace function public.search_car_rentals(
  p_q text default null,
  p_city text default null,
  p_category text default null,
  p_start date default null,
  p_end date default null,
  p_min_price integer default null,
  p_max_price integer default null,
  p_bounds double precision[] default null,
  p_limit integer default 24,
  p_offset integer default 0
) returns table (
  vehicle_id uuid, vehicle_name text, category text, transmission text,
  fuel text, seats smallint, luggage smallint, daily_price_cents integer,
  deposit_cents integer, image_url text, company_id uuid, company_slug text,
  company_name text, city text, address text, latitude double precision,
  longitude double precision, total bigint
)
language sql stable security invoker
set search_path = pg_catalog, public
as $$
  select v.id,v.name,v.category,v.transmission,v.fuel,v.seats,v.luggage,
         v.daily_price_cents,v.deposit_cents,v.image_url,c.id,c.slug,c.name,
         c.city,c.address,c.latitude,c.longitude,count(*) over()
  from public.car_rental_vehicles v
  join public.car_rental_companies c on c.id=v.company_id
  where c.status='published' and v.active
    and (p_q is null or p_q='' or
      (lower(v.name || ' ' || c.name || ' ' || c.city) like '%' || lower(p_q) || '%'))
    and (p_city is null or p_city='' or lower(c.city)=lower(p_city))
    and (p_category is null or p_category='' or v.category=p_category)
    and (p_min_price is null or v.daily_price_cents >= p_min_price)
    and (p_max_price is null or v.daily_price_cents <= p_max_price)
    and (p_bounds is null or (
      cardinality(p_bounds)=4 and c.latitude between p_bounds[1] and p_bounds[3]
      and (case when p_bounds[2] <= p_bounds[4]
        then c.longitude between p_bounds[2] and p_bounds[4]
        else c.longitude >= p_bounds[2] or c.longitude <= p_bounds[4] end)
    ))
    and (p_start is null or p_end is null or not exists (
      select 1 from public.car_rental_calendar_blocks b
      where b.vehicle_id=v.id and b.start_date < p_end and b.end_date > p_start
    ))
  order by v.daily_price_cents,c.name,v.name,v.id
  limit least(greatest(p_limit,1),100) offset greatest(p_offset,0)
$$;
revoke all on function public.search_car_rentals(text,text,text,date,date,integer,integer,double precision[],integer,integer) from public;
grant execute on function public.search_car_rentals(text,text,text,date,date,integer,integer,double precision[],integer,integer) to anon, authenticated;

create or replace function public.request_car_rental_booking(
  p_vehicle uuid,
  p_start date,
  p_end date,
  p_contact_name text,
  p_contact_email text,
  p_contact_phone text,
  p_note text,
  p_idempotency_key uuid
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  price integer;
  booking_id uuid;
  day_count integer;
begin
  if actor is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_start < current_date or p_end <= p_start or p_end > p_start + 30 then
    raise exception 'invalid rental dates' using errcode = '22023';
  end if;
  if char_length(btrim(p_contact_name)) not between 2 and 120
     or char_length(btrim(p_contact_email)) not between 3 and 254
     or (p_contact_phone is not null and char_length(p_contact_phone) > 40)
     or (p_note is not null and char_length(p_note) > 1000) then
    raise exception 'invalid contact details' using errcode = '22023';
  end if;
  select v.daily_price_cents into price
    from public.car_rental_vehicles v
    join public.car_rental_companies c on c.id=v.company_id
    where v.id=p_vehicle and v.active and c.status='published';
  if price is null then raise exception 'vehicle not available' using errcode = 'P0002'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_vehicle::text, 0));
  if exists (select 1 from public.car_rental_calendar_blocks b
    where b.vehicle_id=p_vehicle and b.start_date < p_end and b.end_date > p_start) then
    raise exception 'vehicle dates are no longer available' using errcode = 'PT409';
  end if;
  day_count := p_end - p_start;
  insert into public.car_rental_bookings(
    vehicle_id,renter_id,idempotency_key,start_date,end_date,contact_name,
    contact_email,contact_phone,note,quoted_total_cents
  ) values (
    p_vehicle,actor,p_idempotency_key,p_start,p_end,btrim(p_contact_name),
    lower(btrim(p_contact_email)),nullif(btrim(p_contact_phone),''),
    nullif(btrim(p_note),''),price * day_count
  ) on conflict (renter_id,idempotency_key) do update set idempotency_key=excluded.idempotency_key
    returning id into booking_id;
  return booking_id;
end;
$$;
revoke all on function public.request_car_rental_booking(uuid,date,date,text,text,text,text,uuid) from public, anon;
grant execute on function public.request_car_rental_booking(uuid,date,date,text,text,text,text,uuid) to authenticated;

create or replace function public.set_car_rental_booking_status(
  p_booking uuid,
  p_status text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.car_rental_bookings%rowtype;
  owner_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_status not in ('confirmed','declined','cancelled','completed') then raise exception 'invalid booking status' using errcode = '22023'; end if;
  select * into b from public.car_rental_bookings where id = p_booking for update;
  if not found then raise exception 'booking not found' using errcode = 'P0002'; end if;
  select c.submitted_by into owner_id
    from public.car_rental_vehicles v join public.car_rental_companies c on c.id = v.company_id
    where v.id = b.vehicle_id;
  if b.renter_id <> (select auth.uid()) and owner_id <> (select auth.uid()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if b.renter_id = (select auth.uid()) and p_status <> 'cancelled' then
    raise exception 'renter may only cancel a request' using errcode = '42501';
  end if;
  if p_status = 'confirmed' then
    perform pg_advisory_xact_lock(hashtextextended(b.vehicle_id::text, 0));
    if exists (
      select 1 from public.car_rental_calendar_blocks x
      where x.vehicle_id = b.vehicle_id
        and x.start_date < b.end_date and x.end_date > b.start_date
    ) then raise exception 'vehicle dates are no longer available' using errcode = 'PT409'; end if;
    if b.status not in ('requested') then raise exception 'booking cannot be confirmed from this state' using errcode = 'PT409'; end if;
    insert into public.car_rental_calendar_blocks(vehicle_id,start_date,end_date,reason)
      values (b.vehicle_id,b.start_date,b.end_date,'booking');
  elsif p_status = 'cancelled' then
    if b.status not in ('requested','confirmed') then raise exception 'booking cannot be cancelled from this state' using errcode = 'PT409'; end if;
    delete from public.car_rental_calendar_blocks
      where vehicle_id=b.vehicle_id and start_date=b.start_date and end_date=b.end_date and reason='booking';
  elsif p_status = 'declined' and b.status <> 'requested' then
    raise exception 'booking cannot be declined from this state' using errcode = 'PT409';
  elsif p_status = 'completed' and (b.status <> 'confirmed' or b.end_date > current_date) then
    raise exception 'only completed rentals can be completed' using errcode = 'PT409';
  end if;
  update public.car_rental_bookings set status = p_status, updated_at = now() where id = b.id;
end;
$$;
revoke all on function public.set_car_rental_booking_status(uuid,text) from public, anon;
grant execute on function public.set_car_rental_booking_status(uuid,text) to authenticated;

grant select on public.car_rental_companies, public.car_rental_vehicles,
  public.car_rental_calendar_blocks to anon, authenticated;
grant insert on public.car_rental_companies to authenticated;
grant insert, update, delete on public.car_rental_vehicles to authenticated;
grant insert, delete on public.car_rental_calendar_blocks to authenticated;
grant select on public.car_rental_bookings to authenticated;

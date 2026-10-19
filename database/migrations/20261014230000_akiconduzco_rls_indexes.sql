-- Collapse equivalent read policies so Postgres evaluates each public table once.
drop policy if exists car_rental_vehicles_public_read on public.car_rental_vehicles;
drop policy if exists car_rental_vehicles_operator_read on public.car_rental_vehicles;
create policy car_rental_vehicles_read
  on public.car_rental_vehicles for select to anon, authenticated
  using (
    (active and exists (
      select 1 from public.car_rental_companies c
      where c.id = company_id and c.status = 'published'
    ))
    or (select auth.uid()) is not null and exists (
      select 1 from public.car_rental_companies c
      where c.id = company_id and (c.submitted_by = (select auth.uid())
        or public.has_platform_role(array['moderator','administrator']::public.app_role[]))
    )
  );

drop policy if exists car_rental_calendar_public_read on public.car_rental_calendar_blocks;
drop policy if exists car_rental_calendar_operator_read on public.car_rental_calendar_blocks;
create policy car_rental_calendar_read
  on public.car_rental_calendar_blocks for select to anon, authenticated
  using (
    exists (
      select 1 from public.car_rental_vehicles v
      join public.car_rental_companies c on c.id = v.company_id
      where v.id = vehicle_id and v.active and c.status = 'published'
    )
    or (select auth.uid()) is not null and exists (
      select 1 from public.car_rental_vehicles v
      join public.car_rental_companies c on c.id = v.company_id
      where v.id = vehicle_id and (c.submitted_by = (select auth.uid())
        or public.has_platform_role(array['moderator','administrator']::public.app_role[]))
    )
  );

drop policy if exists car_rental_bookings_customer_read on public.car_rental_bookings;
drop policy if exists car_rental_bookings_operator_read on public.car_rental_bookings;
create policy car_rental_bookings_read
  on public.car_rental_bookings for select to authenticated
  using (
    renter_id = (select auth.uid())
    or exists (
      select 1 from public.car_rental_vehicles v
      join public.car_rental_companies c on c.id = v.company_id
      where v.id = vehicle_id and c.submitted_by = (select auth.uid())
    )
  );

create index if not exists car_rental_companies_reviewed_by_idx
  on public.car_rental_companies(reviewed_by);
create index if not exists car_rental_company_reviews_company_idx
  on public.car_rental_company_reviews(company_id);
create index if not exists car_rental_company_reviews_reviewer_idx
  on public.car_rental_company_reviews(reviewer_id);

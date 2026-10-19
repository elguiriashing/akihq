begin;

-- Production migration version: 20261010022234.

-- Anonymous reads must not call the authenticated-only entitlement helper.
alter policy offers_visible on public.offers to authenticated;
drop policy if exists offers_public_visible on public.offers;
create policy offers_public_visible on public.offers for select
to anon
using (status = 'published' and audience = 'public');

notify pgrst, 'reload schema';
commit;

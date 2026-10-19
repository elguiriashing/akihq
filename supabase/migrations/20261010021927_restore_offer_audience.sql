begin;

-- Production migration version: 20261010021927.

-- Restore the offer audience contract already used by public and business code.
alter table public.offers
  add column if not exists audience text not null default 'public'
    check (audience in ('public','premium'));

drop policy if exists offers_visible on public.offers;
create policy offers_visible on public.offers for select
to anon, authenticated
using (
  (
    status = 'published'
    and (
      audience = 'public'
      or (
        audience = 'premium'
        and auth.uid() is not null
        and public.has_active_entitlement(auth.uid(), 'premium')
      )
    )
  )
  or public.is_venue_member(venue_id)
  or public.has_platform_role(array['moderator','administrator']::public.app_role[])
);

notify pgrst, 'reload schema';
commit;

-- Public, privacy-safe ownership signal. Do not expose owner identities.
create or replace function public.public_venue_is_claimed(p_venue uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.venue_members vm
    where vm.venue_id = p_venue
      and vm.role in ('owner', 'manager', 'editor')
  ) or exists (
    select 1 from public.venue_claims vc
    where vc.venue_id = p_venue
      and vc.status = 'approved'
  );
$$;
revoke all on function public.public_venue_is_claimed(uuid) from public;
grant execute on function public.public_venue_is_claimed(uuid) to anon, authenticated;

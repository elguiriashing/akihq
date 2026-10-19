begin;

-- Keep staff dashboard totals in sync with the pending claims shown by
-- staff_pending_venue_claims. Return only an aggregate, never claimant PII.
create or replace function public.staff_pending_venue_claim_count()
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.app_role::text in ('moderator','administrator')
  ) then
    raise exception 'staff role required' using errcode = '42501';
  end if;

  return (
    select count(*)
    from public.venue_claims c
    join public.venues v on v.id = c.venue_id
    join public.profiles p on p.id = c.claimant_id
    where c.status::text = 'pending'
  );
end;
$$;

revoke all on function public.staff_pending_venue_claim_count() from public, anon, authenticated;
grant execute on function public.staff_pending_venue_claim_count() to authenticated;

commit;

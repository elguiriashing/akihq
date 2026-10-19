begin;

-- Read only: identity details are confined to pending claims and staff.
create or replace function public.staff_pending_venue_claims(p_offset integer default 0)
returns table(id uuid, created_at timestamptz, evidence text, status text,
  claimant_id uuid, venues jsonb, claimant jsonb, total_count bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p where p.id=auth.uid()
      and p.app_role::text in ('moderator','administrator')
  ) then
    raise exception 'staff role required' using errcode='42501';
  end if;
  if p_offset is null or p_offset < 0 or p_offset > 200000 then
    raise exception 'invalid claim offset' using errcode='22023';
  end if;
  return query
  select c.id,c.created_at,c.evidence,c.status::text,c.claimant_id,
    jsonb_build_object('name',v.name,'address',v.address,'slug',v.slug,
      'discovery_vertical',v.discovery_vertical,'contact_phone',v.contact_phone,
      'website_url',v.website_url,'timezone',coalesce(city.timezone,'Europe/Madrid')),
    jsonb_build_object('display_name',p.display_name,'email',u.email::text,
      'phone',p.phone,'created_at',p.created_at),
    count(*) over()
  from public.venue_claims c
  join public.venues v on v.id=c.venue_id
  join public.profiles p on p.id=c.claimant_id
  left join auth.users u on u.id=p.id and u.deleted_at is null
  left join public.cities city on city.id=v.city_id
  where c.status::text='pending'
  order by c.created_at,c.id
  limit 20 offset p_offset;
end;
$$;
revoke all on function public.staff_pending_venue_claims(integer) from public,anon,authenticated;
grant execute on function public.staff_pending_venue_claims(integer) to authenticated;

commit;

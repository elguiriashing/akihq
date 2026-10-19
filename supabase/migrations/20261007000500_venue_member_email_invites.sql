begin;

create or replace function public.add_venue_member_by_email(
  p_venue uuid,
  p_email text,
  p_role public.venue_member_role
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_profile uuid;
  normalized_email text := lower(trim(coalesce(p_email, '')));
begin
  if not public.is_venue_member(
    p_venue,
    array['owner']::public.venue_member_role[]
  ) then
    raise exception 'venue owner required' using errcode = '42501';
  end if;

  if p_role = 'owner'::public.venue_member_role then
    raise exception 'ownership transfer requires administrator review';
  end if;

  if normalized_email = '' or normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'valid email required';
  end if;

  select u.id
  into target_profile
  from auth.users u
  where lower(coalesce(u.email, '')) = normalized_email
    and u.deleted_at is null
    and u.email_confirmed_at is not null
  limit 1;

  if target_profile is null then
    raise exception 'active AkiPasa account not found for that email';
  end if;

  perform public.add_venue_member(p_venue, target_profile, p_role);
  return target_profile;
end;
$$;

revoke all on function public.add_venue_member_by_email(
  uuid,
  text,
  public.venue_member_role
) from public, anon;

grant execute on function public.add_venue_member_by_email(
  uuid,
  text,
  public.venue_member_role
) to authenticated;

commit;

begin;

-- Platform administrators inherit venue-management access without needing a
-- synthetic membership row for every venue. Business team permissions remain
-- venue-scoped through venue_members.
create or replace function is_venue_member(
  target_venue uuid,
  allowed_roles venue_member_role[] default array['editor','manager','owner']::venue_member_role[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from profiles
      where id = auth.uid()
        and app_role = 'administrator'
    )
    or exists (
      select 1
      from venue_members
      where venue_id = target_venue
        and profile_id = auth.uid()
        and role = any(allowed_roles)
    );
$$;

revoke all on function is_venue_member(uuid,venue_member_role[]) from public;
grant execute on function is_venue_member(uuid,venue_member_role[]) to anon, authenticated;

commit;

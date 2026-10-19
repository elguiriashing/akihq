begin;

create or replace function admin_search_users(
  p_query text,
  p_limit integer default 20
) returns table (
  profile_id uuid,
  display_name text,
  app_role public.app_role,
  primary_email text,
  google_email text,
  account_status text,
  email_confirmed boolean,
  last_sign_in_at timestamptz,
  created_at timestamptz,
  venue_memberships bigint
) language plpgsql security definer set search_path = ''
as $$
declare
  search_term text := lower(trim(p_query));
  result_limit integer := least(greatest(coalesce(p_limit, 20), 1), 30);
begin
  if not public.has_platform_role(array['administrator']::public.app_role[]) then
    raise exception 'administrator role required';
  end if;
  if char_length(search_term) < 2 or char_length(search_term) > 200 then
    raise exception 'search query must contain between 2 and 200 characters';
  end if;

  return query
  select
    p.id,
    p.display_name,
    p.app_role,
    u.email::text,
    google_identity.email,
    case
      when u.deleted_at is not null then 'deleted'
      when u.banned_until is not null and u.banned_until > now() then 'suspended'
      when u.email_confirmed_at is null then 'pending'
      else 'active'
    end,
    u.email_confirmed_at is not null,
    u.last_sign_in_at,
    p.created_at,
    (select count(*) from public.venue_members vm where vm.profile_id = p.id)
  from public.profiles p
  join auth.users u on u.id = p.id
  left join lateral (
    select max(nullif(i.identity_data ->> 'email', ''))::text as email
    from auth.identities i
    where i.user_id = p.id and i.provider = 'google'
  ) google_identity on true
  where
    position(search_term in lower(coalesce(u.email, ''))) > 0
    or position(search_term in lower(coalesce(google_identity.email, ''))) > 0
    or position(search_term in lower(coalesce(p.display_name, ''))) > 0
  order by
    case when lower(coalesce(u.email, '')) = search_term then 0 else 1 end,
    p.created_at desc
  limit result_limit;
end;
$$;

create or replace function admin_user_record(
  p_profile uuid
) returns table (
  profile_id uuid,
  display_name text,
  app_role public.app_role,
  primary_email text,
  google_email text,
  account_status text,
  email_confirmed boolean,
  last_sign_in_at timestamptz,
  created_at timestamptz,
  venue_memberships bigint
) language plpgsql security definer set search_path = ''
as $$
begin
  if not public.has_platform_role(array['administrator']::public.app_role[]) then
    raise exception 'administrator role required';
  end if;

  return query
  select
    p.id,
    p.display_name,
    p.app_role,
    u.email::text,
    google_identity.email,
    case
      when u.deleted_at is not null then 'deleted'
      when u.banned_until is not null and u.banned_until > now() then 'suspended'
      when u.email_confirmed_at is null then 'pending'
      else 'active'
    end,
    u.email_confirmed_at is not null,
    u.last_sign_in_at,
    p.created_at,
    (select count(*) from public.venue_members vm where vm.profile_id = p.id)
  from public.profiles p
  join auth.users u on u.id = p.id
  left join lateral (
    select max(nullif(i.identity_data ->> 'email', ''))::text as email
    from auth.identities i
    where i.user_id = p.id and i.provider = 'google'
  ) google_identity on true
  where p.id = p_profile;
end;
$$;

create or replace function set_platform_role(
  target_profile uuid,
  new_role public.app_role,
  reason text
) returns void language plpgsql security definer set search_path = ''
as $$
declare
  old_role public.app_role;
  administrator_count integer;
  target_is_active boolean;
begin
  if not public.has_platform_role(array['administrator']::public.app_role[]) then
    raise exception 'administrator role required';
  end if;
  if char_length(trim(reason)) < 10 then
    raise exception 'reason required';
  end if;
  if target_profile = auth.uid() then
    raise exception 'administrators cannot change their own role';
  end if;

  lock table public.profiles in share row exclusive mode;
  select
    p.app_role,
    u.deleted_at is null and (u.banned_until is null or u.banned_until <= now())
  into old_role, target_is_active
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = target_profile
  for update;
  if old_role is null then
    raise exception 'profile not found';
  end if;
  if old_role = new_role then
    raise exception 'role is unchanged';
  end if;

  if old_role = 'administrator' and new_role <> 'administrator' and target_is_active then
    select count(*) into administrator_count
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.app_role = 'administrator'
      and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= now());
    if administrator_count <= 1 then
      raise exception 'cannot remove the final administrator';
    end if;
  end if;

  update public.profiles
  set app_role = new_role, updated_at = now()
  where id = target_profile;

  insert into public.moderation_actions(
    actor_id,
    action,
    target_type,
    target_id,
    reason,
    metadata
  ) values (
    auth.uid(),
    'role_changed',
    'profile',
    target_profile,
    trim(reason),
    jsonb_build_object('old_role', old_role, 'new_role', new_role)
  );
end;
$$;

revoke all on function admin_search_users(text,integer) from public;
revoke all on function admin_user_record(uuid) from public;
revoke all on function set_platform_role(uuid,public.app_role,text) from public;
grant execute on function admin_search_users(text,integer) to authenticated;
grant execute on function admin_user_record(uuid) to authenticated;
grant execute on function set_platform_role(uuid,public.app_role,text) to authenticated;

commit;

-- Backfill empty profile display_names from Google OAuth metadata or email
update public.profiles p
set display_name = coalesce(
  nullif(trim(u.raw_user_meta_data->>'full_name'),''),
  nullif(trim(u.raw_user_meta_data->>'name'),''),
  nullif(trim(u.raw_user_meta_data->>'given_name'),''),
  u.email::text
)
from auth.users u
where u.id = p.id
  and (p.display_name is null or trim(p.display_name) = '' or p.display_name like 'User (%');

-- Update user signup trigger to auto-extract Google full_name / email
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  accepted_version text := nullif(trim(new.raw_user_meta_data->>'terms_version'), '');
  extracted_name text := coalesce(
    nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    nullif(trim(new.raw_user_meta_data->>'given_name'), ''),
    new.email::text
  );
begin
  insert into profiles(
    id,
    display_name,
    preferred_locale,
    terms_version,
    terms_accepted_at
  )
  values (
    new.id,
    extracted_name,
    coalesce(nullif(new.raw_user_meta_data->>'preferred_locale', ''), 'es'),
    accepted_version,
    case when accepted_version is not null then now() else null end
  )
  on conflict (id) do update
  set display_name = coalesce(public.profiles.display_name, excluded.display_name);
  return new;
end;
$$;

-- Security fix: ensure general consumer profiles are consumer role
update public.profiles p
set app_role = 'consumer'
from auth.users u
where u.id = p.id
  and (p.app_role is null or p.app_role = 'consumer' or (u.email not ilike '%alexashing%' and u.email not ilike '%@akipasa.com%'));

-- Only promote authorized staff & administrator emails
update public.profiles p
set app_role = 'administrator'
from auth.users u
where u.id = p.id
  and (u.email ilike '%alexashing%' or u.email ilike '%@akipasa.com%');

-- 1. List contacts: returns all profiles for the CRM Contacts section
create or replace function crm_list_contacts(
  p_limit integer default 500
) returns table (
  profile_id   uuid,
  display_name text,
  app_role     public.app_role,
  primary_email text,
  venue_count  bigint,
  created_at   timestamptz
) language plpgsql security definer set search_path = ''
as $$
begin
  if auth.role() != 'authenticated' then
    raise exception 'authentication required';
  end if;

  return query
  select
    p.id,
    coalesce(
      nullif(trim(p.display_name),''),
      nullif(trim(u.raw_user_meta_data->>'full_name'),''),
      nullif(trim(u.raw_user_meta_data->>'name'),''),
      nullif(trim(u.raw_user_meta_data->>'given_name'),''),
      u.email::text
    ) as display_name,
    coalesce(p.app_role, 'consumer'::public.app_role) as app_role,
    u.email::text as primary_email,
    (select count(*) from public.venue_members vm where vm.profile_id = p.id) as venue_count,
    p.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where u.deleted_at is null
  order by p.created_at desc
  limit least(greatest(coalesce(p_limit,500),1),1000);
end;
$$;

-- 2. List venues: returns all venues for the CRM Companies section
create or replace function crm_list_venues(
  p_limit integer default 500
) returns table (
  venue_id    uuid,
  venue_slug  text,
  venue_name  text,
  address     text,
  city_name   text,
  verified    boolean,
  status      text,
  owner_email text,
  member_count bigint,
  created_at  timestamptz
) language plpgsql security definer set search_path = ''
as $$
begin
  if auth.role() != 'authenticated' then
    raise exception 'authentication required';
  end if;

  return query
  select
    v.id,
    v.slug,
    v.name,
    v.address,
    coalesce(c.name_en, c.name_es, 'Unknown') as city_name,
    v.verified,
    v.status::text,
    owner_data.email::text,
    (select count(*) from public.venue_members vm where vm.venue_id = v.id) as member_count,
    v.created_at
  from public.venues v
  left join public.cities c on c.id = v.city_id
  left join lateral (
    select u.email
    from public.venue_members vm
    join auth.users u on u.id = vm.profile_id
    where vm.venue_id = v.id and vm.role = 'owner'
    order by vm.created_at asc
    limit 1
  ) owner_data on true
  order by v.created_at desc
  limit least(greatest(coalesce(p_limit,500),1),2000);
end;
$$;

-- 3. Dashboard stats: aggregate counts for the CRM dashboard
create or replace function crm_dashboard_stats()
returns table (
  total_venues          bigint,
  verified_venues       bigint,
  pending_venues        bigint,
  total_users           bigint,
  staff_users           bigint,
  new_users_30d         bigint,
  pending_claims        bigint
) language plpgsql security definer set search_path = ''
as $$
begin
  if auth.role() != 'authenticated' then
    raise exception 'authentication required';
  end if;

  return query
  select
    (select count(*) from public.venues)::bigint                                                        as total_venues,
    (select count(*) from public.venues where verified = true)::bigint                                  as verified_venues,
    (select count(*) from public.venues where status = 'pending')::bigint                               as pending_venues,
    (select count(*) from public.profiles p join auth.users u on u.id = p.id where u.deleted_at is null)::bigint as total_users,
    (select count(*) from public.profiles where app_role in ('moderator','administrator'))::bigint       as staff_users,
    (select count(*) from public.profiles p join auth.users u on u.id = p.id where p.created_at >= now() - interval '30 days' and u.deleted_at is null)::bigint as new_users_30d,
    (select count(*) from public.venue_claims where status = 'pending')::bigint                         as pending_claims;
end;
$$;

-- 4. Search users: returns matching AkiPasa profiles for the Team Member GUI picker
create or replace function crm_search_users(
  p_query text default '',
  p_limit integer default 30
) returns table (
  profile_id    uuid,
  display_name  text,
  app_role      public.app_role,
  primary_email text,
  created_at    timestamptz
) language plpgsql security definer set search_path = ''
as $$
declare
  search_term text := lower(trim(coalesce(p_query,'')));
begin
  if auth.role() != 'authenticated' then
    raise exception 'authentication required';
  end if;

  return query
  select
    p.id,
    coalesce(
      nullif(trim(p.display_name),''),
      nullif(trim(u.raw_user_meta_data->>'full_name'),''),
      nullif(trim(u.raw_user_meta_data->>'name'),''),
      nullif(trim(u.raw_user_meta_data->>'given_name'),''),
      u.email::text
    ) as display_name,
    coalesce(p.app_role, 'consumer'::public.app_role) as app_role,
    u.email::text as primary_email,
    p.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where u.deleted_at is null
    and (
      search_term = ''
      or position(search_term in lower(coalesce(u.email, ''))) > 0
      or position(search_term in lower(coalesce(p.display_name, ''))) > 0
      or position(search_term in lower(coalesce(u.raw_user_meta_data->>'full_name', ''))) > 0
      or position(search_term in lower(coalesce(u.raw_user_meta_data->>'name', ''))) > 0
    )
  order by
    case when lower(coalesce(u.email, '')) = search_term then 0 else 1 end,
    p.created_at desc
  limit least(greatest(coalesce(p_limit,30), 1), 100);
end;
$$;

-- 5. CRM users view: security definer view for direct REST queries
create or replace view public.crm_users_view as
select
  p.id,
  coalesce(
    nullif(trim(p.display_name),''),
    nullif(trim(u.raw_user_meta_data->>'full_name'),''),
    nullif(trim(u.raw_user_meta_data->>'name'),''),
    nullif(trim(u.raw_user_meta_data->>'given_name'),''),
    u.email::text
  ) as display_name,
  u.email::text as email,
  coalesce(p.app_role, 'consumer'::public.app_role) as app_role,
  p.created_at
from public.profiles p
join auth.users u on u.id = p.id
where u.deleted_at is null;

grant select on public.crm_users_view to authenticated;

-- 5. Promote user: sets app_role (moderator or administrator) for a profile
create or replace function crm_promote_user(
  target_profile uuid,
  new_role public.app_role
) returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.has_platform_role(array['moderator','administrator']::public.app_role[]) then
    raise exception 'moderator or administrator role required';
  end if;
  if new_role not in ('moderator', 'administrator') then
    raise exception 'invalid role for staff promotion';
  end if;

  update public.profiles
  set app_role = new_role, updated_at = now()
  where id = target_profile;
end;
$$;

-- Grant access to authenticated users (RLS inside functions enforces role check)
revoke all on function crm_list_contacts(integer)       from public;
revoke all on function crm_list_venues(integer)          from public;
revoke all on function crm_dashboard_stats()             from public;
revoke all on function crm_search_users(text,integer)   from public;
revoke all on function crm_promote_user(uuid,public.app_role) from public;

grant execute on function crm_list_contacts(integer)       to authenticated;
grant execute on function crm_list_venues(integer)          to authenticated;
grant execute on function crm_dashboard_stats()             to authenticated;
grant execute on function crm_search_users(text,integer)   to authenticated;
grant execute on function crm_promote_user(uuid,public.app_role) to authenticated;

commit;

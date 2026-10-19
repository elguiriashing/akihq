begin;

create table saved_events (
  profile_id uuid not null references profiles(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, event_id)
);

create table followed_venues (
  profile_id uuid not null references profiles(id) on delete cascade,
  venue_id uuid not null references venues(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, venue_id)
);

create table recent_event_views (
  profile_id uuid not null references profiles(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (profile_id, event_id)
);

alter table saved_events enable row level security;
alter table followed_venues enable row level security;
alter table recent_event_views enable row level security;

create policy saved_events_own on saved_events for all
using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy followed_venues_own on followed_venues for all
using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy recent_event_views_own on recent_event_views for all
using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create or replace function promote_business_owner() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.role in ('manager','owner') then
    update profiles set app_role='organiser', updated_at=now()
    where id=new.profile_id and app_role='consumer';
  end if;
  return new;
end;
$$;

create trigger on_business_membership_created
after insert or update of role on venue_members
for each row execute function promote_business_owner();

create or replace function set_platform_role(
  target_profile uuid, new_role app_role, reason text
) returns void language plpgsql security definer set search_path = public
as $$
declare old_role app_role;
begin
  if not has_platform_role(array['administrator']::app_role[]) then
    raise exception 'administrator role required';
  end if;
  if char_length(trim(reason)) < 10 then raise exception 'reason required'; end if;
  if target_profile = auth.uid() then raise exception 'administrators cannot change their own role'; end if;
  select app_role into old_role from profiles where id=target_profile for update;
  if old_role is null then raise exception 'profile not found'; end if;
  update profiles set app_role=new_role, updated_at=now() where id=target_profile;
  insert into moderation_actions(actor_id,action,target_type,target_id,reason,metadata)
  values(auth.uid(),'role_changed','profile',target_profile,trim(reason),
    jsonb_build_object('old_role',old_role,'new_role',new_role));
end;
$$;

grant execute on function set_platform_role(uuid,app_role,text) to authenticated;
revoke execute on function set_platform_role(uuid,app_role,text) from anon;

commit;

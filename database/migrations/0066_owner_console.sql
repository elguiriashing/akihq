begin;

create table owner_console_entitlements (
  profile_id uuid primary key references profiles(id) on delete cascade,
  active boolean not null default true,
  granted_by uuid references profiles(id) on delete set null,
  granted_at timestamptz not null default now(),
  note text not null default 'Platform owner console' check (char_length(note) between 3 and 500)
);

create table owner_console_preferences (
  profile_id uuid primary key references owner_console_entitlements(profile_id) on delete cascade,
  background text not null default 'aurora' check (background in ('default','aurora','midnight','synthwave','paper','none')),
  accent text not null default 'teal' check (accent in ('orange','teal','violet','pink','gold')),
  motion boolean not null default true,
  glass boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table owner_console_entitlements enable row level security;
alter table owner_console_preferences enable row level security;
grant select on owner_console_entitlements,owner_console_preferences to authenticated;

create policy owner_console_entitlement_self_read on owner_console_entitlements for select to authenticated
  using (profile_id=(select auth.uid()));
create policy owner_console_preferences_self_read on owner_console_preferences for select to authenticated
  using (profile_id=(select auth.uid()) and exists(
    select 1 from owner_console_entitlements e where e.profile_id=(select auth.uid()) and e.active
  ));

create function has_owner_console() returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from owner_console_entitlements where profile_id=(select auth.uid()) and active);
$$;

create function update_owner_console_preferences(
  p_background text,p_accent text,p_motion boolean,p_glass boolean
) returns void language plpgsql security definer set search_path=public as $$
begin
  if not has_owner_console() then raise exception 'owner console required'; end if;
  if p_background not in ('default','aurora','midnight','synthwave','paper','none')
    or p_accent not in ('orange','teal','violet','pink','gold')
  then raise exception 'invalid owner preference'; end if;
  insert into owner_console_preferences(profile_id,background,accent,motion,glass,updated_at)
  values(auth.uid(),p_background,p_accent,p_motion,p_glass,now())
  on conflict(profile_id) do update set background=excluded.background,accent=excluded.accent,
    motion=excluded.motion,glass=excluded.glass,updated_at=excluded.updated_at;
  insert into moderation_actions(actor_id,action,target_type,target_id,reason,metadata)
  values(auth.uid(),'owner_preferences_updated','owner_console',auth.uid(),
    'Owner console appearance preferences updated',
    jsonb_build_object('background',p_background,'accent',p_accent,'motion',p_motion,'glass',p_glass));
end;
$$;

revoke all on function has_owner_console() from public,anon;
grant execute on function has_owner_console() to authenticated;
revoke all on function update_owner_console_preferences(text,text,boolean,boolean) from public,anon;
grant execute on function update_owner_console_preferences(text,text,boolean,boolean) to authenticated;

commit;
begin;

create table public.achievements (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{2,63}$'),
  title_es text not null check (char_length(trim(title_es)) between 2 and 80),
  title_en text not null check (char_length(trim(title_en)) between 2 and 80),
  description_es text not null check (char_length(trim(description_es)) between 3 and 300),
  description_en text not null check (char_length(trim(description_en)) between 3 and 300),
  minimum_xp integer not null check (minimum_xp between 1 and 1000000),
  icon text not null default 'star' check (icon in ('discover','star','venue','gift','heart')),
  active boolean not null default false,
  updated_at timestamptz not null default clock_timestamp()
);

-- Preserve the existing XP milestones. No XP or user progress is modified.
insert into public.achievements(key,title_es,title_en,description_es,description_en,minimum_xp,icon,active) values
  ('first_step','Primer paso','First step','Has hecho tu primer check-in válido.','You completed your first valid check-in.',10,'discover',true),
  ('local_regular','Habitual local','Local regular','Has conseguido 100 XP explorando negocios participantes.','You earned 100 XP exploring participating businesses.',100,'venue',true),
  ('city_insider','Conoce la ciudad','City insider','Has conseguido 500 XP descubriendo planes locales.','You earned 500 XP discovering local plans.',500,'star',true);

alter table public.achievements enable row level security;
revoke all on public.achievements from public, anon, authenticated;
grant select on public.achievements to anon, authenticated;
grant insert, update, delete on public.achievements to authenticated;
grant all on public.achievements to service_role;
create policy achievements_live_read on public.achievements for select to anon, authenticated using (active);
create policy achievements_admin_read on public.achievements for select to authenticated
  using ((select public.has_platform_role(array['administrator']::public.app_role[])));
create policy achievements_admin_insert on public.achievements for insert to authenticated
  with check ((select public.has_platform_role(array['administrator']::public.app_role[])));
create policy achievements_admin_update on public.achievements for update to authenticated
  using ((select public.has_platform_role(array['administrator']::public.app_role[])))
  with check ((select public.has_platform_role(array['administrator']::public.app_role[])));
create policy achievements_admin_delete on public.achievements for delete to authenticated
  using ((select public.has_platform_role(array['administrator']::public.app_role[])));

-- The private trigger alone can write the existing protected audit ledger.
-- Catalogue mutations themselves still run through the caller's RLS policies.
create schema if not exists private;
create function private.audit_achievement_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_key text;
begin
  if auth.uid() is null or not public.has_platform_role(array['administrator']::public.app_role[]) then
    raise exception 'administrator role required' using errcode='42501';
  end if;
  if tg_op = 'UPDATE' and new.key <> old.key then
    raise exception 'achievement key is immutable';
  end if;
  if tg_op = 'DELETE' then v_key := old.key;
  else
    new.updated_at := clock_timestamp();
    v_key := new.key;
  end if;
  insert into public.moderation_actions(actor_id,action,target_type,target_id,reason,metadata)
  values(auth.uid(),'achievement_' || lower(tg_op),'achievement',md5(v_key)::uuid,
    'Achievement catalogue ' || lower(tg_op),
    jsonb_build_object('key',v_key,'before',case when tg_op <> 'INSERT' then to_jsonb(old) end,'after',case when tg_op <> 'DELETE' then to_jsonb(new) end));
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;
revoke all on function private.audit_achievement_change() from public, anon, authenticated;
create trigger audit_achievement_change before insert or update or delete on public.achievements
  for each row execute function private.audit_achievement_change();

commit;

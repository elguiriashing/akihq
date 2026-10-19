-- Rollback-only acceptance: tests the real grants, RLS, validation and audit.
begin;
do $$
declare v_admin uuid;
begin
  select id into v_admin from public.profiles where app_role='administrator' limit 1;
  if v_admin is null then raise exception 'An existing administrator is required for acceptance'; end if;
  perform set_config('test.achievement_admin',v_admin::text,true);
  perform set_config('request.jwt.claim.sub',v_admin::text,true);
end;
$$;
set local role authenticated;
insert into public.achievements(key,title_es,title_en,description_es,description_en,minimum_xp,icon,active)
values ('a_achievement_acceptance','Prueba temporal','Temporary test','Solo para prueba transaccional.','Rollback-only acceptance fixture.',25,'star',false);
do $$
begin
  if not exists(select 1 from public.achievements where key='a_achievement_acceptance' and not active) then raise exception 'admin draft read failed'; end if;
  if not exists(select 1 from public.moderation_actions where target_type='achievement' and metadata->>'key'='a_achievement_acceptance' and action='achievement_insert') then raise exception 'atomic insert audit missing'; end if;
  begin
    update public.achievements set minimum_xp=0 where key='a_achievement_acceptance';
    raise exception 'invalid XP accepted';
  exception when check_violation then null;
  end;
end;
$$;
set local role anon;
do $$
begin
  if exists(select 1 from public.achievements where key='a_achievement_acceptance') then raise exception 'anon can read drafts'; end if;
  if not exists(select 1 from public.achievements where key='first_step') then raise exception 'anon active read failed'; end if;
  begin
    delete from public.achievements where key='first_step';
    raise exception 'anon delete permitted';
  exception when insufficient_privilege then null;
  end;
end;
$$;
set local role authenticated;
do $$
declare v_count integer;
begin
  -- A valid authenticated identity without an administrator profile.
  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  if exists(select 1 from public.achievements where key='a_achievement_acceptance') then raise exception 'non-admin can read drafts'; end if;
  update public.achievements set active=false where key='first_step';
  get diagnostics v_count=row_count;
  if v_count <> 0 then raise exception 'non-admin update permitted'; end if;
  delete from public.achievements where key='first_step';
  get diagnostics v_count=row_count;
  if v_count <> 0 then raise exception 'non-admin delete permitted'; end if;
  begin
    insert into public.achievements(key,title_es,title_en,description_es,description_en,minimum_xp)
    values ('a_forbidden','No permitido','Forbidden','No permitido','Forbidden',1);
    raise exception 'non-admin insert permitted';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.sub',current_setting('test.achievement_admin'),true);
end;
$$;
update public.achievements set minimum_xp=50,active=true where key='a_achievement_acceptance';
do $$
declare v_count integer;
begin
  update public.achievements set minimum_xp=60 where key='a_achievement_acceptance' and updated_at='2000-01-01';
  get diagnostics v_count=row_count;
  if v_count <> 0 then raise exception 'stale update accepted'; end if;
end;
$$;
set local role anon;
do $$ begin
  if not exists(select 1 from public.achievements where key='a_achievement_acceptance' and minimum_xp=50) then raise exception 'published change is not public'; end if;
end; $$;
set local role authenticated;
delete from public.achievements where key='a_achievement_acceptance';
do $$ begin
  if exists(select 1 from public.achievements where key='a_achievement_acceptance') then raise exception 'admin delete failed'; end if;
  if (select count(*) from public.moderation_actions where target_type='achievement' and metadata->>'key'='a_achievement_acceptance') <> 3 then raise exception 'audit must record exactly insert/update/delete'; end if;
end; $$;
rollback;

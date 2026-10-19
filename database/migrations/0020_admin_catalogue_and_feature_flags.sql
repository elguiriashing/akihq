begin;

create table feature_flags (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{2,63}$'),
  enabled boolean not null default true,
  label_es text not null check (char_length(label_es) between 3 and 160),
  label_en text not null check (char_length(label_en) between 3 and 160),
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

insert into feature_flags(key,enabled,label_es,label_en) values
  ('community_submissions',true,'Sugerencias de eventos','Community event suggestions'),
  ('loyalty_check_ins',true,'Check-ins y recompensas','Check-ins and rewards'),
  ('promotion_requests',true,'Solicitudes de promoción','Promotion requests');

alter table feature_flags enable row level security;
create policy feature_flags_public_read
on feature_flags for select
to anon, authenticated
using (true);

create or replace function require_enabled_feature()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if not coalesce(
    (select enabled from feature_flags where key=TG_ARGV[0]),
    false
  ) then
    raise exception 'feature disabled';
  end if;
  return new;
end;
$$;

create trigger event_submissions_feature_guard
before insert on event_submissions
for each row execute function require_enabled_feature('community_submissions');

create trigger check_ins_feature_guard
before insert on check_ins
for each row execute function require_enabled_feature('loyalty_check_ins');

create trigger promotion_requests_feature_guard
before insert on promotion_requests
for each row execute function require_enabled_feature('promotion_requests');

create or replace function set_feature_flag(
  p_key text,
  p_enabled boolean,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_previous boolean;
begin
  if not has_platform_role(array['administrator']::app_role[]) then
    raise exception 'administrator role required';
  end if;
  if char_length(trim(p_reason)) < 10 then raise exception 'reason required'; end if;

  select enabled into v_previous from feature_flags where key=p_key for update;
  if not found then raise exception 'feature flag not found'; end if;

  update feature_flags
  set enabled=p_enabled,updated_by=auth.uid(),updated_at=now()
  where key=p_key;

  insert into moderation_actions(
    actor_id,action,target_type,target_id,reason,metadata
  ) values (
    auth.uid(),
    'feature_flag_changed',
    'feature_flag',
    md5(p_key)::uuid,
    trim(p_reason),
    jsonb_build_object(
      'key',p_key,
      'previous_enabled',v_previous,
      'enabled',p_enabled
    )
  );
end;
$$;

create or replace function upsert_catalog_category(
  p_category uuid,
  p_slug text,
  p_name_es text,
  p_name_en text,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_id uuid:=coalesce(p_category,gen_random_uuid());
  v_action text;
begin
  if not has_platform_role(array['administrator']::app_role[]) then
    raise exception 'administrator role required';
  end if;
  if p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then raise exception 'invalid slug'; end if;
  if char_length(trim(p_name_es)) not between 2 and 80
    or char_length(trim(p_name_en)) not between 2 and 80
    or char_length(trim(p_reason)) < 10
  then raise exception 'invalid category'; end if;

  v_action:=case when exists(select 1 from categories where id=v_id)
    then 'category_updated' else 'category_created' end;

  insert into categories(id,slug,name_es,name_en)
  values(v_id,trim(p_slug),trim(p_name_es),trim(p_name_en))
  on conflict(id) do update set
    slug=excluded.slug,
    name_es=excluded.name_es,
    name_en=excluded.name_en;

  insert into moderation_actions(
    actor_id,action,target_type,target_id,reason,metadata
  ) values (
    auth.uid(),v_action,'category',v_id,trim(p_reason),
    jsonb_build_object('slug',trim(p_slug))
  );
  return v_id;
end;
$$;

create or replace function upsert_catalog_city(
  p_city uuid,
  p_slug text,
  p_name_es text,
  p_name_en text,
  p_latitude double precision,
  p_longitude double precision,
  p_timezone text,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_id uuid:=coalesce(p_city,gen_random_uuid());
  v_action text;
begin
  if not has_platform_role(array['administrator']::app_role[]) then
    raise exception 'administrator role required';
  end if;
  if p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then raise exception 'invalid slug'; end if;
  if char_length(trim(p_name_es)) not between 2 and 120
    or char_length(trim(p_name_en)) not between 2 and 120
    or p_latitude not between 27.0 and 44.5
    or p_longitude not between -19.0 and 5.0
    or p_timezone not in ('Europe/Madrid','Atlantic/Canary')
    or char_length(trim(p_reason)) < 10
  then raise exception 'invalid city'; end if;

  v_action:=case when exists(select 1 from cities where id=v_id)
    then 'city_updated' else 'city_created' end;

  insert into cities(id,slug,name_es,name_en,center,timezone)
  values(
    v_id,trim(p_slug),trim(p_name_es),trim(p_name_en),
    st_setsrid(st_makepoint(p_longitude,p_latitude),4326)::geography,
    p_timezone
  )
  on conflict(id) do update set
    slug=excluded.slug,
    name_es=excluded.name_es,
    name_en=excluded.name_en,
    center=excluded.center,
    timezone=excluded.timezone;

  insert into moderation_actions(
    actor_id,action,target_type,target_id,reason,metadata
  ) values (
    auth.uid(),v_action,'city',v_id,trim(p_reason),
    jsonb_build_object(
      'slug',trim(p_slug),
      'latitude',p_latitude,
      'longitude',p_longitude,
      'timezone',p_timezone
    )
  );
  return v_id;
end;
$$;

revoke all on function require_enabled_feature() from public;
revoke all on function set_feature_flag(text,boolean,text) from public;
revoke all on function upsert_catalog_category(uuid,text,text,text,text) from public;
revoke all on function upsert_catalog_city(uuid,text,text,text,double precision,double precision,text,text) from public;
grant execute on function set_feature_flag(text,boolean,text) to authenticated;
grant execute on function upsert_catalog_category(uuid,text,text,text,text) to authenticated;
grant execute on function upsert_catalog_city(uuid,text,text,text,double precision,double precision,text,text) to authenticated;

commit;

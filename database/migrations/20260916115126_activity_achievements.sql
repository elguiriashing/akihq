begin;

create table public.achievement_cities (
 key text primary key, title_es text not null, title_en text not null, aliases text[] not null
);
create table public.achievement_categories (
 key text primary key, title_es text not null, title_en text not null
);
alter table public.achievement_cities enable row level security;
alter table public.achievement_categories enable row level security;
revoke all on public.achievement_cities,public.achievement_categories from public,anon,authenticated;
grant select on public.achievement_cities,public.achievement_categories to anon,authenticated;
create policy achievement_cities_read on public.achievement_cities for select to anon,authenticated using (true);
create policy achievement_categories_read on public.achievement_categories for select to anon,authenticated using (true);

alter table public.achievements
 add column condition_type text not null default 'xp' check(condition_type in ('xp','venues','check_ins','cities','categories','active_days','regular','weekend')),
 add column target_count integer not null default 1 check(target_count between 1 and 1000000),
 add column city_key text references public.achievement_cities(key),
 add column category_key text references public.achievement_categories(key),
 add constraint achievement_scope_check check(condition_type='venues' or (city_key is null and category_key is null));
create index achievements_city_idx on public.achievements(city_key) where city_key is not null;
create index achievements_category_idx on public.achievements(category_key) where category_key is not null;
-- Seeding is a schema migration, not a user edit. The migration history records it.
-- Restore the unchanged administrator-only audit trigger before committing.
alter table public.achievements disable trigger audit_achievement_change;
update public.achievements set target_count=minimum_xp;

create table public.venue_achievement_categories (
 venue_id uuid not null references public.venues(id) on delete cascade,
 category_key text not null references public.achievement_categories(key),
 primary key(venue_id,category_key)
);
create index venue_achievement_category_idx on public.venue_achievement_categories(category_key,venue_id);
alter table public.venue_achievement_categories enable row level security;
revoke all on public.venue_achievement_categories from public,anon,authenticated;
grant select on public.venue_achievement_categories to anon,authenticated;
grant insert,delete on public.venue_achievement_categories to authenticated;
create policy venue_achievement_categories_read on public.venue_achievement_categories for select to anon,authenticated using (
 exists(select 1 from public.venues v where v.id=venue_id)
);
create policy venue_achievement_categories_admin_insert on public.venue_achievement_categories for insert to authenticated with check ((select public.has_platform_role(array['administrator']::public.app_role[])));
create policy venue_achievement_categories_admin_delete on public.venue_achievement_categories for delete to authenticated using ((select public.has_platform_role(array['administrator']::public.app_role[])));
create function private.audit_venue_achievement_category() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.has_platform_role(array['administrator']::public.app_role[]) then raise exception 'administrator required' using errcode='42501'; end if;
 insert into public.moderation_actions(actor_id,action,target_type,target_id,reason,metadata)
 values(auth.uid(),'achievement_category_'||lower(tg_op),'venue',coalesce(new.venue_id,old.venue_id),'Achievement venue classification',jsonb_build_object('before',case when tg_op='DELETE' then to_jsonb(old) end,'after',case when tg_op='INSERT' then to_jsonb(new) end));
 if tg_op='DELETE' then return old; else return new; end if;
end; $$;
revoke all on function private.audit_venue_achievement_category() from public,anon,authenticated;
create trigger audit_venue_achievement_category before insert or delete on public.venue_achievement_categories for each row execute function private.audit_venue_achievement_category();

-- Keep awarded identities even if an admin hides/deletes a definition. Deletion of
-- a user still cascades. Clients cannot insert awards or choose another profile.
create table public.achievement_unlocks (
 profile_id uuid not null references public.profiles(id) on delete cascade,
 achievement_key text not null,
 unlocked_at timestamptz not null default now(),
 check_in_id uuid references public.check_ins(id) on delete set null,
 primary key(profile_id,achievement_key)
);
create index achievement_unlocks_check_in_idx on public.achievement_unlocks(check_in_id) where check_in_id is not null;
alter table public.achievement_unlocks enable row level security;
revoke all on public.achievement_unlocks from public,anon,authenticated;
grant select on public.achievement_unlocks to authenticated;
create policy achievement_unlocks_own_read on public.achievement_unlocks for select to authenticated using (profile_id=(select auth.uid()));

create function private.achievement_city_normalize(value text) returns text
language sql immutable strict set search_path='' as $$
 select trim(both '-' from regexp_replace(translate(lower(value),'áàäâãåéèëêíìïîóòöôõúùüûñç','aaaaaaeeeeiiiiooooouuuunc'),'[^a-z0-9]+','-','g'));
$$;
revoke all on function private.achievement_city_normalize(text) from public,anon,authenticated;

-- Aggregate accepted, location-verified activity once. Repeated visits never
-- inflate distinct-place milestones. City aliases merge duplicate city records.
create function private.achievement_counts(p_profile uuid)
returns table(achievement_key text,current_count bigint)
language sql stable set search_path='' as $$
 with visits as materialized (
  select ci.id,ci.venue_id,
   (ci.created_at at time zone coalesce(c.timezone,'Europe/Madrid'))::date visit_day,
   coalesce(ac.key,private.achievement_city_normalize(c.name_es)) city
  from public.check_ins ci join public.venues v on v.id=ci.venue_id join public.cities c on c.id=v.city_id
  left join lateral (
   select a.key from public.achievement_cities a where
    private.achievement_city_normalize(c.name_es)=any(a.aliases)
    or private.achievement_city_normalize(c.name_en)=any(a.aliases)
    or c.slug=a.key or c.slug like a.key||'-%'
   order by length(a.key) desc,a.key limit 1
  ) ac on true
  where ci.profile_id=p_profile and ci.state='accepted'
 ), grouped_places as materialized (
  select distinct v.venue_id,v.city,t.category_key from visits v left join public.venue_achievement_categories t on t.venue_id=v.venue_id
 ), totals as (
  select count(*) check_ins,count(distinct city) cities,count(distinct visit_day) active_days,
   count(distinct visit_day) filter(where extract(isodow from visit_day) in (6,7)) weekend from visits
 ), counts as (
  select a.key,
   case a.condition_type
    when 'xp' then greatest(0,(select coalesce(sum(delta),0) from public.xp_ledger where profile_id=p_profile))
    when 'venues' then (select count(distinct v.venue_id) from grouped_places v where (a.city_key is null or v.city=a.city_key) and (a.category_key is null or v.category_key=a.category_key))
    when 'check_ins' then t.check_ins
    when 'cities' then t.cities
    when 'categories' then (select count(distinct category_key) from grouped_places)
    when 'active_days' then t.active_days
    when 'weekend' then t.weekend
    when 'regular' then (select coalesce(max(n),0) from (select count(*) n from visits group by venue_id) r)
   end value
  from public.achievements a cross join totals t where a.active
 ) select key,value::bigint from counts;
$$;
revoke all on function private.achievement_counts(uuid) from public,anon,authenticated;

create function private.award_achievements(p_profile uuid,p_check_in uuid default null) returns void
language plpgsql set search_path='' as $$
begin
 -- Serialise awards per profile; duplicate requests cannot award a badge twice.
 perform pg_advisory_xact_lock(hashtextextended('achievements:'||p_profile::text,0));
 insert into public.achievement_unlocks(profile_id,achievement_key,check_in_id)
 select p_profile,c.achievement_key,p_check_in from private.achievement_counts(p_profile) c
 join public.achievements a on a.key=c.achievement_key
 where c.current_count >= case when a.condition_type='xp' then a.minimum_xp else a.target_count end
 on conflict(profile_id,achievement_key) do nothing;
end; $$;
revoke all on function private.award_achievements(uuid,uuid) from public,anon,authenticated;

create function private.achievement_xp_award_trigger() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 -- XP writes are already server-only. Never award against another user's session.
 if auth.uid() is not null and auth.uid()<>new.profile_id then raise exception 'profile mismatch' using errcode='42501'; end if;
 if new.check_in_id is null or exists(select 1 from public.check_ins c where c.id=new.check_in_id and c.profile_id=new.profile_id and c.state='accepted') then
  perform private.award_achievements(new.profile_id,new.check_in_id);
 end if;
 return new;
end; $$;
revoke all on function private.achievement_xp_award_trigger() from public,anon,authenticated;
create trigger achievement_xp_award after insert on public.xp_ledger for each row execute function private.achievement_xp_award_trigger();

-- Reconcile historical activity/newly published rules when opening rewards.
-- No profile argument: a signed-in user can only retrieve and award their own.
create function private.my_achievement_progress() returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_user uuid := auth.uid(); v_result jsonb;
begin
 if v_user is null then raise exception 'authentication required' using errcode='42501'; end if;
 perform private.award_achievements(v_user);
 select coalesce(jsonb_agg(to_jsonb(a)||jsonb_build_object('current_count',c.current_count,'unlocked_at',u.unlocked_at) order by a.key),'[]'::jsonb)
 into v_result from public.achievements a
 join private.achievement_counts(v_user) c on c.achievement_key=a.key
 left join public.achievement_unlocks u on u.profile_id=v_user and u.achievement_key=a.key where a.active;
 return v_result;
end; $$;
revoke all on function private.my_achievement_progress() from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.my_achievement_progress() to authenticated;
create function public.my_achievement_progress() returns jsonb
language sql security invoker set search_path='' as $$ select private.my_achievement_progress(); $$;
revoke all on function public.my_achievement_progress() from public,anon,authenticated;
grant execute on function public.my_achievement_progress() to authenticated;

insert into public.achievement_cities(key,title_es,title_en,aliases) values
('a-coruna','A Coruña','A Coruña',array['a-coruna','la-coruna']),
('albacete','Albacete','Albacete',array['albacete']),
('alicante','Alicante','Alicante',array['alicante','alacant']),
('almeria','Almería','Almería',array['almeria']),
('avila','Ávila','Ávila',array['avila']),
('badajoz','Badajoz','Badajoz',array['badajoz']),
('barcelona','Barcelona','Barcelona',array['barcelona']),
('bilbao','Bilbao','Bilbao',array['bilbao']),
('burgos','Burgos','Burgos',array['burgos']),
('caceres','Cáceres','Cáceres',array['caceres']),
('cadiz','Cádiz','Cádiz',array['cadiz']),
('castellon','Castelló de la Plana','Castellón',array['castellon','castello-de-la-plana']),
('ceuta','Ceuta','Ceuta',array['ceuta']),
('ciudad-real','Ciudad Real','Ciudad Real',array['ciudad-real']),
('cordoba','Córdoba','Córdoba',array['cordoba']),
('cuenca','Cuenca','Cuenca',array['cuenca']),
('donostia-san-sebastian','Donostia / San Sebastián','San Sebastián',array['donostia-san-sebastian','san-sebastian','donostia']),
('girona','Girona','Girona',array['girona','gerona']),
('granada','Granada','Granada',array['granada']),
('guadalajara','Guadalajara','Guadalajara',array['guadalajara']),
('huelva','Huelva','Huelva',array['huelva']),
('huesca','Huesca','Huesca',array['huesca']),
('jaen','Jaén','Jaén',array['jaen']),
('las-palmas','Las Palmas de Gran Canaria','Las Palmas',array['las-palmas','las-palmas-de-gran-canaria']),
('leon','León','León',array['leon']),
('lleida','Lleida','Lleida',array['lleida','lerida']),
('logrono','Logroño','Logroño',array['logrono']),
('lugo','Lugo','Lugo',array['lugo']),
('madrid','Madrid','Madrid',array['madrid']),
('malaga','Málaga','Málaga',array['malaga']),
('melilla','Melilla','Melilla',array['melilla']),
('murcia','Murcia','Murcia',array['murcia']),
('ourense','Ourense','Ourense',array['ourense']),
('oviedo','Oviedo','Oviedo',array['oviedo']),
('palencia','Palencia','Palencia',array['palencia']),
('palma','Palma','Palma',array['palma','palma-de-mallorca']),
('pamplona','Pamplona / Iruña','Pamplona',array['pamplona','pamplona-iruna']),
('pontevedra','Pontevedra','Pontevedra',array['pontevedra']),
('salamanca','Salamanca','Salamanca',array['salamanca']),
('santa-cruz-tenerife','Santa Cruz de Tenerife','Santa Cruz de Tenerife',array['santa-cruz-tenerife','santa-cruz-de-tenerife']),
('santander','Santander','Santander',array['santander']),
('segovia','Segovia','Segovia',array['segovia']),
('sevilla','Sevilla','Seville',array['sevilla','seville']),
('soria','Soria','Soria',array['soria']),
('tarragona','Tarragona','Tarragona',array['tarragona']),
('teruel','Teruel','Teruel',array['teruel']),
('toledo','Toledo','Toledo',array['toledo']),
('valencia','València','Valencia',array['valencia']),
('valladolid','Valladolid','Valladolid',array['valladolid']),
('vitoria-gasteiz','Vitoria-Gasteiz','Vitoria-Gasteiz',array['vitoria-gasteiz','vitoria']),
('zamora','Zamora','Zamora',array['zamora']),
('zaragoza','Zaragoza','Zaragoza',array['zaragoza']),
('vigo','Vigo','Vigo',array['vigo']),
('gijon','Gijón','Gijón',array['gijon']),
('elche','Elche','Elche',array['elche','elx']),
('jerez','Jerez de la Frontera','Jerez de la Frontera',array['jerez','jerez-de-la-frontera']),
('cartagena','Cartagena','Cartagena',array['cartagena']),
('marbella','Marbella','Marbella',array['marbella']),
('santiago','Santiago de Compostela','Santiago de Compostela',array['santiago','santiago-de-compostela']),
('merida','Mérida','Mérida',array['merida']),
('badalona','Badalona','Badalona',array['badalona']),
('sabadell','Sabadell','Sabadell',array['sabadell']),
('la-laguna','San Cristóbal de La Laguna','San Cristóbal de La Laguna',array['la-laguna','san-cristobal-de-la-laguna']),
('ibiza','Ibiza','Ibiza',array['ibiza','eivissa']),
('alcala','Alcalá de Henares','Alcalá de Henares',array['alcala','alcala-de-henares']),
('terrassa','Terrassa','Terrassa',array['terrassa']),
('fuengirola','Fuengirola','Fuengirola',array['fuengirola','boliches','los-boliches','carvajal','torreblanca-carvajal']);

insert into public.achievement_categories(key,title_es,title_en) values
('restaurant','Restaurantes','Restaurants'),
('cafe','Cafeterías','Cafés'),
('bar','Bares y tapas','Bars & tapas'),
('nightlife','Ocio nocturno','Nightlife'),
('culture','Arte y cultura','Arts & culture'),
('shopping','Tiendas y mercados','Shops & markets'),
('sport','Deporte','Sport'),
('wellness','Bienestar','Wellness'),
('family','Planes familiares','Family activities'),
('outdoors','Naturaleza y aire libre','Nature & outdoors');

insert into public.achievements(key,title_es,title_en,description_es,description_en,condition_type,target_count,icon,city_key,category_key,minimum_xp,active) values
('city_a_coruna_1','A Coruña: Principiante','A Coruña Novice','Haz check-in válido en 1 local distinto de A Coruña.','Complete valid check-ins at 1 distinct place in A Coruña.','venues',1,'discover','a-coruna',null,1000000,true),
('city_a_coruna_5','A Coruña: Aficionado','A Coruña Amateur','Haz check-in válido en 5 locales distintos de A Coruña.','Complete valid check-ins at 5 distinct places in A Coruña.','venues',5,'discover','a-coruna',null,1000000,true),
('city_a_coruna_10','A Coruña: Explorador','A Coruña Explorer','Haz check-in válido en 10 locales distintos de A Coruña.','Complete valid check-ins at 10 distinct places in A Coruña.','venues',10,'discover','a-coruna',null,1000000,true),
('city_a_coruna_25','A Coruña: Conocedor','A Coruña Insider','Haz check-in válido en 25 locales distintos de A Coruña.','Complete valid check-ins at 25 distinct places in A Coruña.','venues',25,'discover','a-coruna',null,1000000,true),
('city_a_coruna_50','A Coruña: Experto','A Coruña Expert','Haz check-in válido en 50 locales distintos de A Coruña.','Complete valid check-ins at 50 distinct places in A Coruña.','venues',50,'discover','a-coruna',null,1000000,true),
('city_a_coruna_100','A Coruña: Leyenda','A Coruña Legend','Haz check-in válido en 100 locales distintos de A Coruña.','Complete valid check-ins at 100 distinct places in A Coruña.','venues',100,'discover','a-coruna',null,1000000,true),
('city_albacete_1','Albacete: Principiante','Albacete Novice','Haz check-in válido en 1 local distinto de Albacete.','Complete valid check-ins at 1 distinct place in Albacete.','venues',1,'discover','albacete',null,1000000,true),
('city_albacete_5','Albacete: Aficionado','Albacete Amateur','Haz check-in válido en 5 locales distintos de Albacete.','Complete valid check-ins at 5 distinct places in Albacete.','venues',5,'discover','albacete',null,1000000,true),
('city_albacete_10','Albacete: Explorador','Albacete Explorer','Haz check-in válido en 10 locales distintos de Albacete.','Complete valid check-ins at 10 distinct places in Albacete.','venues',10,'discover','albacete',null,1000000,true),
('city_albacete_25','Albacete: Conocedor','Albacete Insider','Haz check-in válido en 25 locales distintos de Albacete.','Complete valid check-ins at 25 distinct places in Albacete.','venues',25,'discover','albacete',null,1000000,true),
('city_albacete_50','Albacete: Experto','Albacete Expert','Haz check-in válido en 50 locales distintos de Albacete.','Complete valid check-ins at 50 distinct places in Albacete.','venues',50,'discover','albacete',null,1000000,true),
('city_albacete_100','Albacete: Leyenda','Albacete Legend','Haz check-in válido en 100 locales distintos de Albacete.','Complete valid check-ins at 100 distinct places in Albacete.','venues',100,'discover','albacete',null,1000000,true),
('city_alicante_1','Alicante: Principiante','Alicante Novice','Haz check-in válido en 1 local distinto de Alicante.','Complete valid check-ins at 1 distinct place in Alicante.','venues',1,'discover','alicante',null,1000000,true),
('city_alicante_5','Alicante: Aficionado','Alicante Amateur','Haz check-in válido en 5 locales distintos de Alicante.','Complete valid check-ins at 5 distinct places in Alicante.','venues',5,'discover','alicante',null,1000000,true),
('city_alicante_10','Alicante: Explorador','Alicante Explorer','Haz check-in válido en 10 locales distintos de Alicante.','Complete valid check-ins at 10 distinct places in Alicante.','venues',10,'discover','alicante',null,1000000,true),
('city_alicante_25','Alicante: Conocedor','Alicante Insider','Haz check-in válido en 25 locales distintos de Alicante.','Complete valid check-ins at 25 distinct places in Alicante.','venues',25,'discover','alicante',null,1000000,true),
('city_alicante_50','Alicante: Experto','Alicante Expert','Haz check-in válido en 50 locales distintos de Alicante.','Complete valid check-ins at 50 distinct places in Alicante.','venues',50,'discover','alicante',null,1000000,true),
('city_alicante_100','Alicante: Leyenda','Alicante Legend','Haz check-in válido en 100 locales distintos de Alicante.','Complete valid check-ins at 100 distinct places in Alicante.','venues',100,'discover','alicante',null,1000000,true),
('city_almeria_1','Almería: Principiante','Almería Novice','Haz check-in válido en 1 local distinto de Almería.','Complete valid check-ins at 1 distinct place in Almería.','venues',1,'discover','almeria',null,1000000,true),
('city_almeria_5','Almería: Aficionado','Almería Amateur','Haz check-in válido en 5 locales distintos de Almería.','Complete valid check-ins at 5 distinct places in Almería.','venues',5,'discover','almeria',null,1000000,true),
('city_almeria_10','Almería: Explorador','Almería Explorer','Haz check-in válido en 10 locales distintos de Almería.','Complete valid check-ins at 10 distinct places in Almería.','venues',10,'discover','almeria',null,1000000,true),
('city_almeria_25','Almería: Conocedor','Almería Insider','Haz check-in válido en 25 locales distintos de Almería.','Complete valid check-ins at 25 distinct places in Almería.','venues',25,'discover','almeria',null,1000000,true),
('city_almeria_50','Almería: Experto','Almería Expert','Haz check-in válido en 50 locales distintos de Almería.','Complete valid check-ins at 50 distinct places in Almería.','venues',50,'discover','almeria',null,1000000,true),
('city_almeria_100','Almería: Leyenda','Almería Legend','Haz check-in válido en 100 locales distintos de Almería.','Complete valid check-ins at 100 distinct places in Almería.','venues',100,'discover','almeria',null,1000000,true),
('city_avila_1','Ávila: Principiante','Ávila Novice','Haz check-in válido en 1 local distinto de Ávila.','Complete valid check-ins at 1 distinct place in Ávila.','venues',1,'discover','avila',null,1000000,true),
('city_avila_5','Ávila: Aficionado','Ávila Amateur','Haz check-in válido en 5 locales distintos de Ávila.','Complete valid check-ins at 5 distinct places in Ávila.','venues',5,'discover','avila',null,1000000,true),
('city_avila_10','Ávila: Explorador','Ávila Explorer','Haz check-in válido en 10 locales distintos de Ávila.','Complete valid check-ins at 10 distinct places in Ávila.','venues',10,'discover','avila',null,1000000,true),
('city_avila_25','Ávila: Conocedor','Ávila Insider','Haz check-in válido en 25 locales distintos de Ávila.','Complete valid check-ins at 25 distinct places in Ávila.','venues',25,'discover','avila',null,1000000,true),
('city_avila_50','Ávila: Experto','Ávila Expert','Haz check-in válido en 50 locales distintos de Ávila.','Complete valid check-ins at 50 distinct places in Ávila.','venues',50,'discover','avila',null,1000000,true),
('city_avila_100','Ávila: Leyenda','Ávila Legend','Haz check-in válido en 100 locales distintos de Ávila.','Complete valid check-ins at 100 distinct places in Ávila.','venues',100,'discover','avila',null,1000000,true),
('city_badajoz_1','Badajoz: Principiante','Badajoz Novice','Haz check-in válido en 1 local distinto de Badajoz.','Complete valid check-ins at 1 distinct place in Badajoz.','venues',1,'discover','badajoz',null,1000000,true),
('city_badajoz_5','Badajoz: Aficionado','Badajoz Amateur','Haz check-in válido en 5 locales distintos de Badajoz.','Complete valid check-ins at 5 distinct places in Badajoz.','venues',5,'discover','badajoz',null,1000000,true),
('city_badajoz_10','Badajoz: Explorador','Badajoz Explorer','Haz check-in válido en 10 locales distintos de Badajoz.','Complete valid check-ins at 10 distinct places in Badajoz.','venues',10,'discover','badajoz',null,1000000,true),
('city_badajoz_25','Badajoz: Conocedor','Badajoz Insider','Haz check-in válido en 25 locales distintos de Badajoz.','Complete valid check-ins at 25 distinct places in Badajoz.','venues',25,'discover','badajoz',null,1000000,true),
('city_badajoz_50','Badajoz: Experto','Badajoz Expert','Haz check-in válido en 50 locales distintos de Badajoz.','Complete valid check-ins at 50 distinct places in Badajoz.','venues',50,'discover','badajoz',null,1000000,true),
('city_badajoz_100','Badajoz: Leyenda','Badajoz Legend','Haz check-in válido en 100 locales distintos de Badajoz.','Complete valid check-ins at 100 distinct places in Badajoz.','venues',100,'discover','badajoz',null,1000000,true),
('city_barcelona_1','Barcelona: Principiante','Barcelona Novice','Haz check-in válido en 1 local distinto de Barcelona.','Complete valid check-ins at 1 distinct place in Barcelona.','venues',1,'discover','barcelona',null,1000000,true),
('city_barcelona_5','Barcelona: Aficionado','Barcelona Amateur','Haz check-in válido en 5 locales distintos de Barcelona.','Complete valid check-ins at 5 distinct places in Barcelona.','venues',5,'discover','barcelona',null,1000000,true),
('city_barcelona_10','Barcelona: Explorador','Barcelona Explorer','Haz check-in válido en 10 locales distintos de Barcelona.','Complete valid check-ins at 10 distinct places in Barcelona.','venues',10,'discover','barcelona',null,1000000,true),
('city_barcelona_25','Barcelona: Conocedor','Barcelona Insider','Haz check-in válido en 25 locales distintos de Barcelona.','Complete valid check-ins at 25 distinct places in Barcelona.','venues',25,'discover','barcelona',null,1000000,true),
('city_barcelona_50','Barcelona: Experto','Barcelona Expert','Haz check-in válido en 50 locales distintos de Barcelona.','Complete valid check-ins at 50 distinct places in Barcelona.','venues',50,'discover','barcelona',null,1000000,true),
('city_barcelona_100','Barcelona: Leyenda','Barcelona Legend','Haz check-in válido en 100 locales distintos de Barcelona.','Complete valid check-ins at 100 distinct places in Barcelona.','venues',100,'discover','barcelona',null,1000000,true),
('city_bilbao_1','Bilbao: Principiante','Bilbao Novice','Haz check-in válido en 1 local distinto de Bilbao.','Complete valid check-ins at 1 distinct place in Bilbao.','venues',1,'discover','bilbao',null,1000000,true),
('city_bilbao_5','Bilbao: Aficionado','Bilbao Amateur','Haz check-in válido en 5 locales distintos de Bilbao.','Complete valid check-ins at 5 distinct places in Bilbao.','venues',5,'discover','bilbao',null,1000000,true),
('city_bilbao_10','Bilbao: Explorador','Bilbao Explorer','Haz check-in válido en 10 locales distintos de Bilbao.','Complete valid check-ins at 10 distinct places in Bilbao.','venues',10,'discover','bilbao',null,1000000,true),
('city_bilbao_25','Bilbao: Conocedor','Bilbao Insider','Haz check-in válido en 25 locales distintos de Bilbao.','Complete valid check-ins at 25 distinct places in Bilbao.','venues',25,'discover','bilbao',null,1000000,true),
('city_bilbao_50','Bilbao: Experto','Bilbao Expert','Haz check-in válido en 50 locales distintos de Bilbao.','Complete valid check-ins at 50 distinct places in Bilbao.','venues',50,'discover','bilbao',null,1000000,true),
('city_bilbao_100','Bilbao: Leyenda','Bilbao Legend','Haz check-in válido en 100 locales distintos de Bilbao.','Complete valid check-ins at 100 distinct places in Bilbao.','venues',100,'discover','bilbao',null,1000000,true),
('city_burgos_1','Burgos: Principiante','Burgos Novice','Haz check-in válido en 1 local distinto de Burgos.','Complete valid check-ins at 1 distinct place in Burgos.','venues',1,'discover','burgos',null,1000000,true),
('city_burgos_5','Burgos: Aficionado','Burgos Amateur','Haz check-in válido en 5 locales distintos de Burgos.','Complete valid check-ins at 5 distinct places in Burgos.','venues',5,'discover','burgos',null,1000000,true),
('city_burgos_10','Burgos: Explorador','Burgos Explorer','Haz check-in válido en 10 locales distintos de Burgos.','Complete valid check-ins at 10 distinct places in Burgos.','venues',10,'discover','burgos',null,1000000,true),
('city_burgos_25','Burgos: Conocedor','Burgos Insider','Haz check-in válido en 25 locales distintos de Burgos.','Complete valid check-ins at 25 distinct places in Burgos.','venues',25,'discover','burgos',null,1000000,true),
('city_burgos_50','Burgos: Experto','Burgos Expert','Haz check-in válido en 50 locales distintos de Burgos.','Complete valid check-ins at 50 distinct places in Burgos.','venues',50,'discover','burgos',null,1000000,true),
('city_burgos_100','Burgos: Leyenda','Burgos Legend','Haz check-in válido en 100 locales distintos de Burgos.','Complete valid check-ins at 100 distinct places in Burgos.','venues',100,'discover','burgos',null,1000000,true),
('city_caceres_1','Cáceres: Principiante','Cáceres Novice','Haz check-in válido en 1 local distinto de Cáceres.','Complete valid check-ins at 1 distinct place in Cáceres.','venues',1,'discover','caceres',null,1000000,true),
('city_caceres_5','Cáceres: Aficionado','Cáceres Amateur','Haz check-in válido en 5 locales distintos de Cáceres.','Complete valid check-ins at 5 distinct places in Cáceres.','venues',5,'discover','caceres',null,1000000,true),
('city_caceres_10','Cáceres: Explorador','Cáceres Explorer','Haz check-in válido en 10 locales distintos de Cáceres.','Complete valid check-ins at 10 distinct places in Cáceres.','venues',10,'discover','caceres',null,1000000,true),
('city_caceres_25','Cáceres: Conocedor','Cáceres Insider','Haz check-in válido en 25 locales distintos de Cáceres.','Complete valid check-ins at 25 distinct places in Cáceres.','venues',25,'discover','caceres',null,1000000,true),
('city_caceres_50','Cáceres: Experto','Cáceres Expert','Haz check-in válido en 50 locales distintos de Cáceres.','Complete valid check-ins at 50 distinct places in Cáceres.','venues',50,'discover','caceres',null,1000000,true),
('city_caceres_100','Cáceres: Leyenda','Cáceres Legend','Haz check-in válido en 100 locales distintos de Cáceres.','Complete valid check-ins at 100 distinct places in Cáceres.','venues',100,'discover','caceres',null,1000000,true),
('city_cadiz_1','Cádiz: Principiante','Cádiz Novice','Haz check-in válido en 1 local distinto de Cádiz.','Complete valid check-ins at 1 distinct place in Cádiz.','venues',1,'discover','cadiz',null,1000000,true),
('city_cadiz_5','Cádiz: Aficionado','Cádiz Amateur','Haz check-in válido en 5 locales distintos de Cádiz.','Complete valid check-ins at 5 distinct places in Cádiz.','venues',5,'discover','cadiz',null,1000000,true),
('city_cadiz_10','Cádiz: Explorador','Cádiz Explorer','Haz check-in válido en 10 locales distintos de Cádiz.','Complete valid check-ins at 10 distinct places in Cádiz.','venues',10,'discover','cadiz',null,1000000,true),
('city_cadiz_25','Cádiz: Conocedor','Cádiz Insider','Haz check-in válido en 25 locales distintos de Cádiz.','Complete valid check-ins at 25 distinct places in Cádiz.','venues',25,'discover','cadiz',null,1000000,true),
('city_cadiz_50','Cádiz: Experto','Cádiz Expert','Haz check-in válido en 50 locales distintos de Cádiz.','Complete valid check-ins at 50 distinct places in Cádiz.','venues',50,'discover','cadiz',null,1000000,true),
('city_cadiz_100','Cádiz: Leyenda','Cádiz Legend','Haz check-in válido en 100 locales distintos de Cádiz.','Complete valid check-ins at 100 distinct places in Cádiz.','venues',100,'discover','cadiz',null,1000000,true),
('city_castellon_1','Castelló de la Plana: Principiante','Castellón Novice','Haz check-in válido en 1 local distinto de Castelló de la Plana.','Complete valid check-ins at 1 distinct place in Castellón.','venues',1,'discover','castellon',null,1000000,true),
('city_castellon_5','Castelló de la Plana: Aficionado','Castellón Amateur','Haz check-in válido en 5 locales distintos de Castelló de la Plana.','Complete valid check-ins at 5 distinct places in Castellón.','venues',5,'discover','castellon',null,1000000,true),
('city_castellon_10','Castelló de la Plana: Explorador','Castellón Explorer','Haz check-in válido en 10 locales distintos de Castelló de la Plana.','Complete valid check-ins at 10 distinct places in Castellón.','venues',10,'discover','castellon',null,1000000,true),
('city_castellon_25','Castelló de la Plana: Conocedor','Castellón Insider','Haz check-in válido en 25 locales distintos de Castelló de la Plana.','Complete valid check-ins at 25 distinct places in Castellón.','venues',25,'discover','castellon',null,1000000,true),
('city_castellon_50','Castelló de la Plana: Experto','Castellón Expert','Haz check-in válido en 50 locales distintos de Castelló de la Plana.','Complete valid check-ins at 50 distinct places in Castellón.','venues',50,'discover','castellon',null,1000000,true),
('city_castellon_100','Castelló de la Plana: Leyenda','Castellón Legend','Haz check-in válido en 100 locales distintos de Castelló de la Plana.','Complete valid check-ins at 100 distinct places in Castellón.','venues',100,'discover','castellon',null,1000000,true),
('city_ceuta_1','Ceuta: Principiante','Ceuta Novice','Haz check-in válido en 1 local distinto de Ceuta.','Complete valid check-ins at 1 distinct place in Ceuta.','venues',1,'discover','ceuta',null,1000000,true),
('city_ceuta_5','Ceuta: Aficionado','Ceuta Amateur','Haz check-in válido en 5 locales distintos de Ceuta.','Complete valid check-ins at 5 distinct places in Ceuta.','venues',5,'discover','ceuta',null,1000000,true),
('city_ceuta_10','Ceuta: Explorador','Ceuta Explorer','Haz check-in válido en 10 locales distintos de Ceuta.','Complete valid check-ins at 10 distinct places in Ceuta.','venues',10,'discover','ceuta',null,1000000,true),
('city_ceuta_25','Ceuta: Conocedor','Ceuta Insider','Haz check-in válido en 25 locales distintos de Ceuta.','Complete valid check-ins at 25 distinct places in Ceuta.','venues',25,'discover','ceuta',null,1000000,true),
('city_ceuta_50','Ceuta: Experto','Ceuta Expert','Haz check-in válido en 50 locales distintos de Ceuta.','Complete valid check-ins at 50 distinct places in Ceuta.','venues',50,'discover','ceuta',null,1000000,true),
('city_ceuta_100','Ceuta: Leyenda','Ceuta Legend','Haz check-in válido en 100 locales distintos de Ceuta.','Complete valid check-ins at 100 distinct places in Ceuta.','venues',100,'discover','ceuta',null,1000000,true),
('city_ciudad_real_1','Ciudad Real: Principiante','Ciudad Real Novice','Haz check-in válido en 1 local distinto de Ciudad Real.','Complete valid check-ins at 1 distinct place in Ciudad Real.','venues',1,'discover','ciudad-real',null,1000000,true),
('city_ciudad_real_5','Ciudad Real: Aficionado','Ciudad Real Amateur','Haz check-in válido en 5 locales distintos de Ciudad Real.','Complete valid check-ins at 5 distinct places in Ciudad Real.','venues',5,'discover','ciudad-real',null,1000000,true),
('city_ciudad_real_10','Ciudad Real: Explorador','Ciudad Real Explorer','Haz check-in válido en 10 locales distintos de Ciudad Real.','Complete valid check-ins at 10 distinct places in Ciudad Real.','venues',10,'discover','ciudad-real',null,1000000,true),
('city_ciudad_real_25','Ciudad Real: Conocedor','Ciudad Real Insider','Haz check-in válido en 25 locales distintos de Ciudad Real.','Complete valid check-ins at 25 distinct places in Ciudad Real.','venues',25,'discover','ciudad-real',null,1000000,true),
('city_ciudad_real_50','Ciudad Real: Experto','Ciudad Real Expert','Haz check-in válido en 50 locales distintos de Ciudad Real.','Complete valid check-ins at 50 distinct places in Ciudad Real.','venues',50,'discover','ciudad-real',null,1000000,true),
('city_ciudad_real_100','Ciudad Real: Leyenda','Ciudad Real Legend','Haz check-in válido en 100 locales distintos de Ciudad Real.','Complete valid check-ins at 100 distinct places in Ciudad Real.','venues',100,'discover','ciudad-real',null,1000000,true),
('city_cordoba_1','Córdoba: Principiante','Córdoba Novice','Haz check-in válido en 1 local distinto de Córdoba.','Complete valid check-ins at 1 distinct place in Córdoba.','venues',1,'discover','cordoba',null,1000000,true),
('city_cordoba_5','Córdoba: Aficionado','Córdoba Amateur','Haz check-in válido en 5 locales distintos de Córdoba.','Complete valid check-ins at 5 distinct places in Córdoba.','venues',5,'discover','cordoba',null,1000000,true),
('city_cordoba_10','Córdoba: Explorador','Córdoba Explorer','Haz check-in válido en 10 locales distintos de Córdoba.','Complete valid check-ins at 10 distinct places in Córdoba.','venues',10,'discover','cordoba',null,1000000,true),
('city_cordoba_25','Córdoba: Conocedor','Córdoba Insider','Haz check-in válido en 25 locales distintos de Córdoba.','Complete valid check-ins at 25 distinct places in Córdoba.','venues',25,'discover','cordoba',null,1000000,true),
('city_cordoba_50','Córdoba: Experto','Córdoba Expert','Haz check-in válido en 50 locales distintos de Córdoba.','Complete valid check-ins at 50 distinct places in Córdoba.','venues',50,'discover','cordoba',null,1000000,true),
('city_cordoba_100','Córdoba: Leyenda','Córdoba Legend','Haz check-in válido en 100 locales distintos de Córdoba.','Complete valid check-ins at 100 distinct places in Córdoba.','venues',100,'discover','cordoba',null,1000000,true),
('city_cuenca_1','Cuenca: Principiante','Cuenca Novice','Haz check-in válido en 1 local distinto de Cuenca.','Complete valid check-ins at 1 distinct place in Cuenca.','venues',1,'discover','cuenca',null,1000000,true),
('city_cuenca_5','Cuenca: Aficionado','Cuenca Amateur','Haz check-in válido en 5 locales distintos de Cuenca.','Complete valid check-ins at 5 distinct places in Cuenca.','venues',5,'discover','cuenca',null,1000000,true),
('city_cuenca_10','Cuenca: Explorador','Cuenca Explorer','Haz check-in válido en 10 locales distintos de Cuenca.','Complete valid check-ins at 10 distinct places in Cuenca.','venues',10,'discover','cuenca',null,1000000,true),
('city_cuenca_25','Cuenca: Conocedor','Cuenca Insider','Haz check-in válido en 25 locales distintos de Cuenca.','Complete valid check-ins at 25 distinct places in Cuenca.','venues',25,'discover','cuenca',null,1000000,true),
('city_cuenca_50','Cuenca: Experto','Cuenca Expert','Haz check-in válido en 50 locales distintos de Cuenca.','Complete valid check-ins at 50 distinct places in Cuenca.','venues',50,'discover','cuenca',null,1000000,true),
('city_cuenca_100','Cuenca: Leyenda','Cuenca Legend','Haz check-in válido en 100 locales distintos de Cuenca.','Complete valid check-ins at 100 distinct places in Cuenca.','venues',100,'discover','cuenca',null,1000000,true),
('city_donostia_san_sebastian_1','Donostia / San Sebastián: Principiante','San Sebastián Novice','Haz check-in válido en 1 local distinto de Donostia / San Sebastián.','Complete valid check-ins at 1 distinct place in San Sebastián.','venues',1,'discover','donostia-san-sebastian',null,1000000,true),
('city_donostia_san_sebastian_5','Donostia / San Sebastián: Aficionado','San Sebastián Amateur','Haz check-in válido en 5 locales distintos de Donostia / San Sebastián.','Complete valid check-ins at 5 distinct places in San Sebastián.','venues',5,'discover','donostia-san-sebastian',null,1000000,true),
('city_donostia_san_sebastian_10','Donostia / San Sebastián: Explorador','San Sebastián Explorer','Haz check-in válido en 10 locales distintos de Donostia / San Sebastián.','Complete valid check-ins at 10 distinct places in San Sebastián.','venues',10,'discover','donostia-san-sebastian',null,1000000,true),
('city_donostia_san_sebastian_25','Donostia / San Sebastián: Conocedor','San Sebastián Insider','Haz check-in válido en 25 locales distintos de Donostia / San Sebastián.','Complete valid check-ins at 25 distinct places in San Sebastián.','venues',25,'discover','donostia-san-sebastian',null,1000000,true),
('city_donostia_san_sebastian_50','Donostia / San Sebastián: Experto','San Sebastián Expert','Haz check-in válido en 50 locales distintos de Donostia / San Sebastián.','Complete valid check-ins at 50 distinct places in San Sebastián.','venues',50,'discover','donostia-san-sebastian',null,1000000,true),
('city_donostia_san_sebastian_100','Donostia / San Sebastián: Leyenda','San Sebastián Legend','Haz check-in válido en 100 locales distintos de Donostia / San Sebastián.','Complete valid check-ins at 100 distinct places in San Sebastián.','venues',100,'discover','donostia-san-sebastian',null,1000000,true),
('city_girona_1','Girona: Principiante','Girona Novice','Haz check-in válido en 1 local distinto de Girona.','Complete valid check-ins at 1 distinct place in Girona.','venues',1,'discover','girona',null,1000000,true),
('city_girona_5','Girona: Aficionado','Girona Amateur','Haz check-in válido en 5 locales distintos de Girona.','Complete valid check-ins at 5 distinct places in Girona.','venues',5,'discover','girona',null,1000000,true),
('city_girona_10','Girona: Explorador','Girona Explorer','Haz check-in válido en 10 locales distintos de Girona.','Complete valid check-ins at 10 distinct places in Girona.','venues',10,'discover','girona',null,1000000,true),
('city_girona_25','Girona: Conocedor','Girona Insider','Haz check-in válido en 25 locales distintos de Girona.','Complete valid check-ins at 25 distinct places in Girona.','venues',25,'discover','girona',null,1000000,true),
('city_girona_50','Girona: Experto','Girona Expert','Haz check-in válido en 50 locales distintos de Girona.','Complete valid check-ins at 50 distinct places in Girona.','venues',50,'discover','girona',null,1000000,true),
('city_girona_100','Girona: Leyenda','Girona Legend','Haz check-in válido en 100 locales distintos de Girona.','Complete valid check-ins at 100 distinct places in Girona.','venues',100,'discover','girona',null,1000000,true),
('city_granada_1','Granada: Principiante','Granada Novice','Haz check-in válido en 1 local distinto de Granada.','Complete valid check-ins at 1 distinct place in Granada.','venues',1,'discover','granada',null,1000000,true),
('city_granada_5','Granada: Aficionado','Granada Amateur','Haz check-in válido en 5 locales distintos de Granada.','Complete valid check-ins at 5 distinct places in Granada.','venues',5,'discover','granada',null,1000000,true),
('city_granada_10','Granada: Explorador','Granada Explorer','Haz check-in válido en 10 locales distintos de Granada.','Complete valid check-ins at 10 distinct places in Granada.','venues',10,'discover','granada',null,1000000,true),
('city_granada_25','Granada: Conocedor','Granada Insider','Haz check-in válido en 25 locales distintos de Granada.','Complete valid check-ins at 25 distinct places in Granada.','venues',25,'discover','granada',null,1000000,true),
('city_granada_50','Granada: Experto','Granada Expert','Haz check-in válido en 50 locales distintos de Granada.','Complete valid check-ins at 50 distinct places in Granada.','venues',50,'discover','granada',null,1000000,true),
('city_granada_100','Granada: Leyenda','Granada Legend','Haz check-in válido en 100 locales distintos de Granada.','Complete valid check-ins at 100 distinct places in Granada.','venues',100,'discover','granada',null,1000000,true),
('city_guadalajara_1','Guadalajara: Principiante','Guadalajara Novice','Haz check-in válido en 1 local distinto de Guadalajara.','Complete valid check-ins at 1 distinct place in Guadalajara.','venues',1,'discover','guadalajara',null,1000000,true),
('city_guadalajara_5','Guadalajara: Aficionado','Guadalajara Amateur','Haz check-in válido en 5 locales distintos de Guadalajara.','Complete valid check-ins at 5 distinct places in Guadalajara.','venues',5,'discover','guadalajara',null,1000000,true),
('city_guadalajara_10','Guadalajara: Explorador','Guadalajara Explorer','Haz check-in válido en 10 locales distintos de Guadalajara.','Complete valid check-ins at 10 distinct places in Guadalajara.','venues',10,'discover','guadalajara',null,1000000,true),
('city_guadalajara_25','Guadalajara: Conocedor','Guadalajara Insider','Haz check-in válido en 25 locales distintos de Guadalajara.','Complete valid check-ins at 25 distinct places in Guadalajara.','venues',25,'discover','guadalajara',null,1000000,true),
('city_guadalajara_50','Guadalajara: Experto','Guadalajara Expert','Haz check-in válido en 50 locales distintos de Guadalajara.','Complete valid check-ins at 50 distinct places in Guadalajara.','venues',50,'discover','guadalajara',null,1000000,true),
('city_guadalajara_100','Guadalajara: Leyenda','Guadalajara Legend','Haz check-in válido en 100 locales distintos de Guadalajara.','Complete valid check-ins at 100 distinct places in Guadalajara.','venues',100,'discover','guadalajara',null,1000000,true),
('city_huelva_1','Huelva: Principiante','Huelva Novice','Haz check-in válido en 1 local distinto de Huelva.','Complete valid check-ins at 1 distinct place in Huelva.','venues',1,'discover','huelva',null,1000000,true),
('city_huelva_5','Huelva: Aficionado','Huelva Amateur','Haz check-in válido en 5 locales distintos de Huelva.','Complete valid check-ins at 5 distinct places in Huelva.','venues',5,'discover','huelva',null,1000000,true),
('city_huelva_10','Huelva: Explorador','Huelva Explorer','Haz check-in válido en 10 locales distintos de Huelva.','Complete valid check-ins at 10 distinct places in Huelva.','venues',10,'discover','huelva',null,1000000,true),
('city_huelva_25','Huelva: Conocedor','Huelva Insider','Haz check-in válido en 25 locales distintos de Huelva.','Complete valid check-ins at 25 distinct places in Huelva.','venues',25,'discover','huelva',null,1000000,true),
('city_huelva_50','Huelva: Experto','Huelva Expert','Haz check-in válido en 50 locales distintos de Huelva.','Complete valid check-ins at 50 distinct places in Huelva.','venues',50,'discover','huelva',null,1000000,true),
('city_huelva_100','Huelva: Leyenda','Huelva Legend','Haz check-in válido en 100 locales distintos de Huelva.','Complete valid check-ins at 100 distinct places in Huelva.','venues',100,'discover','huelva',null,1000000,true),
('city_huesca_1','Huesca: Principiante','Huesca Novice','Haz check-in válido en 1 local distinto de Huesca.','Complete valid check-ins at 1 distinct place in Huesca.','venues',1,'discover','huesca',null,1000000,true),
('city_huesca_5','Huesca: Aficionado','Huesca Amateur','Haz check-in válido en 5 locales distintos de Huesca.','Complete valid check-ins at 5 distinct places in Huesca.','venues',5,'discover','huesca',null,1000000,true),
('city_huesca_10','Huesca: Explorador','Huesca Explorer','Haz check-in válido en 10 locales distintos de Huesca.','Complete valid check-ins at 10 distinct places in Huesca.','venues',10,'discover','huesca',null,1000000,true),
('city_huesca_25','Huesca: Conocedor','Huesca Insider','Haz check-in válido en 25 locales distintos de Huesca.','Complete valid check-ins at 25 distinct places in Huesca.','venues',25,'discover','huesca',null,1000000,true),
('city_huesca_50','Huesca: Experto','Huesca Expert','Haz check-in válido en 50 locales distintos de Huesca.','Complete valid check-ins at 50 distinct places in Huesca.','venues',50,'discover','huesca',null,1000000,true),
('city_huesca_100','Huesca: Leyenda','Huesca Legend','Haz check-in válido en 100 locales distintos de Huesca.','Complete valid check-ins at 100 distinct places in Huesca.','venues',100,'discover','huesca',null,1000000,true),
('city_jaen_1','Jaén: Principiante','Jaén Novice','Haz check-in válido en 1 local distinto de Jaén.','Complete valid check-ins at 1 distinct place in Jaén.','venues',1,'discover','jaen',null,1000000,true),
('city_jaen_5','Jaén: Aficionado','Jaén Amateur','Haz check-in válido en 5 locales distintos de Jaén.','Complete valid check-ins at 5 distinct places in Jaén.','venues',5,'discover','jaen',null,1000000,true),
('city_jaen_10','Jaén: Explorador','Jaén Explorer','Haz check-in válido en 10 locales distintos de Jaén.','Complete valid check-ins at 10 distinct places in Jaén.','venues',10,'discover','jaen',null,1000000,true),
('city_jaen_25','Jaén: Conocedor','Jaén Insider','Haz check-in válido en 25 locales distintos de Jaén.','Complete valid check-ins at 25 distinct places in Jaén.','venues',25,'discover','jaen',null,1000000,true),
('city_jaen_50','Jaén: Experto','Jaén Expert','Haz check-in válido en 50 locales distintos de Jaén.','Complete valid check-ins at 50 distinct places in Jaén.','venues',50,'discover','jaen',null,1000000,true),
('city_jaen_100','Jaén: Leyenda','Jaén Legend','Haz check-in válido en 100 locales distintos de Jaén.','Complete valid check-ins at 100 distinct places in Jaén.','venues',100,'discover','jaen',null,1000000,true),
('city_las_palmas_1','Las Palmas de Gran Canaria: Principiante','Las Palmas Novice','Haz check-in válido en 1 local distinto de Las Palmas de Gran Canaria.','Complete valid check-ins at 1 distinct place in Las Palmas.','venues',1,'discover','las-palmas',null,1000000,true),
('city_las_palmas_5','Las Palmas de Gran Canaria: Aficionado','Las Palmas Amateur','Haz check-in válido en 5 locales distintos de Las Palmas de Gran Canaria.','Complete valid check-ins at 5 distinct places in Las Palmas.','venues',5,'discover','las-palmas',null,1000000,true),
('city_las_palmas_10','Las Palmas de Gran Canaria: Explorador','Las Palmas Explorer','Haz check-in válido en 10 locales distintos de Las Palmas de Gran Canaria.','Complete valid check-ins at 10 distinct places in Las Palmas.','venues',10,'discover','las-palmas',null,1000000,true),
('city_las_palmas_25','Las Palmas de Gran Canaria: Conocedor','Las Palmas Insider','Haz check-in válido en 25 locales distintos de Las Palmas de Gran Canaria.','Complete valid check-ins at 25 distinct places in Las Palmas.','venues',25,'discover','las-palmas',null,1000000,true),
('city_las_palmas_50','Las Palmas de Gran Canaria: Experto','Las Palmas Expert','Haz check-in válido en 50 locales distintos de Las Palmas de Gran Canaria.','Complete valid check-ins at 50 distinct places in Las Palmas.','venues',50,'discover','las-palmas',null,1000000,true),
('city_las_palmas_100','Las Palmas de Gran Canaria: Leyenda','Las Palmas Legend','Haz check-in válido en 100 locales distintos de Las Palmas de Gran Canaria.','Complete valid check-ins at 100 distinct places in Las Palmas.','venues',100,'discover','las-palmas',null,1000000,true),
('city_leon_1','León: Principiante','León Novice','Haz check-in válido en 1 local distinto de León.','Complete valid check-ins at 1 distinct place in León.','venues',1,'discover','leon',null,1000000,true),
('city_leon_5','León: Aficionado','León Amateur','Haz check-in válido en 5 locales distintos de León.','Complete valid check-ins at 5 distinct places in León.','venues',5,'discover','leon',null,1000000,true),
('city_leon_10','León: Explorador','León Explorer','Haz check-in válido en 10 locales distintos de León.','Complete valid check-ins at 10 distinct places in León.','venues',10,'discover','leon',null,1000000,true),
('city_leon_25','León: Conocedor','León Insider','Haz check-in válido en 25 locales distintos de León.','Complete valid check-ins at 25 distinct places in León.','venues',25,'discover','leon',null,1000000,true),
('city_leon_50','León: Experto','León Expert','Haz check-in válido en 50 locales distintos de León.','Complete valid check-ins at 50 distinct places in León.','venues',50,'discover','leon',null,1000000,true),
('city_leon_100','León: Leyenda','León Legend','Haz check-in válido en 100 locales distintos de León.','Complete valid check-ins at 100 distinct places in León.','venues',100,'discover','leon',null,1000000,true),
('city_lleida_1','Lleida: Principiante','Lleida Novice','Haz check-in válido en 1 local distinto de Lleida.','Complete valid check-ins at 1 distinct place in Lleida.','venues',1,'discover','lleida',null,1000000,true),
('city_lleida_5','Lleida: Aficionado','Lleida Amateur','Haz check-in válido en 5 locales distintos de Lleida.','Complete valid check-ins at 5 distinct places in Lleida.','venues',5,'discover','lleida',null,1000000,true),
('city_lleida_10','Lleida: Explorador','Lleida Explorer','Haz check-in válido en 10 locales distintos de Lleida.','Complete valid check-ins at 10 distinct places in Lleida.','venues',10,'discover','lleida',null,1000000,true),
('city_lleida_25','Lleida: Conocedor','Lleida Insider','Haz check-in válido en 25 locales distintos de Lleida.','Complete valid check-ins at 25 distinct places in Lleida.','venues',25,'discover','lleida',null,1000000,true),
('city_lleida_50','Lleida: Experto','Lleida Expert','Haz check-in válido en 50 locales distintos de Lleida.','Complete valid check-ins at 50 distinct places in Lleida.','venues',50,'discover','lleida',null,1000000,true),
('city_lleida_100','Lleida: Leyenda','Lleida Legend','Haz check-in válido en 100 locales distintos de Lleida.','Complete valid check-ins at 100 distinct places in Lleida.','venues',100,'discover','lleida',null,1000000,true),
('city_logrono_1','Logroño: Principiante','Logroño Novice','Haz check-in válido en 1 local distinto de Logroño.','Complete valid check-ins at 1 distinct place in Logroño.','venues',1,'discover','logrono',null,1000000,true),
('city_logrono_5','Logroño: Aficionado','Logroño Amateur','Haz check-in válido en 5 locales distintos de Logroño.','Complete valid check-ins at 5 distinct places in Logroño.','venues',5,'discover','logrono',null,1000000,true),
('city_logrono_10','Logroño: Explorador','Logroño Explorer','Haz check-in válido en 10 locales distintos de Logroño.','Complete valid check-ins at 10 distinct places in Logroño.','venues',10,'discover','logrono',null,1000000,true),
('city_logrono_25','Logroño: Conocedor','Logroño Insider','Haz check-in válido en 25 locales distintos de Logroño.','Complete valid check-ins at 25 distinct places in Logroño.','venues',25,'discover','logrono',null,1000000,true),
('city_logrono_50','Logroño: Experto','Logroño Expert','Haz check-in válido en 50 locales distintos de Logroño.','Complete valid check-ins at 50 distinct places in Logroño.','venues',50,'discover','logrono',null,1000000,true),
('city_logrono_100','Logroño: Leyenda','Logroño Legend','Haz check-in válido en 100 locales distintos de Logroño.','Complete valid check-ins at 100 distinct places in Logroño.','venues',100,'discover','logrono',null,1000000,true),
('city_lugo_1','Lugo: Principiante','Lugo Novice','Haz check-in válido en 1 local distinto de Lugo.','Complete valid check-ins at 1 distinct place in Lugo.','venues',1,'discover','lugo',null,1000000,true),
('city_lugo_5','Lugo: Aficionado','Lugo Amateur','Haz check-in válido en 5 locales distintos de Lugo.','Complete valid check-ins at 5 distinct places in Lugo.','venues',5,'discover','lugo',null,1000000,true),
('city_lugo_10','Lugo: Explorador','Lugo Explorer','Haz check-in válido en 10 locales distintos de Lugo.','Complete valid check-ins at 10 distinct places in Lugo.','venues',10,'discover','lugo',null,1000000,true),
('city_lugo_25','Lugo: Conocedor','Lugo Insider','Haz check-in válido en 25 locales distintos de Lugo.','Complete valid check-ins at 25 distinct places in Lugo.','venues',25,'discover','lugo',null,1000000,true),
('city_lugo_50','Lugo: Experto','Lugo Expert','Haz check-in válido en 50 locales distintos de Lugo.','Complete valid check-ins at 50 distinct places in Lugo.','venues',50,'discover','lugo',null,1000000,true),
('city_lugo_100','Lugo: Leyenda','Lugo Legend','Haz check-in válido en 100 locales distintos de Lugo.','Complete valid check-ins at 100 distinct places in Lugo.','venues',100,'discover','lugo',null,1000000,true),
('city_madrid_1','Madrid: Principiante','Madrid Novice','Haz check-in válido en 1 local distinto de Madrid.','Complete valid check-ins at 1 distinct place in Madrid.','venues',1,'discover','madrid',null,1000000,true),
('city_madrid_5','Madrid: Aficionado','Madrid Amateur','Haz check-in válido en 5 locales distintos de Madrid.','Complete valid check-ins at 5 distinct places in Madrid.','venues',5,'discover','madrid',null,1000000,true),
('city_madrid_10','Madrid: Explorador','Madrid Explorer','Haz check-in válido en 10 locales distintos de Madrid.','Complete valid check-ins at 10 distinct places in Madrid.','venues',10,'discover','madrid',null,1000000,true),
('city_madrid_25','Madrid: Conocedor','Madrid Insider','Haz check-in válido en 25 locales distintos de Madrid.','Complete valid check-ins at 25 distinct places in Madrid.','venues',25,'discover','madrid',null,1000000,true),
('city_madrid_50','Madrid: Experto','Madrid Expert','Haz check-in válido en 50 locales distintos de Madrid.','Complete valid check-ins at 50 distinct places in Madrid.','venues',50,'discover','madrid',null,1000000,true),
('city_madrid_100','Madrid: Leyenda','Madrid Legend','Haz check-in válido en 100 locales distintos de Madrid.','Complete valid check-ins at 100 distinct places in Madrid.','venues',100,'discover','madrid',null,1000000,true),
('city_malaga_1','Málaga: Principiante','Málaga Novice','Haz check-in válido en 1 local distinto de Málaga.','Complete valid check-ins at 1 distinct place in Málaga.','venues',1,'discover','malaga',null,1000000,true),
('city_malaga_5','Málaga: Aficionado','Málaga Amateur','Haz check-in válido en 5 locales distintos de Málaga.','Complete valid check-ins at 5 distinct places in Málaga.','venues',5,'discover','malaga',null,1000000,true),
('city_malaga_10','Málaga: Explorador','Málaga Explorer','Haz check-in válido en 10 locales distintos de Málaga.','Complete valid check-ins at 10 distinct places in Málaga.','venues',10,'discover','malaga',null,1000000,true),
('city_malaga_25','Málaga: Conocedor','Málaga Insider','Haz check-in válido en 25 locales distintos de Málaga.','Complete valid check-ins at 25 distinct places in Málaga.','venues',25,'discover','malaga',null,1000000,true),
('city_malaga_50','Málaga: Experto','Málaga Expert','Haz check-in válido en 50 locales distintos de Málaga.','Complete valid check-ins at 50 distinct places in Málaga.','venues',50,'discover','malaga',null,1000000,true),
('city_malaga_100','Málaga: Leyenda','Málaga Legend','Haz check-in válido en 100 locales distintos de Málaga.','Complete valid check-ins at 100 distinct places in Málaga.','venues',100,'discover','malaga',null,1000000,true),
('city_melilla_1','Melilla: Principiante','Melilla Novice','Haz check-in válido en 1 local distinto de Melilla.','Complete valid check-ins at 1 distinct place in Melilla.','venues',1,'discover','melilla',null,1000000,true),
('city_melilla_5','Melilla: Aficionado','Melilla Amateur','Haz check-in válido en 5 locales distintos de Melilla.','Complete valid check-ins at 5 distinct places in Melilla.','venues',5,'discover','melilla',null,1000000,true),
('city_melilla_10','Melilla: Explorador','Melilla Explorer','Haz check-in válido en 10 locales distintos de Melilla.','Complete valid check-ins at 10 distinct places in Melilla.','venues',10,'discover','melilla',null,1000000,true),
('city_melilla_25','Melilla: Conocedor','Melilla Insider','Haz check-in válido en 25 locales distintos de Melilla.','Complete valid check-ins at 25 distinct places in Melilla.','venues',25,'discover','melilla',null,1000000,true),
('city_melilla_50','Melilla: Experto','Melilla Expert','Haz check-in válido en 50 locales distintos de Melilla.','Complete valid check-ins at 50 distinct places in Melilla.','venues',50,'discover','melilla',null,1000000,true),
('city_melilla_100','Melilla: Leyenda','Melilla Legend','Haz check-in válido en 100 locales distintos de Melilla.','Complete valid check-ins at 100 distinct places in Melilla.','venues',100,'discover','melilla',null,1000000,true),
('city_murcia_1','Murcia: Principiante','Murcia Novice','Haz check-in válido en 1 local distinto de Murcia.','Complete valid check-ins at 1 distinct place in Murcia.','venues',1,'discover','murcia',null,1000000,true),
('city_murcia_5','Murcia: Aficionado','Murcia Amateur','Haz check-in válido en 5 locales distintos de Murcia.','Complete valid check-ins at 5 distinct places in Murcia.','venues',5,'discover','murcia',null,1000000,true),
('city_murcia_10','Murcia: Explorador','Murcia Explorer','Haz check-in válido en 10 locales distintos de Murcia.','Complete valid check-ins at 10 distinct places in Murcia.','venues',10,'discover','murcia',null,1000000,true),
('city_murcia_25','Murcia: Conocedor','Murcia Insider','Haz check-in válido en 25 locales distintos de Murcia.','Complete valid check-ins at 25 distinct places in Murcia.','venues',25,'discover','murcia',null,1000000,true),
('city_murcia_50','Murcia: Experto','Murcia Expert','Haz check-in válido en 50 locales distintos de Murcia.','Complete valid check-ins at 50 distinct places in Murcia.','venues',50,'discover','murcia',null,1000000,true),
('city_murcia_100','Murcia: Leyenda','Murcia Legend','Haz check-in válido en 100 locales distintos de Murcia.','Complete valid check-ins at 100 distinct places in Murcia.','venues',100,'discover','murcia',null,1000000,true),
('city_ourense_1','Ourense: Principiante','Ourense Novice','Haz check-in válido en 1 local distinto de Ourense.','Complete valid check-ins at 1 distinct place in Ourense.','venues',1,'discover','ourense',null,1000000,true),
('city_ourense_5','Ourense: Aficionado','Ourense Amateur','Haz check-in válido en 5 locales distintos de Ourense.','Complete valid check-ins at 5 distinct places in Ourense.','venues',5,'discover','ourense',null,1000000,true),
('city_ourense_10','Ourense: Explorador','Ourense Explorer','Haz check-in válido en 10 locales distintos de Ourense.','Complete valid check-ins at 10 distinct places in Ourense.','venues',10,'discover','ourense',null,1000000,true),
('city_ourense_25','Ourense: Conocedor','Ourense Insider','Haz check-in válido en 25 locales distintos de Ourense.','Complete valid check-ins at 25 distinct places in Ourense.','venues',25,'discover','ourense',null,1000000,true),
('city_ourense_50','Ourense: Experto','Ourense Expert','Haz check-in válido en 50 locales distintos de Ourense.','Complete valid check-ins at 50 distinct places in Ourense.','venues',50,'discover','ourense',null,1000000,true),
('city_ourense_100','Ourense: Leyenda','Ourense Legend','Haz check-in válido en 100 locales distintos de Ourense.','Complete valid check-ins at 100 distinct places in Ourense.','venues',100,'discover','ourense',null,1000000,true),
('city_oviedo_1','Oviedo: Principiante','Oviedo Novice','Haz check-in válido en 1 local distinto de Oviedo.','Complete valid check-ins at 1 distinct place in Oviedo.','venues',1,'discover','oviedo',null,1000000,true),
('city_oviedo_5','Oviedo: Aficionado','Oviedo Amateur','Haz check-in válido en 5 locales distintos de Oviedo.','Complete valid check-ins at 5 distinct places in Oviedo.','venues',5,'discover','oviedo',null,1000000,true),
('city_oviedo_10','Oviedo: Explorador','Oviedo Explorer','Haz check-in válido en 10 locales distintos de Oviedo.','Complete valid check-ins at 10 distinct places in Oviedo.','venues',10,'discover','oviedo',null,1000000,true),
('city_oviedo_25','Oviedo: Conocedor','Oviedo Insider','Haz check-in válido en 25 locales distintos de Oviedo.','Complete valid check-ins at 25 distinct places in Oviedo.','venues',25,'discover','oviedo',null,1000000,true),
('city_oviedo_50','Oviedo: Experto','Oviedo Expert','Haz check-in válido en 50 locales distintos de Oviedo.','Complete valid check-ins at 50 distinct places in Oviedo.','venues',50,'discover','oviedo',null,1000000,true),
('city_oviedo_100','Oviedo: Leyenda','Oviedo Legend','Haz check-in válido en 100 locales distintos de Oviedo.','Complete valid check-ins at 100 distinct places in Oviedo.','venues',100,'discover','oviedo',null,1000000,true),
('city_palencia_1','Palencia: Principiante','Palencia Novice','Haz check-in válido en 1 local distinto de Palencia.','Complete valid check-ins at 1 distinct place in Palencia.','venues',1,'discover','palencia',null,1000000,true),
('city_palencia_5','Palencia: Aficionado','Palencia Amateur','Haz check-in válido en 5 locales distintos de Palencia.','Complete valid check-ins at 5 distinct places in Palencia.','venues',5,'discover','palencia',null,1000000,true),
('city_palencia_10','Palencia: Explorador','Palencia Explorer','Haz check-in válido en 10 locales distintos de Palencia.','Complete valid check-ins at 10 distinct places in Palencia.','venues',10,'discover','palencia',null,1000000,true),
('city_palencia_25','Palencia: Conocedor','Palencia Insider','Haz check-in válido en 25 locales distintos de Palencia.','Complete valid check-ins at 25 distinct places in Palencia.','venues',25,'discover','palencia',null,1000000,true),
('city_palencia_50','Palencia: Experto','Palencia Expert','Haz check-in válido en 50 locales distintos de Palencia.','Complete valid check-ins at 50 distinct places in Palencia.','venues',50,'discover','palencia',null,1000000,true),
('city_palencia_100','Palencia: Leyenda','Palencia Legend','Haz check-in válido en 100 locales distintos de Palencia.','Complete valid check-ins at 100 distinct places in Palencia.','venues',100,'discover','palencia',null,1000000,true),
('city_palma_1','Palma: Principiante','Palma Novice','Haz check-in válido en 1 local distinto de Palma.','Complete valid check-ins at 1 distinct place in Palma.','venues',1,'discover','palma',null,1000000,true),
('city_palma_5','Palma: Aficionado','Palma Amateur','Haz check-in válido en 5 locales distintos de Palma.','Complete valid check-ins at 5 distinct places in Palma.','venues',5,'discover','palma',null,1000000,true),
('city_palma_10','Palma: Explorador','Palma Explorer','Haz check-in válido en 10 locales distintos de Palma.','Complete valid check-ins at 10 distinct places in Palma.','venues',10,'discover','palma',null,1000000,true),
('city_palma_25','Palma: Conocedor','Palma Insider','Haz check-in válido en 25 locales distintos de Palma.','Complete valid check-ins at 25 distinct places in Palma.','venues',25,'discover','palma',null,1000000,true),
('city_palma_50','Palma: Experto','Palma Expert','Haz check-in válido en 50 locales distintos de Palma.','Complete valid check-ins at 50 distinct places in Palma.','venues',50,'discover','palma',null,1000000,true),
('city_palma_100','Palma: Leyenda','Palma Legend','Haz check-in válido en 100 locales distintos de Palma.','Complete valid check-ins at 100 distinct places in Palma.','venues',100,'discover','palma',null,1000000,true),
('city_pamplona_1','Pamplona / Iruña: Principiante','Pamplona Novice','Haz check-in válido en 1 local distinto de Pamplona / Iruña.','Complete valid check-ins at 1 distinct place in Pamplona.','venues',1,'discover','pamplona',null,1000000,true),
('city_pamplona_5','Pamplona / Iruña: Aficionado','Pamplona Amateur','Haz check-in válido en 5 locales distintos de Pamplona / Iruña.','Complete valid check-ins at 5 distinct places in Pamplona.','venues',5,'discover','pamplona',null,1000000,true),
('city_pamplona_10','Pamplona / Iruña: Explorador','Pamplona Explorer','Haz check-in válido en 10 locales distintos de Pamplona / Iruña.','Complete valid check-ins at 10 distinct places in Pamplona.','venues',10,'discover','pamplona',null,1000000,true),
('city_pamplona_25','Pamplona / Iruña: Conocedor','Pamplona Insider','Haz check-in válido en 25 locales distintos de Pamplona / Iruña.','Complete valid check-ins at 25 distinct places in Pamplona.','venues',25,'discover','pamplona',null,1000000,true),
('city_pamplona_50','Pamplona / Iruña: Experto','Pamplona Expert','Haz check-in válido en 50 locales distintos de Pamplona / Iruña.','Complete valid check-ins at 50 distinct places in Pamplona.','venues',50,'discover','pamplona',null,1000000,true),
('city_pamplona_100','Pamplona / Iruña: Leyenda','Pamplona Legend','Haz check-in válido en 100 locales distintos de Pamplona / Iruña.','Complete valid check-ins at 100 distinct places in Pamplona.','venues',100,'discover','pamplona',null,1000000,true),
('city_pontevedra_1','Pontevedra: Principiante','Pontevedra Novice','Haz check-in válido en 1 local distinto de Pontevedra.','Complete valid check-ins at 1 distinct place in Pontevedra.','venues',1,'discover','pontevedra',null,1000000,true),
('city_pontevedra_5','Pontevedra: Aficionado','Pontevedra Amateur','Haz check-in válido en 5 locales distintos de Pontevedra.','Complete valid check-ins at 5 distinct places in Pontevedra.','venues',5,'discover','pontevedra',null,1000000,true),
('city_pontevedra_10','Pontevedra: Explorador','Pontevedra Explorer','Haz check-in válido en 10 locales distintos de Pontevedra.','Complete valid check-ins at 10 distinct places in Pontevedra.','venues',10,'discover','pontevedra',null,1000000,true),
('city_pontevedra_25','Pontevedra: Conocedor','Pontevedra Insider','Haz check-in válido en 25 locales distintos de Pontevedra.','Complete valid check-ins at 25 distinct places in Pontevedra.','venues',25,'discover','pontevedra',null,1000000,true),
('city_pontevedra_50','Pontevedra: Experto','Pontevedra Expert','Haz check-in válido en 50 locales distintos de Pontevedra.','Complete valid check-ins at 50 distinct places in Pontevedra.','venues',50,'discover','pontevedra',null,1000000,true),
('city_pontevedra_100','Pontevedra: Leyenda','Pontevedra Legend','Haz check-in válido en 100 locales distintos de Pontevedra.','Complete valid check-ins at 100 distinct places in Pontevedra.','venues',100,'discover','pontevedra',null,1000000,true),
('city_salamanca_1','Salamanca: Principiante','Salamanca Novice','Haz check-in válido en 1 local distinto de Salamanca.','Complete valid check-ins at 1 distinct place in Salamanca.','venues',1,'discover','salamanca',null,1000000,true),
('city_salamanca_5','Salamanca: Aficionado','Salamanca Amateur','Haz check-in válido en 5 locales distintos de Salamanca.','Complete valid check-ins at 5 distinct places in Salamanca.','venues',5,'discover','salamanca',null,1000000,true),
('city_salamanca_10','Salamanca: Explorador','Salamanca Explorer','Haz check-in válido en 10 locales distintos de Salamanca.','Complete valid check-ins at 10 distinct places in Salamanca.','venues',10,'discover','salamanca',null,1000000,true),
('city_salamanca_25','Salamanca: Conocedor','Salamanca Insider','Haz check-in válido en 25 locales distintos de Salamanca.','Complete valid check-ins at 25 distinct places in Salamanca.','venues',25,'discover','salamanca',null,1000000,true),
('city_salamanca_50','Salamanca: Experto','Salamanca Expert','Haz check-in válido en 50 locales distintos de Salamanca.','Complete valid check-ins at 50 distinct places in Salamanca.','venues',50,'discover','salamanca',null,1000000,true),
('city_salamanca_100','Salamanca: Leyenda','Salamanca Legend','Haz check-in válido en 100 locales distintos de Salamanca.','Complete valid check-ins at 100 distinct places in Salamanca.','venues',100,'discover','salamanca',null,1000000,true),
('city_santa_cruz_tenerife_1','Santa Cruz de Tenerife: Principiante','Santa Cruz de Tenerife Novice','Haz check-in válido en 1 local distinto de Santa Cruz de Tenerife.','Complete valid check-ins at 1 distinct place in Santa Cruz de Tenerife.','venues',1,'discover','santa-cruz-tenerife',null,1000000,true),
('city_santa_cruz_tenerife_5','Santa Cruz de Tenerife: Aficionado','Santa Cruz de Tenerife Amateur','Haz check-in válido en 5 locales distintos de Santa Cruz de Tenerife.','Complete valid check-ins at 5 distinct places in Santa Cruz de Tenerife.','venues',5,'discover','santa-cruz-tenerife',null,1000000,true),
('city_santa_cruz_tenerife_10','Santa Cruz de Tenerife: Explorador','Santa Cruz de Tenerife Explorer','Haz check-in válido en 10 locales distintos de Santa Cruz de Tenerife.','Complete valid check-ins at 10 distinct places in Santa Cruz de Tenerife.','venues',10,'discover','santa-cruz-tenerife',null,1000000,true),
('city_santa_cruz_tenerife_25','Santa Cruz de Tenerife: Conocedor','Santa Cruz de Tenerife Insider','Haz check-in válido en 25 locales distintos de Santa Cruz de Tenerife.','Complete valid check-ins at 25 distinct places in Santa Cruz de Tenerife.','venues',25,'discover','santa-cruz-tenerife',null,1000000,true),
('city_santa_cruz_tenerife_50','Santa Cruz de Tenerife: Experto','Santa Cruz de Tenerife Expert','Haz check-in válido en 50 locales distintos de Santa Cruz de Tenerife.','Complete valid check-ins at 50 distinct places in Santa Cruz de Tenerife.','venues',50,'discover','santa-cruz-tenerife',null,1000000,true),
('city_santa_cruz_tenerife_100','Santa Cruz de Tenerife: Leyenda','Santa Cruz de Tenerife Legend','Haz check-in válido en 100 locales distintos de Santa Cruz de Tenerife.','Complete valid check-ins at 100 distinct places in Santa Cruz de Tenerife.','venues',100,'discover','santa-cruz-tenerife',null,1000000,true),
('city_santander_1','Santander: Principiante','Santander Novice','Haz check-in válido en 1 local distinto de Santander.','Complete valid check-ins at 1 distinct place in Santander.','venues',1,'discover','santander',null,1000000,true),
('city_santander_5','Santander: Aficionado','Santander Amateur','Haz check-in válido en 5 locales distintos de Santander.','Complete valid check-ins at 5 distinct places in Santander.','venues',5,'discover','santander',null,1000000,true),
('city_santander_10','Santander: Explorador','Santander Explorer','Haz check-in válido en 10 locales distintos de Santander.','Complete valid check-ins at 10 distinct places in Santander.','venues',10,'discover','santander',null,1000000,true),
('city_santander_25','Santander: Conocedor','Santander Insider','Haz check-in válido en 25 locales distintos de Santander.','Complete valid check-ins at 25 distinct places in Santander.','venues',25,'discover','santander',null,1000000,true),
('city_santander_50','Santander: Experto','Santander Expert','Haz check-in válido en 50 locales distintos de Santander.','Complete valid check-ins at 50 distinct places in Santander.','venues',50,'discover','santander',null,1000000,true),
('city_santander_100','Santander: Leyenda','Santander Legend','Haz check-in válido en 100 locales distintos de Santander.','Complete valid check-ins at 100 distinct places in Santander.','venues',100,'discover','santander',null,1000000,true),
('city_segovia_1','Segovia: Principiante','Segovia Novice','Haz check-in válido en 1 local distinto de Segovia.','Complete valid check-ins at 1 distinct place in Segovia.','venues',1,'discover','segovia',null,1000000,true),
('city_segovia_5','Segovia: Aficionado','Segovia Amateur','Haz check-in válido en 5 locales distintos de Segovia.','Complete valid check-ins at 5 distinct places in Segovia.','venues',5,'discover','segovia',null,1000000,true),
('city_segovia_10','Segovia: Explorador','Segovia Explorer','Haz check-in válido en 10 locales distintos de Segovia.','Complete valid check-ins at 10 distinct places in Segovia.','venues',10,'discover','segovia',null,1000000,true),
('city_segovia_25','Segovia: Conocedor','Segovia Insider','Haz check-in válido en 25 locales distintos de Segovia.','Complete valid check-ins at 25 distinct places in Segovia.','venues',25,'discover','segovia',null,1000000,true),
('city_segovia_50','Segovia: Experto','Segovia Expert','Haz check-in válido en 50 locales distintos de Segovia.','Complete valid check-ins at 50 distinct places in Segovia.','venues',50,'discover','segovia',null,1000000,true),
('city_segovia_100','Segovia: Leyenda','Segovia Legend','Haz check-in válido en 100 locales distintos de Segovia.','Complete valid check-ins at 100 distinct places in Segovia.','venues',100,'discover','segovia',null,1000000,true),
('city_sevilla_1','Sevilla: Principiante','Seville Novice','Haz check-in válido en 1 local distinto de Sevilla.','Complete valid check-ins at 1 distinct place in Seville.','venues',1,'discover','sevilla',null,1000000,true),
('city_sevilla_5','Sevilla: Aficionado','Seville Amateur','Haz check-in válido en 5 locales distintos de Sevilla.','Complete valid check-ins at 5 distinct places in Seville.','venues',5,'discover','sevilla',null,1000000,true),
('city_sevilla_10','Sevilla: Explorador','Seville Explorer','Haz check-in válido en 10 locales distintos de Sevilla.','Complete valid check-ins at 10 distinct places in Seville.','venues',10,'discover','sevilla',null,1000000,true),
('city_sevilla_25','Sevilla: Conocedor','Seville Insider','Haz check-in válido en 25 locales distintos de Sevilla.','Complete valid check-ins at 25 distinct places in Seville.','venues',25,'discover','sevilla',null,1000000,true),
('city_sevilla_50','Sevilla: Experto','Seville Expert','Haz check-in válido en 50 locales distintos de Sevilla.','Complete valid check-ins at 50 distinct places in Seville.','venues',50,'discover','sevilla',null,1000000,true),
('city_sevilla_100','Sevilla: Leyenda','Seville Legend','Haz check-in válido en 100 locales distintos de Sevilla.','Complete valid check-ins at 100 distinct places in Seville.','venues',100,'discover','sevilla',null,1000000,true),
('city_soria_1','Soria: Principiante','Soria Novice','Haz check-in válido en 1 local distinto de Soria.','Complete valid check-ins at 1 distinct place in Soria.','venues',1,'discover','soria',null,1000000,true),
('city_soria_5','Soria: Aficionado','Soria Amateur','Haz check-in válido en 5 locales distintos de Soria.','Complete valid check-ins at 5 distinct places in Soria.','venues',5,'discover','soria',null,1000000,true),
('city_soria_10','Soria: Explorador','Soria Explorer','Haz check-in válido en 10 locales distintos de Soria.','Complete valid check-ins at 10 distinct places in Soria.','venues',10,'discover','soria',null,1000000,true),
('city_soria_25','Soria: Conocedor','Soria Insider','Haz check-in válido en 25 locales distintos de Soria.','Complete valid check-ins at 25 distinct places in Soria.','venues',25,'discover','soria',null,1000000,true),
('city_soria_50','Soria: Experto','Soria Expert','Haz check-in válido en 50 locales distintos de Soria.','Complete valid check-ins at 50 distinct places in Soria.','venues',50,'discover','soria',null,1000000,true),
('city_soria_100','Soria: Leyenda','Soria Legend','Haz check-in válido en 100 locales distintos de Soria.','Complete valid check-ins at 100 distinct places in Soria.','venues',100,'discover','soria',null,1000000,true),
('city_tarragona_1','Tarragona: Principiante','Tarragona Novice','Haz check-in válido en 1 local distinto de Tarragona.','Complete valid check-ins at 1 distinct place in Tarragona.','venues',1,'discover','tarragona',null,1000000,true),
('city_tarragona_5','Tarragona: Aficionado','Tarragona Amateur','Haz check-in válido en 5 locales distintos de Tarragona.','Complete valid check-ins at 5 distinct places in Tarragona.','venues',5,'discover','tarragona',null,1000000,true),
('city_tarragona_10','Tarragona: Explorador','Tarragona Explorer','Haz check-in válido en 10 locales distintos de Tarragona.','Complete valid check-ins at 10 distinct places in Tarragona.','venues',10,'discover','tarragona',null,1000000,true),
('city_tarragona_25','Tarragona: Conocedor','Tarragona Insider','Haz check-in válido en 25 locales distintos de Tarragona.','Complete valid check-ins at 25 distinct places in Tarragona.','venues',25,'discover','tarragona',null,1000000,true),
('city_tarragona_50','Tarragona: Experto','Tarragona Expert','Haz check-in válido en 50 locales distintos de Tarragona.','Complete valid check-ins at 50 distinct places in Tarragona.','venues',50,'discover','tarragona',null,1000000,true),
('city_tarragona_100','Tarragona: Leyenda','Tarragona Legend','Haz check-in válido en 100 locales distintos de Tarragona.','Complete valid check-ins at 100 distinct places in Tarragona.','venues',100,'discover','tarragona',null,1000000,true),
('city_teruel_1','Teruel: Principiante','Teruel Novice','Haz check-in válido en 1 local distinto de Teruel.','Complete valid check-ins at 1 distinct place in Teruel.','venues',1,'discover','teruel',null,1000000,true),
('city_teruel_5','Teruel: Aficionado','Teruel Amateur','Haz check-in válido en 5 locales distintos de Teruel.','Complete valid check-ins at 5 distinct places in Teruel.','venues',5,'discover','teruel',null,1000000,true),
('city_teruel_10','Teruel: Explorador','Teruel Explorer','Haz check-in válido en 10 locales distintos de Teruel.','Complete valid check-ins at 10 distinct places in Teruel.','venues',10,'discover','teruel',null,1000000,true),
('city_teruel_25','Teruel: Conocedor','Teruel Insider','Haz check-in válido en 25 locales distintos de Teruel.','Complete valid check-ins at 25 distinct places in Teruel.','venues',25,'discover','teruel',null,1000000,true),
('city_teruel_50','Teruel: Experto','Teruel Expert','Haz check-in válido en 50 locales distintos de Teruel.','Complete valid check-ins at 50 distinct places in Teruel.','venues',50,'discover','teruel',null,1000000,true),
('city_teruel_100','Teruel: Leyenda','Teruel Legend','Haz check-in válido en 100 locales distintos de Teruel.','Complete valid check-ins at 100 distinct places in Teruel.','venues',100,'discover','teruel',null,1000000,true),
('city_toledo_1','Toledo: Principiante','Toledo Novice','Haz check-in válido en 1 local distinto de Toledo.','Complete valid check-ins at 1 distinct place in Toledo.','venues',1,'discover','toledo',null,1000000,true),
('city_toledo_5','Toledo: Aficionado','Toledo Amateur','Haz check-in válido en 5 locales distintos de Toledo.','Complete valid check-ins at 5 distinct places in Toledo.','venues',5,'discover','toledo',null,1000000,true),
('city_toledo_10','Toledo: Explorador','Toledo Explorer','Haz check-in válido en 10 locales distintos de Toledo.','Complete valid check-ins at 10 distinct places in Toledo.','venues',10,'discover','toledo',null,1000000,true),
('city_toledo_25','Toledo: Conocedor','Toledo Insider','Haz check-in válido en 25 locales distintos de Toledo.','Complete valid check-ins at 25 distinct places in Toledo.','venues',25,'discover','toledo',null,1000000,true),
('city_toledo_50','Toledo: Experto','Toledo Expert','Haz check-in válido en 50 locales distintos de Toledo.','Complete valid check-ins at 50 distinct places in Toledo.','venues',50,'discover','toledo',null,1000000,true),
('city_toledo_100','Toledo: Leyenda','Toledo Legend','Haz check-in válido en 100 locales distintos de Toledo.','Complete valid check-ins at 100 distinct places in Toledo.','venues',100,'discover','toledo',null,1000000,true),
('city_valencia_1','València: Principiante','Valencia Novice','Haz check-in válido en 1 local distinto de València.','Complete valid check-ins at 1 distinct place in Valencia.','venues',1,'discover','valencia',null,1000000,true),
('city_valencia_5','València: Aficionado','Valencia Amateur','Haz check-in válido en 5 locales distintos de València.','Complete valid check-ins at 5 distinct places in Valencia.','venues',5,'discover','valencia',null,1000000,true),
('city_valencia_10','València: Explorador','Valencia Explorer','Haz check-in válido en 10 locales distintos de València.','Complete valid check-ins at 10 distinct places in Valencia.','venues',10,'discover','valencia',null,1000000,true),
('city_valencia_25','València: Conocedor','Valencia Insider','Haz check-in válido en 25 locales distintos de València.','Complete valid check-ins at 25 distinct places in Valencia.','venues',25,'discover','valencia',null,1000000,true),
('city_valencia_50','València: Experto','Valencia Expert','Haz check-in válido en 50 locales distintos de València.','Complete valid check-ins at 50 distinct places in Valencia.','venues',50,'discover','valencia',null,1000000,true),
('city_valencia_100','València: Leyenda','Valencia Legend','Haz check-in válido en 100 locales distintos de València.','Complete valid check-ins at 100 distinct places in Valencia.','venues',100,'discover','valencia',null,1000000,true),
('city_valladolid_1','Valladolid: Principiante','Valladolid Novice','Haz check-in válido en 1 local distinto de Valladolid.','Complete valid check-ins at 1 distinct place in Valladolid.','venues',1,'discover','valladolid',null,1000000,true),
('city_valladolid_5','Valladolid: Aficionado','Valladolid Amateur','Haz check-in válido en 5 locales distintos de Valladolid.','Complete valid check-ins at 5 distinct places in Valladolid.','venues',5,'discover','valladolid',null,1000000,true),
('city_valladolid_10','Valladolid: Explorador','Valladolid Explorer','Haz check-in válido en 10 locales distintos de Valladolid.','Complete valid check-ins at 10 distinct places in Valladolid.','venues',10,'discover','valladolid',null,1000000,true),
('city_valladolid_25','Valladolid: Conocedor','Valladolid Insider','Haz check-in válido en 25 locales distintos de Valladolid.','Complete valid check-ins at 25 distinct places in Valladolid.','venues',25,'discover','valladolid',null,1000000,true),
('city_valladolid_50','Valladolid: Experto','Valladolid Expert','Haz check-in válido en 50 locales distintos de Valladolid.','Complete valid check-ins at 50 distinct places in Valladolid.','venues',50,'discover','valladolid',null,1000000,true),
('city_valladolid_100','Valladolid: Leyenda','Valladolid Legend','Haz check-in válido en 100 locales distintos de Valladolid.','Complete valid check-ins at 100 distinct places in Valladolid.','venues',100,'discover','valladolid',null,1000000,true),
('city_vitoria_gasteiz_1','Vitoria-Gasteiz: Principiante','Vitoria-Gasteiz Novice','Haz check-in válido en 1 local distinto de Vitoria-Gasteiz.','Complete valid check-ins at 1 distinct place in Vitoria-Gasteiz.','venues',1,'discover','vitoria-gasteiz',null,1000000,true),
('city_vitoria_gasteiz_5','Vitoria-Gasteiz: Aficionado','Vitoria-Gasteiz Amateur','Haz check-in válido en 5 locales distintos de Vitoria-Gasteiz.','Complete valid check-ins at 5 distinct places in Vitoria-Gasteiz.','venues',5,'discover','vitoria-gasteiz',null,1000000,true),
('city_vitoria_gasteiz_10','Vitoria-Gasteiz: Explorador','Vitoria-Gasteiz Explorer','Haz check-in válido en 10 locales distintos de Vitoria-Gasteiz.','Complete valid check-ins at 10 distinct places in Vitoria-Gasteiz.','venues',10,'discover','vitoria-gasteiz',null,1000000,true),
('city_vitoria_gasteiz_25','Vitoria-Gasteiz: Conocedor','Vitoria-Gasteiz Insider','Haz check-in válido en 25 locales distintos de Vitoria-Gasteiz.','Complete valid check-ins at 25 distinct places in Vitoria-Gasteiz.','venues',25,'discover','vitoria-gasteiz',null,1000000,true),
('city_vitoria_gasteiz_50','Vitoria-Gasteiz: Experto','Vitoria-Gasteiz Expert','Haz check-in válido en 50 locales distintos de Vitoria-Gasteiz.','Complete valid check-ins at 50 distinct places in Vitoria-Gasteiz.','venues',50,'discover','vitoria-gasteiz',null,1000000,true),
('city_vitoria_gasteiz_100','Vitoria-Gasteiz: Leyenda','Vitoria-Gasteiz Legend','Haz check-in válido en 100 locales distintos de Vitoria-Gasteiz.','Complete valid check-ins at 100 distinct places in Vitoria-Gasteiz.','venues',100,'discover','vitoria-gasteiz',null,1000000,true),
('city_zamora_1','Zamora: Principiante','Zamora Novice','Haz check-in válido en 1 local distinto de Zamora.','Complete valid check-ins at 1 distinct place in Zamora.','venues',1,'discover','zamora',null,1000000,true),
('city_zamora_5','Zamora: Aficionado','Zamora Amateur','Haz check-in válido en 5 locales distintos de Zamora.','Complete valid check-ins at 5 distinct places in Zamora.','venues',5,'discover','zamora',null,1000000,true),
('city_zamora_10','Zamora: Explorador','Zamora Explorer','Haz check-in válido en 10 locales distintos de Zamora.','Complete valid check-ins at 10 distinct places in Zamora.','venues',10,'discover','zamora',null,1000000,true),
('city_zamora_25','Zamora: Conocedor','Zamora Insider','Haz check-in válido en 25 locales distintos de Zamora.','Complete valid check-ins at 25 distinct places in Zamora.','venues',25,'discover','zamora',null,1000000,true),
('city_zamora_50','Zamora: Experto','Zamora Expert','Haz check-in válido en 50 locales distintos de Zamora.','Complete valid check-ins at 50 distinct places in Zamora.','venues',50,'discover','zamora',null,1000000,true),
('city_zamora_100','Zamora: Leyenda','Zamora Legend','Haz check-in válido en 100 locales distintos de Zamora.','Complete valid check-ins at 100 distinct places in Zamora.','venues',100,'discover','zamora',null,1000000,true),
('city_zaragoza_1','Zaragoza: Principiante','Zaragoza Novice','Haz check-in válido en 1 local distinto de Zaragoza.','Complete valid check-ins at 1 distinct place in Zaragoza.','venues',1,'discover','zaragoza',null,1000000,true),
('city_zaragoza_5','Zaragoza: Aficionado','Zaragoza Amateur','Haz check-in válido en 5 locales distintos de Zaragoza.','Complete valid check-ins at 5 distinct places in Zaragoza.','venues',5,'discover','zaragoza',null,1000000,true),
('city_zaragoza_10','Zaragoza: Explorador','Zaragoza Explorer','Haz check-in válido en 10 locales distintos de Zaragoza.','Complete valid check-ins at 10 distinct places in Zaragoza.','venues',10,'discover','zaragoza',null,1000000,true),
('city_zaragoza_25','Zaragoza: Conocedor','Zaragoza Insider','Haz check-in válido en 25 locales distintos de Zaragoza.','Complete valid check-ins at 25 distinct places in Zaragoza.','venues',25,'discover','zaragoza',null,1000000,true),
('city_zaragoza_50','Zaragoza: Experto','Zaragoza Expert','Haz check-in válido en 50 locales distintos de Zaragoza.','Complete valid check-ins at 50 distinct places in Zaragoza.','venues',50,'discover','zaragoza',null,1000000,true),
('city_zaragoza_100','Zaragoza: Leyenda','Zaragoza Legend','Haz check-in válido en 100 locales distintos de Zaragoza.','Complete valid check-ins at 100 distinct places in Zaragoza.','venues',100,'discover','zaragoza',null,1000000,true),
('city_vigo_1','Vigo: Principiante','Vigo Novice','Haz check-in válido en 1 local distinto de Vigo.','Complete valid check-ins at 1 distinct place in Vigo.','venues',1,'discover','vigo',null,1000000,true),
('city_vigo_5','Vigo: Aficionado','Vigo Amateur','Haz check-in válido en 5 locales distintos de Vigo.','Complete valid check-ins at 5 distinct places in Vigo.','venues',5,'discover','vigo',null,1000000,true),
('city_vigo_10','Vigo: Explorador','Vigo Explorer','Haz check-in válido en 10 locales distintos de Vigo.','Complete valid check-ins at 10 distinct places in Vigo.','venues',10,'discover','vigo',null,1000000,true),
('city_vigo_25','Vigo: Conocedor','Vigo Insider','Haz check-in válido en 25 locales distintos de Vigo.','Complete valid check-ins at 25 distinct places in Vigo.','venues',25,'discover','vigo',null,1000000,true),
('city_vigo_50','Vigo: Experto','Vigo Expert','Haz check-in válido en 50 locales distintos de Vigo.','Complete valid check-ins at 50 distinct places in Vigo.','venues',50,'discover','vigo',null,1000000,true),
('city_vigo_100','Vigo: Leyenda','Vigo Legend','Haz check-in válido en 100 locales distintos de Vigo.','Complete valid check-ins at 100 distinct places in Vigo.','venues',100,'discover','vigo',null,1000000,true),
('city_gijon_1','Gijón: Principiante','Gijón Novice','Haz check-in válido en 1 local distinto de Gijón.','Complete valid check-ins at 1 distinct place in Gijón.','venues',1,'discover','gijon',null,1000000,true),
('city_gijon_5','Gijón: Aficionado','Gijón Amateur','Haz check-in válido en 5 locales distintos de Gijón.','Complete valid check-ins at 5 distinct places in Gijón.','venues',5,'discover','gijon',null,1000000,true),
('city_gijon_10','Gijón: Explorador','Gijón Explorer','Haz check-in válido en 10 locales distintos de Gijón.','Complete valid check-ins at 10 distinct places in Gijón.','venues',10,'discover','gijon',null,1000000,true),
('city_gijon_25','Gijón: Conocedor','Gijón Insider','Haz check-in válido en 25 locales distintos de Gijón.','Complete valid check-ins at 25 distinct places in Gijón.','venues',25,'discover','gijon',null,1000000,true),
('city_gijon_50','Gijón: Experto','Gijón Expert','Haz check-in válido en 50 locales distintos de Gijón.','Complete valid check-ins at 50 distinct places in Gijón.','venues',50,'discover','gijon',null,1000000,true),
('city_gijon_100','Gijón: Leyenda','Gijón Legend','Haz check-in válido en 100 locales distintos de Gijón.','Complete valid check-ins at 100 distinct places in Gijón.','venues',100,'discover','gijon',null,1000000,true),
('city_elche_1','Elche: Principiante','Elche Novice','Haz check-in válido en 1 local distinto de Elche.','Complete valid check-ins at 1 distinct place in Elche.','venues',1,'discover','elche',null,1000000,true),
('city_elche_5','Elche: Aficionado','Elche Amateur','Haz check-in válido en 5 locales distintos de Elche.','Complete valid check-ins at 5 distinct places in Elche.','venues',5,'discover','elche',null,1000000,true),
('city_elche_10','Elche: Explorador','Elche Explorer','Haz check-in válido en 10 locales distintos de Elche.','Complete valid check-ins at 10 distinct places in Elche.','venues',10,'discover','elche',null,1000000,true),
('city_elche_25','Elche: Conocedor','Elche Insider','Haz check-in válido en 25 locales distintos de Elche.','Complete valid check-ins at 25 distinct places in Elche.','venues',25,'discover','elche',null,1000000,true),
('city_elche_50','Elche: Experto','Elche Expert','Haz check-in válido en 50 locales distintos de Elche.','Complete valid check-ins at 50 distinct places in Elche.','venues',50,'discover','elche',null,1000000,true),
('city_elche_100','Elche: Leyenda','Elche Legend','Haz check-in válido en 100 locales distintos de Elche.','Complete valid check-ins at 100 distinct places in Elche.','venues',100,'discover','elche',null,1000000,true),
('city_jerez_1','Jerez de la Frontera: Principiante','Jerez de la Frontera Novice','Haz check-in válido en 1 local distinto de Jerez de la Frontera.','Complete valid check-ins at 1 distinct place in Jerez de la Frontera.','venues',1,'discover','jerez',null,1000000,true),
('city_jerez_5','Jerez de la Frontera: Aficionado','Jerez de la Frontera Amateur','Haz check-in válido en 5 locales distintos de Jerez de la Frontera.','Complete valid check-ins at 5 distinct places in Jerez de la Frontera.','venues',5,'discover','jerez',null,1000000,true),
('city_jerez_10','Jerez de la Frontera: Explorador','Jerez de la Frontera Explorer','Haz check-in válido en 10 locales distintos de Jerez de la Frontera.','Complete valid check-ins at 10 distinct places in Jerez de la Frontera.','venues',10,'discover','jerez',null,1000000,true),
('city_jerez_25','Jerez de la Frontera: Conocedor','Jerez de la Frontera Insider','Haz check-in válido en 25 locales distintos de Jerez de la Frontera.','Complete valid check-ins at 25 distinct places in Jerez de la Frontera.','venues',25,'discover','jerez',null,1000000,true),
('city_jerez_50','Jerez de la Frontera: Experto','Jerez de la Frontera Expert','Haz check-in válido en 50 locales distintos de Jerez de la Frontera.','Complete valid check-ins at 50 distinct places in Jerez de la Frontera.','venues',50,'discover','jerez',null,1000000,true),
('city_jerez_100','Jerez de la Frontera: Leyenda','Jerez de la Frontera Legend','Haz check-in válido en 100 locales distintos de Jerez de la Frontera.','Complete valid check-ins at 100 distinct places in Jerez de la Frontera.','venues',100,'discover','jerez',null,1000000,true),
('city_cartagena_1','Cartagena: Principiante','Cartagena Novice','Haz check-in válido en 1 local distinto de Cartagena.','Complete valid check-ins at 1 distinct place in Cartagena.','venues',1,'discover','cartagena',null,1000000,true),
('city_cartagena_5','Cartagena: Aficionado','Cartagena Amateur','Haz check-in válido en 5 locales distintos de Cartagena.','Complete valid check-ins at 5 distinct places in Cartagena.','venues',5,'discover','cartagena',null,1000000,true),
('city_cartagena_10','Cartagena: Explorador','Cartagena Explorer','Haz check-in válido en 10 locales distintos de Cartagena.','Complete valid check-ins at 10 distinct places in Cartagena.','venues',10,'discover','cartagena',null,1000000,true),
('city_cartagena_25','Cartagena: Conocedor','Cartagena Insider','Haz check-in válido en 25 locales distintos de Cartagena.','Complete valid check-ins at 25 distinct places in Cartagena.','venues',25,'discover','cartagena',null,1000000,true),
('city_cartagena_50','Cartagena: Experto','Cartagena Expert','Haz check-in válido en 50 locales distintos de Cartagena.','Complete valid check-ins at 50 distinct places in Cartagena.','venues',50,'discover','cartagena',null,1000000,true),
('city_cartagena_100','Cartagena: Leyenda','Cartagena Legend','Haz check-in válido en 100 locales distintos de Cartagena.','Complete valid check-ins at 100 distinct places in Cartagena.','venues',100,'discover','cartagena',null,1000000,true),
('city_marbella_1','Marbella: Principiante','Marbella Novice','Haz check-in válido en 1 local distinto de Marbella.','Complete valid check-ins at 1 distinct place in Marbella.','venues',1,'discover','marbella',null,1000000,true),
('city_marbella_5','Marbella: Aficionado','Marbella Amateur','Haz check-in válido en 5 locales distintos de Marbella.','Complete valid check-ins at 5 distinct places in Marbella.','venues',5,'discover','marbella',null,1000000,true),
('city_marbella_10','Marbella: Explorador','Marbella Explorer','Haz check-in válido en 10 locales distintos de Marbella.','Complete valid check-ins at 10 distinct places in Marbella.','venues',10,'discover','marbella',null,1000000,true),
('city_marbella_25','Marbella: Conocedor','Marbella Insider','Haz check-in válido en 25 locales distintos de Marbella.','Complete valid check-ins at 25 distinct places in Marbella.','venues',25,'discover','marbella',null,1000000,true),
('city_marbella_50','Marbella: Experto','Marbella Expert','Haz check-in válido en 50 locales distintos de Marbella.','Complete valid check-ins at 50 distinct places in Marbella.','venues',50,'discover','marbella',null,1000000,true),
('city_marbella_100','Marbella: Leyenda','Marbella Legend','Haz check-in válido en 100 locales distintos de Marbella.','Complete valid check-ins at 100 distinct places in Marbella.','venues',100,'discover','marbella',null,1000000,true),
('city_santiago_1','Santiago de Compostela: Principiante','Santiago de Compostela Novice','Haz check-in válido en 1 local distinto de Santiago de Compostela.','Complete valid check-ins at 1 distinct place in Santiago de Compostela.','venues',1,'discover','santiago',null,1000000,true),
('city_santiago_5','Santiago de Compostela: Aficionado','Santiago de Compostela Amateur','Haz check-in válido en 5 locales distintos de Santiago de Compostela.','Complete valid check-ins at 5 distinct places in Santiago de Compostela.','venues',5,'discover','santiago',null,1000000,true),
('city_santiago_10','Santiago de Compostela: Explorador','Santiago de Compostela Explorer','Haz check-in válido en 10 locales distintos de Santiago de Compostela.','Complete valid check-ins at 10 distinct places in Santiago de Compostela.','venues',10,'discover','santiago',null,1000000,true),
('city_santiago_25','Santiago de Compostela: Conocedor','Santiago de Compostela Insider','Haz check-in válido en 25 locales distintos de Santiago de Compostela.','Complete valid check-ins at 25 distinct places in Santiago de Compostela.','venues',25,'discover','santiago',null,1000000,true),
('city_santiago_50','Santiago de Compostela: Experto','Santiago de Compostela Expert','Haz check-in válido en 50 locales distintos de Santiago de Compostela.','Complete valid check-ins at 50 distinct places in Santiago de Compostela.','venues',50,'discover','santiago',null,1000000,true),
('city_santiago_100','Santiago de Compostela: Leyenda','Santiago de Compostela Legend','Haz check-in válido en 100 locales distintos de Santiago de Compostela.','Complete valid check-ins at 100 distinct places in Santiago de Compostela.','venues',100,'discover','santiago',null,1000000,true),
('city_merida_1','Mérida: Principiante','Mérida Novice','Haz check-in válido en 1 local distinto de Mérida.','Complete valid check-ins at 1 distinct place in Mérida.','venues',1,'discover','merida',null,1000000,true),
('city_merida_5','Mérida: Aficionado','Mérida Amateur','Haz check-in válido en 5 locales distintos de Mérida.','Complete valid check-ins at 5 distinct places in Mérida.','venues',5,'discover','merida',null,1000000,true),
('city_merida_10','Mérida: Explorador','Mérida Explorer','Haz check-in válido en 10 locales distintos de Mérida.','Complete valid check-ins at 10 distinct places in Mérida.','venues',10,'discover','merida',null,1000000,true),
('city_merida_25','Mérida: Conocedor','Mérida Insider','Haz check-in válido en 25 locales distintos de Mérida.','Complete valid check-ins at 25 distinct places in Mérida.','venues',25,'discover','merida',null,1000000,true),
('city_merida_50','Mérida: Experto','Mérida Expert','Haz check-in válido en 50 locales distintos de Mérida.','Complete valid check-ins at 50 distinct places in Mérida.','venues',50,'discover','merida',null,1000000,true),
('city_merida_100','Mérida: Leyenda','Mérida Legend','Haz check-in válido en 100 locales distintos de Mérida.','Complete valid check-ins at 100 distinct places in Mérida.','venues',100,'discover','merida',null,1000000,true),
('city_badalona_1','Badalona: Principiante','Badalona Novice','Haz check-in válido en 1 local distinto de Badalona.','Complete valid check-ins at 1 distinct place in Badalona.','venues',1,'discover','badalona',null,1000000,true),
('city_badalona_5','Badalona: Aficionado','Badalona Amateur','Haz check-in válido en 5 locales distintos de Badalona.','Complete valid check-ins at 5 distinct places in Badalona.','venues',5,'discover','badalona',null,1000000,true),
('city_badalona_10','Badalona: Explorador','Badalona Explorer','Haz check-in válido en 10 locales distintos de Badalona.','Complete valid check-ins at 10 distinct places in Badalona.','venues',10,'discover','badalona',null,1000000,true),
('city_badalona_25','Badalona: Conocedor','Badalona Insider','Haz check-in válido en 25 locales distintos de Badalona.','Complete valid check-ins at 25 distinct places in Badalona.','venues',25,'discover','badalona',null,1000000,true),
('city_badalona_50','Badalona: Experto','Badalona Expert','Haz check-in válido en 50 locales distintos de Badalona.','Complete valid check-ins at 50 distinct places in Badalona.','venues',50,'discover','badalona',null,1000000,true),
('city_badalona_100','Badalona: Leyenda','Badalona Legend','Haz check-in válido en 100 locales distintos de Badalona.','Complete valid check-ins at 100 distinct places in Badalona.','venues',100,'discover','badalona',null,1000000,true),
('city_sabadell_1','Sabadell: Principiante','Sabadell Novice','Haz check-in válido en 1 local distinto de Sabadell.','Complete valid check-ins at 1 distinct place in Sabadell.','venues',1,'discover','sabadell',null,1000000,true),
('city_sabadell_5','Sabadell: Aficionado','Sabadell Amateur','Haz check-in válido en 5 locales distintos de Sabadell.','Complete valid check-ins at 5 distinct places in Sabadell.','venues',5,'discover','sabadell',null,1000000,true),
('city_sabadell_10','Sabadell: Explorador','Sabadell Explorer','Haz check-in válido en 10 locales distintos de Sabadell.','Complete valid check-ins at 10 distinct places in Sabadell.','venues',10,'discover','sabadell',null,1000000,true),
('city_sabadell_25','Sabadell: Conocedor','Sabadell Insider','Haz check-in válido en 25 locales distintos de Sabadell.','Complete valid check-ins at 25 distinct places in Sabadell.','venues',25,'discover','sabadell',null,1000000,true),
('city_sabadell_50','Sabadell: Experto','Sabadell Expert','Haz check-in válido en 50 locales distintos de Sabadell.','Complete valid check-ins at 50 distinct places in Sabadell.','venues',50,'discover','sabadell',null,1000000,true),
('city_sabadell_100','Sabadell: Leyenda','Sabadell Legend','Haz check-in válido en 100 locales distintos de Sabadell.','Complete valid check-ins at 100 distinct places in Sabadell.','venues',100,'discover','sabadell',null,1000000,true),
('city_la_laguna_1','San Cristóbal de La Laguna: Principiante','San Cristóbal de La Laguna Novice','Haz check-in válido en 1 local distinto de San Cristóbal de La Laguna.','Complete valid check-ins at 1 distinct place in San Cristóbal de La Laguna.','venues',1,'discover','la-laguna',null,1000000,true),
('city_la_laguna_5','San Cristóbal de La Laguna: Aficionado','San Cristóbal de La Laguna Amateur','Haz check-in válido en 5 locales distintos de San Cristóbal de La Laguna.','Complete valid check-ins at 5 distinct places in San Cristóbal de La Laguna.','venues',5,'discover','la-laguna',null,1000000,true),
('city_la_laguna_10','San Cristóbal de La Laguna: Explorador','San Cristóbal de La Laguna Explorer','Haz check-in válido en 10 locales distintos de San Cristóbal de La Laguna.','Complete valid check-ins at 10 distinct places in San Cristóbal de La Laguna.','venues',10,'discover','la-laguna',null,1000000,true),
('city_la_laguna_25','San Cristóbal de La Laguna: Conocedor','San Cristóbal de La Laguna Insider','Haz check-in válido en 25 locales distintos de San Cristóbal de La Laguna.','Complete valid check-ins at 25 distinct places in San Cristóbal de La Laguna.','venues',25,'discover','la-laguna',null,1000000,true),
('city_la_laguna_50','San Cristóbal de La Laguna: Experto','San Cristóbal de La Laguna Expert','Haz check-in válido en 50 locales distintos de San Cristóbal de La Laguna.','Complete valid check-ins at 50 distinct places in San Cristóbal de La Laguna.','venues',50,'discover','la-laguna',null,1000000,true),
('city_la_laguna_100','San Cristóbal de La Laguna: Leyenda','San Cristóbal de La Laguna Legend','Haz check-in válido en 100 locales distintos de San Cristóbal de La Laguna.','Complete valid check-ins at 100 distinct places in San Cristóbal de La Laguna.','venues',100,'discover','la-laguna',null,1000000,true),
('city_ibiza_1','Ibiza: Principiante','Ibiza Novice','Haz check-in válido en 1 local distinto de Ibiza.','Complete valid check-ins at 1 distinct place in Ibiza.','venues',1,'discover','ibiza',null,1000000,true),
('city_ibiza_5','Ibiza: Aficionado','Ibiza Amateur','Haz check-in válido en 5 locales distintos de Ibiza.','Complete valid check-ins at 5 distinct places in Ibiza.','venues',5,'discover','ibiza',null,1000000,true),
('city_ibiza_10','Ibiza: Explorador','Ibiza Explorer','Haz check-in válido en 10 locales distintos de Ibiza.','Complete valid check-ins at 10 distinct places in Ibiza.','venues',10,'discover','ibiza',null,1000000,true),
('city_ibiza_25','Ibiza: Conocedor','Ibiza Insider','Haz check-in válido en 25 locales distintos de Ibiza.','Complete valid check-ins at 25 distinct places in Ibiza.','venues',25,'discover','ibiza',null,1000000,true),
('city_ibiza_50','Ibiza: Experto','Ibiza Expert','Haz check-in válido en 50 locales distintos de Ibiza.','Complete valid check-ins at 50 distinct places in Ibiza.','venues',50,'discover','ibiza',null,1000000,true),
('city_ibiza_100','Ibiza: Leyenda','Ibiza Legend','Haz check-in válido en 100 locales distintos de Ibiza.','Complete valid check-ins at 100 distinct places in Ibiza.','venues',100,'discover','ibiza',null,1000000,true),
('city_alcala_1','Alcalá de Henares: Principiante','Alcalá de Henares Novice','Haz check-in válido en 1 local distinto de Alcalá de Henares.','Complete valid check-ins at 1 distinct place in Alcalá de Henares.','venues',1,'discover','alcala',null,1000000,true),
('city_alcala_5','Alcalá de Henares: Aficionado','Alcalá de Henares Amateur','Haz check-in válido en 5 locales distintos de Alcalá de Henares.','Complete valid check-ins at 5 distinct places in Alcalá de Henares.','venues',5,'discover','alcala',null,1000000,true),
('city_alcala_10','Alcalá de Henares: Explorador','Alcalá de Henares Explorer','Haz check-in válido en 10 locales distintos de Alcalá de Henares.','Complete valid check-ins at 10 distinct places in Alcalá de Henares.','venues',10,'discover','alcala',null,1000000,true),
('city_alcala_25','Alcalá de Henares: Conocedor','Alcalá de Henares Insider','Haz check-in válido en 25 locales distintos de Alcalá de Henares.','Complete valid check-ins at 25 distinct places in Alcalá de Henares.','venues',25,'discover','alcala',null,1000000,true),
('city_alcala_50','Alcalá de Henares: Experto','Alcalá de Henares Expert','Haz check-in válido en 50 locales distintos de Alcalá de Henares.','Complete valid check-ins at 50 distinct places in Alcalá de Henares.','venues',50,'discover','alcala',null,1000000,true),
('city_alcala_100','Alcalá de Henares: Leyenda','Alcalá de Henares Legend','Haz check-in válido en 100 locales distintos de Alcalá de Henares.','Complete valid check-ins at 100 distinct places in Alcalá de Henares.','venues',100,'discover','alcala',null,1000000,true),
('city_terrassa_1','Terrassa: Principiante','Terrassa Novice','Haz check-in válido en 1 local distinto de Terrassa.','Complete valid check-ins at 1 distinct place in Terrassa.','venues',1,'discover','terrassa',null,1000000,true),
('city_terrassa_5','Terrassa: Aficionado','Terrassa Amateur','Haz check-in válido en 5 locales distintos de Terrassa.','Complete valid check-ins at 5 distinct places in Terrassa.','venues',5,'discover','terrassa',null,1000000,true),
('city_terrassa_10','Terrassa: Explorador','Terrassa Explorer','Haz check-in válido en 10 locales distintos de Terrassa.','Complete valid check-ins at 10 distinct places in Terrassa.','venues',10,'discover','terrassa',null,1000000,true),
('city_terrassa_25','Terrassa: Conocedor','Terrassa Insider','Haz check-in válido en 25 locales distintos de Terrassa.','Complete valid check-ins at 25 distinct places in Terrassa.','venues',25,'discover','terrassa',null,1000000,true),
('city_terrassa_50','Terrassa: Experto','Terrassa Expert','Haz check-in válido en 50 locales distintos de Terrassa.','Complete valid check-ins at 50 distinct places in Terrassa.','venues',50,'discover','terrassa',null,1000000,true),
('city_terrassa_100','Terrassa: Leyenda','Terrassa Legend','Haz check-in válido en 100 locales distintos de Terrassa.','Complete valid check-ins at 100 distinct places in Terrassa.','venues',100,'discover','terrassa',null,1000000,true),
('city_fuengirola_1','Fuengirola: Principiante','Fuengirola Novice','Haz check-in válido en 1 local distinto de Fuengirola.','Complete valid check-ins at 1 distinct place in Fuengirola.','venues',1,'discover','fuengirola',null,1000000,true),
('city_fuengirola_5','Fuengirola: Aficionado','Fuengirola Amateur','Haz check-in válido en 5 locales distintos de Fuengirola.','Complete valid check-ins at 5 distinct places in Fuengirola.','venues',5,'discover','fuengirola',null,1000000,true),
('city_fuengirola_10','Fuengirola: Explorador','Fuengirola Explorer','Haz check-in válido en 10 locales distintos de Fuengirola.','Complete valid check-ins at 10 distinct places in Fuengirola.','venues',10,'discover','fuengirola',null,1000000,true),
('city_fuengirola_25','Fuengirola: Conocedor','Fuengirola Insider','Haz check-in válido en 25 locales distintos de Fuengirola.','Complete valid check-ins at 25 distinct places in Fuengirola.','venues',25,'discover','fuengirola',null,1000000,true),
('city_fuengirola_50','Fuengirola: Experto','Fuengirola Expert','Haz check-in válido en 50 locales distintos de Fuengirola.','Complete valid check-ins at 50 distinct places in Fuengirola.','venues',50,'discover','fuengirola',null,1000000,true),
('city_fuengirola_100','Fuengirola: Leyenda','Fuengirola Legend','Haz check-in válido en 100 locales distintos de Fuengirola.','Complete valid check-ins at 100 distinct places in Fuengirola.','venues',100,'discover','fuengirola',null,1000000,true),
('category_restaurant_1','Foodie: Principiante','Foodie: Novice','Visita 1 local distinto de la categoría restaurantes.','Visit 1 distinct place in restaurants.','venues',1,'venue',null,'restaurant',1000000,true),
('category_restaurant_5','Foodie: Aficionado','Foodie: Amateur','Visita 5 locales distintos de la categoría restaurantes.','Visit 5 distinct places in restaurants.','venues',5,'venue',null,'restaurant',1000000,true),
('category_restaurant_10','Foodie: Explorador','Foodie: Explorer','Visita 10 locales distintos de la categoría restaurantes.','Visit 10 distinct places in restaurants.','venues',10,'venue',null,'restaurant',1000000,true),
('category_restaurant_25','Foodie: Conocedor','Foodie: Insider','Visita 25 locales distintos de la categoría restaurantes.','Visit 25 distinct places in restaurants.','venues',25,'venue',null,'restaurant',1000000,true),
('category_restaurant_50','Foodie: Experto','Foodie: Expert','Visita 50 locales distintos de la categoría restaurantes.','Visit 50 distinct places in restaurants.','venues',50,'venue',null,'restaurant',1000000,true),
('category_cafe_1','Ruta del café: Principiante','Coffee trail: Novice','Visita 1 local distinto de la categoría cafeterías.','Visit 1 distinct place in cafés.','venues',1,'heart',null,'cafe',1000000,true),
('category_cafe_5','Ruta del café: Aficionado','Coffee trail: Amateur','Visita 5 locales distintos de la categoría cafeterías.','Visit 5 distinct places in cafés.','venues',5,'heart',null,'cafe',1000000,true),
('category_cafe_10','Ruta del café: Explorador','Coffee trail: Explorer','Visita 10 locales distintos de la categoría cafeterías.','Visit 10 distinct places in cafés.','venues',10,'heart',null,'cafe',1000000,true),
('category_cafe_25','Ruta del café: Conocedor','Coffee trail: Insider','Visita 25 locales distintos de la categoría cafeterías.','Visit 25 distinct places in cafés.','venues',25,'heart',null,'cafe',1000000,true),
('category_cafe_50','Ruta del café: Experto','Coffee trail: Expert','Visita 50 locales distintos de la categoría cafeterías.','Visit 50 distinct places in cafés.','venues',50,'heart',null,'cafe',1000000,true),
('category_bar_1','De tapas: Principiante','Tapas explorer: Novice','Visita 1 local distinto de la categoría bares y tapas.','Visit 1 distinct place in bars & tapas.','venues',1,'venue',null,'bar',1000000,true),
('category_bar_5','De tapas: Aficionado','Tapas explorer: Amateur','Visita 5 locales distintos de la categoría bares y tapas.','Visit 5 distinct places in bars & tapas.','venues',5,'venue',null,'bar',1000000,true),
('category_bar_10','De tapas: Explorador','Tapas explorer: Explorer','Visita 10 locales distintos de la categoría bares y tapas.','Visit 10 distinct places in bars & tapas.','venues',10,'venue',null,'bar',1000000,true),
('category_bar_25','De tapas: Conocedor','Tapas explorer: Insider','Visita 25 locales distintos de la categoría bares y tapas.','Visit 25 distinct places in bars & tapas.','venues',25,'venue',null,'bar',1000000,true),
('category_bar_50','De tapas: Experto','Tapas explorer: Expert','Visita 50 locales distintos de la categoría bares y tapas.','Visit 50 distinct places in bars & tapas.','venues',50,'venue',null,'bar',1000000,true),
('category_nightlife_1','Vida nocturna: Principiante','Night owl: Novice','Visita 1 local distinto de la categoría ocio nocturno.','Visit 1 distinct place in nightlife.','venues',1,'star',null,'nightlife',1000000,true),
('category_nightlife_5','Vida nocturna: Aficionado','Night owl: Amateur','Visita 5 locales distintos de la categoría ocio nocturno.','Visit 5 distinct places in nightlife.','venues',5,'star',null,'nightlife',1000000,true),
('category_nightlife_10','Vida nocturna: Explorador','Night owl: Explorer','Visita 10 locales distintos de la categoría ocio nocturno.','Visit 10 distinct places in nightlife.','venues',10,'star',null,'nightlife',1000000,true),
('category_nightlife_25','Vida nocturna: Conocedor','Night owl: Insider','Visita 25 locales distintos de la categoría ocio nocturno.','Visit 25 distinct places in nightlife.','venues',25,'star',null,'nightlife',1000000,true),
('category_nightlife_50','Vida nocturna: Experto','Night owl: Expert','Visita 50 locales distintos de la categoría ocio nocturno.','Visit 50 distinct places in nightlife.','venues',50,'star',null,'nightlife',1000000,true),
('category_culture_1','Pasión cultural: Principiante','Culture seeker: Novice','Visita 1 local distinto de la categoría arte y cultura.','Visit 1 distinct place in arts & culture.','venues',1,'discover',null,'culture',1000000,true),
('category_culture_5','Pasión cultural: Aficionado','Culture seeker: Amateur','Visita 5 locales distintos de la categoría arte y cultura.','Visit 5 distinct places in arts & culture.','venues',5,'discover',null,'culture',1000000,true),
('category_culture_10','Pasión cultural: Explorador','Culture seeker: Explorer','Visita 10 locales distintos de la categoría arte y cultura.','Visit 10 distinct places in arts & culture.','venues',10,'discover',null,'culture',1000000,true),
('category_culture_25','Pasión cultural: Conocedor','Culture seeker: Insider','Visita 25 locales distintos de la categoría arte y cultura.','Visit 25 distinct places in arts & culture.','venues',25,'discover',null,'culture',1000000,true),
('category_culture_50','Pasión cultural: Experto','Culture seeker: Expert','Visita 50 locales distintos de la categoría arte y cultura.','Visit 50 distinct places in arts & culture.','venues',50,'discover',null,'culture',1000000,true),
('category_shopping_1','Compra local: Principiante','Shop local: Novice','Visita 1 local distinto de la categoría tiendas y mercados.','Visit 1 distinct place in shops & markets.','venues',1,'gift',null,'shopping',1000000,true),
('category_shopping_5','Compra local: Aficionado','Shop local: Amateur','Visita 5 locales distintos de la categoría tiendas y mercados.','Visit 5 distinct places in shops & markets.','venues',5,'gift',null,'shopping',1000000,true),
('category_shopping_10','Compra local: Explorador','Shop local: Explorer','Visita 10 locales distintos de la categoría tiendas y mercados.','Visit 10 distinct places in shops & markets.','venues',10,'gift',null,'shopping',1000000,true),
('category_shopping_25','Compra local: Conocedor','Shop local: Insider','Visita 25 locales distintos de la categoría tiendas y mercados.','Visit 25 distinct places in shops & markets.','venues',25,'gift',null,'shopping',1000000,true),
('category_shopping_50','Compra local: Experto','Shop local: Expert','Visita 50 locales distintos de la categoría tiendas y mercados.','Visit 50 distinct places in shops & markets.','venues',50,'gift',null,'shopping',1000000,true),
('category_sport_1','Espíritu deportivo: Principiante','Active explorer: Novice','Visita 1 local distinto de la categoría deporte.','Visit 1 distinct place in sport.','venues',1,'heart',null,'sport',1000000,true),
('category_sport_5','Espíritu deportivo: Aficionado','Active explorer: Amateur','Visita 5 locales distintos de la categoría deporte.','Visit 5 distinct places in sport.','venues',5,'heart',null,'sport',1000000,true),
('category_sport_10','Espíritu deportivo: Explorador','Active explorer: Explorer','Visita 10 locales distintos de la categoría deporte.','Visit 10 distinct places in sport.','venues',10,'heart',null,'sport',1000000,true),
('category_sport_25','Espíritu deportivo: Conocedor','Active explorer: Insider','Visita 25 locales distintos de la categoría deporte.','Visit 25 distinct places in sport.','venues',25,'heart',null,'sport',1000000,true),
('category_sport_50','Espíritu deportivo: Experto','Active explorer: Expert','Visita 50 locales distintos de la categoría deporte.','Visit 50 distinct places in sport.','venues',50,'heart',null,'sport',1000000,true),
('category_wellness_1','Tiempo para ti: Principiante','Wellness seeker: Novice','Visita 1 local distinto de la categoría bienestar.','Visit 1 distinct place in wellness.','venues',1,'heart',null,'wellness',1000000,true),
('category_wellness_5','Tiempo para ti: Aficionado','Wellness seeker: Amateur','Visita 5 locales distintos de la categoría bienestar.','Visit 5 distinct places in wellness.','venues',5,'heart',null,'wellness',1000000,true),
('category_wellness_10','Tiempo para ti: Explorador','Wellness seeker: Explorer','Visita 10 locales distintos de la categoría bienestar.','Visit 10 distinct places in wellness.','venues',10,'heart',null,'wellness',1000000,true),
('category_wellness_25','Tiempo para ti: Conocedor','Wellness seeker: Insider','Visita 25 locales distintos de la categoría bienestar.','Visit 25 distinct places in wellness.','venues',25,'heart',null,'wellness',1000000,true),
('category_wellness_50','Tiempo para ti: Experto','Wellness seeker: Expert','Visita 50 locales distintos de la categoría bienestar.','Visit 50 distinct places in wellness.','venues',50,'heart',null,'wellness',1000000,true),
('category_family_1','En familia: Principiante','Family adventurer: Novice','Visita 1 local distinto de la categoría planes familiares.','Visit 1 distinct place in family activities.','venues',1,'gift',null,'family',1000000,true),
('category_family_5','En familia: Aficionado','Family adventurer: Amateur','Visita 5 locales distintos de la categoría planes familiares.','Visit 5 distinct places in family activities.','venues',5,'gift',null,'family',1000000,true),
('category_family_10','En familia: Explorador','Family adventurer: Explorer','Visita 10 locales distintos de la categoría planes familiares.','Visit 10 distinct places in family activities.','venues',10,'gift',null,'family',1000000,true),
('category_family_25','En familia: Conocedor','Family adventurer: Insider','Visita 25 locales distintos de la categoría planes familiares.','Visit 25 distinct places in family activities.','venues',25,'gift',null,'family',1000000,true),
('category_family_50','En familia: Experto','Family adventurer: Expert','Visita 50 locales distintos de la categoría planes familiares.','Visit 50 distinct places in family activities.','venues',50,'gift',null,'family',1000000,true),
('category_outdoors_1','Al aire libre: Principiante','Outdoor explorer: Novice','Visita 1 local distinto de la categoría naturaleza y aire libre.','Visit 1 distinct place in nature & outdoors.','venues',1,'discover',null,'outdoors',1000000,true),
('category_outdoors_5','Al aire libre: Aficionado','Outdoor explorer: Amateur','Visita 5 locales distintos de la categoría naturaleza y aire libre.','Visit 5 distinct places in nature & outdoors.','venues',5,'discover',null,'outdoors',1000000,true),
('category_outdoors_10','Al aire libre: Explorador','Outdoor explorer: Explorer','Visita 10 locales distintos de la categoría naturaleza y aire libre.','Visit 10 distinct places in nature & outdoors.','venues',10,'discover',null,'outdoors',1000000,true),
('category_outdoors_25','Al aire libre: Conocedor','Outdoor explorer: Insider','Visita 25 locales distintos de la categoría naturaleza y aire libre.','Visit 25 distinct places in nature & outdoors.','venues',25,'discover',null,'outdoors',1000000,true),
('category_outdoors_50','Al aire libre: Experto','Outdoor explorer: Expert','Visita 50 locales distintos de la categoría naturaleza y aire libre.','Visit 50 distinct places in nature & outdoors.','venues',50,'discover',null,'outdoors',1000000,true),
('venues_1','Nuevos lugares · 1','New discoveries · 1','Consigue 1 locales distintos.','Reach 1 distinct places.','venues',1,'discover',null,null,1000000,true),
('venues_3','Nuevos lugares · 3','New discoveries · 3','Consigue 3 locales distintos.','Reach 3 distinct places.','venues',3,'discover',null,null,1000000,true),
('venues_5','Nuevos lugares · 5','New discoveries · 5','Consigue 5 locales distintos.','Reach 5 distinct places.','venues',5,'discover',null,null,1000000,true),
('venues_10','Nuevos lugares · 10','New discoveries · 10','Consigue 10 locales distintos.','Reach 10 distinct places.','venues',10,'discover',null,null,1000000,true),
('venues_25','Nuevos lugares · 25','New discoveries · 25','Consigue 25 locales distintos.','Reach 25 distinct places.','venues',25,'discover',null,null,1000000,true),
('venues_50','Nuevos lugares · 50','New discoveries · 50','Consigue 50 locales distintos.','Reach 50 distinct places.','venues',50,'discover',null,null,1000000,true),
('venues_100','Nuevos lugares · 100','New discoveries · 100','Consigue 100 locales distintos.','Reach 100 distinct places.','venues',100,'discover',null,null,1000000,true),
('venues_250','Nuevos lugares · 250','New discoveries · 250','Consigue 250 locales distintos.','Reach 250 distinct places.','venues',250,'discover',null,null,1000000,true),
('check_ins_3','Siempre hay un plan · 3','Always exploring · 3','Consigue 3 check-ins válidos.','Reach 3 valid check-ins.','check_ins',3,'star',null,null,1000000,true),
('check_ins_10','Siempre hay un plan · 10','Always exploring · 10','Consigue 10 check-ins válidos.','Reach 10 valid check-ins.','check_ins',10,'star',null,null,1000000,true),
('check_ins_25','Siempre hay un plan · 25','Always exploring · 25','Consigue 25 check-ins válidos.','Reach 25 valid check-ins.','check_ins',25,'star',null,null,1000000,true),
('check_ins_50','Siempre hay un plan · 50','Always exploring · 50','Consigue 50 check-ins válidos.','Reach 50 valid check-ins.','check_ins',50,'star',null,null,1000000,true),
('check_ins_100','Siempre hay un plan · 100','Always exploring · 100','Consigue 100 check-ins válidos.','Reach 100 valid check-ins.','check_ins',100,'star',null,null,1000000,true),
('check_ins_250','Siempre hay un plan · 250','Always exploring · 250','Consigue 250 check-ins válidos.','Reach 250 valid check-ins.','check_ins',250,'star',null,null,1000000,true),
('check_ins_500','Siempre hay un plan · 500','Always exploring · 500','Consigue 500 check-ins válidos.','Reach 500 valid check-ins.','check_ins',500,'star',null,null,1000000,true),
('cities_2','De ciudad en ciudad · 2','City hopper · 2','Consigue 2 ciudades distintas.','Reach 2 different cities.','cities',2,'discover',null,null,1000000,true),
('cities_3','De ciudad en ciudad · 3','City hopper · 3','Consigue 3 ciudades distintas.','Reach 3 different cities.','cities',3,'discover',null,null,1000000,true),
('cities_5','De ciudad en ciudad · 5','City hopper · 5','Consigue 5 ciudades distintas.','Reach 5 different cities.','cities',5,'discover',null,null,1000000,true),
('cities_10','De ciudad en ciudad · 10','City hopper · 10','Consigue 10 ciudades distintas.','Reach 10 different cities.','cities',10,'discover',null,null,1000000,true),
('cities_25','De ciudad en ciudad · 25','City hopper · 25','Consigue 25 ciudades distintas.','Reach 25 different cities.','cities',25,'discover',null,null,1000000,true),
('cities_50','De ciudad en ciudad · 50','City hopper · 50','Consigue 50 ciudades distintas.','Reach 50 different cities.','cities',50,'discover',null,null,1000000,true),
('categories_2','Un poco de todo · 2','A bit of everything · 2','Consigue 2 categorías distintas.','Reach 2 different categories.','categories',2,'gift',null,null,1000000,true),
('categories_3','Un poco de todo · 3','A bit of everything · 3','Consigue 3 categorías distintas.','Reach 3 different categories.','categories',3,'gift',null,null,1000000,true),
('categories_5','Un poco de todo · 5','A bit of everything · 5','Consigue 5 categorías distintas.','Reach 5 different categories.','categories',5,'gift',null,null,1000000,true),
('categories_8','Un poco de todo · 8','A bit of everything · 8','Consigue 8 categorías distintas.','Reach 8 different categories.','categories',8,'gift',null,null,1000000,true),
('categories_10','Un poco de todo · 10','A bit of everything · 10','Consigue 10 categorías distintas.','Reach 10 different categories.','categories',10,'gift',null,null,1000000,true),
('active_days_3','Días de aventura · 3','Adventure days · 3','Consigue 3 días diferentes con check-in.','Reach 3 different days with a check-in.','active_days',3,'heart',null,null,1000000,true),
('active_days_7','Días de aventura · 7','Adventure days · 7','Consigue 7 días diferentes con check-in.','Reach 7 different days with a check-in.','active_days',7,'heart',null,null,1000000,true),
('active_days_14','Días de aventura · 14','Adventure days · 14','Consigue 14 días diferentes con check-in.','Reach 14 different days with a check-in.','active_days',14,'heart',null,null,1000000,true),
('active_days_30','Días de aventura · 30','Adventure days · 30','Consigue 30 días diferentes con check-in.','Reach 30 different days with a check-in.','active_days',30,'heart',null,null,1000000,true),
('active_days_60','Días de aventura · 60','Adventure days · 60','Consigue 60 días diferentes con check-in.','Reach 60 different days with a check-in.','active_days',60,'heart',null,null,1000000,true),
('active_days_100','Días de aventura · 100','Adventure days · 100','Consigue 100 días diferentes con check-in.','Reach 100 different days with a check-in.','active_days',100,'heart',null,null,1000000,true),
('regular_3','Como en casa · 3','A familiar face · 3','Consigue 3 visitas válidas a un mismo local.','Reach 3 valid visits to the same place.','regular',3,'venue',null,null,1000000,true),
('regular_5','Como en casa · 5','A familiar face · 5','Consigue 5 visitas válidas a un mismo local.','Reach 5 valid visits to the same place.','regular',5,'venue',null,null,1000000,true),
('regular_10','Como en casa · 10','A familiar face · 10','Consigue 10 visitas válidas a un mismo local.','Reach 10 valid visits to the same place.','regular',10,'venue',null,null,1000000,true),
('regular_25','Como en casa · 25','A familiar face · 25','Consigue 25 visitas válidas a un mismo local.','Reach 25 valid visits to the same place.','regular',25,'venue',null,null,1000000,true),
('regular_50','Como en casa · 50','A familiar face · 50','Consigue 50 visitas válidas a un mismo local.','Reach 50 valid visits to the same place.','regular',50,'venue',null,null,1000000,true),
('weekend_1','Planes de finde · 1','Weekend wanderer · 1','Consigue 1 días de fin de semana con check-in.','Reach 1 weekend days with a check-in.','weekend',1,'gift',null,null,1000000,true),
('weekend_5','Planes de finde · 5','Weekend wanderer · 5','Consigue 5 días de fin de semana con check-in.','Reach 5 weekend days with a check-in.','weekend',5,'gift',null,null,1000000,true),
('weekend_10','Planes de finde · 10','Weekend wanderer · 10','Consigue 10 días de fin de semana con check-in.','Reach 10 weekend days with a check-in.','weekend',10,'gift',null,null,1000000,true),
('weekend_25','Planes de finde · 25','Weekend wanderer · 25','Consigue 25 días de fin de semana con check-in.','Reach 25 weekend days with a check-in.','weekend',25,'gift',null,null,1000000,true),
('weekend_50','Planes de finde · 50','Weekend wanderer · 50','Consigue 50 días de fin de semana con check-in.','Reach 50 weekend days with a check-in.','weekend',50,'gift',null,null,1000000,true),
('xp_250','Energía exploradora · 250','Explorer energy · 250','Acumula 250 XP.','Earn 250 XP.','xp',250,'star',null,null,250,true),
('xp_1000','Energía exploradora · 1000','Explorer energy · 1000','Acumula 1000 XP.','Earn 1000 XP.','xp',1000,'star',null,null,1000,true),
('xp_2500','Energía exploradora · 2500','Explorer energy · 2500','Acumula 2500 XP.','Earn 2500 XP.','xp',2500,'star',null,null,2500,true),
('xp_5000','Energía exploradora · 5000','Explorer energy · 5000','Acumula 5000 XP.','Earn 5000 XP.','xp',5000,'star',null,null,5000,true),
('xp_10000','Energía exploradora · 10000','Explorer energy · 10000','Acumula 10000 XP.','Earn 10000 XP.','xp',10000,'star',null,null,10000,true);

alter table public.achievements enable trigger audit_achievement_change;
create function public.set_venue_achievement_categories(p_venue uuid,p_categories text[],p_expected text[]) returns void
language plpgsql security invoker set search_path='' as $$
declare v_current text[]; v_expected text[];
begin
 if auth.uid() is null or not public.has_platform_role(array['administrator']::public.app_role[]) then raise exception 'administrator required' using errcode='42501'; end if;
 if p_categories is null or cardinality(p_categories)>10 or exists(select 1 from unnest(p_categories) k where k is null or not exists(select 1 from public.achievement_categories c where c.key=k)) then raise exception 'invalid categories'; end if;
 if not exists(select 1 from public.venues where id=p_venue) then raise exception 'venue not found'; end if;
 perform pg_advisory_xact_lock(hashtextextended('achievement-categories:'||p_venue::text,0));
 select coalesce(array_agg(category_key order by category_key),'{}'::text[]) into v_current from public.venue_achievement_categories where venue_id=p_venue;
 select coalesce(array_agg(distinct k order by k),'{}'::text[]) into v_expected from unnest(p_expected) k;
 if v_current is distinct from v_expected then raise exception 'categories changed; refresh'; end if;
 delete from public.venue_achievement_categories where venue_id=p_venue and not(category_key=any(p_categories));
 insert into public.venue_achievement_categories(venue_id,category_key) select p_venue,k from (select distinct unnest(p_categories) k) cats on conflict do nothing;
end; $$;
revoke all on function public.set_venue_achievement_categories(uuid,text[],text[]) from public,anon,authenticated;
grant execute on function public.set_venue_achievement_categories(uuid,text[],text[]) to authenticated;

commit;

begin;
alter table public.achievements add column family_key text, add column tier_index integer not null default 0, add column archived boolean not null default false;
alter table public.achievements disable trigger audit_achievement_change;
update public.achievements set family_key=case when city_key is not null then 'city/'||city_key when category_key is not null then 'legacy/'||category_key else 'general/'||key end,
 tier_index=case when city_key is not null then coalesce(array_position(array[1,5,10,25,50,100],target_count),0) when category_key is not null then coalesce(array_position(array[1,5,10,25,50],target_count),0) else 1 end;
update public.achievements set active=false,archived=true where category_key is not null and city_key is null;
insert into public.achievements(key,title_es,title_en,description_es,description_en,minimum_xp,icon,active,condition_type,target_count,city_key,category_key,family_key,tier_index)
select 'stamp_'||replace(c.key,'-','_')||'_'||k.key||'_'||t.n,
 left(c.title_es||' · '||k.title_es||' · '||t.es,80),left(c.title_en||' · '||k.title_en||' · '||t.en,80),
 'Visita '||t.n||' locales distintos de '||lower(k.title_es)||' en '||c.title_es||'.',
 'Visit '||t.n||' different '||lower(k.title_en)||' venues in '||c.title_en||'.',
 1000000,'venue',true,'venues',t.n,c.key,k.key,'stamp/'||c.key||'/'||k.key,t.tier
from public.achievement_cities c cross join public.achievement_categories k cross join (values (1,1,'Bronce','Bronze'),(5,2,'Plata','Silver'),(10,3,'Oro','Gold'),(25,4,'Platino','Platinum'),(50,5,'Holográfico','Holographic')) t(n,tier,es,en);
alter table public.achievements enable trigger audit_achievement_change;
create unique index achievement_family_tier_unique on public.achievements(family_key,tier_index) where family_key is not null;
alter table public.achievements add constraint achievement_tier_valid check(tier_index between 0 and 6);

create table private.passport_manual_awards (
 id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.profiles(id) on delete cascade,
 achievement_key text not null references public.achievements(key), purpose text not null check(purpose in ('test','recognition')),
 reason text not null check(length(trim(reason)) between 3 and 500), granted_by uuid not null, granted_at timestamptz not null default now(),
 request_id uuid not null, batch_id uuid not null, revoked_at timestamptz, revoked_by uuid,
 unique(granted_by,request_id,achievement_key)
);
create index passport_manual_member on private.passport_manual_awards(profile_id) where revoked_at is null;
create table private.passport_test_accounts(profile_id uuid primary key references public.profiles(id) on delete cascade,marked_by uuid not null,marked_at timestamptz not null default now());
alter table private.passport_manual_awards enable row level security;
alter table private.passport_test_accounts enable row level security;
revoke all on private.passport_manual_awards,private.passport_test_accounts from public,anon,authenticated;

create function private.passport_city(p_id uuid) returns text language sql stable set search_path='' as $$
 select coalesce((select a.key from public.achievement_cities a where private.achievement_city_normalize(c.name_es)=any(a.aliases) or private.achievement_city_normalize(c.name_en)=any(a.aliases) or c.slug=a.key or c.slug like a.key||'-%' order by length(a.key) desc,a.key limit 1),private.achievement_city_normalize(c.name_es)) from public.cities c where c.id=p_id;
$$;
revoke all on function private.passport_city(uuid) from public,anon,authenticated;

create or replace function private.achievement_counts(p_profile uuid) returns table(achievement_key text,current_count bigint)
language sql stable set search_path='' as $$
 with visits as materialized (
 select ci.venue_id,(ci.created_at at time zone coalesce(c.timezone,'Europe/Madrid'))::date visit_day,private.passport_city(c.id) city
 from public.check_ins ci join public.venues v on v.id=ci.venue_id join public.cities c on c.id=v.city_id where ci.profile_id=p_profile and ci.state='accepted'
 ), places as materialized(select distinct venue_id,city from visits),
 tagged as materialized(select p.*,t.category_key from places p join public.venue_achievement_categories t on t.venue_id=p.venue_id),
 city_counts as(select city,count(*) n from places group by city),
 category_counts as(select category_key,count(distinct venue_id) n from tagged group by category_key),
 local_counts as(select city,category_key,count(distinct venue_id) n from tagged group by city,category_key),
 totals as(select count(*) check_ins,count(distinct city) cities,count(distinct visit_day) active_days,count(distinct visit_day) filter(where extract(isodow from visit_day) in (6,7)) weekend from visits)
 select a.key,coalesce(case a.condition_type
 when 'xp' then greatest(0,(select coalesce(sum(delta),0) from public.xp_ledger where profile_id=p_profile))
 when 'venues' then case when a.city_key is not null and a.category_key is not null then lc.n when a.city_key is not null then cc.n when a.category_key is not null then kc.n else (select count(*) from places) end
 when 'check_ins' then t.check_ins when 'cities' then t.cities when 'categories' then (select count(distinct category_key) from tagged)
 when 'active_days' then t.active_days when 'weekend' then t.weekend when 'regular' then (select max(n) from (select count(*) n from visits group by venue_id) r) end,0)::bigint
 from public.achievements a cross join totals t left join city_counts cc on cc.city=a.city_key left join category_counts kc on kc.category_key=a.category_key left join local_counts lc on lc.city=a.city_key and lc.category_key=a.category_key where a.active;
$$;

create function private.passport_collection(p_profile uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or (p_profile<>auth.uid() and not public.has_platform_role(array['administrator']::public.app_role[])) then raise exception 'not authorised' using errcode='42501'; end if;
 perform private.award_achievements(p_profile);
 with eligible as materialized (
 select v.id,private.passport_city(v.city_id) city from public.venues v where v.status='published' and v.verified and v.location is not null and exists(select 1 from public.venue_checkin_credentials c where c.venue_id=v.id and c.active)
 ), candidates as materialized (
 select e.city,null::text category_key,e.id from eligible e union all select e.city,t.category_key,e.id from eligible e join public.venue_achievement_categories t on t.venue_id=e.id
 ), possible as (
 select city,category_key,count(distinct id) available,count(distinct id) filter(where not exists(select 1 from public.check_ins ci where ci.profile_id=p_profile and ci.venue_id=ca.id and ci.state='accepted')) remaining from candidates ca group by city,category_key
 ), manual as (
 select achievement_key,max(granted_at) granted_at from private.passport_manual_awards where profile_id=p_profile and revoked_at is null group by achievement_key
 ), rows as (
 select a.*,coalesce(c.current_count,0) current_count,u.unlocked_at,m.granted_at,coalesce(p.available,0) available,coalesce(p.remaining,0) remaining
 from public.achievements a left join private.achievement_counts(p_profile) c on c.achievement_key=a.key
 left join public.achievement_unlocks u on u.profile_id=p_profile and u.achievement_key=a.key
 left join manual m on m.achievement_key=a.key
 left join possible p on p.city=a.city_key and p.category_key is not distinct from a.category_key
 where a.active or (a.archived and (u.unlocked_at is not null or m.granted_at is not null))
 ), families as (
 select coalesce(family_key,'custom/'||key) family_key,city_key,category_key,bool_or(archived) archived,
 max(current_count) current_count,max(available) available,max(remaining) remaining,
 jsonb_agg(jsonb_build_object('key',key,'tier',tier_index,'target',case when condition_type='xp' then minimum_xp else target_count end,'title_es',title_es,'title_en',title_en,'unlocked_at',unlocked_at,'manual_at',granted_at) order by target_count,key) milestones
 from rows group by coalesce(family_key,'custom/'||key),city_key,category_key
 ) select jsonb_build_object('families',coalesce(jsonb_agg(to_jsonb(families) order by family_key),'[]'::jsonb),'updated_at',now()) into result from families;
 return result;
end; $$;
revoke all on function private.passport_collection(uuid) from public,anon,authenticated;
grant execute on function private.passport_collection(uuid) to authenticated;
create function public.passport_collection(p_profile uuid default auth.uid()) returns jsonb language sql security invoker set search_path='' as $$ select private.passport_collection(p_profile); $$;
revoke all on function public.passport_collection(uuid) from public,anon,authenticated;
grant execute on function public.passport_collection(uuid) to authenticated;

-- Administrator RPC: all reads and writes authorise independently of the UI.
create function private.admin_passport_awards(p_action text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); member uuid; request uuid; batch uuid; city text; reason text; v_purpose text; result jsonb; keys text[]; k text; target public.achievements%rowtype; changed integer;
begin
 if actor is null or not public.has_platform_role(array['administrator']::public.app_role[]) then raise exception 'administrator required' using errcode='42501'; end if;
 if p_action='search' then
 if length(trim(p_payload->>'query'))<2 then return '[]'::jsonb; end if;
 select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) into result from (select p.id,p.display_name,u.email,exists(select 1 from private.passport_test_accounts t where t.profile_id=p.id) test_account from public.profiles p join auth.users u on u.id=p.id where p.id::text=p_payload->>'query' or p.display_name ilike '%'||left(p_payload->>'query',100)||'%' or u.email ilike '%'||left(p_payload->>'query',100)||'%' order by p.display_name limit 20) t; return result;
 end if;
 member:=(p_payload->>'profile_id')::uuid;
 if member is null or not exists(select 1 from public.profiles where id=member) then raise exception 'member not found'; end if;
 perform pg_advisory_xact_lock(hashtextextended('achievements:'||member::text,0));
 if p_action='read' then
 return jsonb_build_object('collection',private.passport_collection(member),'test_account',exists(select 1 from private.passport_test_accounts where profile_id=member),'grants',(select coalesce(jsonb_agg(to_jsonb(g) order by g.granted_at desc),'[]'::jsonb) from (select m.*,a.title_en,a.title_es,a.city_key,a.category_key from private.passport_manual_awards m join public.achievements a on a.key=m.achievement_key where m.profile_id=member order by m.granted_at desc limit 200) g));
 end if;
 if p_action='mark_test' then
 if (p_payload->>'enabled')::boolean then insert into private.passport_test_accounts(profile_id,marked_by) values(member,actor) on conflict do nothing;
 else delete from private.passport_test_accounts where profile_id=member; end if;
 elsif p_action in ('grant','preset') then
 reason:=trim(p_payload->>'reason');v_purpose:=p_payload->>'purpose';request:=(p_payload->>'request_id')::uuid;batch:=request;
 if reason is null or length(reason) not between 3 and 500 or v_purpose is null or v_purpose not in ('test','recognition') or request is null then raise exception 'valid reason, purpose and request required'; end if;
 if v_purpose='test' and not exists(select 1 from private.passport_test_accounts where profile_id=member) then raise exception 'mark this as a test account first'; end if;
 if p_action='grant' then keys:=array[p_payload->>'achievement_key'];
 else
 if v_purpose<>'test' then raise exception 'presets require test purpose'; end if;
 city:=p_payload->>'city_key';
 if not exists(select 1 from public.achievement_cities where key=city) then raise exception 'unknown city'; end if;
 select array_agg(a.key) into keys from public.achievements a join (select key,row_number() over(order by key) n from public.achievement_categories) c on c.key=a.category_key where a.city_key=city and a.active and a.tier_index=case when p_payload->>'preset'='mixed' then ((c.n-1)%5+1)::integer else (p_payload->>'preset')::integer end;
 end if;
 if coalesce(array_length(keys,1),0)=0 then raise exception 'no valid awards selected'; end if;
 foreach k in array keys loop
 select * into target from public.achievements where key=k and active and not archived;
 if not found then raise exception 'achievement unavailable'; end if;
 if exists(select 1 from private.passport_manual_awards where granted_by=actor and request_id=request and (profile_id<>member or purpose<>v_purpose)) then raise exception 'request already used'; end if;
 insert into private.passport_manual_awards(profile_id,achievement_key,purpose,reason,granted_by,request_id,batch_id) values(member,k,v_purpose,reason,actor,request,batch) on conflict do nothing;
 get diagnostics changed=row_count;
 if changed>0 then insert into public.moderation_actions(actor_id,action,target_type,target_id,reason,metadata) values(actor,'passport_award_grant','profile',member,reason,jsonb_build_object('achievement',k,'batch',batch,'purpose',v_purpose)); end if;
 end loop;
 return jsonb_build_object('ok',true,'batch_id',batch);
 elsif p_action in ('revoke','reset_city','reset_batch') then
 reason:=trim(p_payload->>'reason');
 if reason is null or length(reason) not between 3 and 500 then raise exception 'reason required'; end if;
 update private.passport_manual_awards m set revoked_at=now(),revoked_by=actor where m.profile_id=member and m.revoked_at is null and
 ((p_action='revoke' and m.id=(p_payload->>'grant_id')::uuid) or (p_action='reset_batch' and m.purpose='test' and m.batch_id=(p_payload->>'batch_id')::uuid) or (p_action='reset_city' and m.purpose='test' and exists(select 1 from public.achievements a where a.key=m.achievement_key and a.city_key=p_payload->>'city_key')));
 get diagnostics changed=row_count;
 insert into public.moderation_actions(actor_id,action,target_type,target_id,reason,metadata) values(actor,'passport_award_'||p_action,'profile',member,reason,jsonb_build_object('changed',changed,'scope',p_payload - 'reason'));
 else raise exception 'unknown action'; end if;
 if p_action='mark_test' then insert into public.moderation_actions(actor_id,action,target_type,target_id,reason,metadata) values(actor,'passport_test_account','profile',member,'Test account designation',p_payload); end if;
 return jsonb_build_object('ok',true);
end; $$;
revoke all on function private.admin_passport_awards(text,jsonb) from public,anon,authenticated;
grant execute on function private.admin_passport_awards(text,jsonb) to authenticated;
create function public.admin_passport_awards(p_action text,p_payload jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.admin_passport_awards(p_action,p_payload);$$;
revoke all on function public.admin_passport_awards(text,jsonb) from public,anon,authenticated;
grant execute on function public.admin_passport_awards(text,jsonb) to authenticated;

-- The original progress API remains compatible; local families use the compact API.
create or replace function private.my_achievement_progress() returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); result jsonb;
begin
 if v_user is null then raise exception 'authentication required' using errcode='42501'; end if;
 perform private.award_achievements(v_user);
 select coalesce(jsonb_agg(to_jsonb(a)||jsonb_build_object('current_count',coalesce(c.current_count,0),'unlocked_at',coalesce(u.unlocked_at,m.granted_at),'manual',u.unlocked_at is null and m.granted_at is not null) order by a.key),'[]'::jsonb) into result
 from public.achievements a left join private.achievement_counts(v_user) c on c.achievement_key=a.key left join public.achievement_unlocks u on u.profile_id=v_user and u.achievement_key=a.key
 left join lateral(select max(granted_at) granted_at from private.passport_manual_awards where profile_id=v_user and achievement_key=a.key and revoked_at is null) m on true
 where (a.active and a.city_key is null) or (a.archived and u.unlocked_at is not null);
 return result;
end; $$;

create function private.passport_places(p_city text,p_category text default null) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (
 select v.id,v.name,v.slug from public.venues v where v.status='published' and v.verified and v.location is not null
 and private.passport_city(v.city_id)=p_city
 and exists(select 1 from public.venue_checkin_credentials c where c.venue_id=v.id and c.active)
 and (p_category is null or exists(select 1 from public.venue_achievement_categories t where t.venue_id=v.id and t.category_key=p_category)) order by v.name,v.id limit 200
 ) x;
$$;
revoke all on function private.passport_places(text,text) from public,anon,authenticated;
grant usage on schema private to anon;
grant execute on function private.passport_places(text,text) to anon,authenticated;
create function public.passport_places(p_city text,p_category text default null) returns jsonb language sql security invoker set search_path='' as $$select private.passport_places(p_city,p_category);$$;
revoke all on function public.passport_places(text,text) from public,anon,authenticated;
grant execute on function public.passport_places(text,text) to anon,authenticated;

-- Preserve existing accepted visits; no XP, loyalty or route data is altered.
do $$declare u record;begin for u in select distinct profile_id from public.check_ins where state='accepted' loop perform private.award_achievements(u.profile_id);end loop;end;$$;
commit;

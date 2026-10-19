-- Rollback-only integration tests. Fixtures never survive the transaction.
begin;
do $$
declare u uuid:=gen_random_uuid(); other_user uuid:=gen_random_uuid(); admin_id uuid; city_a uuid; city_b uuid; v uuid; ci uuid; n integer;
begin
 select id into admin_id from public.profiles where app_role='administrator' limit 1;
 if admin_id is null then raise exception 'existing admin needed'; end if;
 insert into auth.users(id,email,raw_user_meta_data) values(u,'achievement-fixture-'||u||'@example.invalid','{}'),(other_user,'achievement-fixture-'||other_user||'@example.invalid','{}');
 perform set_config('test.achievement_user',u::text,true);
 perform set_config('test.achievement_other',other_user::text,true);
 perform set_config('test.achievement_admin',admin_id::text,true);
 select id into city_a from public.cities where slug='fuengirola';
 select id into city_b from public.cities where slug='fuengirola-andalucia';
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 for n in 1..5 loop
  v:=gen_random_uuid();
  insert into public.venues(id,city_id,slug,name,description_es,address,location,status) values(v,case when n%2=0 then city_a else city_b end,'achievement-fixture-'||v,'Rollback-only venue','Prueba transaccional','Fixture address',st_setsrid(st_makepoint(-4.62,36.54),4326)::geography,'published');
  perform public.set_venue_achievement_categories(v,array['restaurant'],'{}'::text[]);
  if n=1 then
   perform set_config('test.achievement_venue',v::text,true);
   perform public.set_venue_achievement_categories(v,array['restaurant','cafe'],array['restaurant']);
   begin
    perform public.set_venue_achievement_categories(v,array['sport'],array['restaurant']);
    raise exception 'stale category update accepted';
   exception when raise_exception then
    if sqlerrm<>'categories changed; refresh' then raise; end if;
   end;
  end if;
  insert into public.check_ins(id,profile_id,venue_id,idempotency_key,state,created_at) values(gen_random_uuid(),u,v,gen_random_uuid(),'accepted','2026-09-01'::timestamptz+n*interval '1 day');
 end loop;
 v:=current_setting('test.achievement_venue')::uuid;
 insert into public.check_ins(id,profile_id,venue_id,idempotency_key,state,created_at) values(gen_random_uuid(),u,v,gen_random_uuid(),'accepted','2026-09-08'),(gen_random_uuid(),u,v,gen_random_uuid(),'accepted','2026-09-09'),(gen_random_uuid(),u,v,gen_random_uuid(),'duplicate','2026-09-10'),(gen_random_uuid(),u,v,gen_random_uuid(),'cooldown','2026-09-11'),(gen_random_uuid(),u,v,gen_random_uuid(),'rate_limited','2026-09-12');
 select id into ci from public.check_ins where profile_id=u and state='accepted' order by created_at desc limit 1;
 perform set_config('test.achievement_visit',ci::text,true);
 perform set_config('request.jwt.claim.sub',u::text,true);
 insert into public.xp_ledger(id,profile_id,check_in_id,delta,reason,idempotency_key) values(gen_random_uuid(),u,ci,10,'check_in','achievement-fixture-'||u);
 if not exists(select 1 from public.achievement_unlocks where profile_id=u and achievement_key='city_fuengirola_5' and check_in_id=ci) then raise exception 'transactional city award failed'; end if;
 if not exists(select 1 from public.achievement_unlocks where profile_id=u and achievement_key='category_restaurant_5') then raise exception 'restaurant award failed'; end if;
 if exists(select 1 from public.achievement_unlocks where profile_id=u and achievement_key in ('city_fuengirola_10','category_restaurant_10','cities_2','check_ins_10')) then raise exception 'invalid distinct/count award'; end if;
end; $$;
set local role authenticated;
do $$
declare r jsonb; n integer;
begin
 r:=public.my_achievement_progress();
 if (select (x->>'current_count')::int from jsonb_array_elements(r) x where x->>'key'='city_fuengirola_5')<>5 then raise exception 'distinct venue/duplicate city merge failed'; end if;
 if (select (x->>'current_count')::int from jsonb_array_elements(r) x where x->>'key'='check_ins_10')<>7 then raise exception 'invalid states counted'; end if;
 if (select (x->>'current_count')::int from jsonb_array_elements(r) x where x->>'key'='regular_3')<>3 then raise exception 'repeat visits metric failed'; end if;
 if (select (x->>'current_count')::int from jsonb_array_elements(r) x where x->>'key'='weekend_1')<>2 then raise exception 'weekend metric failed'; end if;
 if (select (x->>'current_count')::int from jsonb_array_elements(r) x where x->>'key'='active_days_7')<>7 then raise exception 'active days metric failed'; end if;
 if (select (x->>'current_count')::int from jsonb_array_elements(r) x where x->>'key'='categories_2')<>2 then raise exception 'category variety failed'; end if;
 select count(*) into n from public.achievement_unlocks;
 perform public.my_achievement_progress();
 if (select count(*) from public.achievement_unlocks)<>n then raise exception 'duplicate unlocks'; end if;
 begin
  insert into public.achievement_unlocks(profile_id,achievement_key) values(auth.uid(),'city_fuengirola_100');
  raise exception 'client self-award permitted';
 exception when insufficient_privilege then null; end;
 begin
  perform public.set_venue_achievement_categories(current_setting('test.achievement_venue')::uuid,array['sport'],array['restaurant','cafe']);
  raise exception 'consumer venue classification permitted';
 exception when insufficient_privilege then null; end;
 begin
  perform private.award_achievements(current_setting('test.achievement_other')::uuid,null);
  raise exception 'client can award another user';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub',current_setting('test.achievement_other'),true);
 if exists(select 1 from public.achievement_unlocks) then raise exception 'cross-user unlock leak'; end if;
 r:=public.my_achievement_progress();
 if exists(select 1 from jsonb_array_elements(r) x where (x->>'current_count')::int<>0 or x->>'unlocked_at' is not null) then raise exception 'cross-user progress leak'; end if;
 if (select sum(delta) from public.xp_ledger where profile_id=auth.uid())<>0 then raise exception 'other user unexpectedly has XP'; end if;
 perform set_config('request.jwt.claim.sub',current_setting('test.achievement_admin'),true);
 perform public.set_venue_achievement_categories(current_setting('test.achievement_venue')::uuid,array['restaurant'],array['restaurant','cafe']);
 if exists(select 1 from public.venue_achievement_categories where venue_id=current_setting('test.achievement_venue')::uuid and category_key='cafe') then raise exception 'category removal failed'; end if;
 update public.achievements set target_count=50 where key='city_fuengirola_5';
 perform set_config('request.jwt.claim.sub',current_setting('test.achievement_user'),true);
 r:=public.my_achievement_progress();
 if (select sum(delta) from public.xp_ledger where profile_id=auth.uid())<>10 then raise exception 'badges minted or changed XP'; end if;
 if not exists(select 1 from jsonb_array_elements(r) x where x->>'key'='city_fuengirola_5' and x->>'unlocked_at' is not null) then raise exception 'earned badge lost after condition change'; end if;
end; $$;
set local role anon;
do $$ begin
 begin
  perform public.my_achievement_progress();
  raise exception 'anonymous progress access';
 exception when insufficient_privilege then null; end;
 begin
  perform private.my_achievement_progress();
  raise exception 'anonymous private progress access';
 exception when insufficient_privilege then null; end;
end; $$;
rollback;

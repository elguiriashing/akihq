-- Manual replacement never alters earned unlocks or reward ledgers.
alter table private.passport_manual_awards add column superseded_by uuid references private.passport_manual_awards(id) on delete set null;
create index passport_manual_awards_history on private.passport_manual_awards(profile_id,granted_at desc,id desc);
create or replace function private.admin_passport_awards(p_action text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); member uuid; request uuid; batch uuid; city text; reason text; v_purpose text; result jsonb; keys text[]; k text; target public.achievements%rowtype; changed integer; new_award uuid; replaced jsonb; existing_keys text[]; history_city text; history_state text; history_page integer; history_total integer;
begin
 if actor is null or not public.has_platform_role(array['administrator']::public.app_role[]) then raise exception 'administrator required' using errcode='42501'; end if;
 if p_action='search' then
 if length(trim(p_payload->>'query'))<2 then return '[]'::jsonb; end if;
 select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) into result from (select p.id,p.display_name,u.email,exists(select 1 from private.passport_test_accounts t where t.profile_id=p.id) test_account from public.profiles p join auth.users u on u.id=p.id where p.id::text=p_payload->>'query' or p.display_name ilike '%'||left(p_payload->>'query',100)||'%' or u.email ilike '%'||left(p_payload->>'query',100)||'%' order by p.display_name limit 20) t; return result;
 end if;
 member:=(p_payload->>'profile_id')::uuid;
 if member is null or not exists(select 1 from public.profiles where id=member) then raise exception 'member not found'; end if;
 perform pg_advisory_xact_lock(hashtextextended('achievements:'||member::text,0));
 if p_action in ('read','history') then
 history_city:=coalesce(p_payload->>'history_city','');
 history_state:=coalesce(p_payload->>'history_state','all');
 if history_state not in ('all','active','revoked','replaced') then raise exception 'invalid history state'; end if;
 history_page:=greatest(1,coalesce((p_payload->>'page')::integer,1));
 select count(*) into history_total from private.passport_manual_awards m join public.achievements a on a.key=m.achievement_key
 where m.profile_id=member and (history_city='' or a.city_key=history_city or (history_city='general' and a.city_key is null))
 and (history_state='all' or (history_state='active' and m.revoked_at is null) or (history_state='revoked' and m.revoked_at is not null and m.superseded_by is null) or (history_state='replaced' and m.superseded_by is not null));
 history_page:=least(history_page,greatest(1,(history_total+14)/15));
 select jsonb_build_object('grants',coalesce(jsonb_agg(to_jsonb(g) order by g.granted_at desc,g.id desc),'[]'::jsonb),'grants_total',history_total,'grants_page',history_page,'page_size',15) into result from (
 select m.*,a.title_en,a.title_es,a.city_key,a.category_key,a.tier_index from private.passport_manual_awards m join public.achievements a on a.key=m.achievement_key
 where m.profile_id=member and (history_city='' or a.city_key=history_city or (history_city='general' and a.city_key is null))
 and (history_state='all' or (history_state='active' and m.revoked_at is null) or (history_state='revoked' and m.revoked_at is not null and m.superseded_by is null) or (history_state='replaced' and m.superseded_by is not null))
 order by m.granted_at desc,m.id desc limit 15 offset (history_page-1)*15) g;
 if p_action='read' then result:=result||jsonb_build_object('collection',private.passport_collection(member),'test_account',exists(select 1 from private.passport_test_accounts where profile_id=member)); end if;
 return result;
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
 -- Serialize request replay as well as the member's award changes.
 perform pg_advisory_xact_lock(hashtextextended('passport-request:'||actor::text||request::text,0));
 select array_agg(achievement_key order by achievement_key) into existing_keys from private.passport_manual_awards where granted_by=actor and request_id=request;
 if existing_keys is not null then
 if existing_keys<>(select array_agg(x order by x) from unnest(keys) x) or exists(select 1 from private.passport_manual_awards m where m.granted_by=actor and m.request_id=request and (m.profile_id<>member or m.purpose<>v_purpose or m.reason<>trim(p_payload->>'reason'))) then raise exception 'request already used'; end if;
 -- Replaying an older request must never undo a newer selection.
 return jsonb_build_object('ok',true,'batch_id',batch);
 end if;
 foreach k in array keys loop
 select * into target from public.achievements where key=k and active and not archived;
 if not found then raise exception 'achievement unavailable'; end if;
 insert into private.passport_manual_awards(profile_id,achievement_key,purpose,reason,granted_by,request_id,batch_id) values(member,k,v_purpose,reason,actor,request,batch) returning id into new_award;
 with replaced_rows as (
 update private.passport_manual_awards m set revoked_at=now(),revoked_by=actor,superseded_by=new_award
 where m.profile_id=member and m.revoked_at is null and m.id<>new_award and exists(
 select 1 from public.achievements a where a.key=m.achievement_key and coalesce(a.family_key,'general/'||a.key)=coalesce(target.family_key,'general/'||target.key)) returning m.id)
 select coalesce(jsonb_agg(id),'[]'::jsonb) into replaced from replaced_rows;
 insert into public.moderation_actions(actor_id,action,target_type,target_id,reason,metadata) values(actor,'passport_award_grant','profile',member,reason,jsonb_build_object('achievement',k,'batch',batch,'purpose',v_purpose,'award_id',new_award,'replaced_awards',replaced));
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

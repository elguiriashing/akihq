begin;
create table crm_catalogue_venues(workspace_id text not null,lead_id text not null,venue_id uuid not null references venues(id) on delete cascade,created_by uuid references auth.users(id) on delete set null,created_at timestamptz not null default now(),primary key(workspace_id,lead_id),unique(venue_id));
alter table crm_catalogue_venues enable row level security;
revoke all on crm_catalogue_venues from public,anon;
grant select on crm_catalogue_venues to authenticated;
create policy "Staff read CRM catalogue links" on crm_catalogue_venues for select to authenticated using(has_platform_role(array['moderator','administrator']::app_role[]));

create function publish_crm_lead_as_unclaimed_venue(p_workspace_id text,p_lead_id text,p_name text,p_address text,p_address_provider_id text,p_locality_name text,p_province_name text,p_latitude float8,p_longitude float8)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c uuid;v uuid;s text;
begin
 if not has_platform_role(array['administrator']::app_role[]) then raise exception 'administrator role required';end if;
 if length(trim(coalesce(p_workspace_id,''))) not between 2 and 100 or length(trim(coalesce(p_lead_id,''))) not between 2 and 160 or length(trim(coalesce(p_name,''))) not between 2 and 180 or length(trim(coalesce(p_address,''))) not between 5 and 300 or length(trim(coalesce(p_address_provider_id,''))) not between 1 and 160 or length(trim(coalesce(p_locality_name,''))) not between 2 and 120 or length(trim(coalesce(p_province_name,''))) not between 2 and 120 or p_latitude not between 27 and 44.5 or p_longitude not between -19 and 5 then raise exception 'invalid verified Spanish venue data';end if;
 select venue_id into v from crm_catalogue_venues where workspace_id=trim(p_workspace_id) and lead_id=trim(p_lead_id);
 if v is not null then return jsonb_build_object('venue_id',v,'created',false,'duplicate',false);end if;
 select id into v from venues where lower(unaccent(trim(name)))=lower(unaccent(trim(p_name))) and lower(unaccent(trim(address)))=lower(unaccent(trim(p_address))) limit 1;
 if v is not null then insert into crm_catalogue_venues values(trim(p_workspace_id),trim(p_lead_id),v,auth.uid(),now());return jsonb_build_object('venue_id',v,'created',false,'duplicate',true);end if;
 s:=trim(both '-' from regexp_replace(lower(unaccent(trim(p_locality_name||'-'||p_province_name))),'[^a-z0-9]+','-','g'));
 insert into cities(id,slug,name_es,name_en,center) values(gen_random_uuid(),s,trim(p_locality_name),trim(p_locality_name),st_setsrid(st_makepoint(p_longitude,p_latitude),4326)::geography) on conflict(slug) do update set name_es=excluded.name_es,name_en=excluded.name_en returning id into c;
 v:=gen_random_uuid();s:=trim(both '-' from regexp_replace(lower(unaccent(trim(p_name))),'[^a-z0-9]+','-','g'))||'-'||left(replace(v::text,'-',''),8);
 insert into venues(id,city_id,slug,name,description_es,description_en,address,location,verified,status,accessibility) values(v,c,s,trim(p_name),'Negocio sin reclamar. Información pendiente de verificación.','Unclaimed business. Information pending verification.',trim(p_address),st_setsrid(st_makepoint(p_longitude,p_latitude),4326)::geography,false,'published',jsonb_build_object('claim_status','unclaimed','address_provider_id',trim(p_address_provider_id)));
 insert into crm_catalogue_venues values(trim(p_workspace_id),trim(p_lead_id),v,auth.uid(),now());
 insert into moderation_actions(actor_id,action,target_type,target_id,reason,metadata) values(auth.uid(),'crm_unclaimed_published','venue',v,'Published verified CRM lead as unclaimed venue',jsonb_build_object('workspace_id',trim(p_workspace_id),'lead_id',trim(p_lead_id)));
 return jsonb_build_object('venue_id',v,'slug',s,'created',true,'duplicate',false);
end$$;
revoke all on function publish_crm_lead_as_unclaimed_venue(text,text,text,text,text,text,text,float8,float8) from public,anon;
grant execute on function publish_crm_lead_as_unclaimed_venue(text,text,text,text,text,text,text,float8,float8) to authenticated;

create or replace function delete_owned_venue(p_venue uuid,p_confirmation text,p_reason text) returns void language plpgsql security definer set search_path=public as $$
declare ok boolean;ids uuid[];
begin
 if p_confirmation<>'DELETE' or length(trim(coalesce(p_reason,'')))<10 then raise exception 'confirmation and reason required';end if;
 select exists(select 1 from venue_members where venue_id=p_venue and profile_id=auth.uid() and role='owner') into ok;if not ok then raise exception 'venue owner permission required';end if;
 select coalesce(array_agg(id),array[]::uuid[]) into ids from events where venue_id=p_venue;
 update event_submissions set duplicate_of=null where duplicate_of=any(ids);update event_submissions set published_event_id=null where published_event_id=any(ids);update event_submissions set published_venue_id=null where published_venue_id=p_venue;
 delete from events where venue_id=p_venue;delete from venues where id=p_venue;if not found then raise exception 'venue not found';end if;
 insert into moderation_actions(actor_id,action,target_type,target_id,reason,metadata) values(auth.uid(),'deleted','venue',p_venue,trim(p_reason),jsonb_build_object('event_ids',ids));
end$$;
create or replace function operator_delete_catalogue_item(p_target_type text,p_target_id uuid,p_confirmation text,p_reason text) returns void language plpgsql security definer set search_path=public as $$
declare ids uuid[];
begin
 if not has_platform_role(array['moderator','administrator']::app_role[]) then raise exception 'staff role required';end if;
 if p_target_type not in('venue','event') or p_confirmation<>'DELETE' or length(trim(coalesce(p_reason,'')))<10 then raise exception 'confirmation and reason required';end if;
 if p_target_type='event' then update event_submissions set duplicate_of=null where duplicate_of=p_target_id;update event_submissions set published_event_id=null where published_event_id=p_target_id;delete from events where id=p_target_id;
 else select coalesce(array_agg(id),array[]::uuid[]) into ids from events where venue_id=p_target_id;update event_submissions set duplicate_of=null where duplicate_of=any(ids);update event_submissions set published_event_id=null where published_event_id=any(ids);update event_submissions set published_venue_id=null where published_venue_id=p_target_id;delete from events where venue_id=p_target_id;delete from venues where id=p_target_id;end if;
 if not found then raise exception 'catalogue item not found';end if;
 insert into moderation_actions(actor_id,action,target_type,target_id,reason,metadata) values(auth.uid(),'operator_deleted',p_target_type,p_target_id,trim(p_reason),jsonb_build_object('event_ids',coalesce(ids,array[]::uuid[])));
end$$;
revoke all on function delete_owned_venue(uuid,text,text) from public,anon;grant execute on function delete_owned_venue(uuid,text,text) to authenticated;
revoke all on function operator_delete_catalogue_item(text,uuid,text,text) from public,anon;grant execute on function operator_delete_catalogue_item(text,uuid,text,text) to authenticated;
commit;

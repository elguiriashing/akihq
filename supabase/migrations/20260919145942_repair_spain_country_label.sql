-- Legacy gateway sent a corrupted country literal in otherwise valid UTF-8.
create or replace function publish_crm_lead_as_unclaimed_venue(p_workspace_id text,p_lead_id text,p_name text,p_address text,p_address_provider_id text,p_locality_name text,p_province_name text,p_latitude float8,p_longitude float8)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c uuid;v uuid;s text;
begin
 if not has_platform_role(array['administrator']::app_role[]) then raise exception 'administrator role required';end if;
 -- Normalize before duplicate matching as well as insertion.
 p_address := replace(p_address, 'EspaÒ±a', 'España');
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

-- Repair only the known literal; valid street/town accents and coordinates stay intact.
update public.venues
set address = replace(address, 'EspaÒ±a', 'España'), updated_at = now()
where strpos(address, 'EspaÒ±a') > 0;

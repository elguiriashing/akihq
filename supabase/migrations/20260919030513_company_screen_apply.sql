begin;
-- Called only by the server after administrator authentication and AI screening.
create function public.crm_company_screen_apply(p_id text,p_token uuid,p_revision integer,p_resolution jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.crm_company_records; d jsonb; k text; a text; city text;
begin
 perform pg_advisory_xact_lock(hashtext('crm-company-ws_akipasa'));
 select * into r from public.crm_company_records where workspace_id='ws_akipasa' and id=p_id
 and deleted_at is null and publish_state='working' and publish_token=p_token and publish_lease>now()
 and revision=p_revision for update;
 if not found then raise exception 'Screening lease expired or company changed';end if;
 if nullif(r.data->>'catalogueVenueId','') is not null or exists(select 1 from public.crm_catalogue_venues where workspace_id=r.workspace_id and lead_id=r.id)
 or (r.import_id is not null and exists(select 1 from public.crm_company_imports where id=r.import_id and status in ('undoing','undone'))) then
 raise exception 'Company is no longer eligible for screening';end if;
 a:=trim(p_resolution->>'normalizedAddress');city:=trim(p_resolution->>'city');
 if p_resolution->>'status' is distinct from 'resolved' or length(coalesce(a,'')) not between 5 and 300
 or length(coalesce(city,'')) not between 1 and 120 or coalesce((p_resolution->>'confidence')::numeric,0)<0.85
 or jsonb_typeof(p_resolution->'evidenceUrls') is distinct from 'array' or jsonb_array_length(p_resolution->'evidenceUrls')=0 then
 raise exception 'Screening result lacks sufficient evidence';end if;
 k:=public.crm_company_key(r.data->>'name',a);
 if exists(select 1 from public.crm_company_records where workspace_id=r.workspace_id and identity_key=k and deleted_at is null and id<>p_id) then
 return jsonb_build_object('status','insufficient','note','Corrected address matches another CRM company; review the duplicate.');end if;
 d:=r.data||jsonb_build_object('address',a,'city',city,'screening',jsonb_build_object('at',now(),'originalAddress',coalesce(r.data#>>'{screening,originalAddress}',r.data->>'address'),'originalCity',coalesce(r.data#>>'{screening,originalCity}',r.data->>'city'),'resolution',p_resolution));
 update public.crm_company_records set data=d,identity_key=k,revision=revision+1,updated_at=now() where seq=r.seq;
 return jsonb_build_object('status','resolved','company',d);
end $$;
revoke all on function public.crm_company_screen_apply(text,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.crm_company_screen_apply(text,uuid,integer,jsonb) to service_role;
commit;

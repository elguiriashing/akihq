begin;
create function public.akipulse_rental_workspace_options(p_company uuid,p_limit integer default 51,p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare owned boolean; options jsonb; current_link jsonb;
begin
 if auth.uid() is null or public.account_features_allowed() is distinct from true or public.can_manage_rental_company(p_company) is distinct from true then raise exception 'Branch manager required' using errcode='42501';end if;
 if p_limit is null or p_limit not between 1 and 101 or p_offset is null or p_offset not between 0 and 10000 then raise exception 'Invalid page' using errcode='22023';end if;
 select submitted_by=auth.uid() into owned from public.car_rental_companies where id=p_company;
 if owned is distinct from true then return jsonb_build_object('can_link',false,'options','[]'::jsonb);end if;
 select coalesce(jsonb_agg(to_jsonb(o) order by o.name,o.id),'[]') into options from (
 select w.id,w.name from public.crm_workspaces w join public.crm_workspace_members m on m.workspace_id=w.id
 where w.id<>'ws_akipasa' and w.owner_profile_id=auth.uid() and w.status in('active','trial') and m.profile_id=auth.uid() and m.status='active' and m.role='owner' and public.akipulse_workspace_management(w.id) is true
 order by w.name,w.id limit p_limit offset p_offset)o;
 select jsonb_build_object('id',w.id,'name',w.name) into current_link from public.akipulse_rental_workspaces l join public.crm_workspaces w on w.id=l.workspace_id
 where l.company_id=p_company and w.owner_profile_id=auth.uid() and public.akipulse_workspace_management(w.id) is true;
 return jsonb_build_object('can_link',true,'options',options,'current',current_link,'has_link',exists(select 1 from public.akipulse_rental_workspaces where company_id=p_company));
end $$;
create function public.set_akipulse_rental_workspace(p_company uuid,p_workspace text) returns void
language plpgsql security definer set search_path='' as $$
declare old_workspace text;
begin
 if auth.uid() is null or public.account_features_allowed() is distinct from true then raise exception 'Account access required' using errcode='42501';end if;
 perform 1 from public.car_rental_companies where id=p_company and submitted_by=auth.uid() for update;
 if not found then raise exception 'Branch owner required' using errcode='42501';end if;
 if p_workspace is not null then
 perform 1 from public.crm_workspaces w join public.crm_workspace_members m on m.workspace_id=w.id
 where w.id=p_workspace and w.id<>'ws_akipasa' and w.owner_profile_id=auth.uid() and w.status in('active','trial')
 and m.profile_id=auth.uid() and m.status='active' and m.role='owner' and public.akipulse_workspace_management(w.id) is true for share of w,m;
 if not found then raise exception 'Active workspace owner required' using errcode='42501';end if;
 end if;
 select workspace_id into old_workspace from public.akipulse_rental_workspaces where company_id=p_company;
 if old_workspace is not distinct from p_workspace then return;end if;
 if p_workspace is null then delete from public.akipulse_rental_workspaces where company_id=p_company;
 else insert into public.akipulse_rental_workspaces(company_id,workspace_id,linked_by) values(p_company,p_workspace,auth.uid())
 on conflict(company_id) do update set workspace_id=excluded.workspace_id,linked_by=excluded.linked_by,linked_at=now();end if;
 insert into akipulse_private.rental_link_audit(company_id,old_workspace,new_workspace,actor) values(p_company,old_workspace,p_workspace,auth.uid());
end $$;
revoke all on function public.akipulse_rental_workspace_options(uuid,integer,integer),public.set_akipulse_rental_workspace(uuid,text) from public,anon;
grant execute on function public.akipulse_rental_workspace_options(uuid,integer,integer),public.set_akipulse_rental_workspace(uuid,text) to authenticated;
commit;

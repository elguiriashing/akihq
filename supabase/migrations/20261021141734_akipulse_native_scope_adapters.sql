begin;
create function public.akipulse_workspace_management(p_workspace text) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and public.account_features_allowed() is true
 and public.crm_can_access_workspace(p_workspace) is true
 and exists(select 1 from public.crm_workspaces w join public.crm_workspace_members m on m.workspace_id=w.id
 where w.id=p_workspace and w.id<>'ws_akipasa' and w.status in('active','trial')
 and m.profile_id=auth.uid() and m.status='active' and m.role in('owner','admin','manager'))
$$;
revoke all on function public.akipulse_workspace_management(text) from public,anon,authenticated;
create function public.akipulse_native_inventory_ready() returns boolean
language plpgsql stable security definer set search_path='' as $$
declare ready boolean;
begin
 if to_regprocedure('public.can_manage_accommodation_inventory(uuid)') is null or to_regclass('accommodation_property_private.launch_settings') is null then return false;end if;
 execute 'select enabled and inventory_enabled from accommodation_property_private.launch_settings where singleton' into ready;
 return ready is true;
end $$;
revoke all on function public.akipulse_native_inventory_ready() from public,anon,authenticated;
create function public.akipulse_scopes_v2(p_kind text,p_limit integer default 51,p_offset integer default 0)
returns table(id uuid,name text) language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or public.account_features_allowed() is distinct from true then raise exception 'Account access required' using errcode='42501';end if;
 if p_kind is null or p_limit is null or p_limit not between 1 and 101 or p_offset is null or p_offset not between 0 and 10000 then raise exception 'Invalid scope page' using errcode='22023';end if;
 if p_kind<>'native_property' then return query select * from public.akipulse_scopes(p_kind,p_limit,p_offset);return;end if;
 if public.akipulse_native_inventory_ready() is distinct from true or to_regclass('public.accommodation_properties') is null then return;end if;
 return query execute 'select p.id,p.name from public.accommodation_properties p where public.can_manage_accommodation_inventory(p.id) is true order by p.name,p.id limit $1 offset $2' using p_limit,p_offset;
end $$;
revoke all on function public.akipulse_scopes_v2(text,integer,integer) from public,anon;
grant execute on function public.akipulse_scopes_v2(text,integer,integer) to authenticated;
commit;

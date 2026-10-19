begin;

-- Legacy Supabase projects can give anon/authenticated direct EXECUTE grants
-- in addition to PUBLIC. Remove both before restoring the intended RPC API.
revoke all on function public.has_active_entitlement(uuid,text) from anon, authenticated;
revoke all on function public.reconcile_profile_entitlements(uuid) from anon, authenticated;
revoke all on function public.sync_stripe_subscription(text,uuid,text,text,text,text,timestamptz,boolean,timestamptz) from anon, authenticated;

revoke all on function public.crm_can_access_workspace(text) from anon, authenticated;
revoke all on function public.crm_can_manage_workspace(text) from anon, authenticated;
revoke all on function public.crm_can_operate_workspace(text) from anon, authenticated;
revoke all on function public.crm_has_tool(text,text) from anon, authenticated;
revoke all on function public.crm_provision_workspace_for_venue(uuid) from anon, authenticated;
revoke all on function public.crm_add_workspace_member(text,text,text) from anon, authenticated;
revoke all on function public.crm_remove_workspace_member(text,uuid) from anon, authenticated;
revoke all on function public.crm_apply_inventory_movement() from anon, authenticated;
revoke all on function public.crm_inventory_recommendations(text) from anon, authenticated;
revoke all on function public.crm_record_pos_sale(text,text,text,integer,text,uuid,jsonb) from anon, authenticated;
revoke all on function public.crm_shares_workspace(uuid) from anon, authenticated;
revoke all on function public.crm_staff_business_overview() from anon, authenticated;
revoke all on function public.crm_staff_set_business_pro(uuid,boolean,text) from anon, authenticated;
revoke all on function public.crm_staff_set_workspace_tool(text,text,boolean,text) from anon, authenticated;

grant execute on function public.has_active_entitlement(uuid,text) to authenticated;
grant execute on function public.crm_can_access_workspace(text) to authenticated;
grant execute on function public.crm_can_manage_workspace(text) to authenticated;
grant execute on function public.crm_can_operate_workspace(text) to authenticated;
grant execute on function public.crm_has_tool(text,text) to authenticated;
grant execute on function public.crm_provision_workspace_for_venue(uuid) to authenticated;
grant execute on function public.crm_add_workspace_member(text,text,text) to authenticated;
grant execute on function public.crm_remove_workspace_member(text,uuid) to authenticated;
grant execute on function public.crm_inventory_recommendations(text) to authenticated;
grant execute on function public.crm_record_pos_sale(text,text,text,integer,text,uuid,jsonb) to authenticated;
grant execute on function public.crm_shares_workspace(uuid) to authenticated;
grant execute on function public.crm_staff_business_overview() to authenticated;
grant execute on function public.crm_staff_set_business_pro(uuid,boolean,text) to authenticated;
grant execute on function public.crm_staff_set_workspace_tool(text,text,boolean,text) to authenticated;

commit;

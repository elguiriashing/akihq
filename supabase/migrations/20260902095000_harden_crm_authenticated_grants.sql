begin;

-- Existing Supabase projects can retain broad authenticated-role defaults for
-- tables created in the public schema. Remove those defaults before restoring
-- only the Data API privileges required by the tenant-aware CRM.
revoke all on public.crm_workspaces, public.crm_workspace_members,
  public.crm_workspace_venues, public.crm_tool_catalog,
  public.crm_workspace_entitlements, public.crm_inventory_items,
  public.crm_inventory_movements, public.crm_demand_signals,
  public.crm_pos_sales, public.crm_pos_sale_lines from authenticated;

grant select on public.crm_workspaces, public.crm_workspace_members,
  public.crm_workspace_venues, public.crm_tool_catalog,
  public.crm_workspace_entitlements to authenticated;

grant select, delete on public.crm_inventory_items to authenticated;
grant insert (
  workspace_id, sku, name, unit, reorder_point, safety_stock, lead_time_days, active
) on public.crm_inventory_items to authenticated;
grant update (
  sku, name, unit, reorder_point, safety_stock, lead_time_days, active
) on public.crm_inventory_items to authenticated;

-- Movement rows are an append-only stock ledger. The insert trigger is the
-- only authenticated path that can change inventory on_hand.
grant select, insert on public.crm_inventory_movements to authenticated;
grant select, insert, update, delete on public.crm_demand_signals to authenticated;

-- POS records are written atomically by crm_record_pos_sale so sale lines and
-- stock movements cannot drift apart.
grant select on public.crm_pos_sales, public.crm_pos_sale_lines to authenticated;

commit;

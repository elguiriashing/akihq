begin;

-- Preserve viewer read access without evaluating a second permissive SELECT
-- policy for operators.
drop policy if exists crm_inventory_items_write on public.crm_inventory_items;
create policy crm_inventory_items_insert on public.crm_inventory_items
for insert to authenticated
with check (
  public.crm_can_operate_workspace(workspace_id)
  and public.crm_has_tool(workspace_id,'inventory')
);
create policy crm_inventory_items_update on public.crm_inventory_items
for update to authenticated
using (
  public.crm_can_operate_workspace(workspace_id)
  and public.crm_has_tool(workspace_id,'inventory')
)
with check (
  public.crm_can_operate_workspace(workspace_id)
  and public.crm_has_tool(workspace_id,'inventory')
);
create policy crm_inventory_items_delete on public.crm_inventory_items
for delete to authenticated
using (
  public.crm_can_operate_workspace(workspace_id)
  and public.crm_has_tool(workspace_id,'inventory')
);

drop policy if exists crm_demand_signals_write on public.crm_demand_signals;
create policy crm_demand_signals_insert on public.crm_demand_signals
for insert to authenticated
with check (
  public.crm_can_operate_workspace(workspace_id)
  and public.crm_has_tool(workspace_id,'inventory')
);
create policy crm_demand_signals_update on public.crm_demand_signals
for update to authenticated
using (
  public.crm_can_operate_workspace(workspace_id)
  and public.crm_has_tool(workspace_id,'inventory')
)
with check (
  public.crm_can_operate_workspace(workspace_id)
  and public.crm_has_tool(workspace_id,'inventory')
);
create policy crm_demand_signals_delete on public.crm_demand_signals
for delete to authenticated
using (
  public.crm_can_operate_workspace(workspace_id)
  and public.crm_has_tool(workspace_id,'inventory')
);

create index if not exists crm_workspaces_owner_profile_idx
  on public.crm_workspaces (owner_profile_id);
create index if not exists crm_workspace_members_invited_by_idx
  on public.crm_workspace_members (invited_by);
create index if not exists crm_workspace_entitlements_tool_idx
  on public.crm_workspace_entitlements (tool_key);
create index if not exists crm_inventory_movements_item_idx
  on public.crm_inventory_movements (item_id);
create index if not exists crm_inventory_movements_employee_idx
  on public.crm_inventory_movements (employee_profile_id);
create index if not exists crm_inventory_movements_created_by_idx
  on public.crm_inventory_movements (created_by);
create index if not exists crm_demand_signals_item_idx
  on public.crm_demand_signals (item_id);
create index if not exists crm_pos_sales_employee_idx
  on public.crm_pos_sales (employee_profile_id);
create index if not exists crm_pos_sales_created_by_idx
  on public.crm_pos_sales (created_by);
create index if not exists crm_pos_sale_lines_sale_idx
  on public.crm_pos_sale_lines (sale_id);
create index if not exists crm_pos_sale_lines_workspace_idx
  on public.crm_pos_sale_lines (workspace_id);
create index if not exists crm_pos_sale_lines_item_idx
  on public.crm_pos_sale_lines (item_id);

commit;

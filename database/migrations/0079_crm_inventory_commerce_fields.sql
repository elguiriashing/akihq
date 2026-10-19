-- Mirror of Supabase migration 20260902222000_crm_inventory_commerce_fields.sql.
alter table public.crm_inventory_items
  add column if not exists category text not null default 'General',
  add column if not exists cost_cents integer not null default 0 check (cost_cents >= 0),
  add column if not exists sale_price_cents integer not null default 0 check (sale_price_cents >= 0);

revoke update on public.crm_inventory_items from authenticated;
grant update (
  sku,name,unit,reorder_point,safety_stock,lead_time_days,category,cost_cents,sale_price_cents,active
) on public.crm_inventory_items to authenticated;

revoke insert on public.crm_inventory_items from authenticated;
grant insert (
  workspace_id,sku,name,unit,reorder_point,safety_stock,lead_time_days,category,cost_cents,sale_price_cents,active
) on public.crm_inventory_items to authenticated;

import { readFileSync } from 'node:fs';
import { securityFixture } from './security-fixture.mjs';
export const ids={owner:'00000000-0000-0000-0000-000000000001',staff:'00000000-0000-0000-0000-000000000002',outsider:'00000000-0000-0000-0000-000000000003',manager:'00000000-0000-0000-0000-000000000004',admin:'00000000-0000-0000-0000-000000000005',viewer:'00000000-0000-0000-0000-000000000006'};
export const item='20000000-0000-0000-0000-000000000001';
export const migrations=['20260923001232_fiscal_document_core.sql','20260923001329_checkout_integrity.sql','20260923001331_inventory_operations.sql','20260923001337_security_workspace_access.sql','20260923001529_privacy_operations.sql','20260925131603_hospitality_pos.sql','20260925140340_unattended_printing.sql','20260925140358_fiscal_atomic_records.sql','20261018152924_pos_kitchen_display.sql'];
export async function setupKitchenDatabase(db) {
  await db.exec(securityFixture(ids));
  await db.exec(`
    alter table public.crm_inventory_items add column safety_stock numeric default 0,add column lead_time_days integer default 1,add column reorder_point numeric default 0;
    create table public.crm_pos_sales(id uuid primary key default gen_random_uuid(),workspace_id text not null references public.crm_workspaces(id),provider text not null,external_id text not null,total_cents integer not null,currency text not null,employee_profile_id uuid,created_by uuid not null,status text not null default 'completed',sold_at timestamptz not null default now(),tip_cents integer not null default 0,unique(workspace_id,provider,external_id));
    create table public.crm_pos_sale_lines(id uuid primary key default gen_random_uuid(),sale_id uuid not null references public.crm_pos_sales(id),workspace_id text not null,item_id uuid not null references public.crm_inventory_items(id),quantity numeric(12,3) not null,unit_price_cents integer not null);
    create table public.crm_inventory_movements(id uuid primary key default gen_random_uuid(),workspace_id text not null,item_id uuid not null references public.crm_inventory_items(id),quantity_delta numeric(12,3) not null,movement_type text not null,source_type text,source_id text,employee_profile_id uuid,notes text not null default '',created_by uuid not null,occurred_at timestamptz not null default now());
    create function public.crm_apply_inventory_movement() returns trigger language plpgsql security definer set search_path='' as $$begin update public.crm_inventory_items i set on_hand=i.on_hand+new.quantity_delta,updated_at=now() where i.id=new.item_id and i.workspace_id=new.workspace_id; if not found then raise exception 'Item not in workspace'; end if; return new; end$$;
    create trigger crm_inventory_movement_apply after insert on public.crm_inventory_movements for each row execute function public.crm_apply_inventory_movement();
    alter table public.crm_pos_sales enable row level security;alter table public.crm_pos_sale_lines enable row level security;alter table public.crm_inventory_movements enable row level security;
    grant select,insert,update,delete on public.crm_pos_sales,public.crm_pos_sale_lines,public.crm_inventory_movements to authenticated;
    create policy pos_read on public.crm_pos_sales for select to authenticated using(public.crm_has_tool(workspace_id,'pos'));
    create policy lines_read on public.crm_pos_sale_lines for select to authenticated using(public.crm_has_tool(workspace_id,'pos'));
    create policy movements_read on public.crm_inventory_movements for select to authenticated using(public.crm_has_tool(workspace_id,'inventory'));
    create table public.crm_support_contacts(id uuid primary key,workspace_id text,email text,name text);
    create table public.crm_support_tickets(id uuid primary key,workspace_id text,contact_id uuid,status text,updated_at timestamptz,subject text,number bigint,created_at timestamptz);
    create table public.crm_support_messages(id uuid primary key,workspace_id text,ticket_id uuid,direction text,text text,created_at timestamptz);
    create table public.crm_support_mailboxes(id uuid primary key,workspace_id text,address text,active boolean,verified_at timestamptz);
  `);
  for(const file of migrations) await db.exec(readFileSync(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8'));
}

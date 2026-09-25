import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { securityFixture } from './security-fixture.mjs';
const { PGlite }=await import(process.env.PGLITE_MODULE || '../cloudflare/node_modules/@electric-sql/pglite/dist/index.js');
const ids={owner:'00000000-0000-0000-0000-000000000001',staff:'00000000-0000-0000-0000-000000000002',outsider:'00000000-0000-0000-0000-000000000003',manager:'00000000-0000-0000-0000-000000000004',admin:'00000000-0000-0000-0000-000000000005',viewer:'00000000-0000-0000-0000-000000000006'};
const item='20000000-0000-0000-0000-000000000001';
const migrations=['20260923001232_fiscal_document_core.sql','20260923001329_checkout_integrity.sql','20260923001331_inventory_operations.sql','20260923001337_security_workspace_access.sql','20260923001529_privacy_operations.sql'];
let db;
test.before(async()=>{
  db=new PGlite();await db.exec(securityFixture(ids));
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
    create table public.crm_support_tickets(id uuid primary key,workspace_id text,contact_id uuid,status text,updated_at timestamptz,subject text,ticket_number text,created_at timestamptz);
    create table public.crm_support_messages(id uuid primary key,workspace_id text,ticket_id uuid,direction text,text text,created_at timestamptz);
    create table public.crm_support_mailboxes(id uuid primary key,workspace_id text,address text,active boolean,verified_at timestamptz);
  `);
  for(const file of migrations) await db.exec(readFileSync(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8'));
});
test.after(async()=>{await db.close()});
async function asUser(who,sql,params=[]){await db.exec(`reset role;select set_config('test.user_id','${ids[who]||''}',false);set role authenticated;`);try{return await db.query(sql,params)}finally{await db.exec('reset role')}}
const rpc=async(who,name,params)=>(await asUser(who,`select public.${name}(${params.map((_,i)=>`$${i+1}`).join(',')}) value`,params)).rows[0].value;
const checkout=(who,key)=>rpc(who,'crm_record_pos_sale',['tenant-a','cash',key,121,'EUR',ids[who],[{item_id:item,quantity:1,unit_price_cents:121}]]);

test('all five release migrations apply together without schema or function collisions',async()=>{
  assert.equal((await db.query("select count(*)::int n from information_schema.tables where table_schema='public' and table_name in ('crm_fiscal_documents','crm_inventory_operations','crm_security_audit_events','crm_privacy_requests')")).rows[0].n,4);
});
test('cashier template controls checkout RPC and stock hook after cumulative release',async()=>{
  await assert.rejects(checkout('staff','denied-test-request'),/access required/);
  await db.exec("insert into public.crm_role_template_tools values('10000000-0000-0000-0000-000000000001','pos')");
  const sale=await checkout('staff','allowed-test-request');assert(sale);
  const stock=(await db.query('select on_hand from public.crm_inventory_items where id=$1',[item])).rows[0].on_hand;
  assert.equal(Number(stock),9);
  await checkout('staff','allowed-test-request');assert.equal(Number((await db.query('select on_hand from public.crm_inventory_items where id=$1',[item])).rows[0].on_hand),9);
  assert.equal((await asUser('staff','select * from public.crm_inventory_location_balances')).rows.length,0);
  assert.equal((await rpc('staff','crm_pos_catalogue',['tenant-a']))[0].cost_cents,undefined);
});
test('cashier cannot write stock operations or view another tenant after checkout',async()=>{
  await assert.rejects(rpc('staff','crm_inventory_operation',['tenant-a','forbidden-stock-request',{type:'receive',reason:'Test purchase',lines:[{item_id:item,quantity:1}]}]),/access required/);
  await assert.rejects(rpc('staff','crm_pos_catalogue',['tenant-b']),/access required/);
  assert.equal((await asUser('staff','select * from public.crm_inventory_items')).rows.length,0);
});
test('fiscal write remains release-gated while role-limited access stays isolated',async()=>{
  await assert.rejects(rpc('owner','crm_fiscal_issue_document',['tenant-a',crypto.randomUUID(),{document_type:'F2',lines:[{item_id:item,quantity:'1'}],expected_total_cents:121}]),/required|configured|release|adapter|profile/i);
  assert.equal((await asUser('outsider','select * from public.crm_fiscal_documents')).rows.length,0);
  assert.equal(await rpc('owner','crm_privacy_access',['tenant-a']),true);
  assert.equal(await rpc('staff','crm_privacy_access',['tenant-a']),false);
});

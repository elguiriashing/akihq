import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { securityFixture } from './security-fixture.mjs';
const { PGlite }=await import(process.env.PGLITE_MODULE || '../cloudflare/node_modules/@electric-sql/pglite/dist/index.js');
const ids={owner:'00000000-0000-0000-0000-000000000001',staff:'00000000-0000-0000-0000-000000000002',outsider:'00000000-0000-0000-0000-000000000003',manager:'00000000-0000-0000-0000-000000000004',admin:'00000000-0000-0000-0000-000000000005',viewer:'00000000-0000-0000-0000-000000000006'};
const item='20000000-0000-0000-0000-000000000001';
const migrations=['20260923001232_fiscal_document_core.sql','20260923001329_checkout_integrity.sql','20260923001331_inventory_operations.sql','20260923001337_security_workspace_access.sql','20260923001529_privacy_operations.sql','20260925131603_hospitality_pos.sql'];
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


const command=(data,key=crypto.randomUUID(),who='owner',workspace='tenant-a')=>rpc(who,'crm_hospitality_command',[workspace,key,data]);
const overview=()=>rpc('owner','crm_hospitality_overview',['tenant-a']);
let order;
test('layout access, occupied tables and server catalogue pricing',async()=>{
 await assert.rejects(command({action:'open'},undefined,'outsider'),/access required/);
 await command({action:'layout',version:0,layout:{mode:'restaurant',pages:[{id:'main',name:'Main'}],tables:[{id:'t1',name:'1',page:'main',shape:'circle',x:0,y:0,width:15,height:15,seats:4},{id:'t2',name:'2',page:'main',shape:'rectangle',x:30,y:0,width:15,height:15,seats:4}]}});
 order=(await command({action:'open',table_id:'t1',label:'Table 1'})).order_id;
 assert.equal((await command({action:'open',table_id:'t1'})).order_id,order);
 await command({action:'add',order_id:order,version:0,item_id:item,unit_price_cents:0});
 let o=(await overview()).orders[0];assert.equal(o.lines[0].unit_price_cents,121);assert.equal(o.version,1);
 await assert.rejects(command({action:'add',order_id:order,version:0,item_id:item}),/changed/);
 await assert.rejects(command({action:'layout',version:1,layout:{mode:'till',pages:[],tables:[]}}),/occupied/);
});
test('idempotent retries and abandoned requests cannot add twice',async()=>{
 const key=crypto.randomUUID(),c={action:'add',order_id:order,version:1,item_id:item};
 const first=await command(c,key);assert.deepEqual(await command(c,key),first);
 await assert.rejects(command({...c,version:2},key),/already used/);
 const dead=crypto.randomUUID();await command({action:'abandon',key:dead});
 await assert.rejects(command({action:'add',order_id:order,version:2,item_id:item},dead),/already used/);
 assert.equal((await overview()).orders[0].lines.length,2);
});
test('partial quantity transfer conserves items, rejects stale destination',async()=>{
 let o=(await overview()).orders[0];
 await command({action:'line',order_id:order,version:o.version,line_id:o.lines[0].id,quantity:2,note:'No ice',seat:'2',station:'bar'});
 o=(await overview()).orders[0];
 await command({action:'send',order_id:order,version:o.version});
 o=(await overview()).orders[0];
 await command({action:'transfer',order_id:order,version:o.version,table_id:'t2',lines:[{id:o.lines[0].id,quantity:0.25}]});
 const all=(await overview()).orders;assert.equal(all.length,2);
 assert.equal(all.flatMap(x=>x.lines).reduce((a,l)=>a+Number(l.quantity),0),3);
 assert.equal(all.find(x=>x.table_id==='t2').lines[0].note,'No ice');
 const source=all.find(x=>x.id===order);
 await assert.rejects(command({action:'transfer',order_id:order,version:source.version,table_id:'t2',destination_version:0,lines:[{id:source.lines[0].id,quantity:0.25}]}),/Destination changed/);
});
test('split payments close exactly once, preserve stock and prohibit paid edits',async()=>{
 let o=(await overview()).orders.find(x=>x.id===order);
 await command({action:'payment',order_id:order,version:o.version,amount_cents:100,method:'cash'});
 o=(await overview()).orders.find(x=>x.id===order);assert.equal(o.paid_cents,100);
 await assert.rejects(command({action:'add',order_id:order,version:o.version,item_id:item}),/Reverse/);
 const key=crypto.randomUUID(),c={action:'payment',order_id:order,version:o.version,amount_cents:o.total_cents-100,method:'card',reference:'terminal-approval-1'};
 const r=await command(c,key);assert.equal(r.status,'closed');assert(r.sale_id);assert.deepEqual(await command(c,key),r);
 assert.equal(Number((await db.query('select on_hand from public.crm_inventory_items where id=$1',[item])).rows[0].on_hand),7.25);
 assert.equal((await db.query('select count(*)::int n from public.crm_pos_sales')).rows[0].n,1);
});
test('printer claims exclude competing devices, copies preserve original payload',async()=>{
 const t=(await overview()).tickets.find(t=>t.status==='queued');
 const claim=await command({action:'claim_ticket',ticket_id:t.id});assert(claim.payload);
 await assert.rejects(command({action:'claim_ticket',ticket_id:t.id}),/already claimed/);
 await command({action:'uncertain_ticket',ticket_id:t.id});
 await assert.rejects(command({action:'reprint',ticket_id:t.id,reason:''}),/reason required/);
 const copy=await command({action:'reprint',ticket_id:t.id,reason:'Paper jam verified'});
 const printed=await command({action:'claim_ticket',ticket_id:copy.ticket_id});assert.equal(printed.payload.copy_of,t.id);
 await assert.rejects(asUser('owner','select * from akihq_hospitality.orders'),/permission denied/);
});
test('sent transfers retain preparation state and rounding-changing splits roll back',async()=>{
 let o=(await overview()).orders.find(x=>x.table_id==='t2');assert.deepEqual(o.sent,o.lines);
 const before=JSON.stringify(o);
 // 0.125 * 121 rounds to 15 twice, whereas 0.25 * 121 rounds to 30: valid.
 // First create an odd-half split from a whole item, which would add one cent.
 const n=(await command({action:'open',label:'Rounding check'})).order_id;
 await command({action:'add',order_id:n,version:0,item_id:item});
 const fresh=(await overview()).orders.find(x=>x.id===n);
 await assert.rejects(command({action:'transfer',order_id:n,version:fresh.version,table_id:'',lines:[{id:fresh.lines[0].id,quantity:0.5}]}),/changes rounding/);
 assert.equal((await overview()).orders.filter(x=>x.label.startsWith('Split from Rounding')).length,0);
 assert.equal(JSON.stringify((await overview()).orders.find(x=>x.id===o.id)),before);
});
test('layout null coordinates, immutable evidence and revoked access are rejected',async()=>{
 const d=await overview();const bad=structuredClone(d.layout);bad.tables[0].x=null;
 await assert.rejects(command({action:'layout',version:d.layout_version,layout:bad}),/bounds/);
 await assert.rejects(db.exec("update akihq_hospitality.events set action='forged'"),/append-only/);
 await assert.rejects(db.exec("update akihq_hospitality.tickets set payload='{}'"),/immutable/);
 await db.exec("update public.crm_workspace_entitlements set active=false where workspace_id='tenant-a' and tool_key='pos'");
 await assert.rejects(overview(),/access required/);
 await db.exec("update public.crm_workspace_entitlements set active=true where workspace_id='tenant-a' and tool_key='pos'");
});
test('print attempt is recorded once and a failed print requires an explicit copy',async()=>{
 const t=(await overview()).tickets.find(t=>t.status==='queued');
 await command({action:'claim_ticket',ticket_id:t.id});await command({action:'begin_print',ticket_id:t.id});
 await assert.rejects(command({action:'begin_print',ticket_id:t.id}),/already attempted/);
 assert.equal((await overview()).tickets.find(x=>x.id===t.id).status,'uncertain');
 await command({action:'confirm_ticket',ticket_id:t.id});
});
test('accountant evidence contains partial payments and sale links with live export permissions',async()=>{
 const from=new Date(Date.now()-86400000).toISOString(),until=new Date(Date.now()+86400000).toISOString();
 const result=await rpc('owner','crm_hospitality_export',['tenant-a',from,until]);
 assert.equal(result.schema_version,1);assert(result.events.length>0);assert(result.tickets.length>0);
 const recorded=result.payments.filter(p=>p.order_id===order);assert.equal(recorded.length,2);assert(recorded.every(p=>p.sale_id));
 await assert.rejects(rpc('staff','crm_hospitality_export',['tenant-a',from,until]),/access required/);
 await assert.rejects(rpc('owner','crm_hospitality_export',['tenant-a','2020-01-01','2026-01-01']),/31 local days/);
});
test('cash limit applies to the whole operation after splitting it between tables',async()=>{
 await db.query('update public.crm_inventory_items set sale_price_cents=50000 where id=$1',[item]);
 try {
  const n=(await command({action:'open',label:'Large split bill'})).order_id;
  await command({action:'add',order_id:n,version:0,item_id:item});
  let o=(await overview()).orders.find(o=>o.id===n);
  await command({action:'line',order_id:n,version:o.version,line_id:o.lines[0].id,quantity:2,note:'',seat:'',station:'kitchen'});
  o=(await overview()).orders.find(o=>o.id===n);
  const split=await command({action:'transfer',order_id:n,version:o.version,table_id:'',lines:[{id:o.lines[0].id,quantity:1}]});
  const dest=(await overview()).orders.find(o=>o.id===split.destination_id);
  assert.equal(dest.total_cents,50000);
  await assert.rejects(command({action:'payment',order_id:dest.id,version:dest.version,method:'cash',amount_cents:1}),/EUR 1000/);
 } finally {await db.query('update public.crm_inventory_items set sale_price_cents=121 where id=$1',[item]);}
});

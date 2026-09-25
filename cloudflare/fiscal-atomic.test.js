import { serializeRegistration } from './verifactu.js';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
const db = new PGlite();
const owner='10000000-0000-4000-8000-000000000001', other='10000000-0000-4000-8000-000000000002', staff='10000000-0000-4000-8000-000000000003';
const itemA='20000000-0000-4000-8000-000000000001', itemB='20000000-0000-4000-8000-000000000002';
const scalar=async(sql,params=[]) => (await db.query(sql,params)).rows[0]?.value;
const rpc=(name,params) => scalar(`select public.${name}(${params.map((_,i)=>`$${i+1}`).join(',')}) value`,params);
const profile={legal_name:'Example Business SL',tax_id:'B12345674',address:'Example street 10',postal_code:'29640',city:'Fuengirola',country:'ES',jurisdiction:'common_territory',tax_regime:'general',currency:'EUR',sii:false};
const request=(extra={})=>({document_type:'F2',lines:[{item_id:itemA,quantity:'1'},{item_id:itemB,quantity:'1'}],expected_total_cents:2310,...extra});
const issue=(body=request(),key=crypto.randomUUID())=>rpc('crm_fiscal_issue_document',['ws_a',key,body]);
const actor=async(id=owner)=>db.exec(`set role authenticated; set request.jwt.claim.sub='${id}';`);
let document, fragment;
before(async()=>{
 await db.exec(`
 create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; grant usage on schema auth to public;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table public.crm_workspaces(id text primary key,timezone text default 'Europe/Madrid');
 create table public.crm_workspace_members(workspace_id text,profile_id uuid,status text,role text,role_template_id uuid);
 create table public.crm_role_templates(id uuid primary key,workspace_id text);
 create table public.crm_role_template_tools(template_id uuid,tool_key text);
 create table public.crm_inventory_items(id uuid primary key,workspace_id text,name text,sku text,unit text,sale_price_cents integer,active boolean default true);
 create table public.crm_pos_sales(id uuid primary key,workspace_id text,currency text,total_cents integer,sold_at timestamptz);
 create table public.crm_pos_sale_lines(id uuid primary key,sale_id uuid,workspace_id text,item_id uuid,quantity numeric,unit_price_cents integer);
 create function public.crm_has_tool(w text,t text) returns boolean language sql as $$select true$$;
 insert into public.crm_workspaces(id) values('ws_a'),('ws_b');
 insert into public.crm_workspace_members(workspace_id,profile_id,status,role) values('ws_a','${owner}','active','owner'),('ws_b','${other}','active','owner'),('ws_a','${staff}','active','staff');
 insert into public.crm_inventory_items values('${itemA}','ws_a','Meal','001','unit',1100,true),('${itemB}','ws_a','Bottle','002','unit',1210,true);
 `);
 await db.exec(readFileSync(new URL('../supabase/migrations/20260923001232_fiscal_document_core.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../supabase/migrations/20260925140358_fiscal_atomic_records.sql',import.meta.url),'utf8'));
 await actor();
});
after(()=>db.close());

const system={producer_name:'TEST ONLY Producer',producer_nif:'B12345674',name:'AkiHQ',id:'AH',version:'akihq-fiscal-0.1',installation:'isolated-test',verifactu_only:true,multi_taxpayer:true,has_multiple_taxpayers:false};
test('atomic adapter cannot bypass the production release gate',async()=>{
 await rpc('crm_fiscal_save_profile',['ws_a',profile]);
 await rpc('crm_fiscal_assign_tax',['ws_a',itemA,1000,'taxable','']);await rpc('crm_fiscal_assign_tax',['ws_a',itemB,2100,'taxable','']);
 await assert.rejects(issue(),/disabled/);
 await db.exec('reset role');await db.query("insert into fiscal_private.installations(workspace_id,environment,system) values('ws_a','test',$1)",[system]);await actor();
 await assert.rejects(issue(),/disabled/);
 // Explicit local test-only replacement. Never sent to the live database.
 await db.exec(`reset role;create or replace function fiscal_private.assert_release(w text) returns public.crm_fiscal_profiles language plpgsql security definer set search_path='' as $$declare p public.crm_fiscal_profiles;begin select * into strict p from public.crm_fiscal_profiles where workspace_id=w;return p;end$$;`);await actor();
});
test('issuance atomically stores a registration exactly matching the independent AEAT serializer',async()=>{
 document=await issue();await db.exec('reset role');
 const r=(await db.query('select * from fiscal_private.registrations where document_id=$1',[document.id])).rows[0];
 const expected=await serializeRegistration(document,r.context);
 assert.equal(r.hash,expected.hash);assert.equal(r.hash_input,expected.hashInput);assert.equal(r.xml,expected.xml);assert.equal(r.qr_url,expected.qrUrl);
 assert.equal((await db.query('select status from public.crm_fiscal_outbox where document_id=$1',[document.id])).rows[0].status,'pending');await actor();
});
test('another series extends the same issuer installation chain and retries do not append twice',async()=>{
 const key=crypto.randomUUID(),body=request({document_type:'F1',customer:{legal_name:'Test customer',tax_id:'B12345674',address:'Test street 1',country:'ES'}});
 const next=await issue(body,key);assert.equal((await issue(body,key)).id,next.id);await db.exec('reset role');
 const r=(await db.query('select * from fiscal_private.registrations where document_id=$1',[next.id])).rows[0];
 assert.equal(r.previous_document_id,document.id);assert.equal(r.xml,(await serializeRegistration(next,r.context)).xml);
 assert.equal((await db.query('select count(*)::int n from fiscal_private.registrations')).rows[0].n,2);await actor();
});
test('missing installation or malformed XML rolls back numbering, invoice and chain',async()=>{
 await db.exec('reset role');const count=(await db.query('select count(*)::int n from public.crm_fiscal_documents')).rows[0].n;
 await db.exec("update fiscal_private.installations set description=chr(1) where workspace_id='ws_a'");await actor();
 await assert.rejects(issue(),/XML/);await db.exec('reset role');
 assert.equal((await db.query('select count(*)::int n from public.crm_fiscal_documents')).rows[0].n,count);
 assert.equal((await db.query('select count(*)::int n from fiscal_private.registrations')).rows[0].n,count);
 await db.exec("update fiscal_private.installations set description='Venta de bienes y servicios' where workspace_id='ws_a'");await actor();
});
test('difference corrections extend the chain and preserve negative IVA',async()=>{
 const lines=(await db.query('select id,quantity from public.crm_fiscal_document_lines where document_id=$1',[document.id])).rows;
 const rdoc=await rpc('crm_fiscal_reverse_document',['ws_a',crypto.randomUUID(),document.id,{reason:'Test return only',lines:lines.map(l=>({line_id:l.id,quantity:String(l.quantity)}))}]);
 await db.exec('reset role');const r=(await db.query('select * from fiscal_private.registrations where document_id=$1',[rdoc.id])).rows[0];
 assert.equal(r.xml,(await serializeRegistration(rdoc,r.context)).xml);assert(rdoc.tax_cents<0);
 await assert.rejects(db.exec("update fiscal_private.registrations set hash='changed'"),/append-only/);await actor();
});
test('one issuer uses continuous numbering across separate workspaces',async()=>{
 const otherItem='20000000-0000-4000-8000-000000000003';
 await db.exec('reset role');
 const last=(await db.query("select max(sequence_number)::int n from public.crm_fiscal_documents where document_type='F2'")).rows[0].n;
 await db.query("insert into public.crm_inventory_items values($1,'ws_b','Other outlet meal','003','unit',1100,true)",[otherItem]);
 await db.query("insert into fiscal_private.installations(workspace_id,environment,system) values('ws_b','test',$1)",[system]);
 await actor(other);await rpc('crm_fiscal_save_profile',['ws_b',profile]);await rpc('crm_fiscal_assign_tax',['ws_b',otherItem,1000,'taxable','']);
 const d=await rpc('crm_fiscal_issue_document',['ws_b',crypto.randomUUID(),{document_type:'F2',lines:[{item_id:otherItem,quantity:'1'}],expected_total_cents:1100}]);
 assert.equal(Number(d.sequence_number),last+1);await db.exec('reset role');
 const r=(await db.query('select * from fiscal_private.registrations where document_id=$1',[d.id])).rows[0];
 assert(r.previous_document_id);assert.equal(r.xml,(await serializeRegistration(d,r.context)).xml);await actor();
});

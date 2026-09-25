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
 await actor();
});
after(()=>db.close());
test('issuer profile and tax configuration persist with checksummed identity',async()=>{
 const result=await rpc('crm_fiscal_save_profile',['ws_a',profile]); assert.equal(result.tax_id,profile.tax_id);
 await assert.rejects(rpc('crm_fiscal_save_profile',['ws_a',{...profile,tax_id:'B12345670'}]),/Valid Spanish/);
 await assert.rejects(rpc('crm_fiscal_save_profile',['ws_a',{...profile,jurisdiction:'canary_islands'}]),/Unsupported fiscal scope/);
 await rpc('crm_fiscal_assign_tax',['ws_a',itemA,1000,'taxable','']); await rpc('crm_fiscal_assign_tax',['ws_a',itemB,2100,'taxable','']);
 const overview=await rpc('crm_fiscal_overview',['ws_a']); assert.equal(overview.tax_assignments.length,2); assert.equal(overview.release.status,'draft');
});
test('production issue fails closed even if a release registry is manually approved',async()=>{
 await assert.rejects(issue(),/producer declaration/);
 await db.exec(`reset role; update public.crm_fiscal_releases set status='approved',declaration_url='https://example.invalid/declaration',declaration_sha256=repeat('a',64),transport_adapter='test-fixture-only',validation_evidence_url='https://example.invalid/evidence',approved_at=now();`); await actor();
 await assert.rejects(issue(),/atomic fiscal adapter integration/);
 assert.equal(await scalar('select count(*)::integer value from public.crm_fiscal_documents'),0);
});
test('test-only fixture opens accounting algorithms; production migration remains hard gated',async()=>{
 // Deliberate local-test replacement. Never shipped as a migration or called remotely.
 await db.exec(`reset role; create or replace function fiscal_private.assert_release(w text) returns public.crm_fiscal_profiles language plpgsql security definer set search_path='' as $$declare p public.crm_fiscal_profiles; begin if not fiscal_private.allowed(w,'issue') then raise exception 'Denied'; end if; select * into strict p from public.crm_fiscal_profiles where workspace_id=w; return p; end;$$;`); await actor();
 document=await issue(); assert.equal(document.total_cents,2310); assert.equal(document.tax_cents,310); assert.equal(document.taxable_base_cents,2000); assert.equal(document.sequence_number,1);
 assert.deepEqual(document.tax_summary.map(g=>[g.rate_bps,g.base_cents,g.tax_cents]),[[1000,1000,100],[2100,1000,210]]);
});
test('server totals reject tampered totals and product price overrides have no effect',async()=>{
 await assert.rejects(issue(request({expected_total_cents:1})),/inconsistent/);
 const doc=await issue(request({lines:[{item_id:itemA,quantity:'1',unit_price_cents:1}],expected_total_cents:1100})); assert.equal(doc.total_cents,1100);
 await assert.rejects(issue(request({lines:[{item_id:itemA,quantity:'1.00001'}]})),/precision/);
 await assert.rejects(issue(request({document_type:'F1'})),/Full invoices require/);
 await assert.rejects(issue(request({source_sale_id:crypto.randomUUID()})),/atomic fiscal checkout adapter/);
});
test('stable idempotency returns exact document and changed payload conflicts',async()=>{
 const key=crypto.randomUUID(), body=request(); const first=await issue(body,key); const again=await issue(body,key); assert.equal(first.id,again.id);
 await assert.rejects(issue({...body,expected_total_cents:5},key),/Idempotency/);
});
test('queued competing requests obtain unique consecutive numbers without failed-attempt gaps',async()=>{
 const before=await scalar("select last_number::integer value from public.crm_fiscal_series where document_type='F2'");
 const docs=await Promise.all(Array.from({length:10},()=>issue()));
 assert.equal(new Set(docs.map(d=>d.document_number)).size,10);
 assert.deepEqual(docs.map(d=>d.sequence_number).sort((a,b)=>a-b),Array.from({length:10},(_,i)=>before+i+1));
 // PGlite serialises requests: this verifies allocation/retries, not independent PostgreSQL sessions.
});
test('issued records resist updates/deletes even by database owner and catalogue edits preserve snapshots',async()=>{
 await assert.rejects(db.exec(`update public.crm_fiscal_documents set total_cents=0`),/permission denied/);
 await db.exec('reset role');
 await assert.rejects(db.exec(`delete from public.crm_fiscal_documents where id='${document.id}'`),/append-only/);
 await assert.rejects(db.exec(`update public.crm_fiscal_document_lines set tax_cents=0`),/append-only/);
 await db.exec(`update public.crm_inventory_items set name='Changed meal',sale_price_cents=1200 where id='${itemA}'`); await actor();
 const name=await scalar('select description value from public.crm_fiscal_document_lines where document_id=$1 and item_id=$2',[document.id,itemA]); assert.equal(name,'Meal');
});
test('tenant isolation, anon denial and manager restrictions hold at RPC and table boundaries',async()=>{
 await actor(other); const r=await db.query('select * from public.crm_fiscal_documents'); assert.equal(r.rows.length,0);
 await assert.rejects(rpc('crm_fiscal_save_profile',['ws_a',profile]),/owner or admin/);
 await assert.rejects(issue(),/access required/);
 await actor(staff); await assert.rejects(rpc('crm_fiscal_assign_tax',['ws_a',itemA,400,'taxable','']),/owner or admin/);
 await assert.rejects(issue(request({lines:[{item_id:itemA,quantity:1,discount_bps:10}]})),/Discounts require/);
 await db.exec('reset role; set role anon'); await assert.rejects(db.exec('select * from public.crm_fiscal_documents'),/permission denied/); await assert.rejects(rpc('crm_fiscal_overview',['ws_a']),/permission denied/); await actor();
});
test('partial corrections use original amounts and cannot exceed original quantity',async()=>{
 const line=(await db.query('select * from public.crm_fiscal_document_lines where document_id=$1 and item_id=$2',[document.id,itemA])).rows[0];
 const body={reason:'Customer returned item',lines:[{line_id:line.id,quantity:'0.5'}]}, key=crypto.randomUUID();
 const first=await rpc('crm_fiscal_reverse_document',['ws_a',key,document.id,body]); assert.equal(first.total_cents,-550); assert.equal(first.tax_cents,-50); assert.equal(first.document_type,'R5');
 assert.equal((await rpc('crm_fiscal_reverse_document',['ws_a',key,document.id,body])).id,first.id);
 const second=await rpc('crm_fiscal_reverse_document',['ws_a',crypto.randomUUID(),document.id,body]); assert.equal(second.total_cents,-550);
 await assert.rejects(rpc('crm_fiscal_reverse_document',['ws_a',crypto.randomUUID(),document.id,body]),/exceeds original/);
});
test('fractional quantities, sub-cent sales and repeated corrections conserve every cent',async()=>{
 await db.exec(`reset role; update public.crm_inventory_items set sale_price_cents=101 where id='${itemA}'`); await actor();
 fragment=await issue(request({lines:[{item_id:itemA,quantity:'3'}],expected_total_cents:303}));
 const line=(await db.query('select * from public.crm_fiscal_document_lines where document_id=$1',[fragment.id])).rows[0];
 const refunds=[];
 for(let i=0;i<3;i++) refunds.push(await rpc('crm_fiscal_reverse_document',['ws_a',crypto.randomUUID(),fragment.id,{reason:'Partial customer return',lines:[{line_id:line.id,quantity:'1'}]}]));
 assert.equal(refunds.reduce((s,d)=>s+d.total_cents,0),-fragment.total_cents); assert.equal(refunds.reduce((s,d)=>s+d.tax_cents,0),-fragment.tax_cents);
 const tiny=await issue(request({lines:[{item_id:itemA,quantity:'0.005'}],expected_total_cents:1})); assert.equal(tiny.total_cents,1);
});
test('ledger export contains preserved lines, excludes other workspaces and offers cursor pagination',async()=>{
 const now=new Date(Date.now()+0).toISOString(), day=fragment.issue_date;
 const first=await rpc('crm_fiscal_export_ledger',['ws_a',day,day,now,null,2]); assert.equal(first.documents.length,2); assert.equal(first.official_aeat_book,false); assert.ok(first.documents[0].lines.length);
 const second=await rpc('crm_fiscal_export_ledger',['ws_a',day,day,now,first.documents.at(-1).id,2]); assert.equal(second.documents.length,2); assert.ok(!first.documents.some(d=>second.documents.some(s=>s.id===d.id)));
 await actor(other); await assert.rejects(rpc('crm_fiscal_export_ledger',['ws_a',day,day,now,null,2]),/access required/); await actor();
});
test('past periods lock immutably and cannot silently change issuer identity',async()=>{
 await rpc('crm_fiscal_lock_period',['ws_a','2020-01-01']);
 await assert.rejects(rpc('crm_fiscal_lock_period',['ws_a','2099-01-01']),/past dates/);
 await assert.rejects(rpc('crm_fiscal_save_profile',['ws_a',{...profile,tax_id:'12345678Z'}]),/cannot change NIF/);
 await db.exec('reset role'); await assert.rejects(db.exec('delete from public.crm_fiscal_period_locks'),/append-only/); await actor();
});

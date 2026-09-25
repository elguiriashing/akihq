import {PGlite} from '../cloudflare/node_modules/@electric-sql/pglite/dist/index.js';
import {readFileSync,readdirSync} from 'node:fs';
import test from 'node:test';import assert from 'node:assert/strict';
const files=readdirSync(new URL('../supabase/migrations/',import.meta.url)).filter(f=>/^202609(23001|2513|2514|2515)/.test(f)).sort();
test('release installs on captured production column/types/constraints and serves login prerequisites',async()=>{
 const db=new PGlite();try{
 await db.exec(readFileSync(new URL('./production-schema-fixture.sql',import.meta.url),'utf8'));
 for(const f of files){try{await db.exec(readFileSync(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'));}catch(e){e.message=f+': '+e.message;throw e;}}
 const readiness=(await db.query('select public.crm_release_readiness() value')).rows[0].value;assert.equal(readiness.database_ready,true);assert.equal(readiness.fiscal_issuance_enabled,false);
 const id='10000000-0000-4000-8000-000000000011';
 await db.exec(`insert into public.profiles(id,app_role) values('${id}','administrator');insert into public.crm_workspaces(id,name,slug) values('ws_akipasa','TEST ONLY','test-only');insert into public.crm_workspace_members(workspace_id,profile_id,role) values('ws_akipasa','${id}','owner');insert into public.crm_tool_catalog(tool_key,name) values('pos','PoS'),('inventory','Inventory'),('sales','Sales'),('employees','People');insert into public.crm_workspace_entitlements(workspace_id,tool_key) select 'ws_akipasa',tool_key from public.crm_tool_catalog;set role authenticated;set request.jwt.claim.sub='${id}';`);
 const access=(await db.query("select public.crm_workspace_access('ws_akipasa') value")).rows[0].value;
 assert.equal(access.can_administer,true);assert(access.tool_keys.includes('pos'));
 const snapshot=(await db.query("select public.crm_read_workspace_snapshot('ws_akipasa') value")).rows[0].value;assert(snapshot.access);
 const orders=(await db.query("select public.crm_hospitality_overview('ws_akipasa') value")).rows[0].value;assert.equal(orders.orders.length,0);
 await db.exec("set request.jwt.claim.sub='10000000-0000-4000-8000-000000000099'");
 await assert.rejects(db.query("select public.crm_workspace_access('ws_akipasa')"),/access required/);
 }finally{await db.close();}
});

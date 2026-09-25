import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { securityFixture } from './security-fixture.mjs';

const { PGlite } = await import(process.env.PGLITE_MODULE || '../cloudflare/node_modules/@electric-sql/pglite/dist/index.js');
const migration = readFileSync(new URL('../supabase/migrations/20260923001337_security_workspace_access.sql', import.meta.url), 'utf8');
const ids={owner:'00000000-0000-0000-0000-000000000001',staff:'00000000-0000-0000-0000-000000000002',outsider:'00000000-0000-0000-0000-000000000003',manager:'00000000-0000-0000-0000-000000000004',admin:'00000000-0000-0000-0000-000000000005',viewer:'00000000-0000-0000-0000-000000000006'};
let db;
test.before(async()=>{
  db=new PGlite();
  await db.exec(securityFixture(ids));
  // The security migration follows the inventory migration in production.
  await db.exec(`create table public.crm_inventory_locations(id uuid primary key,workspace_id text,is_default boolean,active boolean);
    create table public.crm_inventory_location_balances(workspace_id text,item_id uuid,location_id uuid,quantity numeric);`);
  await db.exec(migration);
});
test.after(async()=>{await db.close()});
async function asUser(who,sql,params=[]){
  await db.exec(`reset role; select set_config('test.user_id','${ids[who]||''}',false); set role ${who==='anon'?'anon':'authenticated'};`);
  try{return await db.query(sql,params)}finally{await db.exec('reset role')}
}
async function rpc(who,name,params=[]){return (await asUser(who,`select public.${name}(${params.map((_,i)=>`$${i+1}`).join(',')}) as value`,params)).rows[0].value;}

test('outsiders and anonymous callers cannot read legacy HQ or raw snapshots',async()=>{
  await assert.rejects(asUser('outsider',"select data from public.workspace_snapshots where workspace_id='ws_akipasa'"),/permission denied/);
  await assert.rejects(rpc('outsider','crm_read_workspace_snapshot',['ws_akipasa']),/Workspace access required/);
  await assert.rejects(rpc('anon','crm_read_workspace_snapshot',['tenant-a']),/permission denied/);
});
test('profile self-edit works but role and paid-package escalation are denied',async()=>{
  await asUser('staff',"update public.profiles set display_name='New name' where id=$1",[ids.staff]);
  for(const field of ["app_role='administrator'","business_tier='enterprise'","business_plan_active=true"]){
    await assert.rejects(asUser('staff',`update public.profiles set ${field} where id=$1`,[ids.staff]),/permission denied/);
  }
});
test('tool access uses role-template permissions, not all paid entitlements',async()=>{
  const access=await rpc('staff','crm_workspace_access',['tenant-a']);
  assert.deepEqual(access.tool_keys,['calendar']); assert.equal(access.can_export,false);assert.equal(access.can_administer,false);
  const owner=await rpc('owner','crm_workspace_access',['tenant-a']);assert(owner.tool_keys.includes('employees'));assert(owner.can_export);
  const admin=await rpc('admin','crm_workspace_access',['ws_akipasa']);assert(admin.tool_keys.includes('crm'));
});
test('filtered snapshots remove HR, CRM and authority data from restricted staff',async()=>{
  const snapshot=await rpc('staff','crm_read_workspace_snapshot',['tenant-a']);
  assert.equal(snapshot.data.events.length,1);assert.deepEqual(snapshot.data.employees,[]);assert.deepEqual(snapshot.data.contacts,[]);
  assert.equal(snapshot.data.workspace.role,undefined);assert.equal(snapshot.data.workspace.toolKeys,undefined);assert.deepEqual(snapshot.data.integrations,{});
});
test('owner snapshots recursively redact historical integration credentials',async()=>{
  const snapshot=await rpc('owner','crm_read_workspace_snapshot',['tenant-a']);
  const config=snapshot.data.integrations.provider.config;assert.equal(config.apiKey,undefined);assert.equal(config.nested[0].access_token,undefined);
  assert.equal(config.nested[0].senderEmail,'public@test.invalid');
});
test('staff saves cannot overwrite unauthorized modules or forge workspace authority',async()=>{
  const snapshot=await rpc('staff','crm_read_workspace_snapshot',['tenant-a']);
  const saved=await rpc('staff','crm_write_workspace_snapshot',['tenant-a',{events:[{id:'e2'}],employees:[],contacts:[],workspace:{id:'tenant-b',role:'owner'},settings:{theme:'hacked'}},snapshot.updated_at]);
  assert.equal(saved.data.events[0].id,'e2');
  const owner=await rpc('owner','crm_read_workspace_snapshot',['tenant-a']);assert.equal(owner.data.employees[0].salary,100);assert.equal(owner.data.contacts[0].phone,'PRIVATE');assert.equal(owner.data.workspace.id,'tenant-a');
});
test('stale writes reject rather than silently overwriting concurrent work',async()=>{
  const snapshot=await rpc('staff','crm_read_workspace_snapshot',['tenant-a']);
  await rpc('staff','crm_write_workspace_snapshot',['tenant-a',{events:[{id:'e3'}]},snapshot.updated_at]);
  await assert.rejects(rpc('staff','crm_write_workspace_snapshot',['tenant-a',{events:[]},snapshot.updated_at]),/Workspace changed/);
  await assert.rejects(rpc('staff','crm_write_workspace_snapshot',['tenant-a',{events:[]}]),/Workspace changed/);
});
test('viewer write and cross-tenant writes fail closed',async()=>{
  await assert.rejects(rpc('viewer','crm_write_workspace_snapshot',['tenant-a',{events:[]}]),/write access required/);
  await assert.rejects(rpc('staff','crm_write_workspace_snapshot',['tenant-b',{events:[]}]),/Workspace access required/);
});
test('durable record RLS enforces module permissions and write attribution',async()=>{
  assert.deepEqual((await asUser('staff','select record_type from public.crm_workspace_records')).rows,[{record_type:'event'}]);
  await assert.rejects(asUser('staff',"insert into public.crm_workspace_records values('tenant-a','employee','h2','{}',$1,now(),now())",[ids.staff]),/row-level security/);
  await assert.rejects(asUser('staff',"insert into public.crm_workspace_records values('tenant-a','event','e2','{}',$1,now(),now())",[ids.owner]),/row-level security/);
  await asUser('staff',"update public.crm_workspace_records set data='{\"title\":\"Updated\"}',updated_by=$1 where record_id='e1'",[ids.staff]);
  await assert.rejects(asUser('staff',"update public.crm_workspace_records set record_id='renamed',updated_by=$1 where record_id='e1'",[ids.staff]),/identity and creation time/);
});
test('safe directory omits private contact fields and blocks outsiders',async()=>{
  const directory=await rpc('staff','crm_workspace_directory',['tenant-a']);
  assert(directory.some(m=>m.profiles.id===ids.owner));assert(!JSON.stringify(directory).includes('SECRET_PHONE'));assert(!JSON.stringify(directory).includes('birth_year'));
  assert.equal((await asUser('staff','select id from public.profiles')).rows.length,1);
  await assert.rejects(rpc('outsider','crm_workspace_directory',['tenant-a']),/Workspace access required/);
});
test('manager cannot use legacy membership RPC to escalate or remove others',async()=>{
  await assert.rejects(asUser('manager',"select public.crm_add_workspace_member('tenant-a','Manager@test.invalid','admin'::text)"),/owner or administrator required/);
  await assert.rejects(asUser('manager',"select public.crm_remove_workspace_member('tenant-a',$1)",[ids.staff]),/owner or administrator required/);
  await assert.rejects(asUser('owner',"select public.crm_add_workspace_member('tenant-a','Owner@test.invalid','staff'::text)"),/ownership transfer/);
  await assert.rejects(asUser('staff',"select akihq_security.crm_add_workspace_member('tenant-a','Staff@test.invalid','admin'::text)"),/permission denied/);
});
test('server audit is append-only, contains hashes and excludes personal payload',async()=>{
  const rows=(await asUser('owner','select * from public.crm_security_audit_events')).rows;
  assert(rows.length>=3);assert(rows.some(r=>r.after_sha256?.length===64));assert(!JSON.stringify(rows).includes('PRIVATE'));assert(!JSON.stringify(rows).includes('salary'));
  assert.equal((await asUser('staff','select * from public.crm_security_audit_events')).rows.length,0);
  await assert.rejects(asUser('owner','delete from public.crm_security_audit_events'),/permission denied/);
  await assert.rejects(asUser('owner',"insert into public.crm_security_audit_events(workspace_id,action,target_type) values('tenant-a','forged','snapshot')"),/permission denied/);
});
test('export audit requires role, module scope and bounded metadata',async()=>{
  await assert.rejects(rpc('staff','crm_record_export_event',['tenant-a','calendar',10]),/Export permission required/);
  const id=await rpc('manager','crm_record_export_event',['tenant-a','calendar',10]);assert(Number(id)>0);
  await assert.rejects(rpc('manager','crm_record_export_event',['tenant-a','employees',10]),/Export permission required/);
  await assert.rejects(rpc('owner','crm_record_export_event',['tenant-a','calendar',-1]),/Invalid export metadata/);
});
test('suspended workspaces fail access despite legacy access helper permissiveness',async()=>{
  await db.exec("update public.crm_workspaces set status='suspended' where id='tenant-a'");
  await assert.rejects(rpc('staff','crm_read_workspace_snapshot',['tenant-a']),/Workspace access required/);
  assert.equal((await asUser('staff','select * from public.crm_workspace_records')).rows.length,0);
  await db.exec("update public.crm_workspaces set status='active' where id='tenant-a'");
});
test('POS-only catalogue supports cashiers without exposing inventory cost columns',async()=>{
  await db.exec("insert into public.crm_role_template_tools values('10000000-0000-0000-0000-000000000001','pos')");
  const catalogue=await rpc('staff','crm_pos_catalogue',['tenant-a']);assert.equal(catalogue[0].sale_price_cents,121);assert.equal(catalogue[0].cost_cents,undefined);
  assert.equal((await asUser('staff','select * from public.crm_inventory_items')).rows.length,0);
  await assert.rejects(rpc('outsider','crm_pos_catalogue',['tenant-a']),/Point-of-sale access required/);
  await db.exec("delete from public.crm_role_template_tools where tool_key='pos'");
});
test('cashier availability uses MAIN stock, preserving aggregate inventory quantities',async()=>{
  const item='20000000-0000-0000-0000-000000000001';
  await db.exec(`insert into public.crm_role_template_tools values('10000000-0000-0000-0000-000000000001','pos');
    update public.crm_inventory_items set on_hand=12 where id='${item}';
    insert into public.crm_inventory_locations values('30000000-0000-0000-0000-000000000001','tenant-a',true,true),('30000000-0000-0000-0000-000000000002','tenant-a',false,true);
    insert into public.crm_inventory_location_balances values('tenant-a','${item}','30000000-0000-0000-0000-000000000001',9),('tenant-a','${item}','30000000-0000-0000-0000-000000000002',3);`);
  assert.equal((await rpc('staff','crm_pos_catalogue',['tenant-a']))[0].on_hand,9);
  assert.equal(Number((await db.query('select on_hand from public.crm_inventory_items where id=$1',[item])).rows[0].on_hand),12);
  await db.exec("delete from public.crm_inventory_location_balances where location_id='30000000-0000-0000-0000-000000000001'");
  assert.equal((await rpc('staff','crm_pos_catalogue',['tenant-a']))[0].on_hand,0);
  await db.exec("delete from public.crm_inventory_location_balances;delete from public.crm_inventory_locations");
  assert.equal((await rpc('staff','crm_pos_catalogue',['tenant-a']))[0].on_hand,12);
  await db.exec("delete from public.crm_role_template_tools where tool_key='pos'");
});
test('expired tool entitlements deny existing commerce entry points immediately',async()=>{
  const before=await rpc('staff','crm_read_workspace_snapshot',['tenant-a']);
  assert(before.access.tool_keys.includes('calendar'));
  await db.exec("update public.crm_workspace_entitlements set ends_at=now()-interval '1 second' where workspace_id='tenant-a' and tool_key='calendar'");
  const access=await rpc('staff','crm_workspace_access',['tenant-a']);assert.deepEqual(access.tool_keys,[]);
  const after=await rpc('staff','crm_read_workspace_snapshot',['tenant-a']);
  assert.equal(after.updated_at,before.updated_at);
  assert.deepEqual(after.access.tool_keys,[]);assert.deepEqual(after.data.events,[]);
  await db.exec("update public.crm_workspace_entitlements set ends_at=null where workspace_id='tenant-a' and tool_key='calendar'");
});
test('snapshot access reflects role-template revocation without changing snapshot timestamp',async()=>{
  const before=await rpc('staff','crm_read_workspace_snapshot',['tenant-a']);
  await db.exec("delete from public.crm_role_template_tools where template_id='10000000-0000-0000-0000-000000000001' and tool_key='calendar'");
  const after=await rpc('staff','crm_read_workspace_snapshot',['tenant-a']);
  assert.equal(after.updated_at,before.updated_at);assert.deepEqual(after.access.tool_keys,[]);assert.deepEqual(after.data.events,[]);
  assert.equal(after.access.can_administer,false);
  await db.exec("insert into public.crm_role_template_tools values('10000000-0000-0000-0000-000000000001','calendar')");
});
test('template permission-only changes create audit evidence without changing template name',async()=>{
  const rows=(await asUser('owner',"select action,detail from public.crm_security_audit_events where target_type='crm_role_template_tools' order by id")).rows;
  assert(rows.some(r=>r.action==='insert' && r.detail.tool_key==='pos'));
  assert(rows.some(r=>r.action==='delete' && r.detail.tool_key==='pos'));
});

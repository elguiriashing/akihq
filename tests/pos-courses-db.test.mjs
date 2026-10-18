import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {PGlite} from '../cloudflare/node_modules/@electric-sql/pglite/dist/index.js';
import {setupKitchenDatabase,ids,item} from './pos-kds-fixture.mjs';
let db;
test.before(async()=>{db=new PGlite();await setupKitchenDatabase(db);await db.exec("insert into public.crm_role_template_tools values('10000000-0000-0000-0000-000000000001','pos')");await db.exec(readFileSync(new URL('../supabase/migrations/20261018184327_pos_course_control.sql',import.meta.url),'utf8'));});
test.after(async()=>db.close());
async function rpc(name,args,who='owner'){
 await db.exec(`reset role;select set_config('test.user_id','${ids[who]||''}',false);set role authenticated;`);
 try{return (await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) value`,args)).rows[0].value;}
 finally{await db.exec('reset role');}
}
const command=(c,key=crypto.randomUUID(),who='owner',w='tenant-a')=>rpc('crm_hospitality_command',[w,key,c],who);
const course=(c,key=crypto.randomUUID(),who='owner',w='tenant-a')=>rpc('crm_course_command',[w,key,c],who);
const overview=()=>rpc('crm_hospitality_overview',['tenant-a']);
const order=async(id)=>(await overview()).orders.find(o=>o.id===id);
const board=()=>rpc('crm_kds_overview',['tenant-a']);
const card=async(id)=>(await board()).cards.find(c=>c.order_id===id&&c.station==='kitchen');
const tickets=async(id)=>(await db.query("select * from akihq_hospitality.tickets where order_id=$1 and kind='preparation' order by created_at,id",[id])).rows;
async function add(id){const before=await order(id);await command({action:'add',order_id:id,version:before.version,item_id:item});return (await order(id)).lines.at(-1);}
async function assign(id,line,number,extra={}){const o=await order(id);return command({action:'line',order_id:id,version:o.version,line_id:line.id,quantity:line.quantity,station:line.station,note:line.note,seat:line.seat,course:number,...extra});}
async function fresh(){const id=(await command({action:'open',label:'Synthetic course service'})).order_id;return {id,line:await add(id)};}
async function fire(id,number,extra={}){const o=await order(id);return course({action:'course_fire',order_id:id,version:o.version,course:number,confirmed:true,...extra});}
async function send(id){const o=await order(id);return command({action:'send',order_id:id,version:o.version});}

test('advertises course contract without changing uncoursed service',async()=>{
 assert.equal((await overview()).course_contract_version,1);
 const {id}=await fresh();await send(id);const o=await order(id);assert.deepEqual(o.lines,o.sent);assert.equal((await tickets(id)).length,1);
 await rpc('crm_kds_command',['tenant-a',crypto.randomUUID(),{action:'kds_enable',confirmed:true}]);
});
test('assigning a course changes no money, stock, kitchen cards or print jobs',async()=>{
 const {id,line}=await fresh();const before=await order(id);const stock=(await db.query('select on_hand from public.crm_inventory_items where id=$1',[item])).rows[0].on_hand;
 await assign(id,line,2);const o=await order(id);assert.equal(o.lines[0].course,2);assert.equal(o.lines[0].course_held,true);assert.equal(o.total_cents,before.total_cents);assert.equal(o.sent.length,0);assert.equal(await card(id),undefined);assert.equal((await tickets(id)).length,0);
 assert.equal((await db.query('select on_hand from public.crm_inventory_items where id=$1',[item])).rows[0].on_hand,stock);
});
test('normal Send excludes held dishes on both stations, including legacy clients',async()=>{
 const {id,line}=await fresh();await assign(id,line,3);const drink=await add(id);await assign(id,drink,2,{station:'bar'});
 await assert.rejects(send(id),/No ready item/);assert.equal((await tickets(id)).length,0);
 const immediate=await add(id);await send(id);const o=await order(id);assert.deepEqual(o.sent.map(l=>l.id),[immediate.id]);
 const ts=await tickets(id);assert.equal(ts.length,1);assert.equal(ts[0].station,'kitchen');assert.deepEqual(ts[0].payload.current.map(l=>l.id),[immediate.id]);assert.deepEqual((await card(id)).source.lines.map(l=>l.id),[immediate.id]);
});
test('fire releases just the selected course and leaves unrelated edits unsent',async()=>{
 const {id,line}=await fresh();await send(id);const main=await add(id);await assign(id,main,2);const dessert=await add(id);await assign(id,dessert,3);
 // A changed already-sent line must NOT be implicitly re-sent by firing mains.
 await assign(id,(await order(id)).lines[0],0,{note:'Later unsent note'});
 const r=await fire(id,2);assert.equal(r.fired_lines,1);const o=await order(id);
 assert.equal(o.lines.find(l=>l.id===main.id).course_held,false);assert(o.lines.find(l=>l.id===main.id).course_fired_at);assert.equal(o.lines.find(l=>l.id===dessert.id).course_held,true);
 assert.equal(o.sent.find(l=>l.id===line.id).note,'');assert(!o.sent.some(l=>l.id===dessert.id));
 const t=(await tickets(id)).find(t=>t.payload.course===2);assert.deepEqual(t.payload.released.map(l=>l.id),[main.id]);assert.equal(t.payload.current.length,2);assert.equal(t.payload.previous.length,1);
});
test('late additions to a fired course are held and require another explicit fire',async()=>{
 const {id,line}=await fresh();await assign(id,line,2);await fire(id,2);const extra=await add(id);await assign(id,extra,2);
 await assert.rejects(send(id),/No ready item/);assert.equal((await order(id)).sent.length,1);
 await fire(id,2);const ts=await tickets(id);assert.equal(ts.length,2);assert.deepEqual(ts[1].payload.released.map(l=>l.id),[extra.id]);
});
test('new course preserves cooking progress and does not require false relocation review',async()=>{
 const {id,line}=await fresh();await send(id);let c=await card(id);
 await rpc('crm_kds_command',['tenant-a',crypto.randomUUID(),{action:'kds_advance',order_id:id,station:'kitchen',version:c.version,state:'preparing',line_id:line.id}]);
 const main=await add(id);await assign(id,main,2);await fire(id,2);c=await card(id);
 assert.equal(c.change_kind,'course_fire');assert.equal(c.review_required,false);assert.equal(c.progress[line.id],'preparing');assert.equal(c.progress[main.id],'queued');
});
test('an existing unacknowledged revision remains blocked when a course fires',async()=>{
 const {id,line}=await fresh();await send(id);await assign(id,line,0,{note:'Allergy revised'});await send(id);let c=await card(id);assert(c.review_required);const previous=c.previous_source;
 const main=await add(id);await assign(id,main,2);await fire(id,2);c=await card(id);assert(c.review_required);assert.deepEqual(c.previous_source,previous);
});
test('sent dishes cannot be re-held, re-coursed or fired a second time',async()=>{
 const {id,line}=await fresh();await assign(id,line,2);await fire(id,2);const o=await order(id);
 await assign(id,o.lines[0],2,{quantity:2});assert.equal((await order(id)).lines[0].course_held,false);
 await assert.rejects(assign(id,(await order(id)).lines[0],3),/Sent items/);
 await assert.rejects(fire(id,2),/No held dishes/);
});
test('ASAP assignment releases an unsent hold without implicitly sending',async()=>{
 const {id,line}=await fresh();await assign(id,line,1);await assign(id,(await order(id)).lines[0],0);const o=await order(id);
 assert.equal(o.lines[0].course_held,false);assert.equal(o.sent.length,0);await send(id);assert.equal((await order(id)).sent.length,1);
});
test('holds and course identity survive quantity edits and table splits',async()=>{
 const {id,line}=await fresh();await assign(id,line,3,{quantity:2});let o=await order(id);
 await command({action:'line',order_id:id,version:o.version,line_id:line.id,quantity:3,note:'',seat:'',station:'kitchen'});o=await order(id);assert(o.lines[0].course_held);
 const moved=await command({action:'transfer',order_id:id,version:o.version,lines:[{id:line.id,quantity:1}]});
 const destination=await order(moved.destination_id);assert.equal(destination.lines[0].course,3);assert(destination.lines[0].course_held);assert.equal(destination.sent.length,0);
 await fire(destination.id,3);assert.equal((await order(id)).sent.length,0);assert.equal((await order(destination.id)).sent.length,1);
});
test('partial payments are allowed; final payment with a held course rolls back',async()=>{
 const {id,line}=await fresh();await assign(id,line,3);let o=await order(id);
 await command({action:'payment',order_id:id,version:o.version,amount_cents:1,method:'cash'});o=await order(id);
 await assert.rejects(command({action:'payment',order_id:id,version:o.version,amount_cents:o.total_cents-o.paid_cents,method:'cash'}),/Fire held courses/);
 const unchanged=await order(id);assert.deepEqual(unchanged,o);assert.equal((await db.query('select count(*)::int n from public.crm_pos_sales where external_id=$1',[id])).rows[0].n,0);
 await fire(id,3);o=await order(id);await command({action:'payment',order_id:id,version:o.version,amount_cents:o.total_cents-o.paid_cents,method:'cash'});assert.equal(await order(id),undefined);assert(await card(id),'Paid food remains in KDS');
});
test('firing is idempotent across retries and stale requests cannot include new dishes',async()=>{
 const {id,line}=await fresh();await assign(id,line,2);const o=await order(id),key=crypto.randomUUID();
 const c={action:'course_fire',order_id:id,version:o.version,course:2,confirmed:true};const result=await course(c,key);
 assert.deepEqual(await course(c,key),result);assert.equal((await tickets(id)).length,1);
 await assert.rejects(course({...c,course:3},key),/already used/);
 await assert.rejects(course(c),/Order changed/);
 const extra=await add(id);await assign(id,extra,2);await assert.rejects(course(c),/Order changed/);assert((await order(id)).lines.find(l=>l.id===extra.id).course_held);
});
test('same UUID cannot be reused by another actor; abandon tombstones block delayed fire',async()=>{
 const {id,line}=await fresh();await assign(id,line,2);const o=await order(id),key=crypto.randomUUID(),c={action:'course_fire',order_id:id,version:o.version,course:2,confirmed:true};
 await course(c,key,'staff');await assert.rejects(course(c,key,'owner'),/already used/);
 const next=await fresh();await assign(next.id,next.line,2);const pendingKey=crypto.randomUUID();
 await command({action:'abandon',key:pendingKey});await assert.rejects(course({action:'course_fire',order_id:next.id,version:(await order(next.id)).version,course:2,confirmed:true},pendingKey),/already used/);
 assert.equal((await order(next.id)).sent.length,0);
});
test('permission checks, tenant boundaries and direct-function ACLs cannot be bypassed',async()=>{
 const {id,line}=await fresh();await assign(id,line,2);const c={action:'course_fire',order_id:id,version:(await order(id)).version,course:2,confirmed:true};
 await assert.rejects(course(c,undefined,'outsider'),/access required/);await assert.rejects(course(c,undefined,'staff','tenant-b'),/access required/);
 const checks=(await db.query("select has_function_privilege('anon','public.crm_course_command(text,uuid,jsonb)','execute') anon, has_function_privilege('authenticated','akihq_hospitality.course_assign(jsonb,jsonb,jsonb)','execute') helper, has_function_privilege('authenticated','public.crm_course_command(text,uuid,jsonb)','execute') staff")).rows[0];
 assert.deepEqual(checks,{anon:false,helper:false,staff:true});
 await db.exec("update public.crm_workspace_entitlements set active=false where workspace_id='tenant-a' and tool_key='pos'");
 try{await assert.rejects(course(c),/access required/);}finally{await db.exec("update public.crm_workspace_entitlements set active=true where workspace_id='tenant-a' and tool_key='pos'");}
});
test('invalid course, absent confirmation, closed orders and injected prices are rejected or ignored',async()=>{
 const {id,line}=await fresh();for(const value of [-1,7,1.5,null,'2;select 1',''])await assert.rejects(assign(id,line,value),/Choose a course/);
 await assign(id,line,2,{unit_price_cents:1,course_held:false});let o=await order(id);assert(o.lines[0].course_held);assert.equal(o.lines[0].unit_price_cents,line.unit_price_cents);
 await assert.rejects(fire(id,2,{confirmed:false}),/Confirm/);await assert.rejects(fire(id,7),/Choose/);
 await command({action:'cancel',order_id:id,version:o.version,reason:'Synthetic cancellation'});
 await assert.rejects(course({action:'course_fire',order_id:id,version:o.version+1,course:2,confirmed:true}),/Open order/);
});
test('batch-entry course on Add is held immediately, never client-priced',async()=>{
 const {id}=await fresh();const before=await order(id);
 await command({action:'add',order_id:id,version:before.version,item_id:item,course:2,course_held:false,unit_price_cents:1});
 const added=(await order(id)).lines.at(-1);assert.equal(added.course,2);assert.equal(added.course_held,true);assert.equal(added.unit_price_cents,before.lines[0].unit_price_cents);
 await send(id);assert(!(await order(id)).sent.some(l=>l.id===added.id));
});
test('invalid course on Add rolls back the newly created line',async()=>{
 const {id}=await fresh();const before=await order(id);
 await assert.rejects(command({action:'add',order_id:id,version:before.version,item_id:item,course:7}),/Choose a course/);
 assert.deepEqual(await order(id),before);
});

test('out-of-entry-order course firing does not create a false Send revision',async()=>{
 const {id,line}=await fresh();await assign(id,line,3);const starter=await add(id);await assign(id,starter,1);
 await fire(id,1);await fire(id,3);const o=await order(id);assert.deepEqual(o.lines,o.sent);
 await assert.rejects(send(id),/No ready item/);assert.equal((await tickets(id)).length,2);
});
test('firing a later course reopens a completed KDS card without recooking served dishes',async()=>{
 const {id,line}=await fresh();await send(id);
 for(const state of ['preparing','ready','served']){const c=await card(id);await rpc('crm_kds_command',['tenant-a',crypto.randomUUID(),{action:'kds_advance',order_id:id,station:'kitchen',version:c.version,state,line_id:line.id}]);}
 const dessert=await add(id);await assign(id,dessert,3);await fire(id,3);const c=await card(id);
 assert(c);assert.equal(c.progress[line.id],'served');assert.equal(c.progress[dessert.id],'queued');assert.equal(c.review_required,false);
});

import assert from 'node:assert/strict';
import test from 'node:test';
const { PGlite }=await import(process.env.PGLITE_MODULE || '../cloudflare/node_modules/@electric-sql/pglite/dist/index.js');
import { ids, item, setupKitchenDatabase } from './pos-kds-fixture.mjs';
let db;
test.before(async()=>{db=new PGlite();await setupKitchenDatabase(db);});
test.after(async()=>{await db.close()});
async function asUser(who,sql,params=[]){await db.exec(`reset role;select set_config('test.user_id','${ids[who]||''}',false);set role authenticated;`);try{return await db.query(sql,params)}finally{await db.exec('reset role')}}
const rpc=async(who,name,params)=>(await asUser(who,`select public.${name}(${params.map((_,i)=>`$${i+1}`).join(',')}) value`,params)).rows[0].value;


const command=(data,key=crypto.randomUUID(),who='owner',workspace='tenant-a')=>rpc(who,'crm_hospitality_command',[workspace,key,data]);
const overview=()=>rpc('owner','crm_hospitality_overview',['tenant-a']);

const kds=(command,key=crypto.randomUUID(),who='owner',workspace='tenant-a')=>rpc(who,'crm_kds_command',[workspace,key,command]);
const board=()=>rpc('owner','crm_kds_overview',['tenant-a']);
const card=async(id,station='kitchen')=>(await board()).cards.find(c=>c.order_id===id&&c.station===station);
const order=async(id)=>(await overview()).orders.find(o=>o.id===id);
async function newOrder(label='KDS test',send=true){
 const id=(await command({action:'open',label})).order_id;
 await command({action:'add',order_id:id,version:0,item_id:item});
 if(send)await command({action:'send',order_id:id,version:(await order(id)).version});
 return id;
}
const transition=(c,state,line_id='*',key)=>kds({action:'kds_advance',order_id:c.order_id,station:c.station,version:c.version,state,line_id},key);
const review=(c,progress=c.progress)=>kds({action:'kds_review',order_id:c.order_id,station:c.station,version:c.version,progress,confirmed:true,reason:'Compared current and previous preparation with the kitchen'});

let imported;
test('off by default; manager-only activation imports open orders for review',async()=>{
 assert.equal((await board()).enabled,false);
 imported=await newOrder('Existing service');
 assert.equal((await board()).cards.length,0);
 await assert.rejects(kds({action:'kds_enable',confirmed:true},undefined,'outsider'),/access required/);
 await assert.rejects(kds({action:'kds_enable',confirmed:true},undefined,'staff'),/access required/);
 await assert.rejects(kds({action:'kds_enable'}),/Confirm/);
 await kds({action:'kds_enable',confirmed:true});
 const c=await card(imported);assert(c.review_required);assert.equal(c.change_kind,'imported');
 await assert.rejects(transition(c,'preparing'),/Review/);
 await review(c);assert.equal((await card(imported)).review_required,false);
});
test('only sent lines appear; culinary snapshots omit prices and payments',async()=>{
 const id=await newOrder('Unsent',false);assert.equal(await card(id),undefined);
 const o=await order(id);await command({action:'send',order_id:id,version:o.version});
 const c=await card(id);assert.equal(c.review_required,false);assert.equal(c.source.lines.length,1);
 assert.equal(await card(id,'bar'),undefined);
 assert(!JSON.stringify(c).includes('unit_price_cents'));assert(!JSON.stringify(c).includes('payments'));
});
test('exact transitions, stale-device rejection, idempotency and changed-key conflicts',async()=>{
 const id=await newOrder();let c=await card(id);
 await assert.rejects(transition(c,'served'),/expected preparation/);
 const key=crypto.randomUUID(),payload={action:'kds_advance',order_id:id,station:'kitchen',version:c.version,state:'preparing',line_id:'*'};
 const result=await kds(payload,key);assert.deepEqual(await kds(payload,key),result);
 await assert.rejects(kds({...payload,state:'ready'},key),/already used/);
 await assert.rejects(transition(c,'preparing'),/changed/);
 c=await card(id);assert.deepEqual(Object.values(c.progress),['preparing']);
 await transition(c,'ready');c=await card(id);assert.equal(c.completed_at,null);
 await transition(c,'served');assert((await card(id)).completed_at);
 assert(await order(id),'Serving food must not close its bill');
});
test('paying a bill does not remove food still being prepared or alter ticket status',async()=>{
 const id=await newOrder('Paid before cooking');const o=await order(id);
 const before=(await db.query('select id,status from akihq_hospitality.tickets where order_id=$1 order by id',[id])).rows;
 await command({action:'payment',order_id:id,version:o.version,amount_cents:o.total_cents,method:'card',reference:'EXTERNAL-TEST-ONLY'});
 assert.equal(await order(id),undefined);
 const c=await card(id);assert(c);assert.equal(c.completed_at,null);assert.equal(c.review_required,false);
 await transition(c,'preparing');
 assert.deepEqual((await db.query('select id,status from akihq_hospitality.tickets where order_id=$1 order by id',[id])).rows.filter(x=>before.some(y=>y.id===x.id)),before);
});
test('changed lines lose readiness; unchanged dishes retain progress; revisions require review',async()=>{
 const id=await newOrder();let o=await order(id);
 await command({action:'add',order_id:id,version:o.version,item_id:item});o=await order(id);
 await command({action:'send',order_id:id,version:o.version});let c=await card(id);await review(c);
 c=await card(id);await transition(c,'preparing');c=await card(id);await transition(c,'ready');
 o=await order(id);const [changed,unchanged]=o.lines;
 await command({action:'line',order_id:id,version:o.version,line_id:changed.id,quantity:3,note:'No nuts',seat:'1',station:'kitchen'});
 assert.equal((await card(id)).review_required,false,'Unsent line edit must not reach kitchen');
 o=await order(id);await command({action:'send',order_id:id,version:o.version});c=await card(id);
 assert(c.review_required);assert.equal(c.progress[changed.id],'queued');assert.equal(c.progress[unchanged.id],'ready');
 await assert.rejects(transition(c,'served'),/Review/);
 const baseline=c.previous_source;
 o=await order(id);await command({action:'note',order_id:id,version:o.version,note:'Allergy confirmed',guests:2});
 c=await card(id);assert.deepEqual(c.previous_source,baseline,'Do not erase the unacknowledged baseline');
 await assert.rejects(review(c,{alien:'served'}),/Unknown reviewed/);
 await assert.rejects(review(c,{}),/Review every/);
 await review(c);assert(!(await card(id)).review_required);
});
test('transfers are reconciliation work, never an automatic instruction to cook again',async()=>{
 const id=await newOrder();let c=await card(id);await transition(c,'preparing');c=await card(id);await transition(c,'ready');
 const o=await order(id);const result=await command({action:'transfer',order_id:id,version:o.version,lines:[{id:o.lines[0].id,quantity:1}]});
 const destination=await card(result.destination_id);assert(destination.review_required);assert.equal(destination.change_kind,'relocation');
 assert((await card(id)).review_required);
 const ready=Object.fromEntries(Object.keys(destination.progress).map(k=>[k,'ready']));await review(destination,ready);
 assert.deepEqual(Object.values((await card(result.destination_id)).progress),['ready']);
 await review(await card(id));assert((await card(id)).completed_at);
});
test('cancellations remain visible until acknowledged and cannot be recalled',async()=>{
 const id=await newOrder();const o=await order(id);
 await command({action:'cancel',order_id:id,version:o.version,reason:'Customer cancelled'});
 let c=await card(id);assert(c.source.cancelled);assert(c.review_required);assert.equal(c.completed_at,null);
 await review(c);c=await card(id);assert(c.completed_at);
 await assert.rejects(kds({action:'kds_recall',order_id:id,station:'kitchen',version:c.version,line_id:Object.keys(c.progress)[0],reason:'Mistaken tap'}),/cancelled/);
});
test('staff operate only with live POS permission; recall remains manager-only and audited',async()=>{
 await db.exec("insert into public.crm_role_template_tools values('10000000-0000-0000-0000-000000000001','pos')");
 const id=await newOrder();let c=await card(id);const key=crypto.randomUUID();
 const payload={action:'kds_advance',order_id:id,station:'kitchen',version:c.version,state:'preparing',line_id:'*'};
 await kds(payload,key,'staff');c=await card(id);
 const recall={action:'kds_recall',order_id:id,station:'kitchen',version:c.version,line_id:Object.keys(c.progress)[0],reason:'Incorrect preparation tap'};
 await assert.rejects(kds(recall,undefined,'staff'),/Manager/);
 await assert.rejects(kds({...recall,reason:''}),/reason/);
 await kds(recall);assert.deepEqual(Object.values((await card(id)).progress),['queued']);
 await db.exec("delete from public.crm_role_template_tools where tool_key='pos'");
 await assert.rejects(kds(payload,key,'staff'),/access required/);
 const evidence=(await db.query("select actor,metadata from akihq_hospitality.events where action='kds_recall' and order_id=$1",[id])).rows;
 assert.equal(evidence.length,1);assert.equal(evidence[0].actor,ids.owner);
});
test('existing request tombstones prevent delayed kitchen writes after abandonment',async()=>{
 const id=await newOrder();const c=await card(id);const key=crypto.randomUUID();
 await command({action:'abandon',key});
 await assert.rejects(transition(c,'preparing','*',key),/already used/);
 assert.equal((await card(id)).version,c.version);
});
test('private tables and anonymous API access remain blocked; no cross-workspace reads',async()=>{
 await assert.rejects(asUser('owner','select * from akihq_hospitality.kds_cards'),/permission denied/);
 await assert.rejects(rpc('outsider','crm_kds_overview',['tenant-a']),/access required/);
 await assert.rejects(rpc('owner','crm_kds_overview',['tenant-b']),/access required/);
 await db.exec('set role anon');await assert.rejects(db.query("select public.crm_kds_overview('tenant-a')"),/permission denied/);await db.exec('reset role');
 const rows=(await db.query("select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='akihq_hospitality' and c.relname in ('kds_cards','kds_settings')")).rows;
 assert.equal(rows.length,2);assert(rows.every(r=>r.relrowsecurity));
});
test('reads are non-mutating; unresolved kitchen work prevents accidental deactivation',async()=>{
 const before=(await db.query('select count(*)::int n from akihq_hospitality.events')).rows[0].n;
 await board();await board();
 assert.equal((await db.query('select count(*)::int n from akihq_hospitality.events')).rows[0].n,before);
 await assert.rejects(kds({action:'kds_disable'}),/outstanding/);
 await assert.rejects(db.query("update akihq_hospitality.events set action='fake' where action='kds_enable'"),/append-only/);
});

test('kitchen and bar progress stay separate when a sent line is rerouted',async()=>{
 const id=await newOrder('Reroute');let c=await card(id);await transition(c,'preparing');c=await card(id);await transition(c,'ready');
 let o=await order(id);const l=o.lines[0];
 await command({action:'line',order_id:id,version:o.version,line_id:l.id,quantity:l.quantity,note:l.note,seat:l.seat,station:'bar'});
 assert.equal(await card(id,'bar'),undefined,'Unsent route changes do not silently move preparation');
 o=await order(id);await command({action:'send',order_id:id,version:o.version});
 assert((await card(id)).review_required);
 const b=await card(id,'bar');
 // A new station must explicitly reconcile food already sent to another station.
 assert(b.review_required,'Moving sent food to a different station must not create an ordinary new task');
 await review(b,{[l.id]:'ready'});assert.equal((await card(id,'bar')).progress[l.id],'ready');
 await review(await card(id));assert((await card(id)).completed_at);
});

test('new revision reopens a completed card but preserves already served unchanged lines',async()=>{
 const id=await newOrder('More food');let c=await card(id);
 for(const state of ['preparing','ready','served']){await transition(c,state);c=await card(id);}
 let o=await order(id);const first=o.lines[0].id;
 await command({action:'add',order_id:id,version:o.version,item_id:item});o=await order(id);
 await command({action:'send',order_id:id,version:o.version});c=await card(id);
 assert.equal(c.completed_at,null);assert(c.review_required);assert.equal(c.progress[first],'served');
 assert(Object.values(c.progress).includes('queued'));
 await review(c);assert.equal((await card(id)).progress[first],'served');
});

test('active board is not limited by the completed-history display cap',async()=>{
 const ids=[];
 for(let i=0;i<55;i++)ids.push(await newOrder('History '+i));
 // Test-only privileged seed of completed progress; normal API flow is tested above.
 await db.query("update akihq_hospitality.kds_cards set completed_at=now() where order_id=any($1::uuid[])",[ids]);
 const activeIds=[];for(let i=0;i<55;i++)activeIds.push(await newOrder('Active '+i));
 const result=await board();
 assert.equal(result.cards.filter(c=>c.completed_at).length,50);
 assert(activeIds.every(id=>result.cards.some(c=>c.order_id===id&&!c.completed_at)));
 const saved=(await db.query('select count(*)::int n from akihq_hospitality.kds_cards where order_id=any($1::uuid[])',[ids])).rows[0].n;
 assert.equal(saved,55,'History cap must not delete retained records');
});

test('malformed commands and cross-tenant writes have no side effects',async()=>{
 const id=await newOrder();const c=await card(id),base={action:'kds_advance',order_id:id,station:'kitchen',version:c.version,state:'preparing',line_id:'*'};
 for(const bad of [null,[],{...base,version:null},{...base,state:null},{...base,line_id:'unknown'},{...base,action:'unknown'},{...base,station:'receipt'}]){
  await assert.rejects(kds(bad));assert.equal((await card(id)).version,c.version);
 }
 await assert.rejects(kds(base,undefined,'owner','tenant-b'),/access required/);
 assert.equal((await card(id)).version,c.version);
});

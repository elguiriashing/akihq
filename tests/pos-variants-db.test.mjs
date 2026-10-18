// Actual hospitality/stock SQL with synthetic tenants; never a production database.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '../cloudflare/node_modules/@electric-sql/pglite/dist/index.js';
import {setupKitchenDatabase,ids,item} from './pos-kds-fixture.mjs';
let db;
const large='20000000-0000-0000-0000-000000000002',foreign='20000000-0000-0000-0000-000000000003';
test.before(async()=>{
 db=new PGlite();await setupKitchenDatabase(db);
 await db.exec("insert into public.crm_role_template_tools values('10000000-0000-0000-0000-000000000001','pos')");
 await db.exec(readFileSync(new URL('../supabase/migrations/20261018184327_pos_course_control.sql',import.meta.url),'utf8'));
 await db.query("insert into public.crm_inventory_items(id,workspace_id,sku,name,unit,on_hand,category,sale_price_cents,cost_cents,active) values($1,'tenant-a','COF-L','Café grande','unit',0,'Coffee',350,50,true),($2,'tenant-b','PRIVATE','Other workspace item','unit',0,'Coffee',50,10,true)",[large,foreign]);
 await rpc('crm_inventory_operation',['tenant-a','variant-opening-stock',{type:'receive',reason:'Synthetic opening stock',supplier_name:'Test supplier',reference:'TEST-1',lines:[{item_id:large,quantity:20,unit_cost_cents:50}]}]);
});
test.after(async()=>db.close());
async function rpc(name,args,who='owner'){
 await db.exec(`reset role;select set_config('test.user_id','${ids[who]||''}',false);set role authenticated;`);
 try{return (await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) value`,args)).rows[0].value;}finally{await db.exec('reset role');}
}
const command=(c,key=crypto.randomUUID(),who='owner')=>rpc('crm_hospitality_command',['tenant-a',key,c],who);
const overview=()=>rpc('crm_hospitality_overview',['tenant-a']);
const order=async id=>(await overview()).orders.find(o=>o.id===id);
async function fresh(){return (await command({action:'open',label:'Synthetic variant selection'})).order_id;}
async function add(id,sku=large,extra={}){return command({action:'add',order_id:id,version:(await order(id)).version,item_id:sku,...extra});}
const config={version:1,title:'Coffee size',items:[item,large]};
async function save(extra={},who='owner'){const d=await overview();return command({action:'layout',version:d.layout_version,layout:{...d.layout,menu:{...d.layout.menu,variants:{[item]:config},...extra}}},undefined,who);}
test('manager variant configuration shares the existing protected layout and changes no stock or bills',async()=>{
 const before=(await db.query('select id,on_hand,sale_price_cents from public.crm_inventory_items order by id')).rows;
 await save();const d=await overview();assert.deepEqual(d.layout.menu.variants[item],config);
 assert.deepEqual((await db.query('select id,on_hand,sale_price_cents from public.crm_inventory_items order by id')).rows,before);assert.equal(d.orders.length,0);
});
test('ordinary staff cannot rewrite variant mappings or prices through layout',async()=>{await assert.rejects(save({},'staff'),/Administrator/);});
test('stale manager writes cannot overwrite newer variant configuration',async()=>{const d=await overview();await save({presets:['No sugar']});await assert.rejects(command({action:'layout',version:d.layout_version,layout:d.layout}),/Layout changed/);});
test('selecting a variant records its own SKU name and server price, not browser price fields',async()=>{
 const id=await fresh();await add(id,large,{unit_price_cents:1,sale_price_cents:1,name:'Forged name',tax_rate:0});const o=await order(id);
 assert.equal(o.lines.length,1);assert.equal(o.lines[0].item_id,large);assert.equal(o.lines[0].name,'Café grande');assert.equal(o.lines[0].unit_price_cents,350);assert.equal(o.total_cents,350);assert.equal(o.lines[0].tax_rate,undefined);
});
test('different sizes remain distinct lines with independent totals',async()=>{const id=await fresh();await add(id,item);await add(id,large);const o=await order(id);assert.deepEqual(o.lines.map(l=>l.item_id),[item,large]);assert.equal(o.total_cents,471);});
test('variant selection retains the selected held course and the actual KDS product',async()=>{
 await rpc('crm_kds_command',['tenant-a',crypto.randomUUID(),{action:'kds_enable',confirmed:true}]);
 const id=await fresh();await add(id,large,{course:2});let o=await order(id);assert(o.lines[0].course_held);assert.equal(o.sent.length,0);
 await rpc('crm_course_command',['tenant-a',crypto.randomUUID(),{action:'course_fire',order_id:id,version:o.version,course:2,confirmed:true}]);
 const board=await rpc('crm_kds_overview',['tenant-a']);const card=board.cards.find(c=>c.order_id===id);assert.equal(card.source.lines[0].item_id,large);assert.equal(card.source.lines[0].name,'Café grande');
});
test('final payment deducts only the chosen SKU, and a lost-response retry is idempotent',async()=>{
 const before=(await db.query('select id,on_hand from public.crm_inventory_items where workspace_id=$1 order by id',['tenant-a'])).rows;
 const id=await fresh(),key=crypto.randomUUID(),c={action:'add',order_id:id,version:0,item_id:large};await command(c,key);await command(c,key);
 let o=await order(id);assert.equal(o.lines.length,1);await command({action:'payment',order_id:id,version:o.version,method:'cash',amount_cents:350});
 const after=(await db.query('select id,on_hand from public.crm_inventory_items where workspace_id=$1 order by id',['tenant-a'])).rows;
 for(const p of before)assert.equal(Number(after.find(x=>x.id===p.id).on_hand),Number(p.on_hand)-(p.id===large?1:0));
 const sale=(await db.query('select item_id,unit_price_cents,quantity from public.crm_pos_sale_lines where sale_id=(select sale_id from akihq_hospitality.orders where id=$1)',[id])).rows;
 assert.equal(sale.length,1);assert.equal(sale[0].item_id,large);assert.equal(sale[0].unit_price_cents,350);
});
test('changing the menu mappings never changes existing selected SKU lines',async()=>{const id=await fresh();await add(id,large);const before=(await order(id)).lines;await save({variants:{}});assert.deepEqual((await order(id)).lines,before);});
test('catalogue changes require the existing manager repricing safeguard before payment',async()=>{
 const id=await fresh();await add(id,large);await db.query('update public.crm_inventory_items set sale_price_cents=375 where id=$1',[large]);
 try{const o=await order(id);await assert.rejects(command({action:'payment',order_id:id,version:o.version,method:'cash',amount_cents:350}),/Catalogue changed/);assert.equal((await order(id)).paid_cents,0);assert.equal((await order(id)).lines[0].unit_price_cents,350);}finally{await db.query('update public.crm_inventory_items set sale_price_cents=350 where id=$1',[large]);}
});
test('cross-workspace, inactive and non-existent SKU choices cannot be added',async()=>{
 const id=await fresh();for(const sku of [foreign,'20000000-0000-0000-0000-000000000099'])await assert.rejects(add(id,sku),/Active product/);
 await db.query('update public.crm_inventory_items set active=false where id=$1',[large]);try{await assert.rejects(add(id,large),/Active product/);}finally{await db.query('update public.crm_inventory_items set active=true where id=$1',[large]);}
 assert.equal((await order(id)).lines.length,0);
});
test('variant SKU and price survive quantity changes and a table split',async()=>{
 const id=await fresh();await add(id,large);let o=await order(id),line=o.lines[0];await command({action:'line',order_id:id,version:o.version,line_id:line.id,quantity:2,note:'Sin azúcar',seat:'2',station:'bar'});o=await order(id);
 const r=await command({action:'transfer',order_id:id,version:o.version,lines:[{id:line.id,quantity:1}]});const dest=await order(r.destination_id);assert.equal(dest.lines[0].item_id,large);assert.equal(dest.lines[0].unit_price_cents,350);assert.equal(dest.lines[0].note,'Sin azúcar');assert.equal(dest.lines[0].station,'bar');assert.equal((await order(id)).total_cents+dest.total_cents,700);
});
test('recorded payments and revoked POS access still prevent variant additions',async()=>{
 const id=await fresh();await add(id,large);let o=await order(id);await command({action:'payment',order_id:id,version:o.version,method:'cash',amount_cents:1});await assert.rejects(add(id,large),/Reverse recorded payments/);
 const next=await fresh();await db.exec("update public.crm_workspace_entitlements set active=false where workspace_id='tenant-a' and tool_key='pos'");try{await assert.rejects(command({action:'add',order_id:next,version:0,item_id:large}),/access required/);}finally{await db.exec("update public.crm_workspace_entitlements set active=true where workspace_id='tenant-a' and tool_key='pos'");}
});

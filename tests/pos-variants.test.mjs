import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const clone=x=>JSON.parse(JSON.stringify(x));
function env(lang='en'){
 const listeners=new Map(),storage=new Map();let n=0;
 const root={document:{documentElement:{lang},activeElement:null,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(type,fn){listeners.set(fn,type);},removeEventListener(type,fn){listeners.delete(fn);}},confirm:()=>true,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},navigator:{locks:{request:async(k,o,fn)=>fn({})}},crypto:{randomUUID:()=>`00000000-0000-4000-a000-${String(++n).padStart(12,'0')}`},setInterval:()=>0,clearInterval(){},setTimeout,clearTimeout,FormData:class{constructor(f){return f.fields;}}};
 for(const f of ['pos-variants.js','pos-courses.js','pos-service.js','pos-v4.js','pos-v4-dialogs.js','pos-printer-station.js','pos-ledger.js','hospitality-pos.js'])vm.runInNewContext(read('assets/'+f),{window:root,globalThis:root,Intl,Date,setTimeout,clearTimeout,console});
 return {root,listeners,storage};
}
const catalogue=[{id:'p1',name:'Café pequeño',sku:'COF-S',sale_price_cents:200,on_hand:25},{id:'p2',name:'Café grande',sku:'COF-L',sale_price_cents:350,on_hand:0},{id:'p3',name:'Café doble',sku:'COF-D',sale_price_cents:420,on_hand:10}];
const cfg={version:1,title:'Coffee size',items:['p1','p2','p3']};
const layout={mode:'till',pages:[],tables:[],menu:{variants:{p1:cfg},categories:[],products:{p2:{hidden:true}},presets:['No ice']}};
const order={id:'o1',label:'Terrace 1',status:'open',version:2,lines:[],sent:[],payments:[],paid_cents:0,total_cents:0};
const data={layout,layout_version:4,catalogue,orders:[order],can_manage:true,tickets:[],recent:[],server_time:new Date().toISOString(),course_contract_version:1};
function harness(lang='en'){
 const e=env(lang),d=clone(data),queued=[],saved=[];let blocked=false,current='o1';
 const c=e.root.AkiPosVariants.create({getData:()=>d,getOrder:id=>d.orders.find(o=>o.id===id),currentId:()=>current,isActive:()=>true,isBlocked:()=>blocked,flushTaps:async()=>true,reload:async()=>{},refresh(){},entryCourse:()=>2,enqueue:(...args)=>queued.push(args),saveLayout:async(l,v)=>saved.push({layout:clone(l),version:v}),currency:'EUR'});
 return {...e,d,c,queued,saved,block(v=true){blocked=v;},current(v){current=v;},fire(action,id){return c.action({dataset:{action:'hp-variant-'+action,id}});},event(type,target){for(const [fn,t] of e.listeners)if(t===type)fn({target});}};
}
const {root}=env(),api=root.AkiPosVariants;
test('a normal product remains a one-tap sale with no chooser',()=>{assert.equal(api.configured({},'p1'),false);assert.equal(api.config({},'p1'),null);assert.equal(api.badge({},catalogue,'p1',order,'EUR'),'');});
test('explicit malformed groups fail closed instead of selling the base item',()=>{
 for(const value of [null,[],{}, {...cfg,items:['p1','p1']},{...cfg,version:2},{...cfg,items:['p1']},{...cfg,title:''}]){const l={menu:{variants:{p1:value}}};assert(api.configured(l,'p1'));assert(api.config(l,'p1').invalid);assert.equal(api.choices(l,catalogue,'p1',order).length,0);}
});
test('choices preserve configured order, real product identity and per-SKU prices',()=>{const rows=api.choices(layout,catalogue,'p1',order);assert.deepEqual(Array.from(rows,r=>[r.id,r.price]),[['p1',200],['p2',350],['p3',420]]);});
test('hidden menu buttons remain selectable only as explicit variants',()=>{assert(api.choices(layout,catalogue,'p1',order).find(x=>x.id==='p2').product);const html=root.AkiPosV4.itemResults(layout,catalogue,'All',order,'EUR');assert.doesNotMatch(html,/data-id="p2"/);assert.match(html,/hp-variant-badge/);});
test('unavailable variants are shown as unavailable, never replaced with another SKU',()=>{const rows=api.choices(layout,catalogue.filter(p=>p.id!=='p2'),'p1',order);assert.equal(rows[1].product,null);assert.equal(rows[1].price,null);});
test('recorded line price is displayed instead of silently quoting a new catalogue price',()=>{assert.equal(api.unitPrice(catalogue[1],{lines:[{item_id:'p2',unit_price_cents:325}]}),325);assert.equal(api.unitPrice({...catalogue[1],sale_price_cents:-1}),null);});
test('validation rejects missing products, duplicate selections and over-capacity groups',()=>{
 assert.throws(()=>api.validate('x',['p1','missing'],catalogue),/changed/);assert.throws(()=>api.validate('x',['p1','p1'],catalogue),/2–12/);assert.throws(()=>api.validate('',cfg.items,catalogue),/2–12/);assert.throws(()=>api.validate('x',Array.from({length:13},(_,i)=>'p'+i),catalogue),/2–12/);
 assert.deepEqual(clone(api.validate('  Coffee  ',cfg.items,catalogue)),{...cfg,title:'Coffee'});
});
test('unrelated designer edits preserve saved variant mappings',()=>{assert.deepEqual(clone(root.AkiPosV4.menu(layout).variants),layout.menu.variants);assert.match(root.AkiPosV4.designer(data,'All'),/hp-variant-edit/);});
test('chooser creates no command until a specific option is selected',async()=>{const h=harness();await h.c.open('p1','choose','o1');assert.equal(h.queued.length,0);assert.match(h.c.render(),/role="dialog" aria-modal="true"/);await h.fire('choose','p2');assert.deepEqual(h.queued,[['o1','p2',2]]);assert.equal(h.c.render(),'');h.c.dispose();});
test('double taps on a closing chooser cannot add an extra item',async()=>{const h=harness();await h.c.open('p1','choose','o1');await h.fire('choose','p2');await h.fire('choose','p2');assert.equal(h.queued.length,1);h.c.dispose();});
test('stale bill, layout, catalogue price and stock all require explicit reload',async()=>{
 for(const mutate of [h=>h.d.orders[0].version++,h=>h.d.layout_version++,h=>h.d.catalogue[1].sale_price_cents++,h=>h.d.catalogue[1].on_hand--]){const h=harness();await h.c.open('p1','choose','o1');mutate(h);await assert.rejects(h.fire('choose','p2'),/changed/);assert.equal(h.queued.length,0);assert.match(h.c.render(),/hp-variant-reload/);h.c.dispose();}
});
test('changed selected table, recorded payment and disappeared order block selection',async()=>{
 for(const mutate of [h=>h.current('other'),h=>h.d.orders[0].paid_cents=1,h=>h.d.orders=[]]){const h=harness();await h.c.open('p1','choose','o1');mutate(h);await assert.rejects(h.fire('choose','p2'));assert.equal(h.queued.length,0);h.c.dispose();}
});
test('pending recovery blocks both selection and manager writes',async()=>{const h=harness();await h.c.open('p1','choose','o1');h.block();await assert.rejects(h.fire('choose','p2'),/pending/);assert.equal(h.queued.length,0);h.c.dispose();});
test('staff cannot open a manager editor; revocation blocks an already-open editor',async()=>{
 const h=harness();h.d.can_manage=false;await assert.rejects(h.fire('edit','p1'),/Manager/);h.d.can_manage=true;await h.fire('edit','p1');h.d.can_manage=false;await assert.rejects(h.c.save());assert.equal(h.saved.length,0);h.c.dispose();
});
test('configuration saves through the same versioned layout with no price changes',async()=>{const h=harness();await h.fire('edit','p1');await h.fire('up','p3');await h.c.save();assert.equal(h.saved.length,1);assert.equal(h.saved[0].version,4);assert.deepEqual(h.saved[0].layout.menu.variants.p1.items,['p1','p3','p2']);assert.deepEqual(h.saved[0].layout.menu.products,layout.menu.products);assert.deepEqual(h.d.catalogue,catalogue);h.c.dispose();});
test('missing selected products can be removed and corrected without clearing all settings',async()=>{const h=harness();h.d.catalogue=h.d.catalogue.filter(p=>p.id!=='p2');await h.fire('edit','p1');await h.fire('deselect','p2');await h.c.save();assert.deepEqual(h.saved[0].layout.menu.variants.p1.items,['p1','p3']);h.c.dispose();});
test('removing a chooser needs explicit confirmation and leaves other settings untouched',async()=>{const h=harness();await h.fire('edit','p1');h.root.confirm=()=>false;await h.fire('remove');assert.equal(h.saved.length,0);h.root.confirm=()=>true;await h.fire('remove');assert.equal(h.saved.length,1);assert.equal(h.saved[0].layout.menu.variants.p1,undefined);assert.deepEqual(h.saved[0].layout.menu.products,layout.menu.products);h.c.dispose();});
test('stale manager version cannot overwrite someone else’s menu',async()=>{const h=harness();await h.fire('edit','p1');h.d.layout_version++;await assert.rejects(h.c.save(),/changed/);assert.equal(h.saved.length,0);h.c.dispose();});
test('stock warnings do not falsely promise reservation or forbid a safe open order',async()=>{const h=harness();await h.c.open('p1','choose','o1');assert.match(h.c.render(),/Open orders do not reserve/);assert.match(h.c.render(),/Check stock/);await h.fire('choose','p2');assert.equal(h.queued[0][1],'p2');h.c.dispose();});
test('translated UI and hostile catalogue labels render as text only',async()=>{const h=harness('es');h.d.layout.menu.variants.p1.title='<img src=x onerror=bad>';h.d.catalogue[1].name='<svg onload=bad>';await h.c.open('p1','choose','o1');const html=h.c.render();assert.match(html,/Elige una opción/);assert.doesNotMatch(html,/<img|<svg/);assert.match(html,/&lt;svg/);h.c.dispose();});
test('disposing the variant controller removes all of its listeners',()=>{const h=harness();assert.equal(h.listeners.size,3);h.c.dispose();assert.equal(h.listeners.size,0);assert.equal(h.c.render(),'');});
test('both new assets and all modified runtime assets have exact cache versions',()=>{for(const asset of ['pos-variants.js?v=1','pos-variants.css?v=1','hospitality-pos.js?v=17','pos-v4.js?v=3'])for(const file of ['index.html','sw.js'])assert(read(file).includes(asset),file+' '+asset);});
test('the real till selects a SKU through the existing durable command path and preserves course',async()=>{
 const h=env(),d=clone(data),commands=[],replies=new Map(),notices=[];let drop=true;
 const controller=h.root.AkiHospitality.create({actor:'staff',workspace:{id:'w',currency:'EUR'},isActive:()=>true,refresh(){},toast(...x){notices.push(x);},client:{async rpc(name,args){
  if(name==='crm_hospitality_overview')return {data:{...clone(d),server_time:new Date().toISOString()}};
  if(name!=='crm_hospitality_command')return {error:{message:'Unexpected RPC'}};
  if(replies.has(args.p_key))return replies.get(args.p_key);
  const c=args.p_command;commands.push(clone(c));const o=d.orders[0];
  assert.equal(c.action,'add');assert.equal(c.item_id,'p2');assert.equal(c.unit_price_cents,undefined);
  o.lines.push({id:'l1',item_id:'p2',name:'Café grande',quantity:1,unit_price_cents:350,station:'kitchen',seat:'',note:'',course:c.course,course_held:true});o.version++;o.total_cents=350;
  const r={data:{order_id:o.id,status:'open'}};replies.set(args.p_key,r);if(drop){drop=false;return {error:{message:'Dropped reply after commit'}};}return r;
 }}});
 controller.render();for(let i=0;i<80;i++)await Promise.resolve();await controller.action({dataset:{action:'hp-select',id:'o1'}});
 for(const [fn,type] of h.listeners)if(type==='change')fn({target:{value:'2',matches:s=>s==='[data-pos-entry-course]'}});
 await controller.action({dataset:{action:'hp-add',order:'o1',id:'p1'}});assert.match(controller.render(),/hp-variant-dialog/);assert.equal(commands.length,0);
 await controller.action({dataset:{action:'hp-variant-choose',id:'p2'}});await new Promise(r=>setTimeout(r,160));
 assert.equal(commands.length,1);assert.equal(commands[0].course,2);assert.equal(h.storage.size,1);
 await controller.action({dataset:{action:'hp-retry'}});assert.equal(h.storage.size,0);assert.equal(commands.length,1);assert.equal(d.orders[0].lines.length,1);
 controller.dispose();assert.equal(h.listeners.size,0);
});

test('variant button ranges convert cents to euros exactly once',()=>{const html=api.badge(layout,catalogue,'p1',order,'EUR');assert.match(html,/2[.,]00/);assert.match(html,/4[.,]20/);assert.doesNotMatch(html,/200[.,]00/);});
test('unknown prices are unavailable, not falsely free options',()=>{for(const sale_price_cents of [null,undefined,''])assert.equal(api.unitPrice({...catalogue[0],sale_price_cents}),null);});

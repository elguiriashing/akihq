import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function environment(lang='en'){
 const listeners=new Map(),storage=new Map();let sequence=0;
 const root={document:{documentElement:{lang},activeElement:null,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(type,fn){listeners.set(fn,type);},removeEventListener(type,fn){listeners.delete(fn);}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},navigator:{locks:{request:async(k,o,fn)=>fn({})}},crypto:{randomUUID:()=>`00000000-0000-4000-a000-${String(++sequence).padStart(12,'0')}`},setInterval:()=>0,clearInterval(){},setTimeout,clearTimeout,FormData:class{constructor(f){return f.fields;}}};
 for(const file of ['pos-service.js','pos-v4.js','pos-v4-dialogs.js','pos-printer-station.js','pos-ledger.js','hospitality-pos.js'])vm.runInNewContext(read('assets/'+file),{window:root,globalThis:root,Intl,Date,setTimeout,clearTimeout,console});
 return {root,listeners,storage};
}
const {root}=environment(),service=root.AkiPosService;
const clone=x=>JSON.parse(JSON.stringify(x));
const line={id:'l1',item_id:'p1',name:'Café',quantity:2,station:'bar',note:'No sugar',seat:'1',unit_price_cents:250};
const layout={mode:'restaurant',pages:[{id:'floor',name:'Terraza'}],tables:[{id:'t1',name:'Mesa 1',page:'floor',seats:4}],menu:{categories:[{id:'drinks',name:'Bebidas'}],products:{p1:{label:'Café con leche',category:'drinks',favourite:true},p3:{hidden:true,favourite:true}}}};
const catalogue=[{id:'p1',name:'Coffee',category:'Hot drinks',sale_price_cents:250,on_hand:10},{id:'p2',name:'Beer',category:'Drinks',sale_price_cents:300},{id:'p3',name:'Hidden café',category:'Drinks',sale_price_cents:900},{id:'p4',name:'Inactive café',active:false,sale_price_cents:900}];
const order={id:'o1',label:'Table 1',table_id:'t1',version:2,status:'open',created_at:'2026-10-18T11:00:00Z',guests:2,note:'Birthday',lines:[clone(line)],sent:[],payments:[],total_cents:500,paid_cents:0};
const data={layout,layout_version:0,catalogue,orders:[order,{...clone(order),id:'o2',label:'Walk-in 2',table_id:null,guests:1,paid_cents:200,sent:[clone(line)],created_at:'2026-10-18T10:00:00Z'}],can_manage:true,tickets:[],recent:[],server_time:'2026-10-18T12:00:00Z'};
test('accent-insensitive matching covers configured labels and category names',()=>{
 assert.equal(service.matchesProduct(layout,catalogue[0],'cafe LECHE'),true);
 assert.equal(service.matchesProduct(layout,catalogue[0],'bebidas'),true);
 assert.equal(service.matchesProduct(layout,catalogue[0],'beer'),false);
});
test('search and favourite filtering never expose hidden or inactive products',()=>{
 const html=root.AkiPosV4.itemResults(layout,catalogue,'All',order,'EUR',{query:'cafe',favourites:true});
 assert.match(html,/data-id="p1"/);assert.doesNotMatch(html,/data-id="p[234]"/);
});
test('search retains selected category instead of silently broadening it',()=>{
 const html=root.AkiPosV4.itemResults(layout,catalogue,'Drinks',order,'EUR',{query:'cafe'});
 assert.doesNotMatch(html,/data-action="hp-add"/);assert.match(html,/No matching products/);
});
test('query and product labels are escaped, never injected as HTML',()=>{
 const html=root.AkiPosV4.itemButtons({},[{id:'" onclick="x',name:'<img src=x onerror=x>',sale_price_cents:1}],'All',order,'EUR',{query:'" onfocus="x'});
 assert.doesNotMatch(html,/<img|value="" onfocus=/);assert.match(html,/&quot;/);
});
test('stock warning is not a promise of reservation or a disabled sale',()=>{
 const html=root.AkiPosV4.itemButtons({},[{id:'x',name:'Beer',sale_price_cents:100,on_hand:0}],'All',order,'EUR');
 assert.match(html,/Check stock/);assert.doesNotMatch(html,/disabled/);
});
test('equal jsonb lines with different key order have no pending changes',()=>{
 const reversed=Object.fromEntries(Object.entries(line).reverse());
 assert.equal(service.preparation({...order,lines:[line],sent:[reversed]}).changed,false);
});
test('added items are distinguished from the previous required quantity',()=>{
 const prep=service.preparation(order);assert.equal(prep.changed,true);assert.equal(prep.changes[0].kind,'added');assert.equal(prep.changes[0].previous,null);
});
test('quantity, routing, seat and note changes are retained in the preview',()=>{
 for(const update of [{quantity:3},{station:'kitchen'},{seat:'2'},{note:'No milk'}]){
  const prep=service.preparation({...order,sent:[line],lines:[{...line,...update}]});
  assert.equal(prep.changes[0].kind,'updated');assert.deepEqual(clone(prep.changes[0].previous),line);
 }
});
test('removed items remain visible as cancellations, including the old station',()=>{
 const prep=service.preparation({...order,lines:[],sent:[line]});
 assert.equal(prep.changed,true);assert.equal(prep.changes[0].kind,'removed');assert.equal(prep.changes[0].current,null);assert.equal(prep.changes[0].previous.station,'bar');
});
test('missing sent data is unknown rather than falsely marked sent',()=>{
 const prep=service.preparation({...order,sent:undefined});assert.equal(prep.known,false);assert.equal(prep.changed,false);
 assert.match(service.preparationPanel({...order,sent:undefined},layout),/disabled/);
});
test('order-note changes alone do not fabricate another item preparation',()=>{
 assert.equal(service.preparation({...order,sent:[line],note:'Changed table note'}).changed,false);
});
test('age is server-clock based and clamps future timestamps',()=>{
 assert.equal(service.age(order,Date.parse('2026-10-18T12:00:00Z')),60);
 assert.equal(service.age(order,Date.parse('2026-10-18T10:00:00Z')),0);
 assert.equal(service.age({...order,created_at:'invalid'},Date.now()),null);
});
test('service includes both occupied tables and walk-ins in restaurant mode',()=>{
 assert.equal(service.serviceOrders(data).length,2);
 assert.equal(service.serviceOrders(data,{floor:'__walkins__'})[0].order.id,'o2');
 assert.equal(service.serviceOrders(data,{floor:'floor'})[0].order.id,'o1');
});
test('service filters combine floor, partial payment and accent-insensitive search',()=>{
 assert.equal(service.serviceOrders(data,{status:'partial'})[0].order.id,'o2');
 assert.equal(service.serviceOrders(data,{query:'TERRAZA mesa'})[0].order.id,'o1');
 assert.equal(service.serviceOrders(data,{query:'zzzz'}).length,0);
});
test('attention sorts unsent first; oldest sort does not hide older sent bills',()=>{
 assert.equal(service.serviceOrders(data)[0].order.id,'o1');
 assert.equal(service.serviceOrders(data,{sort:'oldest'})[0].order.id,'o2');
});
test('staff tools never display the manager-only designer option',()=>{
 const nav=service.navigation({view:'service',canManage:false,immersive:true});
 assert.doesNotMatch(nav,/value="designer"/);assert.match(nav,/data-action="hp-immersive"/);
});
test('service markup does not label sent items as ready, served or physically printed',()=>{
 const html=service.serviceBody(data);assert.match(html,/No unsent item changes/);assert.doesNotMatch(html,/Ready to serve|Physically printed/);
});
test('Spanish service and search labels preserve diacritics',()=>{
 const es=environment('es').root.AkiPosService;
 assert.match(es.serviceBody(data),/Comensales|Pendiente de cobro/);assert.match(es.searchToolbar(),/categoría/);
});
test('pending unknown command blocks the preparation send control',()=>{
 assert.match(service.preparationPanel(order,layout,true),/data-action="hp-service-send"[^>]*disabled/);
});
test('native POS navigation does not reuse cross-site or account menu actions',()=>{
 const nav=service.navigation({view:'terminal',canManage:true});assert.match(nav,/data-pos-view/);assert.doesNotMatch(nav,/suite-app|signout|passport/);
});
test('new assets are versioned in both document and service worker',()=>{
 for(const asset of ['pos-service.js?v=2','pos-service.css?v=1','hospitality-pos.js?v=15','pos-v4.js?v=2']){
  assert.ok(read('index.html').includes(asset));assert.ok(read('sw.js').includes(asset));
 }
});
test('service revision uses the existing command and expected version, not a new write channel',async()=>{
 const {root,listeners}=environment();const db=clone(data),commands=[];
 const controller=root.AkiHospitality.create({actor:'u',workspace:{id:'w',currency:'EUR'},isActive:()=>true,refresh(){},toast(){},client:{rpc:async(name,args)=>{
  if(name==='crm_hospitality_overview')return {data:clone(db)};
  if(name==='crm_hospitality_command'){
   commands.push(clone(args.p_command));assert.equal(args.p_command.action,'send');assert.equal(args.p_command.version,2);
   db.orders[0].sent=clone(db.orders[0].lines);db.orders[0].version++;
   return {data:{order_id:'o1',status:'open'}};
  }
  return {error:{message:'Unexpected RPC'}};
 }}});
 controller.render();for(let i=0;i<80;i++)await Promise.resolve();
 await controller.action({dataset:{action:'hp-switch-view',id:'service'}});assert.match(controller.render(),/hp-service-host/);
 await controller.action({dataset:{action:'hp-service-review',id:'o1'}});assert.match(controller.render(),/Preparation changes/);
 await controller.action({dataset:{action:'hp-service-send',order:'o1',version:'2'}});
 assert.equal(commands.length,1);assert.match(controller.render(),/No item changes to send/);
 await controller.action({dataset:{action:'hp-service-open',id:'o2'}});assert.match(controller.render(),/hp-order-open/);
 controller.dispose();assert.equal(listeners.size,0);
});
test('manager favourite settings persist in the existing versioned layout',async()=>{
 const {root}=environment();const db=clone(data);let saved;
 const controller=root.AkiHospitality.create({actor:'manager',workspace:{id:'w'},isActive:()=>true,refresh(){},toast(){},client:{rpc:async(name,args)=>{
  if(name==='crm_hospitality_overview')return {data:clone(db)};
  saved=clone(args.p_command);db.layout=saved.layout;return {data:{layout_version:1}};
 }}});
 controller.render();for(let i=0;i<80;i++)await Promise.resolve();
 await controller.submit({dataset:{form:'hp-menu-product',id:'p2'},fields:[['label','Pint'],['category','drinks'],['color','#112233'],['favourite','on']]});
 assert.equal(saved.action,'layout');assert.equal(saved.version,0);assert.equal(saved.layout.menu.products.p2.favourite,true);assert.equal(saved.layout.menu.products.p1.label,'Café con leche');controller.dispose();
});
test('staff cannot persist manager favourite settings',async()=>{
 const {root}=environment();const db={...clone(data),can_manage:false};let writes=0;const notices=[];
 const controller=root.AkiHospitality.create({actor:'staff',workspace:{id:'w'},isActive:()=>true,refresh(){},toast(...x){notices.push(x.join(' '));},client:{rpc:async(name)=>{if(name==='crm_hospitality_overview')return {data:db};writes++;return {data:{}};}}});
 controller.render();for(let i=0;i<80;i++)await Promise.resolve();
 await controller.submit({dataset:{form:'hp-menu-product',id:'p2'},fields:[['favourite','on']]});
 assert.equal(writes,0);assert.match(notices.join(' '),/Manager permission required/);controller.dispose();
});

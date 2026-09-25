import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from '../cloudflare/node_modules/jsdom/lib/api.js';
const source=readFileSync(new URL('../assets/hospitality-pos.js',import.meta.url),'utf8');
const sample=()=>({layout:{mode:'restaurant',pages:[{id:'p1',name:'Terrace'}],tables:[{id:'t1',name:'12',page:'p1',shape:'circle',x:10,y:20,width:20,height:20,seats:4}]},layout_version:3,can_manage:true,can_export:true,orders:[{id:'order-1',table_id:'t1',label:'Table 12',version:2,lines:[{id:'line-1',item_id:'item-1',name:'Coffee',quantity:2,unit_price_cents:250,note:'No sugar',seat:'1',station:'bar'}],note:'Outside',guests:2,payments:[],total_cents:500,paid_cents:0}],tickets:[],catalogue:[{id:'item-1',name:'Coffee',sale_price_cents:250}]});
async function harness(handler){
 const dom=new JSDOM('<main></main>',{url:'https://hq.example/',runScripts:'outside-only'}),w=dom.window;
 w.navigator.locks={request:async(_k,_o,cb)=>cb({name:'lock'})};w.eval(source);
 const calls=[],messages=[];let snapshot=sample(),controller,active=true;
 const ctx={workspace:{id:'tenant-a',currency:'EUR',name:'Cafe',timezone:'Europe/Madrid'},actor:'owner',isActive:()=>active,toast:(...a)=>messages.push(a),client:{rpc:async(name,args)=>{calls.push({name,args});if(name==='crm_hospitality_overview')return {data:structuredClone(snapshot)};return handler?handler(name,args):{data:{order_id:'order-1'}};}},refresh:()=>{w.document.querySelector('main').innerHTML=controller.render();}};
 controller=w.AkiHospitality.create(ctx);ctx.refresh();await new Promise(r=>setTimeout(r,10));
 return {w,dom,controller,calls,messages,snapshot,render:ctx.refresh,dispose:()=>{controller.dispose();dom.window.close();},active:v=>active=v};
}
test('table selection opens its server order; stale forms keep their original version',async()=>{
 const h=await harness();try{
  assert.match(h.w.document.body.textContent,/Terrace/);
  await h.controller.action(h.w.document.querySelector('[data-action="hp-table"]'));
  const f=h.w.document.querySelector('[data-form="hp-line"]');assert(f);assert.equal(f.dataset.version,'2');
  f.elements.quantity.value='1.5';f.elements.note.value='Extra hot';
  await h.controller.submit(f);
  const c=h.calls.at(-2).args.p_command;assert.equal(c.action,'line');assert.equal(c.version,2);assert.equal(c.quantity,1.5);assert.equal(c.note,'Extra hot');assert.equal(c.station,'bar');
 }finally{h.dispose();}
});
test('ambiguous network failure keeps exact payload; retry never creates another key',async()=>{
 let attempt=0;const h=await harness(async()=>++attempt===1?{error:{message:'Connection lost'}}:{data:{order_id:'order-1'}});
 try{
  await h.controller.action(h.w.document.querySelector('[data-action="hp-table"]'));
  const first=h.calls.find(c=>c.name==='crm_hospitality_command').args;
  assert(h.w.localStorage.getItem('akihq:hospitality:owner:tenant-a'));
  await h.controller.action(h.w.document.querySelector('[data-action="hp-retry"]'));
  const requests=h.calls.filter(c=>c.name==='crm_hospitality_command');assert.deepEqual(requests[1].args,first);assert.equal(h.w.localStorage.length,0);
 }finally{h.dispose();}
});
test('cross-tab lock denial and storage quota failure send no command',async()=>{
 const h=await harness();try{
  h.w.navigator.locks.request=async(_k,_o,cb)=>cb(null);
  await h.controller.action(h.w.document.querySelector('[data-action="hp-open"]'));
  assert.equal(h.calls.filter(c=>c.name==='crm_hospitality_command').length,0);
  h.w.navigator.locks.request=async(_k,_o,cb)=>cb({});
  h.w.Storage.prototype.setItem=()=>{throw Error('Quota exceeded')};
  await h.controller.action(h.w.document.querySelector('[data-action="hp-open"]'));
  assert.equal(h.calls.filter(c=>c.name==='crm_hospitality_command').length,0);
 }finally{h.dispose();}
});
test('ticket HTML escapes notes and includes copy, payment, invoice distinction',async()=>{
 const h=await harness();try{
  const html=h.w.AkiHospitality.ticketHTML({id:'ticket',station:'receipt',kind:'payment',payload:{copy_of:'original',notice:'NO ES FACTURA',total_cents:500,paid_cents:500,order:{label:'Table 12',note:'<script>alert(1)</script>',lines:[{name:'Coffee <img onerror=x>',quantity:2,unit_price_cents:250}],payments:[{method:'cash',amount_cents:500,change_cents:100}]}}},{name:'Cafe',currency:'EUR'},58);
  assert(!html.includes('<script>'));assert(!html.includes('<img'));assert.match(html,/COPY \/ DUPLICADO/);assert.match(html,/NO ES FACTURA/);assert.match(html,/58mm/);assert.match(html,/Change/);
 }finally{h.dispose();}
});
test('printer records an attempt before opening system dialog and cannot print twice',async()=>{
 const ticket={id:'ticket-1',station:'bar',kind:'preparation',payload:{order:{label:'Table 12',lines:[]}}};
 const h=await harness(async(_n,args)=>({data:args.p_command.action==='claim_ticket'?ticket:{}}));
 try{
  let printed=0;const popup={opener:null,document:{write(){},close(){}},focus(){},print(){printed++},close(){}};h.w.open=()=>popup;
  await h.controller.action({dataset:{action:'hp-claim',id:ticket.id}});
  await h.controller.action({dataset:{action:'hp-print80'}});await h.controller.action({dataset:{action:'hp-print80'}});
  assert.equal(printed,1);assert.equal(h.calls.filter(c=>c.args.p_command?.action==='begin_print').length,1);
 }finally{h.dispose();}
});

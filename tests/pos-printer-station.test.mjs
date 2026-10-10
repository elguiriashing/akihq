import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from '../cloudflare/node_modules/jsdom/lib/api.js';

const scripts=['pos-v4.js','pos-v4-dialogs.js','pos-printer-station.js','hospitality-pos.js'].map(name=>readFileSync(new URL('../assets/'+name,import.meta.url),'utf8'));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function harness(){
 const dom=new JSDOM('<main></main>',{url:'https://hq.example/',runScripts:'outside-only'}),w=dom.window;
 let seq=0,controller,settled=false;const commands=[],toasts=[],visits=[];
 const tickets=[
  {id:'a',station:'kitchen',kind:'preparation',status:'queued',order_id:'o',created_at:'2026-10-10T19:00:00Z'},
  {id:'b',station:'bar',kind:'preparation',status:'claimed',order_id:'o',created_at:'2026-10-10T18:50:00Z'},
  {id:'c',station:'receipt',kind:'prebill',status:'uncertain',order_id:'o',created_at:'2026-10-10T18:40:00Z'},
  {id:'d',station:'receipt',kind:'payment',status:'confirmed',order_id:'paid-order',order_status:'closed',created_at:'2026-10-10T18:30:00Z'},
  {id:'e',station:'receipt',kind:'payment',status:'queued',order_id:'paid-order',order_status:'closed',created_at:'2026-10-10T19:01:00Z'},
  {id:'f',station:'receipt',kind:'prebill',status:'superseded',order_id:'paid-order',order_status:'closed',created_at:'2026-10-10T18:25:00Z'},
  {id:'g',station:'kitchen',kind:'preparation',status:'claimed',order_id:'paid-order',order_status:'closed',created_at:'2026-10-10T17:25:00Z'}
 ];
 const data=()=>({layout:{mode:'restaurant',pages:[{id:'f',name:'Floor'}],tables:[]},layout_version:0,orders:settled?[]:[{id:'o',label:'Walk-in',table_id:null,status:'open',version:1,lines:[{id:'one',item_id:'coke',name:'Coke',quantity:1,unit_price_cents:200,station:'bar',note:'',seat:''}],payments:[],total_cents:200,paid_cents:0,guests:1}],recent:[{id:'paid-order',label:'Table 2',status:'closed'},...(settled?[{id:'o',label:'Walk-in',status:'closed'}]:[])],catalogue:[],tickets,can_manage:true,can_export:true});
 Object.defineProperty(w.crypto,'randomUUID',{configurable:true,value:()=> '00000000-0000-4000-a000-'+String(++seq).padStart(12,'0')});
 w.navigator.locks={request:async(_k,_opt,fn)=>fn({})};
 scripts.forEach(src=>w.eval(src));
 const ctx={actor:'u',workspace:{id:'w',name:'Test',currency:'EUR'},isActive:()=>true,toast:(...x)=>toasts.push(x),
  client:{rpc:async(name,args)=>{
   visits.push(name);
   if(name==='crm_hospitality_overview')return{data:structuredClone(data())};
   if(name==='crm_printer_manage')return{data:[{id:'device1',name:'Bar device',revoked_at:null,expires_at:'2026-12-10',last_seen_at:null}]};
   const cmd=args.p_command;commands.push(cmd);
   if(cmd.action==='payment'){
    settled=true;
    for(const ticket of tickets)if(ticket.order_id==='o'&&ticket.status==='queued')ticket.status='superseded';
    tickets.push({id:'final-paid',station:'receipt',kind:'payment',status:'queued',order_id:'o',order_status:'closed',created_at:'2026-10-10T19:40:00Z'});
    return{data:{order_id:'o',status:'closed'}};
   }
   const ticket=tickets.find(t=>t.id===cmd.ticket_id);
   if(cmd.action==='claim_ticket'){
    if(ticket.status!=='queued')return{error:{message:'Already claimed'}};
    ticket.status='claimed';
    return{data:{...ticket,payload:{order:{label:'Table 1',lines:[{name:'Coke',quantity:2,note:'No ice'}]}}}};
   }
   if(cmd.action==='begin_print'){ticket.status='uncertain';return{data:{}}}
   if(cmd.action==='confirm_ticket'){ticket.status='confirmed';return{data:{}}}
   if(cmd.action==='uncertain_ticket'){ticket.status='uncertain';return{data:{}}}
   if(cmd.action==='reprint'){if(String(cmd.reason||'').trim().length<3)return{error:{message:'Reason required'}};tickets.push({id:'copy',station:ticket.station,kind:ticket.kind,status:'queued',created_at:'2026-10-10T19:10:00Z'});return{data:{ticket_id:'copy'}}}
   return{error:{message:'Unexpected command '+cmd.action}};
  }},
  refresh:()=>{w.document.querySelector('main').innerHTML=controller.render()}
 };
 controller=w.AkiHospitality.create(ctx);ctx.refresh();await wait(20);
 return {w,dom,controller,tickets,commands,toasts,close(){controller.dispose();dom.window.close()}};
}
test('three print destinations separate active jobs from settled orders and history',async()=>{
 const h=await harness();try{
  await h.controller.action({dataset:{action:'hp-printer-panel'}});
  const view=h.w.document.body.textContent;
  for(const name of ['Kitchen / Bar','Client Bill Unpaid','Client Bill Paid','History & Review'])assert.match(view,new RegExp(name));
  assert.equal(h.w.document.querySelectorAll('.hp-ps-ticket').length,2);
  await h.controller.action({dataset:{action:'hp-printer-filter',filter:'unpaid'}});
  assert.equal(h.w.document.querySelectorAll('.hp-ps-ticket').length,1);
  assert.match(h.w.document.querySelector('.hp-ps-ticket').textContent,/Client bill · unpaid/);
  await h.controller.action({dataset:{action:'hp-printer-filter',filter:'paid'}});
  assert.equal(h.w.document.querySelectorAll('.hp-ps-ticket').length,1);
  assert.match(h.w.document.querySelector('.hp-ps-ticket').textContent,/Client bill · paid/);
  await h.controller.action({dataset:{action:'hp-printer-filter',filter:'archive'}});
  assert.equal(h.w.document.querySelectorAll('.hp-ps-ticket').length,3);
  assert.match(h.w.document.body.textContent,/Archived after settlement/);
  await h.controller.action({dataset:{action:'hp-printer-select',id:'f'}});
  assert.equal(h.w.document.querySelector('[data-action="hp-claim"]'),null);
  await h.controller.action({dataset:{action:'hp-printer-filter',filter:'kitchen'}});
  const input=h.w.document.querySelector('[data-printer-station]');
  input.value='bar';input.dispatchEvent(new h.w.Event('change',{bubbles:true}));
  assert.equal(h.w.document.querySelectorAll('.hp-ps-ticket').length,1);
 }finally{h.close()}
});
test('claim is required before printing and a ticket cannot be printed twice',async()=>{
 const h=await harness();try{
  await h.controller.action({dataset:{action:'hp-printer-panel'}});
  await h.controller.action({dataset:{action:'hp-printer-filter',filter:'kitchen'}});
  await h.controller.action({dataset:{action:'hp-printer-select',id:'a'}});
  assert.equal(h.w.document.querySelector('[data-action="hp-print80"]'),null);
  await h.controller.action(h.w.document.querySelector('[data-action="hp-claim"]'));
  assert(h.w.document.querySelector('[data-action="hp-print80"]'),JSON.stringify({view:h.w.document.querySelector('.hp-ps-workspace')?.textContent,actions:h.commands,toasts:h.toasts}));
  let count=0;
  h.w.open=()=>({document:{write(){},close(){}},focus(){},print(){count++},close(){},opener:null});
  await h.controller.action(h.w.document.querySelector('[data-action="hp-print80"]'));
  assert.equal(count,1);
  assert.equal(h.w.document.querySelector('[data-action="hp-print80"]'),null);
  assert.equal(h.commands.filter(c=>c.action==='begin_print').length,1);
 }finally{h.close()}
});
test('uncertain ticket requires physical-paper checkbox before confirmation',async()=>{
 const h=await harness();try{
  await h.controller.action({dataset:{action:'hp-printer-panel'}});
  await h.controller.action({dataset:{action:'hp-printer-filter',filter:'unpaid'}});
  await h.controller.action({dataset:{action:'hp-printer-select',id:'c'}});
  await h.controller.action(h.w.document.querySelector('[data-action="hp-printer-confirm"]'));
  assert.equal(h.commands.filter(x=>x.action==='confirm_ticket').length,0);
  assert.match(h.toasts.at(-1).join(' '),/physical paper/);
  h.w.document.querySelector('.hp-ps-paper-check[data-ticket="c"]').checked=true;
  await h.controller.action(h.w.document.querySelector('[data-action="hp-printer-confirm"]'));
  assert.equal(h.commands.filter(x=>x.action==='confirm_ticket').length,1);
  assert.equal(h.tickets.find(t=>t.id==='c').status,'confirmed');
 }finally{h.close()}
});
test('settings separated from queue and untrusted values escaped',async()=>{
 const h=await harness();try{
  await h.controller.action({dataset:{action:'hp-printer-panel'}});
  await h.controller.action({dataset:{action:'hp-printer-view',view:'settings'}});
  assert.match(h.w.document.body.textContent,/Bar device/);
  assert.match(h.w.document.body.textContent,/Last seen: Never/);
  await h.controller.action({dataset:{action:'hp-printer-view',view:'tickets'}});
  assert.match(h.w.document.body.textContent,/Kitchen \/ Bar/);
 }finally{h.close()}
 const root={};new Function('window','globalThis',scripts[2])(root,root);
 const html=root.AkiPrinterStation.render({tickets:[{id:'1" onclick="evil()',station:'kitchen',kind:'<img src=x onerror=evil()>',status:'queued',created_at:'2026-10-10T18:00:00Z'}],tab:'all',station:'all'});
 assert.doesNotMatch(html,/<img src=/);
 assert.doesNotMatch(html,/onclick="evil/);
});

test('settled orders cannot offer stale unpaid or kitchen reprints',async()=>{
 const root={};new Function('window','globalThis',scripts[2])(root,root);
 const tickets=[
  {id:'k',station:'kitchen',kind:'preparation',status:'queued',order_id:'closed',order_status:'closed'},
  {id:'u',station:'receipt',kind:'prebill',status:'superseded',order_id:'closed',order_status:'closed'},
  {id:'p',station:'receipt',kind:'payment',status:'queued',order_id:'closed',order_status:'closed'},
  {id:'partial',station:'receipt',kind:'payment',status:'superseded',order_id:'open',order_status:'open'}
 ];
 const printer=root.AkiPrinterStation;
 assert.equal(printer.filtered(tickets,'kitchen','all').length,0);
 assert.equal(printer.filtered(tickets,'unpaid','all').length,0);
 assert.deepEqual(printer.filtered(tickets,'paid','all').map(x=>x.id),['p']);
 assert.equal(printer.filtered(tickets,'archive','all').length,3);
 const view=printer.render({tickets,tab:'archive',station:'all'});
 assert.doesNotMatch(view,/data-action="hp-claim"/);
});

test('final payment clears active kitchen and unpaid queues but opens the paid bill',async()=>{
 const h=await harness();try{
  await h.controller.action({dataset:{action:'hp-select',id:'o'}});
  await h.controller.action({dataset:{action:'hp-payment-panel'}});
  const form=h.w.document.querySelector('[data-form="hp-payment"]');
  assert(form,'Cash payment form should be shown');
  form.elements.amount.value='2.00';
  form.elements.method.value='cash';
  await h.controller.submit(form);
  assert.equal(h.commands.filter(x=>x.action==='payment').length,1);
  assert.match(h.w.document.querySelector('.hp-ps-header').textContent,/Printer station/);
  assert.equal(h.w.document.querySelector('[data-filter="paid"]').getAttribute('aria-pressed'),'true');
  assert.equal(h.w.document.querySelectorAll('.hp-ps-ticket').length,1);
  assert.match(h.w.document.querySelector('.hp-ps-ticket').textContent,/Client bill · paid/);
  await h.controller.action({dataset:{action:'hp-printer-filter',filter:'kitchen'}});
  assert.equal(h.w.document.querySelectorAll('.hp-ps-ticket').length,0);
  await h.controller.action({dataset:{action:'hp-printer-filter',filter:'unpaid'}});
  assert.equal(h.w.document.querySelectorAll('.hp-ps-ticket').length,0);
  await h.controller.action({dataset:{action:'hp-printer-filter',filter:'archive'}});
  assert(h.w.document.querySelectorAll('.hp-ps-ticket').length>=3);
  assert.equal(h.w.document.querySelector('[data-action="hp-claim"]'),null);
 }finally{h.close()}
});

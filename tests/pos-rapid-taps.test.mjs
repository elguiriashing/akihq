import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from '../cloudflare/node_modules/jsdom/lib/api.js';

const scripts=['pos-v4.js','pos-v4-dialogs.js','hospitality-pos.js'].map(name=>readFileSync(new URL('../assets/'+name,import.meta.url),'utf8'));
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function harness({existing=[],fault=null}={}){
 const dom=new JSDOM('<main></main>',{url:'https://hq.example/',runScripts:'outside-only'});
 const w=dom.window,events=[],orders=[];
 let nextLine=0,sequence=0,lockTail=Promise.resolve(),controller;
 const order={id:'order-1',label:'Table 1',table_id:'t1',version:1,note:'',guests:2,lines:existing.map(x=>({...x})),payments:[],sent:[],paid_cents:0,total_cents:existing.reduce((n,x)=>n+x.quantity*x.unit_price_cents,0)};
 const layout={mode:'restaurant',pages:[{id:'f',name:'Floor'}],tables:[{id:'t1',name:'1',page:'f',shape:'rectangle',x:5,y:5,width:15,height:15,seats:4}]};
 const catalogue=[{id:'coke',name:'Coke',sale_price_cents:200,category:'Drinks'},{id:'beer',name:'Beer',sale_price_cents:250,category:'Drinks'}];
 const snapshot=()=>({layout,layout_version:0,orders:[order],catalogue,tickets:[],can_manage:true,can_export:true});
 w.navigator.locks={request:(key,options,fn)=>{
  if(options?.ifAvailable)throw Error('Unexpected nonblocking Web Lock');
  const next=lockTail.then(()=>fn({name:key}));
  lockTail=next.catch(()=>{});return next;
 }};
 w.crypto.randomUUID=()=> '00000000-0000-4000-a000-'+String(++sequence).padStart(12,'0');
 for(const script of scripts)w.eval(script);
 const ctx={actor:'staff',workspace:{id:'work',name:'Test',currency:'EUR'},isActive:()=>true,
 toast:(...args)=>events.push({type:'toast',args}),
 refresh:()=>{w.document.querySelector('main').innerHTML=controller.render()},
 client:{rpc:async(name,args)=>{
  if(name==='crm_hospitality_overview')return{data:structuredClone(snapshot())};
  if(name!=='crm_hospitality_command')throw Error('Unexpected RPC '+name);
  const c=args.p_command;
  events.push({type:'cmd',key:args.p_key,command:structuredClone(c)});
  if(fault){const response=await fault(c,args.p_key,events);if(response)return response}
  if(c.action!=='open'&&c.version!==order.version)return{error:{message:'Order version changed'}};
  if(c.action==='add'){
   const p=catalogue.find(x=>x.id===c.item_id);
   if(!p)return{error:{message:'No product'}};
   order.lines.push({id:'new-'+(++nextLine),item_id:p.id,name:p.name,quantity:1,unit_price_cents:p.sale_price_cents,note:'',seat:'',station:'kitchen'});
  }else if(c.action==='line'){
   const line=order.lines.find(x=>x.id===c.line_id);
   if(!line)return{error:{message:'Line missing'}};
   Object.assign(line,{quantity:c.quantity,note:c.note,seat:c.seat,station:c.station});
   if(c.quantity===0)order.lines=order.lines.filter(x=>x!==line);
  }else if(c.action==='open')return{data:{order_id:order.id,status:'open'}};
  else return{error:{message:'Unsupported command '+c.action}};
  order.version++;
  order.total_cents=order.lines.reduce((n,x)=>n+x.quantity*x.unit_price_cents,0);
  return{data:{order_id:order.id,status:'open',version:order.version}};
 }}};
 controller=w.AkiHospitality.create(ctx);ctx.refresh();await delay(15);
 await controller.action(w.document.querySelector('[data-action="hp-select"]')||{dataset:{action:'hp-select',id:order.id}});
 return {controller,w,dom,order,events,
  taps:async(id,count)=>{for(let i=0;i<count;i++)await controller.action({dataset:{action:'hp-add',id,order:order.id,version:String(order.version)}})},
  qty:async(id,delta,count)=>{for(let i=0;i<count;i++)await controller.action({dataset:{action:'hp-quick-qty',line:id,delta:String(delta),order:order.id}})},
  wait:async()=>delay(320),close:()=>{controller.dispose();dom.window.close()}
 };
}

test('five rapid Coke taps become a single priced quantity-five line, and later taps extend it',async()=>{
 const h=await harness();try{
  await h.taps('coke',5);await h.wait();
  assert.equal(h.order.lines.length,1);
  assert.equal(h.order.lines[0].quantity,5);
  assert.equal(h.order.total_cents,1000);
  assert.deepEqual(h.events.filter(x=>x.type==='cmd').map(x=>x.command.action),['add','line']);
  await h.taps('coke',3);await h.wait();
  assert.equal(h.order.lines.length,1);
  assert.equal(h.order.lines[0].quantity,8);
  assert.equal(h.order.total_cents,1600);
  assert.equal(h.events.filter(x=>x.type==='toast').length,0);
 }finally{h.close()}
});

test('separate products remain distinct; notes and seat-specific variants are not merged',async()=>{
 const h=await harness({existing:[{id:'custom',item_id:'coke',name:'Coke',quantity:2,unit_price_cents:200,note:'No ice',seat:'4',station:'bar'}]});
 try{
  await h.taps('coke',4);
  await h.taps('beer',2);
  await h.wait();
  assert.equal(h.order.lines.length,3);
  assert.equal(h.order.lines.find(x=>x.id==='custom').quantity,2);
  assert.equal(h.order.lines.find(x=>x.id==='custom').note,'No ice');
  assert.equal(h.order.lines.find(x=>x.item_id==='coke'&&x.id!=='custom').quantity,4);
  assert.equal(h.order.lines.find(x=>x.item_id==='beer').quantity,2);
  assert.equal(h.order.total_cents,1700);
 }finally{h.close()}
});

test('rapid +/- uses one latest-version mutation and cannot make quantity negative',async()=>{
 const h=await harness({existing:[{id:'plain',item_id:'coke',name:'Coke',quantity:2,unit_price_cents:200,note:'',seat:'',station:'kitchen'}]});
 try{
  await h.qty('plain',1,7);await h.wait();
  assert.equal(h.order.lines[0].quantity,9);
  assert.equal(h.events.filter(x=>x.type==='cmd').length,1);
  await h.qty('plain',-1,4);await h.wait();
  assert.equal(h.order.lines[0].quantity,5);
  await h.taps('coke',3);await h.wait();
  assert.equal(h.order.lines[0].quantity,8);
  assert.equal(h.order.lines.length,1);
 }finally{h.close()}
});

test('ambiguous result is never blindly replayed; pending command requires explicit recovery',async()=>{
 let once=true;
 const h=await harness({fault:async c=>{if(c.action==='add'&&once){once=false;return{error:{message:'Connection lost after request'}}}return null}});
 try{
  await h.taps('coke',4);await h.wait();
  assert.equal(h.events.filter(x=>x.type==='cmd').length,1);
  assert.ok(h.w.localStorage.getItem('akihq:hospitality:staff:work'));
  assert.ok(h.events.some(x=>x.type==='toast'&&x.args.join(' ').includes('Check the bill')));
  await h.controller.action({dataset:{action:'hp-add',id:'coke',order:h.order.id}});
  assert.equal(h.events.filter(x=>x.type==='cmd').length,1);
  assert.match(h.w.document.querySelector('main').textContent,/Request awaiting confirmation/);
 }finally{h.close()}
});

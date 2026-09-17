import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
const source=readFileSync(new URL('../assets/company-manager.js',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function waitFor(fn){for(let i=0;i<100;i++){if(fn())return;await tick();}throw new Error('UI state did not settle');}
function harness(){
 const dom=new JSDOM('<!doctype html><main></main>',{url:'https://crm.example/',runScripts:'outside-only'}),w=dom.window;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const calls=[],batchOffsets=[];let failedOnce=false,saved=false;
 const job={id:'job-1',total_rows:501,processed:0,inserted:0,duplicates:0,invalid:0,status:'running'};
 w.Worker=class {
   terminate(){}
   postMessage({id,action,payload}){queueMicrotask(()=>{
     let result;
     if(action==='open')result={sheets:['Coverage','Companies','Municipalities','Read me'],hash:'a'.repeat(64)};
     if(action==='sheet')result={headers:['id','name','address','type'],total:501,mapping:{name:1,address:2,city:-1,email:-1,website:-1,phone:-1,type:3,source:-1,externalId:0}};
     if(action==='preview')result={total:501,valid:501,invalid:0,sample:[{sourceRow:2,displayName:'<img src=x onerror=alert(1)>',address:'Calle Test 1',city:'Madrid'}]};
     if(action==='batch')result=Array.from({length:Math.min(250,501-payload.offset)},(_,i)=>({name:'Company '+(payload.offset+i),address:'Calle '+(payload.offset+i)}));
     this.onmessage({data:{id,result}});
   });}
 };
 const client={rpc:async(name,args)=>{
   calls.push({name,args});
   if(name==='crm_company_list')return {data:{total:0,rows:[]}};
   if(name==='crm_company_import_start')return {data:{...job}};
   if(name==='crm_company_import_batch'){
     batchOffsets.push(args.p_offset);
     if(args.p_offset===0&&!saved){saved=true;job.processed=250;job.inserted=250;}
     if(!failedOnce){failedOnce=true;return {error:{message:'Connection lost after commit'}};}
     if(args.p_offset>0){job.processed+=args.p_rows.length;job.inserted+=args.p_rows.length;}
     if(job.processed===501)job.status='complete';return {data:{...job}};
   }
   throw new Error('Unexpected RPC '+name);
 }};
 w.eval(source);const manager=w.createCompanyManager({allowed:()=>true,admin:()=>true,client:()=>client,toast(){}});
 const click=a=>w.document.querySelector(`[data-company-action="${a}"]`).click();
 return {w,dom,manager,calls,batchOffsets,click};
}
test('UI requires explicit sheet and preview, escapes cells and resumes an uncertain committed batch without duplicating',async()=>{
 const h=harness();h.manager.openImport();
 const input=h.w.document.querySelector('[data-company-file]');Object.defineProperty(input,'files',{value:[{name:'Spain.xlsx',size:12000000,arrayBuffer:async()=>new ArrayBuffer(16)}]});
 input.dispatchEvent(new h.w.Event('change',{bubbles:true}));await waitFor(()=>h.w.document.querySelector('[data-company-sheet]'));
 assert.equal(h.w.document.querySelector('[data-company-sheet]').value,'');assert.equal(h.calls.length,0);
 assert.equal(h.w.document.querySelector('[data-company-action="commit"]'),null);
 const select=h.w.document.querySelector('[data-company-sheet]');select.value='Companies';select.dispatchEvent(new h.w.Event('change',{bubbles:true}));await waitFor(()=>h.w.document.querySelector('[data-company-action="preview"]'));
 h.click('preview');await waitFor(()=>h.w.document.querySelector('[data-company-action="commit"]'));
 assert.equal(h.w.document.querySelector('img'),null);assert.match(h.w.document.body.textContent,/<img src=x/);assert.equal(h.calls.length,0);
 h.click('commit');await waitFor(()=>h.w.document.querySelector('[role="alert"]'));
 assert.match(h.w.document.body.textContent,/Connection lost/);assert.match(h.w.document.body.textContent,/Progress is saved/);
 h.click('resume');await waitFor(()=>h.w.document.body.textContent.includes('Import complete.'));
 assert.deepEqual(h.batchOffsets,[0,0,250,500]);assert.match(h.w.document.body.textContent,/501 added/);
 assert.equal(h.calls.filter(c=>c.name==='crm_company_import_start').length,1);
 h.click('close');h.dom.window.close();
});

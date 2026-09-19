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
test('legacy Import Excel button is intercepted before the 10 MB gateway handler',async()=>{
 const h=harness();const legacy=h.w.document.createElement('button');legacy.dataset.action='open-prospect-import';legacy.textContent='Import Excel';h.w.document.body.append(legacy);
 legacy.click();await waitFor(()=>h.w.document.querySelector('[data-company-file]'));
 assert.match(h.w.document.body.textContent,/up to 50 MB/);h.dom.window.close();
});

function publishHarness(total=250,concurrency=100,faults={}){
 const dom=new JSDOM('<!doctype html><main></main>',{url:'https://crm.example/',runScripts:'outside-only'}),w=dom.window;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 let clock=0;const timers=[];w.Date.now=()=>clock;w.setTimeout=fn=>{timers.push(fn);return timers.length;};
 const advance=ms=>{clock+=ms;timers.splice(0).forEach(fn=>fn());};
 const requests=[],finished=[];let next=0,inFlight=0,peak=0;
 const client={rpc:async(name,args)=>{
   if(name==='crm_company_list')return {data:{total:0,rows:[]}};
   if(faults[name])return {error:{message:faults[name],code:'57014'}};
   if(name==='crm_company_publish_claim')return {data:next<total?{id:String(++next),token:'lease-'+next,data:{id:String(next)}}:null};
   if(name==='crm_company_publish_finish'){finished.push(args);return {data:{published:!args.p_error}};}
   throw new Error(name);
 }};
 w.eval(source);
 const manager=w.createCompanyManager({allowed:()=>true,admin:()=>true,client:()=>client,toast(){},request:(_path,options)=>new Promise((resolve,reject)=>{
   inFlight++;peak=Math.max(peak,inFlight);
   requests.push({id:options.body.company.id,done(error,result){inFlight--;error?reject(typeof error==="object"?error:new Error(error)):resolve(result||{data:{}});}});
 })});
 const click=a=>w.document.querySelector(`[data-company-action="${a}"]`).click();
 manager.publish();if(concurrency!==null)w.document.querySelector('[data-company-concurrency]').value=String(concurrency);click('run-publish');
 return {dom,w,manager,requests,finished,click,advance,get peak(){return peak;},get claims(){return next;}};
}
test('publisher defaults to 50 and applies a smaller user limit after pausing',async()=>{
 const h=publishHarness(250,null);await waitFor(()=>h.requests.length===50);
 assert.equal(h.w.document.querySelector('[data-company-concurrency]').value,'50');
 assert.equal(h.w.document.querySelector('[data-company-concurrency]').disabled,true);
 h.click('pause');for(const r of h.requests)r.done();
 await waitFor(()=>h.w.document.querySelector('[data-company-action="run-publish"]'));
 const input=h.w.document.querySelector('[data-company-concurrency]');assert.equal(input.disabled,false);
 input.value='7';input.dispatchEvent(new h.w.Event('change',{bubbles:true}));h.click('run-publish');
 await waitFor(()=>h.requests.length===57);await tick();assert.equal(h.requests.length,57);
 assert.match(h.w.document.body.textContent,/Current limit: 7/);
 h.click('pause');for(const r of h.requests.slice(50))r.done();
 await waitFor(()=>h.w.document.querySelector('[data-company-action="run-publish"]'));h.dom.window.close();
});
test('invalid concurrency cannot claim or publish companies',async()=>{
 for(const value of ['',0,-1,101,2.5]){
  const h=publishHarness(10,value);await tick();
  assert.equal(h.claims,0);assert.equal(h.requests.length,0);
  assert.match(h.w.document.body.textContent,/Enter a whole number from 1 to 100/);h.dom.window.close();
 }
});
test('publisher uses one hundred leased workers, continues after address failure and finishes each company once',async()=>{
 const h=publishHarness();await waitFor(()=>h.requests.length===100);
 h.requests[0].done("The agent's normalized address could not be confirmed by the authoritative Spanish address provider.");
 await waitFor(()=>h.requests.length===101);
 for(let i=1;i<250;i++){await waitFor(()=>h.requests[i]);h.requests[i].done();}
 await waitFor(()=>h.w.document.body.textContent.includes('No more pending'));
 assert.equal(h.peak,100);assert.equal(h.finished.length,250);
 assert.equal(new Set(h.finished.map(r=>r.p_id)).size,250);
 assert.match(h.w.document.body.textContent,/249 published or linked · 1 need review/);
 h.dom.window.close();
});
test('pause drains current checks before resume and prevents new claims',async()=>{
 const h=publishHarness();await waitFor(()=>h.requests.length===100);h.click('pause');
 h.requests[0].done();await tick();assert.equal(h.requests.length,100);
 assert.equal(h.w.document.querySelector('[data-company-action="run-publish"]'),null);
 for(let i=1;i<100;i++)h.requests[i].done();await waitFor(()=>h.w.document.querySelector('[data-company-action="run-publish"]'));
 assert.equal(h.claims,100);h.click('run-publish');await waitFor(()=>h.requests.length===200);
 h.click('pause');for(let i=100;i<200;i++)h.requests[i].done();
 await waitFor(()=>h.finished.length===200);assert.equal(h.peak,100);h.dom.window.close();
});
test('service failure stops new claims, drains workers and leaves failed lease retryable',async()=>{
 const h=publishHarness();await waitFor(()=>h.requests.length===100);
 h.requests[0].done('Gateway request failed (401).');await tick();
 assert.equal(h.w.document.querySelector('[data-company-action="run-publish"]'),null);
 for(let i=1;i<100;i++)h.requests[i].done();await waitFor(()=>h.w.document.querySelector('[data-company-action="run-publish"]'));
 assert.equal(h.claims,100);assert.equal(h.finished.length,99);assert.ok(h.finished.every(r=>r.p_id!=='1'));
 assert.match(h.w.document.body.textContent,/401/);h.dom.window.close();
});
test('provider outage cools down globally and retries the same lease automatically',async()=>{
 const h=publishHarness(2);await waitFor(()=>h.requests.length===2);
 h.requests[0].done('The Spanish address provider is unavailable.');
 h.requests[1].done('Gateway request failed (429).');await tick();
 assert.equal(h.finished.length,0);assert.equal(h.requests.length,2);
 assert.match(h.w.document.body.textContent,/reduced to 80/);
 h.advance(15000);await waitFor(()=>h.requests.length===4);
 assert.deepEqual(h.requests.slice(2).map(r=>r.id).sort(),['1','2']);
 h.requests[2].done();h.requests[3].done();
 await waitFor(()=>h.w.document.body.textContent.includes('No more pending'));
 assert.equal(h.finished.length,2);h.dom.window.close();
});
test('manual pause interrupts cooldown without sending a retry',async()=>{
 const h=publishHarness(1);await waitFor(()=>h.requests.length===1);
 h.requests[0].done('The Spanish address provider is unavailable.');await tick();
 h.click('pause');h.advance(250);
 await waitFor(()=>h.w.document.querySelector('[data-company-action="run-publish"]'));
 assert.equal(h.requests.length,1);assert.equal(h.finished.length,0);h.dom.window.close();
});
test('persistent provider outage has bounded retries and preserves the failed lease',async()=>{
 const h=publishHarness(1);
 for(let i=0;i<5;i++){
  await waitFor(()=>h.requests.length===i+1);h.requests[i].done('The Spanish address provider is unavailable.');await tick();
  if(i<4)h.advance([15000,30000,60000,120000][i]);
 }
 await waitFor(()=>h.w.document.querySelector('[data-company-action="run-publish"]'));
 assert.equal(h.requests.length,5);assert.equal(h.finished.length,0);h.dom.window.close();
});
test('workspace reset prevents stale workers from finishing or updating the new dialog',async()=>{
 const h=publishHarness();await waitFor(()=>h.requests.length===100);
 h.manager.reset();h.manager.publish();for(const r of h.requests)r.done();await tick();await tick();
 assert.equal(h.claims,100);assert.equal(h.finished.length,0);
 assert.match(h.w.document.body.textContent,/0 checked in this session/);h.dom.window.close();
});

test('diagnostics identify publishing failures, escape original errors, and preserve failure counts',async()=>{
 const h=publishHarness(1,1);await waitFor(()=>h.requests.length===1);
 h.requests[0].done('Gateway request failed (429). <img src=x onerror=alert(1)>');await tick();
 assert.match(h.w.document.body.textContent,/HTTP rate limit; originating service not confirmed/);
 assert.match(h.w.document.body.textContent,/HTTP 429/);
 assert.match(h.w.document.body.textContent,/Publishing diagnostics/);
 assert.equal(h.w.document.querySelector('img'),null);
 assert.ok(h.w.document.querySelector('[data-company-action="diagnostics"]'));
 h.click('pause');h.advance(250);await waitFor(()=>h.w.document.querySelector('[data-company-action="run-publish"]'));h.dom.window.close();
});

test('healthy checks gradually recover concurrency without exceeding the selected maximum',async()=>{
 const h=publishHarness(400,10);await waitFor(()=>h.requests.length===10);
 let cursor=1;h.requests[0].done('Gateway request failed (429).');await tick();
 assert.match(h.w.document.body.textContent,/Current limit: 8/);
 for(;cursor<10;cursor++)h.requests[cursor].done();await tick();
 h.advance(15000);await tick();h.advance(30000);await tick();
 for(let i=0;i<80;i++){
   const end=h.requests.length;for(;cursor<end;cursor++)h.requests[cursor].done();
   await tick();h.advance(10000);await tick();
   if(h.w.document.body.textContent.includes('Current limit: 10'))break;
 }
 assert.match(h.w.document.body.textContent,/Current limit: 10/);
 assert.match(h.w.document.body.textContent,/Increased to 10/);
 assert.ok(h.peak<=10);
 h.click('pause');const end=h.requests.length;for(;cursor<end;cursor++)h.requests[cursor].done();h.advance(250);
 await waitFor(()=>h.w.document.querySelector('[data-company-action="run-publish"]'));h.dom.window.close();
});

test('database save timeout is identified and never treated as an invalid address',async()=>{
 const h=publishHarness(1,1,{crm_company_publish_finish:'canceling statement due to statement timeout'});
 await waitFor(()=>h.requests.length===1);h.requests[0].done();
 await waitFor(()=>h.w.document.querySelector('[data-company-action="run-publish"]'));
 assert.match(h.w.document.body.textContent,/Latest failure: Database save/);
 assert.match(h.w.document.body.textContent,/57014/);
 assert.equal(h.finished.length,0);
 assert.match(h.w.document.body.textContent,/0 checked in this session/);h.dom.window.close();
});

test('two isolated provider errors keep 100 checks and retry only the same companies',async()=>{
 const h=publishHarness(100,100);await waitFor(()=>h.requests.length===100);
 h.requests[0].done('The Spanish address provider is unavailable.');
 for(let i=1;i<99;i++)h.requests[i].done();await tick();
 assert.match(h.w.document.body.textContent,/Current limit: 100/);
 h.advance(2000);await waitFor(()=>h.requests.length===101);h.requests[100].done();await tick();
 h.advance(36000);h.requests[99].done('The Spanish address provider is unavailable.');await tick();
 assert.match(h.w.document.body.textContent,/Current limit: 100/);
 assert.match(h.w.document.body.textContent,/0 slowdowns/);
 h.advance(2000);await waitFor(()=>h.requests.length===102);h.requests[101].done();
 await waitFor(()=>h.w.document.body.textContent.includes('No more pending'));
 assert.equal(h.finished.length,100);assert.equal(new Set(h.finished.map(r=>r.p_id)).size,100);
 assert.equal(h.requests[100].id,'1');assert.equal(h.requests[101].id,'100');h.dom.window.close();
});

test('a cluster of provider failures reduces concurrency once by 20 percent',async()=>{
 const h=publishHarness(10,100);await waitFor(()=>h.requests.length===10);
 for(let i=0;i<5;i++)h.requests[i].done('The Spanish address provider is unavailable.');await tick();
 assert.match(h.w.document.body.textContent,/Current limit: 80/);
 assert.match(h.w.document.body.textContent,/1 slowdowns/);
 h.click('pause');for(let i=5;i<10;i++)h.requests[i].done();h.advance(250);
 await waitFor(()=>h.w.document.querySelector('[data-company-action="run-publish"]'));h.dom.window.close();
});

test('five failures in one hundred completed attempts do not reduce concurrency',async()=>{
 const h=publishHarness(100,100);await waitFor(()=>h.requests.length===100);
 for(let i=0;i<95;i++)h.requests[i].done();await tick();
 for(let i=95;i<100;i++)h.requests[i].done('Gateway request failed (503).');await tick();
 assert.match(h.w.document.body.textContent,/Current limit: 100/);
 assert.match(h.w.document.body.textContent,/0 slowdowns/);
 h.click('pause');h.advance(250);await waitFor(()=>h.w.document.querySelector('[data-company-action="run-publish"]'));h.dom.window.close();
});

test('explicit Retry-After extends a shared cooldown without stacking reductions',async()=>{
 const h=publishHarness(2,100);await waitFor(()=>h.requests.length===2);
 h.requests[0].done(Object.assign(new Error('Provider throttled'),{status:429,retryAfterMs:20000}));await tick();
 h.advance(1000);
 h.requests[1].done(Object.assign(new Error('Provider throttled'),{status:429,retryAfterMs:60000}));await tick();
 assert.match(h.w.document.body.textContent,/Current limit: 80/);
 assert.match(h.w.document.body.textContent,/1 slowdowns/);
 h.advance(59000);await tick();assert.equal(h.requests.length,2);
 h.advance(1000);await waitFor(()=>h.requests.length===4);
 h.requests[2].done();h.requests[3].done();await waitFor(()=>h.w.document.body.textContent.includes('No more pending'));
 assert.equal(h.finished.length,2);h.dom.window.close();
});

test('budget failure in HTTP-success body pauses without misclassifying the company',async()=>{
 const h=publishHarness(1,1);await waitFor(()=>h.requests.length===1);
 h.requests[0].done(null,{data:{reason:'AI monthly budget exhausted'}});
 await waitFor(()=>h.w.document.querySelector('[data-company-action="run-publish"]'));
 assert.equal(h.finished.length,0);
 assert.match(h.w.document.body.textContent,/AkiPasa internal AI budget reached/);
 h.dom.window.close();
});
test('AI concurrency failure in HTTP-success body retries rather than saving a bad address',async()=>{
 const h=publishHarness(1,1);await waitFor(()=>h.requests.length===1);
 h.requests[0].done(null,{data:{reason:'AI concurrency limit reached'}});
 await tick();assert.equal(h.finished.length,0);h.advance(2000);
 await waitFor(()=>h.requests.length===2);h.requests[1].done();
 await waitFor(()=>h.finished.length===1);h.dom.window.close();
});
test('bulk review queues once and does not endlessly retry unresolved companies',async()=>{
 const dom=new JSDOM('<!doctype html><main></main>',{url:'https://crm.example/',runScripts:'outside-only'}),w=dom.window;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 let queued=0,claims=0,saves=0;
 const client={rpc:async(name,args)=>{
   if(name==='crm_company_review_retry')return {data:args.p_requeue?(queued++,{queued:1,cursor:7,done:true}):{count:1,until:7,spent:3.97,limit:4}};
   if(name==='crm_company_publish_claim')return {data:claims++===0?{id:'a',token:'t',data:{id:'a'}}:null};
   if(name==='crm_company_publish_finish'){saves++;return {data:{published:false}};}
   if(name==='crm_company_list')return {data:{rows:[],total:1}};
   throw new Error(name);
 }};
 w.eval(source);const manager=w.createCompanyManager({allowed:()=>true,admin:()=>true,client:()=>client,request:async()=>({data:{reason:'Address still ambiguous'}})});
 await manager.publish(true);assert.match(w.document.body.textContent,/€3.9700 \/ €4.00/);
 w.document.querySelector('[data-company-action="run-publish"]').click();
 await waitFor(()=>w.document.body.textContent.includes('No more pending companies'));
 assert.equal(queued,1);assert.equal(saves,1);assert.equal(w.document.querySelector('[data-company-concurrency]').value,'2');
 dom.window.close();
});

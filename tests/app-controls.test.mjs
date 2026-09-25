import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(new URL('../cloudflare/package.json',import.meta.url));
const { JSDOM } = require('jsdom');
const appSource = await readFile(new URL('../assets/app-v32.js',import.meta.url),'utf8');
const sessionSource = await readFile(new URL('../assets/checkout-session.js',import.meta.url),'utf8');
const user='00000000-0000-4000-8000-000000000001';
const otherUser='00000000-0000-4000-8000-000000000002';
const item='10000000-0000-4000-8000-000000000001';
const product='inventory-product-a';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const plain=value=>JSON.parse(JSON.stringify(value));
const pendingKey=(who=user,workspace='workspace-a')=>`akihq:pending-sale:v1:${who}:${workspace}`;

// The real IIFE and checkout functions execute in jsdom. Replace only its final
// boot call in the TEST copy to expose closures and stub unrelated rendering /
// data loading. No test hook is added to a production JavaScript file.
const seam=`
  const testOriginalLiveLoader=loadLiveData;
  const testOriginalCommerceLoader=loadCommerceData;
  window.__controls = {
    initialize(client) {
      authUser={id:'${user}'}; authRole='user'; state=seedState();
      state.workspace={...state.workspace,id:'workspace-a',currency:'EUR',toolKeys:['pos','inventory'],canOperate:true};
      state.currentUserId=authUser.id;
      state.products=[{id:'${product}',inventoryItemId:'${item}',name:'Coffee',price:2.50,stock:100,status:'Active',unit:'unit',sku:'A'}];
      ui.posCart={'${product}':1}; ui.posTender='cash'; ui.posBusy=false;
      getSupabaseClient=()=>client;
      render=()=>{window.__effects.renders++;};
      requestBackgroundRender=()=>{window.__effects.renders++;};
      store.save=()=>{window.__effects.saves++;};
      toast=(...args)=>window.__effects.toasts.push(args);
      downloadBlob=(name,blob)=>window.__effects.downloads.push({name,size:blob.size});
      loadLiveData=async()=>{window.__effects.loads++; if(window.__loadHook) await window.__loadHook();};
    },
    complete:completePOSSale, pending:pendingPOSSale, paintPOS:renderPOS,
    accessible:loadAccessibleWorkspaces, bootSession:bootWithSession,
    pullDurable:syncDurableRecordsPull,
    pushSnapshot:version=>pushWorkspaceSnapshot(version),
    gateway:(path,options)=>socialGatewayRequest(path,options),
    binaryGateway:(path,file,headers)=>socialGatewayBinaryRequest(path,file,headers),
    exportRecords:exportCommerceRecords,
    persistence:()=>({baseline:lastRemoteWorkspaceUpdate,error:workspaceSaveError,committed:workspaceCommittedVersion,mutation:workspaceMutationVersion,durableCommitted:durableRecordCommittedVersion,durableMutation:durableRecordMutationVersion}),
    loadOriginal:()=>testOriginalLiveLoader(),
    loadCommerceOriginal:(client)=>testOriginalCommerceLoader(client),
    prepareDirectoryTest() {
      syncCloudWorkspacePull=async()=>{};
      loadCommerceData=async()=>{window.__effects.commerceLoads++;};
      requestBackgroundRender=()=>{window.__effects.renders++;};
      store.save=()=>{window.__effects.saves++;};
    },
    collections:()=>({companies:state.companies,employees:state.employees,products:state.products,events:state.events,knowledge:state.knowledge}),
    read:()=>({workspace:state.workspace.id,user:authUser?.id,busy:ui.posBusy,cart:ui.posCart}),
    set(options) {
      if('workspace' in options) state.workspace={...state.workspace,id:options.workspace};
      if('user' in options) authUser=options.user?{id:options.user}:null;
      if('cart' in options) ui.posCart=options.cart;
      if('busy' in options) ui.posBusy=options.busy;
      if('canOperate' in options) state.workspace.canOperate=options.canOperate;
      if('canExport' in options) state.workspace.canExport=options.canExport;
      if('exportTools' in options) state.workspace.exportToolKeys=options.exportTools;
      if('tools' in options) state.workspace.toolKeys=options.tools;
      if('price' in options) state.products[0].price=options.price;
      if('tender' in options) ui.posTender=options.tender;
      if('employees' in options) state.employees=options.employees;
      if('companies' in options) state.companies=options.companies;
      if('events' in options) state.events=options.events;
      if('knowledge' in options) state.knowledge=options.knowledge;
      if('baseline' in options) lastRemoteWorkspaceUpdate=options.baseline;
      if('saveError' in options) workspaceSaveError=options.saveError;
      if('committed' in options) workspaceCommittedVersion=options.committed;
      if('mutation' in options) workspaceMutationVersion=options.mutation;
      if('durableCommitted' in options) durableRecordCommittedVersion=options.durableCommitted;
      if('durableMutation' in options) durableRecordMutationVersion=options.durableMutation;
      if(options.replaceState) state={...state,workspace:{...state.workspace}};
    },
    logout() { clearSignedOutDeviceCache(authUser.id); authUser=null; authRole=null; },
  };
})();`;
assert.equal((appSource.match(/  boot\(\);\s*\}\)\(\);\s*$/g)||[]).length,1,'test seam must target only final boot');
const testSource=appSource.replace(/  boot\(\);\s*\}\)\(\);\s*$/,seam);

function lockManager() {
  const active=new Set();
  return {
    active,
    async request(name,options,callback) {
      if (typeof options==='function') { callback=options; options={}; }
      if(active.has(name)) {
        if(options.ifAvailable) return callback(null);
        throw new Error('A checkout must not queue automatically behind another tab');
      }
      active.add(name);
      try { return await callback({name,mode:'exclusive'}); }
      finally { active.delete(name); }
    }
  };
}
function setup(t,handler,{locks=lockManager(),sharedStorage,queryHandler}={}) {
  const dom=new JSDOM('<main id="app"></main><div id="portal"></div><input id="import-file" type="file"><input id="media-file" type="file">',{
    url:'https://qa.akihq.example/#/pos',runScripts:'outside-only'
  });
  t.after(()=>dom.window.close());
  const {window}=dom;
  window.structuredClone=structuredClone;
  window.Headers=globalThis.Headers;
  window.AKIHQ_CONFIG={SOCIAL_GATEWAY_URL:'https://gateway.qa.example'};
  window.createCompanyManager=()=>({reset(){}});
  window.createSupportDesk=()=>({reset(){}});
  window.setInterval=()=>0;
  if(sharedStorage) Object.defineProperty(window,'localStorage',{value:sharedStorage});
  Object.defineProperty(window.navigator,'locks',{value:locks,configurable:true});
  window.__effects={renders:0,loads:0,toasts:[],commerceLoads:0,saves:0,downloads:[]};
  window.eval(sessionSource); window.eval(testSource);
  const calls=[];
  const client={rpc:async(name,payload)=>{
    calls.push({name,payload:plain(payload)});
    return handler?handler(name,payload,calls.length):{data:'sale-confirmed',error:null};
  },from(table) {
    const filters=[];
    const query={
      select(){return query;},eq(key,value){filters.push([key,value]);return query;},order(){return query;},limit(){return query;},in(){return query;},
      then(onFulfilled,onRejected){return Promise.resolve(queryHandler?queryHandler(table,filters):{data:[],error:null}).then(onFulfilled,onRejected);}
    };
    return query;
  }};
  window.__controls.initialize(client);
  return {window,api:window.__controls,calls,effects:window.__effects,locks,client};
}

test('the real checkout stages the original payload and retries it after uncertain transport failure',async t=>{
  const ui=setup(t,(_name,_payload,n)=>n===1?Promise.reject(new Error('Connection lost')):{data:'sale-confirmed',error:null});
  await ui.api.complete();
  const pending=plain(ui.api.pending());
  assert.equal(ui.calls.length,1);
  assert.deepEqual(ui.calls[0].payload,pending);
  ui.api.set({price:99,tender:'card',cart:{[product]:7}});
  await ui.api.complete();
  assert.equal(ui.calls.length,2);
  assert.deepEqual(ui.calls[1].payload,pending);
  assert.equal(ui.api.pending(),null);
  assert.deepEqual(plain(ui.api.read().cart),{});
  assert.equal(ui.effects.loads,1);
});

test('permission, conflicting-key and generic database rejections preserve uncertain request identity',async t=>{
  for(const code of ['42501','22023','P0001','23505','25001']) {
    const ui=setup(t,()=>({data:null,error:{code,message:'Needs reconciliation'}}));
    await ui.api.complete(); const original=plain(ui.api.pending());
    assert.ok(original);
    await ui.api.complete();
    assert.deepEqual(ui.calls[1].payload,original);
    assert.deepEqual(plain(ui.api.pending()),original);
  }
});

test('only server-proven no-record rejection clears a request and refreshes catalogue for confirmation',async t=>{
  const ui=setup(t,()=>({data:null,error:{code:'P0N01',message:'Catalogue price changed'}}));
  await ui.api.complete();
  assert.equal(ui.api.pending(),null);
  assert.equal(ui.effects.loads,1);
  assert.equal(ui.calls.length,1);
  assert.deepEqual(plain(ui.api.read().cart),{[product]:1});
});

test('a response without a sale ID leaves the pending request recoverable',async t=>{
  const ui=setup(t,()=>({data:null,error:null}));
  await ui.api.complete();
  assert.ok(ui.api.pending());
  assert.equal(ui.effects.loads,0);
  assert.match(ui.effects.toasts.at(-1)[1],/No sale confirmation/);
});

test('late success after switching workspace cannot clear another cart, reload it or change its busy state',async t=>{
  let finish;
  const ui=setup(t,()=>new Promise(resolve=>{finish=resolve;}));
  const pending=ui.api.complete(); await tick();
  const originalKey=pendingKey(); assert.ok(ui.window.localStorage.getItem(originalKey));
  ui.api.set({workspace:'workspace-b',cart:{other:8},busy:true});
  const effectsBefore=plain(ui.effects);
  finish({data:'sale-confirmed',error:null}); await pending;
  assert.equal(ui.window.localStorage.getItem(originalKey),null);
  assert.deepEqual(plain(ui.api.read()),{workspace:'workspace-b',user,busy:true,cart:{other:8}});
  assert.deepEqual(ui.effects,effectsBefore);
});

test('late failure after logout preserves reconciliation evidence without rendering an authenticated shell',async t=>{
  let fail;
  const ui=setup(t,()=>new Promise((_resolve,reject)=>{fail=reject;}));
  const pending=ui.api.complete(); await tick();
  ui.api.logout(); const effectsBefore=plain(ui.effects);
  fail(new Error('Previous workspace private error')); await pending;
  assert.ok(ui.window.localStorage.getItem(pendingKey()));
  assert.deepEqual(ui.effects,effectsBefore);
});

test('overlapping checkout in a second tab fails visibly rather than queued stale-cart submission',async t=>{
  const data=new Map(),sharedStorage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key)};
  const locks=lockManager(); let finish;
  const first=setup(t,()=>new Promise(resolve=>{finish=resolve;}),{locks,sharedStorage});
  const second=setup(t,undefined,{locks,sharedStorage});
  const firstCall=first.api.complete(); await tick();
  await second.api.complete();
  assert.equal(second.calls.length,0);
  assert.match(second.effects.toasts.at(-1)?.join(' ')||'',/progress|another|checkout|till/i);
  finish({data:'sale-confirmed',error:null}); await firstCall;
  assert.equal(first.calls.length,1);
  assert.equal(second.calls.length,0);
});

test('unavailable locks, revoked operate permission and damaged storage never submit a sale',async t=>{
  const unlocked=setup(t); Object.defineProperty(unlocked.window.navigator,'locks',{value:null});
  await assert.rejects(unlocked.api.complete(),/safely coordinate/); assert.equal(unlocked.calls.length,0);
  const viewer=setup(t); viewer.api.set({canOperate:false}); await viewer.api.complete(); assert.equal(viewer.calls.length,0);
  const denied=setup(t); denied.api.set({tools:[]}); await denied.api.complete(); assert.equal(denied.calls.length,0);
  const damaged=setup(t); damaged.window.localStorage.setItem(pendingKey(),'{bad');
  await assert.rejects(damaged.api.complete(),/damaged/); assert.equal(damaged.calls.length,0);
});

test('pending recovery remains visible even with an empty cart',async t=>{
  const ui=setup(t,()=>({data:null,error:{code:'42501',message:'Access changed'}}));
  await ui.api.complete(); ui.api.set({cart:{}});
  ui.window.document.getElementById('app').innerHTML=ui.api.paintPOS();
  assert.match(ui.window.document.getElementById('app').textContent,/Sale awaiting confirmation/);
  const buttons=[...ui.window.document.querySelectorAll('[data-action="pos-checkout"]')];
  assert.ok(buttons.some(button=>!button.disabled&&/Retry pending/.test(button.textContent)));
});

test('logout removes workspace caches but retains pending sale evidence only under its original user key',async t=>{
  const ui=setup(t,()=>({data:null,error:{code:'42501',message:'Access changed'}}));
  await ui.api.complete();
  ui.window.localStorage.setItem(`akihq:workspace-cache:v3:${user}:workspace-a`,'private-data');
  ui.api.logout();
  assert.equal(ui.window.localStorage.getItem(`akihq:workspace-cache:v3:${user}:workspace-a`),null);
  assert.ok(ui.window.localStorage.getItem(pendingKey()));
  ui.api.set({user:otherUser,workspace:'workspace-a'});
  assert.equal(ui.api.pending(),null);
});

test('late directory response cannot populate or cache a different workspace',async t=>{
  let finish;
  const ui=setup(t,name=>name==='crm_workspace_directory'?new Promise(resolve=>{finish=resolve;}):{data:[],error:null});
  ui.api.prepareDirectoryTest();
  const loading=ui.api.loadOriginal(); await tick();
  ui.api.set({workspace:'workspace-b',employees:[{name:'Current tenant employee'}],companies:[{name:'Current tenant company'}]});
  const before=plain(ui.api.collections()),effects=plain(ui.effects);
  finish({data:[{profile_id:user,profiles:{display_name:'Old tenant private employee'},role:'manager'}],error:null});
  await loading;
  assert.deepEqual(plain(ui.api.collections()),before);
  assert.deepEqual(ui.effects,effects);
});

test('late inventory costs cannot cross between users within the same workspace',async t=>{
  let finish;
  const ui=setup(t,()=>({data:[],error:null}),{queryHandler:table=>table==='crm_inventory_items'?new Promise(resolve=>{finish=resolve;}):{data:[],error:null}});
  const loading=ui.api.loadCommerceOriginal(ui.client); await tick();
  ui.api.set({user:otherUser});
  const before=plain(ui.api.collections());
  finish({data:[{id:item,sku:'A',name:'Privileged cost record',on_hand:100,sale_price_cents:250,cost_cents:200,active:true}],error:null});
  await loading;
  assert.deepEqual(plain(ui.api.collections()),before);
});

test('in-flight inventory response is discarded after inventory permission is downgraded to PoS-only',async t=>{
  let finish;
  const ui=setup(t,()=>({data:[],error:null}),{queryHandler:table=>table==='crm_inventory_items'?new Promise(resolve=>{finish=resolve;}):{data:[],error:null}});
  const loading=ui.api.loadCommerceOriginal(ui.client); await tick();
  ui.api.set({tools:['pos']});
  const before=plain(ui.api.collections());
  finish({data:[{id:item,sku:'A',name:'Privileged cost record',on_hand:100,sale_price_cents:250,cost_cents:200,active:true}],error:null});
  await loading;
  assert.deepEqual(plain(ui.api.collections()),before);
});

test('logout during the post-checkout refresh cannot show a late success notification',async t=>{
  const ui=setup(t);
  let finish;
  ui.window.__loadHook=()=>new Promise(resolve=>{finish=resolve;});
  const checkout=ui.api.complete(); await tick();
  ui.api.logout(); const before=plain(ui.effects);
  finish(); await checkout;
  assert.deepEqual(ui.effects,before);
});

test('late durable event and knowledge records never enter another tenant or user cache',async t=>{
  for(const changedScope of [{workspace:'workspace-b'},{user:otherUser},{replaceState:true}]) {
    let finish;
    const ui=setup(t,undefined,{queryHandler:table=>table==='crm_workspace_records'?new Promise(resolve=>{finish=resolve;}):{data:[]}});
    ui.api.set({tools:['calendar','knowledge'],durableMutation:0,durableCommitted:0});
    const pulling=ui.api.pullDurable(); await tick();
    ui.api.set({...changedScope,events:[{id:'current-event',name:'Current event'}],knowledge:[{id:'current-article',title:'Current article'}]});
    const before=plain(ui.api.collections()),effects=plain(ui.effects);
    finish({data:[
      {record_type:'event',record_id:'private-old-event',data:{name:'Previous workspace event'}},
      {record_type:'article',record_id:'private-old-article',data:{title:'Previous workspace knowledge'}}
    ],error:null});
    await pulling;
    assert.deepEqual(plain(ui.api.collections()),before);
    assert.deepEqual(ui.effects,effects);
  }
});

test('late snapshot acknowledgement cannot move the new user save baseline or committed version',async t=>{
  let finish;
  const ui=setup(t,()=>new Promise(resolve=>{finish=resolve;}));
  ui.api.set({baseline:'original-baseline',mutation:3,committed:2});
  const pushing=ui.api.pushSnapshot(3); await tick();
  assert.equal(ui.calls[0].payload.p_workspace,'workspace-a');
  assert.equal(ui.calls[0].payload.p_expected_updated_at,'original-baseline');
  ui.api.set({user:otherUser,baseline:'current-baseline',mutation:1,committed:1,saveError:'Current user error'});
  const before=plain(ui.api.persistence()),effects=plain(ui.effects);
  finish({data:{updated_at:'old-user-acknowledgement'},error:null}); await pushing;
  assert.deepEqual(plain(ui.api.persistence()),before);
  assert.deepEqual(ui.effects,effects);
});

test('late snapshot save errors cannot overwrite a different workspace or user error state',async t=>{
  for(const changedScope of [{workspace:'workspace-b'},{user:otherUser},{replaceState:true}]) {
    let finish;
    const ui=setup(t,()=>new Promise(resolve=>{finish=resolve;}));
    ui.api.set({baseline:'original-baseline',mutation:3,committed:2});
    const pushing=ui.api.pushSnapshot(3).catch(()=>undefined); await tick();
    ui.api.set({...changedScope,baseline:'current-baseline',mutation:7,committed:6,saveError:'Current scope pending changes'});
    const before=plain(ui.api.persistence()),effects=plain(ui.effects);
    finish({data:null,error:{code:'40001',message:'Private old workspace conflict'}}); await pushing;
    assert.deepEqual(plain(ui.api.persistence()),before);
    assert.deepEqual(ui.effects,effects);
  }
});

test('awaiting session retrieval cannot dispatch an old request into the newly active tenant',async t=>{
  for(const changedScope of [{workspace:'workspace-b'},{user:otherUser},{replaceState:true}]) {
    const ui=setup(t); let finish; const sent=[];
    ui.client.auth={getSession:()=>new Promise(resolve=>{finish=resolve;})};
    ui.window.fetch=async(url,options)=>{sent.push({url,options});return {ok:true,text:async()=>'{"ok":true}'};};
    const posting=ui.api.gateway('/api/social/action',{method:'POST',body:{companyId:'old-tenant-company'}}).catch(()=>undefined);
    await tick(); ui.api.set(changedScope);
    finish({data:{session:{access_token:'synthetic-test-token',user:{id:user}}},error:null}); await posting;
    assert.equal(sent.length,0);
  }
});

test('binary uploads also stop if session retrieval outlives the active workspace',async t=>{
  const ui=setup(t); let finish; const sent=[];
  ui.client.auth={getSession:()=>new Promise(resolve=>{finish=resolve;})};
  ui.window.fetch=async(url,options)=>{sent.push({url,options});return {ok:true,text:async()=>'{"ok":true}'};};
  const file=new ui.window.File(['synthetic content'],'old-company.txt',{type:'text/plain'});
  const uploading=ui.api.binaryGateway('/api/media/upload',file,{}).catch(()=>undefined);
  await tick(); ui.api.set({workspace:'workspace-b'});
  finish({data:{session:{access_token:'synthetic-test-token',user:{id:user}}},error:null}); await uploading;
  assert.equal(sent.length,0);
});

test('JSON and binary gateway calls bind their actor and workspace regardless of header casing overrides',async t=>{
  const ui=setup(t); const sent=[];
  ui.client.auth={getSession:async()=>({data:{session:{access_token:'synthetic-test-token',user:{id:user}}},error:null})};
  ui.window.fetch=async(url,options)=>{sent.push({url,options});return {ok:true,text:async()=>'{"ok":true}'};};
  const headers={AUTHORIZATION:'Bearer other-user','x-workspace-id':'workspace-evil','X-Workspace-Id':'workspace-other','X-Trace':'preserved'};
  const result=await ui.api.gateway('/api/action',{method:'POST',headers,body:{record:'current-tenant-record'}});
  assert.equal(result.ok,true);
  const file=new ui.window.File(['synthetic content'],'current.txt',{type:'text/plain'});
  await ui.api.binaryGateway('/api/media/upload',file,headers);
  assert.equal(sent.length,2,'configured positive requests must reach mocked fetch');
  for(const {options} of sent) {
    const bound=new Headers(options.headers);
    assert.equal(bound.get('authorization'),'Bearer synthetic-test-token');
    assert.equal(bound.get('x-workspace-id'),'workspace-a');
    assert.equal(bound.get('x-trace'),'preserved');
    assert.equal(options.method,'POST');
  }
  assert.deepEqual(JSON.parse(sent[0].options.body),{record:'current-tenant-record'});
  assert.equal(sent[1].options.body,file);
});

test('a mismatched session actor cannot dispatch gateway requests even when current UI scope is unchanged',async t=>{
  const ui=setup(t);const sent=[];
  ui.client.auth={getSession:async()=>({data:{session:{access_token:'synthetic-test-token',user:{id:otherUser}}},error:null})};
  ui.window.fetch=async(...args)=>{sent.push(args);return {ok:true,text:async()=>'{"ok":true}'};};
  await assert.rejects(ui.api.gateway('/api/action',{method:'POST',body:{record:'a'}}),/account changed/i);
  assert.equal(sent.length,0);
});

test('late gateway response bodies cannot return a previous scope private payload',async t=>{
  const ui=setup(t); let finish;
  ui.client.auth={getSession:async()=>({data:{session:{access_token:'synthetic-test-token',user:{id:user}}},error:null})};
  ui.window.fetch=async()=>({ok:true,text:()=>new Promise(resolve=>{finish=resolve;})});
  const response=ui.api.gateway('/api/private/overview'); await tick();
  ui.api.set({workspace:'workspace-b'});
  finish('{"private":"old-tenant-data"}');
  await assert.rejects(response,/account changed|workspace/i);
});

test('finished export data is discarded if actor, workspace or export permission changes during collection',async t=>{
  for(const changedScope of [{user:otherUser},{workspace:'workspace-b'},{replaceState:true},{canExport:false},{exportTools:[]}]) {
    const ui=setup(t);let finish;let workbooks=0;
    ui.api.set({canExport:true,exportTools:['pos']});
    ui.window.XLSX={write:()=>new Uint8Array([1,2,3])};
    ui.window.AkiCommerceExport={period(){},collect:()=>new Promise(resolve=>{finish=resolve;}),workbook(){workbooks++;return {};}};
    const form=ui.window.document.createElement('form');form.dataset.mode='pos';
    form.innerHTML='<input name="from" value="2026-09-01"><input name="through" value="2026-09-23"><button type="submit">Download Excel</button>';
    const exporting=ui.api.exportRecords(form);await tick();
    ui.api.set(changedScope);finish({private:'old-workspace-records'});await exporting;
    assert.equal(workbooks,0);
    assert.equal(ui.effects.downloads.length,0);
  }
});

test('missing access RPC is a backend failure, never an empty authorized-workspace result',async t=>{
 const x=setup(t,async()=>({error:{code:'PGRST202',message:'missing function'}}));
 const client={from:()=>({select(){return this},eq(){return this},then(resolve){resolve({data:[{role:'owner',crm_workspaces:{id:'ws_akipasa',name:'HQ',status:'active'}}]})}}),rpc:async()=>({error:{code:'PGRST202'}})};
 await assert.rejects(x.api.accessible(client,user,'administrator'),/backend is unavailable/);
 client.rpc=async()=>({error:{code:'42501'}});
 assert.equal((await x.api.accessible(client,user,'administrator')).length,0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const api = createRequire(import.meta.url)('./assets/inventory-ops.js');
const item='10000000-0000-4000-8000-000000000001';
const location='20000000-0000-4000-8000-000000000001';
const receive = (extra={}) => ({type:'receive',reason:'Delivery arrived',supplier_name:'Supplier',reference:'INV-01',lines:[{item_id:item,quantity:1,unit_cost_cents:123.45}],...extra});

test('receiving normalization keeps fractional units and precise receipt cost',()=>{
  const result=api.validateOperation(receive({lines:[{item_id:item,quantity:'0.125',unit_cost_cents:'123.456789'}]}));
  assert.equal(result.lines[0].quantity,0.125); assert.equal(result.lines[0].unit_cost_cents,'123.456789'); assert.equal(result.location_id,null);
});
test('no hidden quantity rounding missing costs or fake supplier evidence',()=>{
  for (const quantity of ['1.2345','NaN',Infinity,-1,'1e3','',null]) assert.throws(()=>api.validateOperation(receive({lines:[{item_id:item,quantity,unit_cost_cents:100}]})));
  assert.throws(()=>api.validateOperation(receive({lines:[{item_id:item,quantity:1}]})),/cost/);
  assert.throws(()=>api.validateOperation(receive({supplier_name:''})),/Supplier/);
  assert.throws(()=>api.validateOperation(receive({reference:''})),/reference/);
});
test('count is an absolute zero-capable quantity with mandatory expected balance',()=>{
  const result=api.validateOperation({type:'count',reason:'Empty shelf',lines:[{item_id:item,quantity:0,expected_quantity:2}]});
  assert.equal(result.lines[0].quantity,0); assert.equal(result.lines[0].expected_quantity,2);
  assert.throws(()=>api.validateOperation({type:'count',reason:'Empty shelf',lines:[{item_id:item,quantity:0}]}),/Previously observed/);
});
test('transfers require another location and duplicate items are rejected',()=>{
  assert.throws(()=>api.validateOperation({type:'transfer',from_location_id:location,to_location_id:location,reason:'Move stock',lines:[{item_id:item,quantity:1}]}),/different/);
  const lines=receive().lines; assert.throws(()=>api.validateOperation(receive({lines:[...lines,...lines]})),/duplicate/);
});
test('currency form conversion avoids binary tails from decimal costs',()=>{
  const result=api.fromForm({item_id:item,quantity:'0.1',supplier_name:'S',reference:'R',unit_cost:'0.29',reason:'Received delivery'},'receive');
  assert.equal(result.lines[0].unit_cost_cents,'29');
  const high=api.fromForm({item_id:item,quantity:'1',supplier_name:'S',reference:'R',unit_cost:'9999999999.12345678',reason:'Received delivery'},'receive');
  assert.equal(high.lines[0].unit_cost_cents,'999999999912.345678');
});
test('request key reused unchanged for retry and server errors are not hidden',async()=>{
  const calls=[]; const client={rpc:async(name,args)=>{calls.push({name,args});return {data:'recorded-id'};}};
  assert.equal(await api.submitOperation(client,'tenant','request-1',receive()),'recorded-id');
  await api.submitOperation(client,'tenant','request-1',receive());
  assert.deepEqual(calls[0],calls[1]);
  await assert.rejects(api.submitOperation({rpc:async()=>({error:{message:'Manager approval required'}})},'tenant','request-1',receive()),/Manager approval/);
  await assert.rejects(api.submitOperation({rpc:async()=>({data:null})},'tenant','request-1',receive()),/did not confirm/);
});
test('unknown and different currency values cannot become a misleading stock total',()=>{
  const summary=api.summarizeValuation([{carrying_value_cents:120,currency:'EUR',cost_status:'recorded_weighted_average'},{carrying_value_cents:200,currency:'USD',cost_status:'recorded_weighted_average'},{carrying_value_cents:null,currency:'EUR',cost_status:'unknown_cost'}]);
  assert.equal(summary.complete,false); assert.equal(summary.unknownRows,1); assert.deepEqual(summary.knownValueCentsByCurrency,{EUR:120,USD:200});
});
test('location pagination honours tenant boundaries and server page caps',async()=>{
  const list=Array.from({length:7},(_,i)=>({id:String(i),workspace_id:'tenant'})).concat([{id:'8',workspace_id:'other'}]);
  const client={from(){let filters=[];let cap=2;return {select(){return this;},eq(k,v){filters.push(r=>r[k]===v);return this;},order(){return this;},limit(){return this;},gt(k,v){filters.push(r=>r[k]>v);return this;},then(resolve){return Promise.resolve({data:list.filter(row=>filters.every(f=>f(row))).slice(0,cap)}).then(resolve);}};}};
  assert.equal((await api.loadLocations(client,'tenant')).length,7);
});
test('valuation pagination exhausts the complete stable cutoff',async()=>{
  const calls=[]; const list=Array.from({length:1101},(_,i)=>({item_id:String(i)}));
  const client={rpc(name,args){let start=0; calls.push(args);return {order(){return this;},range(value){start=value;return this;},then(resolve){return Promise.resolve({data:list.slice(start,start+137)}).then(resolve);}};}};
  const rows=await api.loadValuation(client,'tenant','2026-01-01T00:00:00Z');
  assert.equal(rows.length,1101); assert(calls.every(call=>call.p_at==='2026-01-01T00:00:00.000Z'));
});
test('rendered receiving form escapes item names and keeps evidence mandatory',()=>{
  const html=api.renderForm({products:[{inventoryItemId:item,name:'<img onerror=alert(1)>',unit:'kg'}],key:'request-key'});
  assert(!html.includes('<img onerror')); assert(html.includes('&lt;img')); assert(html.includes('name="supplier_name"')); assert(html.includes('name="unit_cost"')); assert(html.includes('step="0.001"'));
});
test('count form captures the selected default-location balance rather than aggregate stock',()=>{
  const html=api.renderForm({type:'count',products:[{inventoryItemId:item,name:'Coffee',stock:10}],locations:[{id:location,name:'Main',is_default:true,active:true}],balances:[{item_id:item,location_id:location,quantity:'2.000'}],itemId:item,key:'request-key'});
  assert(html.includes('value="2.000" required readonly'));assert(html.includes('Recorded stock by location'));
  assert(!html.includes('value="10" required readonly'));
});

const storage=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};};
test('stock retry identity and payload survive reload with user/workspace isolation',()=>{
  const savedStorage=storage();
  const saved=api.stagePending(savedStorage,'user','tenant','request-1',receive());
  assert.deepEqual(api.readPending(savedStorage,'user','tenant'),saved);
  assert.equal(api.readPending(savedStorage,'other','tenant'),null);
  assert.equal(api.readPending(savedStorage,'user','another'),null);
  assert.deepEqual(api.stagePending(savedStorage,'user','tenant','request-1',receive()),saved);
  assert.throws(()=>api.stagePending(savedStorage,'user','tenant','request-2',receive()),/pending/);
  assert.throws(()=>api.stagePending(savedStorage,'user','tenant','request-1',receive({reason:'Different'})),/pending/);
  assert.throws(()=>api.resolvePending(savedStorage,'user','tenant','request-2'),/does not match/);
  api.resolvePending(savedStorage,'user','tenant','request-1');
  assert.equal(api.readPending(savedStorage,'user','tenant'),null);
});
test('unavailable and corrupt recovery storage block submission preparation',()=>{
  const broken={getItem(){throw new Error('blocked');}};
  assert.throws(()=>api.stagePending(broken,'user','tenant','request-1',receive()),/unavailable/);
  assert.throws(()=>api.readPending({getItem(){return '{broken';}},'user','tenant'),/damaged/);
  const readonly={getItem(){return null;},setItem(){throw new Error('quota');}};
  assert.throws(()=>api.stagePending(readonly,'user','tenant','request-1',receive()),/has not been submitted/);
});
test('reconciliation requires a server-confirmed committed or cancelled key',async()=>{
  const client={rpc:async()=>({data:{status:'cancelled',request_key:'request-1',operation_id:null}})};
  assert.equal((await api.reconcileOperation(client,'tenant','request-1',receive())).status,'cancelled');
  await assert.rejects(api.reconcileOperation({rpc:async()=>({data:{status:'cancelled',request_key:'another-key'}})},'tenant','request-1',receive()),/not confirmed/);
  await assert.rejects(api.reconcileOperation({rpc:async()=>({error:{message:'network uncertain'}})},'tenant','request-1',receive()),/network uncertain/);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const session = require('../assets/checkout-session.js');
const user = '00000000-0000-4000-8000-000000000001';
const otherUser = '00000000-0000-4000-8000-000000000002';
const workspace = 'workspace-a';
const item = 'abcdefff-0000-4000-8000-000000000001';
const itemB = 'abcdefff-0000-4000-8000-000000000002';
const storageKey = (who=user, space=workspace) => `akihq:pending-sale:v1:${who}:${space}`;
const line = (quantity=1, price=250, itemId=item) => ({item_id:itemId,quantity,unit_price_cents:price});
const request = (overrides={}) => ({
  p_workspace:workspace, p_provider:'cash', p_external_id:'akihq-original-request',
  p_total_cents:250, p_currency:'EUR', p_employee_profile:user, p_lines:[line()],
  ...overrides
});
function storage() {
  const data = new Map();
  return { data, getItem:key=>data.get(key) ?? null, setItem:(key,value)=>data.set(key,String(value)), removeItem:key=>data.delete(key) };
}

test('stages and reads exact detached payload with a stable key after a simulated reload', () => {
  const store = storage(), input = request();
  const saved = session.stage(store,user,workspace,input);
  assert.deepEqual(saved,input);
  assert.notEqual(saved,input);
  input.p_lines[0].unit_price_cents=999;
  saved.p_lines[0].quantity=7;
  assert.deepEqual(session.read(store,user,workspace),request());
  assert.equal(store.data.size,1);
});

test('a fresh cart or tender cannot overwrite an uncertain saved request', () => {
  const store = storage();
  session.stage(store,user,workspace,request());
  const newCart = request({p_provider:'card',p_external_id:'another-reference',p_total_cents:500,p_lines:[line(2)]});
  assert.deepEqual(session.stage(store,user,workspace,newCart),request());
  assert.deepEqual(session.read(store,user,workspace),request());
});

test('pending requests are isolated by user and workspace', () => {
  const store = storage();
  session.stage(store,user,workspace,request());
  assert.equal(session.read(store,otherUser,workspace),null);
  assert.equal(session.read(store,user,'workspace-b'),null);
  session.stage(store,otherUser,workspace,request({p_employee_profile:otherUser,p_external_id:'other-user-reference'}));
  assert.equal(store.data.size,2);
  assert.equal(session.read(store,user,workspace).p_external_id,'akihq-original-request');
  assert.equal(session.read(store,otherUser,workspace).p_external_id,'other-user-reference');
});

test('damaged JSON or invalid persisted amounts block checkout and preserve reconciliation evidence', () => {
  for (const saved of ['{bad', 'null', '[]', JSON.stringify(request({p_total_cents:1})),
    JSON.stringify(request({p_employee_profile:otherUser})),JSON.stringify(request({p_currency:null})),
    JSON.stringify(request({p_lines:[]})),JSON.stringify(request({p_lines:[line('1')]}))]) {
    const store=storage(); store.setItem(storageKey(),saved);
    assert.throws(()=>session.read(store,user,workspace),/pending sale.*(damaged|verified)/);
    assert.throws(()=>session.stage(store,user,workspace,request()),/pending sale/);
    assert.equal(store.getItem(storageKey()),saved);
  }
});

test('storage access and quota errors fail before a request can be returned for submission', () => {
  const denied=storage(); denied.getItem=()=>{throw new Error('Storage denied');};
  assert.throws(()=>session.stage(denied,user,workspace,request()),/Storage denied/);
  const quota=storage(); quota.setItem=()=>{throw new Error('QuotaExceededError');};
  assert.throws(()=>session.stage(quota,user,workspace,request()),/QuotaExceeded/);
  assert.equal(quota.data.size,0);
});

test('silent loss and conflicting durable readback cannot masquerade as a staged checkout', () => {
  const dropped=storage(); dropped.setItem=()=>{};
  assert.throws(()=>session.stage(dropped,user,workspace,request()),/saved reliably/);
  const raced=storage();
  raced.setItem=(key)=>raced.data.set(key,JSON.stringify(request({p_external_id:'other-tab-reference'})));
  assert.throws(()=>session.stage(raced,user,workspace,request()),/saved reliably/);
  assert.equal(session.read(raced,user,workspace).p_external_id,'other-tab-reference');
});

test('only acknowledgement for the matching pending reference can clear its payload', () => {
  const store=storage(); session.stage(store,user,workspace,request());
  assert.throws(()=>session.resolve(store,user,workspace,'stale-reference'),/pending sale changed/);
  assert.equal(store.data.size,1);
  session.resolve(store,user,workspace,'akihq-original-request');
  assert.equal(session.read(store,user,workspace),null);
  assert.throws(()=>session.resolve(store,user,workspace,'akihq-original-request'),/pending sale changed/);
});

test('failed removal leaves acknowledged payload available for idempotent reconciliation', () => {
  const store=storage(); session.stage(store,user,workspace,request());
  store.removeItem=()=>{throw new Error('Storage denied');};
  assert.throws(()=>session.resolve(store,user,workspace,'akihq-original-request'),/Storage denied/);
  assert.deepEqual(session.read(store,user,workspace),request());
});

test('validation failures do not create pending records', () => {
  const invalid=[request({p_workspace:'other'}),request({p_employee_profile:otherUser}),request({p_total_cents:249}),
    request({p_total_cents:'250'}),request({p_provider:''}),request({p_provider:'x'.repeat(81)}),
    request({p_external_id:null}),request({p_external_id:'x'.repeat(201)}),request({p_currency:'eur'})];
  for (const input of invalid) {
    const store=storage(); assert.throws(()=>session.stage(store,user,workspace,input),/Invalid/);
    assert.equal(store.data.size,0);
  }
  assert.throws(()=>session.read(storage(),null,workspace),/Sign in/);
});

test('exact cents use decimal milliunits and positive half-up rounding for each distinct item', () => {
  assert.equal(session.total([line(0.5,101)]),51);
  assert.equal(session.total([line(0.5,101),line(0.5,250,itemB)]),176);
  assert.equal(session.total([line(1.001,1000)]),1001);
  assert.equal(session.total([line(1.005,100)]),101);
  assert.equal(session.total([line(0.001,500)]),1);
  assert.equal(session.total([line(0.001,499)]),0);
});

test('duplicate items including uppercase UUIDs aggregate before a single rounding step', () => {
  assert.equal(session.total([line(0.004,101),line(0.004,101,item.toUpperCase())]),1);
  assert.throws(()=>session.total([line(1,101),line(1,102)]),/conflicting prices/);
});

test('invalid or unsupported quantities and money cannot enter a saved request', () => {
  for (const quantity of [null,'1',undefined,NaN,Infinity,-Infinity,0,-1,0.0001,0.000000001,0.1+0.2,1000000000]) {
    assert.throws(()=>session.total([{...line(),quantity}]),/positive quantities/);
  }
  for (const price of [null,'250',undefined,NaN,Infinity,-1,0.1,2147483648]) {
    assert.throws(()=>session.total([{...line(),unit_price_cents:price}]),/positive quantities/);
  }
  for (const lines of [null,[],{},Array.from({length:501},()=>line())]) assert.throws(()=>session.total(lines),/sale lines/);
  assert.throws(()=>session.total([null]),/inventory item/);
  assert.throws(()=>session.total([line(1,250,'bad-id')]),/inventory item/);
});

test('quantity and amount limits apply after duplicate aggregation; free goods remain supported', () => {
  assert.equal(session.total([line(999999999.999,0)]),0);
  assert.equal(session.total([line(1,2147483647)]),2147483647);
  assert.throws(()=>session.total([line(999999999.999,0),line(0.001,0)]),/combined item quantity/);
  assert.throws(()=>session.total([line(2,2147483647)]),/sale exceeds/);
  assert.equal(session.total(Array.from({length:500},()=>line(0.001,1000))),500);
});

test('browser global entrypoint exposes the same recovery and calculation operations', async () => {
  const code=await readFile(new URL('../assets/checkout-session.js',import.meta.url),'utf8');
  const context={window:{}}; vm.runInNewContext(code,context);
  assert.equal(context.window.AkiCheckoutSession.total([line(0.5,101)]),51);
  const store=storage(); context.window.AkiCheckoutSession.stage(store,user,workspace,request());
  assert.equal(context.window.AkiCheckoutSession.read(store,user,workspace).p_external_id,'akihq-original-request');
});

import assert from 'node:assert/strict';
import { before, beforeEach, after, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const moduleUrl = process.env.PGLITE_MODULE ? pathToFileURL(resolve(process.env.PGLITE_MODULE)).href : new URL('./cloudflare/node_modules/@electric-sql/pglite/dist/index.js', import.meta.url).href;
const { PGlite } = await import(moduleUrl);
const db = new PGlite();
const user = '00000000-0000-4000-8000-000000000001';
const staff = '00000000-0000-4000-8000-000000000002';
const outsider = '00000000-0000-4000-8000-000000000003';
const item = '10000000-0000-4000-8000-000000000001';
const item2 = '10000000-0000-4000-8000-000000000002';
const otherItem = '10000000-0000-4000-8000-000000000003';
const workspace = 'test-workspace';
const checkoutSource = await readFile(new URL('./tests/checkout-integrity.test.mjs', import.meta.url),'utf8');
const fixture = checkoutSource.match(/const fixture = `([\s\S]*?)`;/)[1];
const migration = await readFile(new URL('./supabase/migrations/20260923001331_inventory_operations.sql', import.meta.url),'utf8');
const checkout = await readFile(new URL('./supabase/migrations/20260923001329_checkout_integrity.sql', import.meta.url),'utf8');
before(async () => {
  await db.exec(fixture);
  await db.exec(`
    alter table public.crm_inventory_movements add column occurred_at timestamptz default now();
    create function public.crm_can_manage_workspace(w text) returns boolean language sql stable security definer set search_path='' as $$
      select exists(select 1 from public.crm_workspace_members m where m.workspace_id=w and m.profile_id=auth.uid() and m.status='active' and m.role in ('owner','admin','manager'))
    $$;
    grant select on public.crm_inventory_items,public.crm_workspaces to authenticated;
    alter table public.crm_inventory_items enable row level security;
    create policy inventory_read on public.crm_inventory_items for select to authenticated using(public.crm_has_tool(workspace_id,'inventory'));
    alter table public.crm_workspaces enable row level security;
    create policy workspace_read on public.crm_workspaces for select to authenticated using(public.crm_has_tool(id,'inventory'));
    grant insert on public.crm_inventory_movements to authenticated;
  `);
  await db.exec(checkout);
  await db.exec(migration);
});
after(async () => db.close());
beforeEach(async () => {
  await db.exec('reset role; truncate public.crm_workspaces,public.crm_workspace_members,public.crm_workspace_entitlements cascade;');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
  await db.exec(`
    insert into public.crm_workspaces(id,currency) values('${workspace}','EUR'),('other-workspace','EUR');
    insert into public.crm_workspace_members values('${workspace}','${user}','active','manager'),('${workspace}','${staff}','active','staff');
    insert into public.crm_workspace_entitlements values('${workspace}','inventory',true),('${workspace}','pos',true);
    insert into public.crm_inventory_items(id,workspace_id,sku,name,unit,sale_price_cents,on_hand) values
      ('${item}','${workspace}','A','Coffee','unit',250,0),('${item2}','${workspace}','B','Fruit','kg',100,0),('${otherItem}','other-workspace','C','Other','unit',250,0);
  `);
});
const receive = (quantity=10,cost=100,which=item) => ({type:'receive',reason:'Delivery received',supplier_name:'Test supplier',reference:'INV-1',lines:[{item_id:which,quantity,unit_cost_cents:cost}]});
async function operation(payload,key='stock-key-0001',ws=workspace) { return (await db.query('select public.crm_inventory_operation($1,$2,$3::jsonb) as id',[ws,key,JSON.stringify(payload)])).rows[0].id; }
async function scalar(sql,args=[]) { return Object.values((await db.query(sql,args)).rows[0])[0]; }
async function balance(location=null) { return (await db.query('select * from public.crm_inventory_location_balances where workspace_id=$1 and item_id=$2'+(location?' and location_id=$3':''),location?[workspace,item,location]:[workspace,item])).rows[0]; }
async function location(code='STORE') { return scalar('select public.crm_inventory_location_create($1,$2,$3)',[workspace,'Store room',code]); }
async function sale(quantity=1,reference='sale-0001') { return scalar('select public.crm_record_pos_sale($1,$2,$3,$4,$5,$6,$7::jsonb)',[workspace,'cash',reference,quantity*250,'EUR',user,JSON.stringify([{item_id:item,quantity,unit_price_cents:250}])]); }

test('receiving records supplier, immutable cost, stock and weighted average',async()=>{
  const id=await operation(receive(10,100));
  await operation(receive(10,200),'stock-key-0002');
  assert.equal(await scalar('select on_hand from public.crm_inventory_items where id=$1',[item]),'20.000');
  assert.equal((await balance()).carrying_value_cents,'3000.000000');
  assert.equal(await scalar('select supplier_name from public.crm_inventory_operations where id=$1',[id]),'Test supplier');
  assert.equal(await scalar('select receipt_unit_cost_cents from public.crm_inventory_movements where operation_id=$1',[id]),'100.000000');
});
test('fractional kilograms retain quantity and fractions of a cent',async()=>{
  await operation(receive(0.125,123.456,item2));
  const row=(await db.query('select quantity,carrying_value_cents from public.crm_inventory_location_balances where item_id=$1',[item2])).rows[0];
  assert.equal(row.quantity,'0.125'); assert.equal(row.carrying_value_cents,'15.432000');
});
test('idempotent retries do not receive twice and changed contents conflict',async()=>{
  const first=await operation(receive());
  assert.equal(await operation(receive()),first);
  await assert.rejects(operation(receive(11)),/already used for different/);
  assert.equal(await scalar('select on_hand from public.crm_inventory_items where id=$1',[item]),'10.000');
});
test('reconciliation returns committed request or cancels an absent key against late arrival',async()=>{
  const payload=receive();
  const cancelled=await scalar('select public.crm_inventory_reconcile_operation($1,$2,$3::jsonb)',[workspace,'stock-key-0001',JSON.stringify(payload)]);
  assert.deepEqual(cancelled,{status:'cancelled',request_key:'stock-key-0001',operation_id:null});
  await assert.rejects(operation(payload),/cancelled/);
  assert.equal(await scalar('select count(*)::int from public.crm_inventory_operations'),0);
  const id=await operation(payload,'stock-key-0002');
  const committed=await scalar('select public.crm_inventory_reconcile_operation($1,$2,$3::jsonb)',[workspace,'stock-key-0002',JSON.stringify(payload)]);
  assert.equal(committed.status,'committed');assert.equal(committed.operation_id,id);
  assert.equal(await scalar('select count(*)::int from public.crm_inventory_operation_cancellations'),1);
  assert.equal(await operation(payload,'stock-key-0002'),id);
});
test('pending reconciliation validates original payload and operator without deleting evidence',async()=>{
  await operation(receive());
  await assert.rejects(db.query('select public.crm_inventory_reconcile_operation($1,$2,$3::jsonb)',[workspace,'stock-key-0001',JSON.stringify(receive(11))]),/different contents/);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[staff]);
  await assert.rejects(db.query('select public.crm_inventory_reconcile_operation($1,$2,$3::jsonb)',[workspace,'stock-key-0001',JSON.stringify(receive())]),/operator/);
  await assert.rejects(operation(receive()),/operator/);
});
test('checkout deducts aggregate and per-location stock once with historical cost',async()=>{
  await operation(receive()); await sale(2);
  assert.equal(await scalar('select on_hand from public.crm_inventory_items where id=$1',[item]),'8.000');
  assert.equal((await balance()).quantity,'8.000');
  assert.equal((await balance()).carrying_value_cents,'800.000000');
  assert.equal(await scalar("select count(*)::int from public.crm_inventory_movements where movement_type='sale'"),1);
  await sale(2);
  assert.equal((await balance()).quantity,'8.000');
});
test('transfers preserve aggregate stock and value through paired entries',async()=>{
  await operation(receive(3,100.123456)); const to=await location();
  await operation({type:'transfer',to_location_id:to,reason:'Move to storeroom',lines:[{item_id:item,quantity:1}]},'transfer-key');
  assert.equal(await scalar('select on_hand from public.crm_inventory_items where id=$1',[item]),'3.000');
  assert.equal((await balance(to)).quantity,'1.000');
  assert.equal(await scalar('select sum(carrying_value_cents) from public.crm_inventory_location_balances where item_id=$1',[item]),'300.370368');
  assert.equal(await scalar("select count(*)::int from public.crm_inventory_movements where movement_type='transfer'"),2);
});
test('insufficient default location fails checkout even with stock at another location',async()=>{
  await operation(receive()); const to=await location();
  await operation({type:'transfer',to_location_id:to,reason:'Storage',lines:[{item_id:item,quantity:9}]},'transfer-key');
  await assert.rejects(sale(2),/Insufficient stock at selected location/);
  assert.equal(await scalar('select count(*)::int from public.crm_pos_sales'),0);
  assert.equal(await scalar('select on_hand from public.crm_inventory_items where id=$1',[item]),'10.000');
});
test('bad destination rolls back entire transfer and operation',async()=>{
  await operation(receive());
  await assert.rejects(operation({type:'transfer',to_location_id:otherItem,reason:'Storage',lines:[{item_id:item,quantity:5}]},'transfer-key'),/destination/);
  assert.equal((await balance()).quantity,'10.000');
  assert.equal(await scalar('select count(*)::int from public.crm_inventory_operations'),1);
});
test('count uses absolute quantity and rejects stale observed stock',async()=>{
  await operation(receive());
  await assert.rejects(operation({type:'count',reason:'Physical count',lines:[{item_id:item,quantity:8,expected_quantity:9}]},'count-key-1'),/Stock changed/);
  await operation({type:'count',reason:'Physical count',lines:[{item_id:item,quantity:8,expected_quantity:10}]},'count-key-1');
  assert.equal((await balance()).quantity,'8.000'); assert.equal((await balance()).carrying_value_cents,'800.000000');
  assert.equal(await scalar("select approved_by from public.crm_inventory_operations where operation_type='count'"),user);
});
test('zero variance count still preserves approved count evidence',async()=>{
  await operation(receive());
  await operation({type:'count',reason:'Physical count matched',lines:[{item_id:item,quantity:10,expected_quantity:10}]},'count-key-1');
  assert.equal(await scalar('select count(*)::int from public.crm_inventory_operations'),2);
  assert.equal(await scalar("select count(*)::int from public.crm_inventory_movements where movement_type='count'"),0);
});
test('waste manager approval removes weighted-average value and prevents negative stock',async()=>{
  await operation(receive());
  await operation({type:'waste',reason:'Spoiled goods',lines:[{item_id:item,quantity:2}]},'waste-key-1');
  assert.equal((await balance()).quantity,'8.000'); assert.equal((await balance()).carrying_value_cents,'800.000000');
  await assert.rejects(operation({type:'waste',reason:'Spoiled goods',lines:[{item_id:item,quantity:9}]},'waste-key-2'),/Insufficient stock/);
});
test('staff may receive but cannot approve counts waste or locations',async()=>{
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[staff]);
  await operation(receive());
  await assert.rejects(operation({type:'waste',reason:'Spoiled',lines:[{item_id:item,quantity:1}]},'waste-key-1'),/manager approval/);
  await assert.rejects(operation({type:'count',reason:'Counted',lines:[{item_id:item,quantity:9,expected_quantity:10}]},'count-key-1'),/manager approval/);
  await assert.rejects(location(),/manager access/);
});
test('workspace boundaries and unauthenticated users cannot mutate stock',async()=>{
  await assert.rejects(operation(receive(1,100,otherItem)),/workspace inventory item/);
  await assert.rejects(operation(receive(), 'stock-key-0001','other-workspace'),/access required/);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[outsider]);
  await assert.rejects(operation(receive()),/access required/);
  await db.query("select set_config('request.jwt.claim.sub','',false)");
  await assert.rejects(operation(receive()),/access required/);
});
test('API grants deny direct stock writes and tenant RLS hides other workspaces',async()=>{
  await operation(receive());
  await db.exec('set role authenticated');
  assert.equal(await scalar('select count(*)::int from public.crm_inventory_operations'),1);
  await assert.rejects(db.query('insert into public.crm_inventory_movements(workspace_id,item_id,quantity_delta,movement_type,created_by) values($1,$2,1,$3,$4)',[workspace,item,'adjustment',user]),/permission denied/);
  await assert.rejects(db.query('update public.crm_inventory_location_balances set quantity=99'),/permission denied/);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[outsider]);
  assert.equal(await scalar('select count(*)::int from public.crm_inventory_operations'),0);
  assert.equal(await scalar('select count(*)::int from public.crm_inventory_value_events'),0);
});
test('all recorded evidence resists update and delete even from privileged SQL',async()=>{
  await operation(receive());
  for (const table of ['crm_inventory_operations','crm_inventory_movements','crm_inventory_value_events']) {
    await assert.rejects(db.exec(`delete from public.${table}`),/immutable/);
  }
});
test('legacy quantity is preserved and its unknown cost is not invented',async()=>{
  await db.exec('alter table public.crm_inventory_items disable trigger inventory_unit_history');
  await db.query('update public.crm_inventory_items set on_hand=10 where id=$1',[item]);
  await db.exec('alter table public.crm_inventory_items enable trigger inventory_unit_history');
  await operation(receive(5,100));
  assert.equal((await balance()).quantity,'15.000'); assert.equal((await balance()).carrying_value_cents,null);
  await sale(15);
  assert.equal((await balance()).carrying_value_cents,'0.000000');
  await operation(receive(1,123),'stock-key-0002');
  assert.equal((await balance()).carrying_value_cents,'123.000000');
});
test('historical valuation uses recorded snapshots instead of present stock',async()=>{
  await operation(receive(10,100));
  const at=await scalar('select clock_timestamp()::text');
  await operation(receive(10,200),'stock-key-0002');
  const rows=(await db.query('select * from public.crm_inventory_valuation($1,$2)',[workspace,at])).rows;
  const valued=rows.find(row=>row.item_id===item);
  assert.equal(valued.quantity,'10.000'); assert.equal(valued.carrying_value_cents,'1000.000000');
  assert.equal(rows.find(row=>row.item_id===item2).cost_status,'not_recorded');
  const old=(await db.query("select * from public.crm_inventory_valuation($1,'2000-01-01')",[workspace])).rows;
  assert(old.every(row=>row.quantity===null && row.carrying_value_cents===null));
});
test('stock units currency and balances cannot be relabelled after tracking',async()=>{
  await operation(receive());
  await assert.rejects(db.query('update public.crm_inventory_items set unit=$1 where id=$2',['kg',item]),/cannot change units/);
  await assert.rejects(db.query('update public.crm_inventory_items set on_hand=50 where id=$1',[item]),/recorded movements/);
  await assert.rejects(db.query('update public.crm_workspaces set currency=$1 where id=$2',['USD',workspace]),/currency is locked/);
});
test('invalid quantities nonfinite values costs duplicates and missing evidence fail atomically',async()=>{
  for (const payload of [receive(0),receive(0.0001),receive(-1),receive('NaN'),receive(1,-1),receive(1,'Infinity'),{...receive(),supplier_name:''},{...receive(),reference:''},{...receive(),lines:[receive().lines[0],receive().lines[0]]}]) {
    await assert.rejects(operation(payload));
  }
  assert.equal(await scalar('select count(*)::int from public.crm_inventory_operations'),0);
  assert.equal(await scalar('select count(*)::int from public.crm_inventory_movements'),0);
});

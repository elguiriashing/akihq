import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// npm ci --prefix cloudflare
// Alternatively point PGLITE_MODULE to an installed package's ESM entrypoint.
const moduleUrl = process.env.PGLITE_MODULE
  ? pathToFileURL(resolve(process.env.PGLITE_MODULE)).href
  : new URL('../cloudflare/node_modules/@electric-sql/pglite/dist/index.js', import.meta.url).href;
const { PGlite } = await import(moduleUrl);
const db = new PGlite();
const user = '00000000-0000-4000-8000-000000000001';
const otherUser = '00000000-0000-4000-8000-000000000002';
const itemA = '10000000-0000-4000-8000-000000000001';
const itemB = '10000000-0000-4000-8000-000000000002';
const otherItem = '10000000-0000-4000-8000-000000000003';
const migration = await readFile(new URL('../supabase/migrations/20260923001329_checkout_integrity.sql', import.meta.url), 'utf8');

// Production-shaped fixture: the repo's optional schema.sql does not contain
// the live crm_* commerce schema. No connection to a production project occurs.
const fixture = `
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to authenticated, anon;
  create table public.crm_workspaces(id text primary key, currency text not null, status text not null default 'active');
  create table public.crm_workspace_members(workspace_id text, profile_id uuid, status text, role text);
  create table public.crm_workspace_entitlements(workspace_id text, tool_key text, active boolean);
  create function public.crm_can_operate_workspace(w text) returns boolean language sql stable security definer set search_path='' as $$
    select auth.uid() is not null and exists(select 1 from public.crm_workspace_members m
      where m.workspace_id=w and m.profile_id=auth.uid() and m.status='active'
      and m.role in ('owner','admin','manager','staff'))
  $$;
  create function public.crm_has_tool(w text,t text) returns boolean language sql stable security definer set search_path='' as $$
    select public.crm_can_operate_workspace(w) and exists(select 1 from public.crm_workspace_entitlements e
      where e.workspace_id=w and e.tool_key=t and e.active)
  $$;
  create table public.crm_inventory_items(
    id uuid primary key default gen_random_uuid(), workspace_id text not null references public.crm_workspaces(id),
    sku text not null, name text not null, unit text not null default 'unit', active boolean not null default true,
    sale_price_cents integer not null check(sale_price_cents>=0), on_hand numeric(12,3) not null check(on_hand>=0),
    updated_at timestamptz not null default now()
  );
  create table public.crm_pos_sales(
    id uuid primary key default gen_random_uuid(), workspace_id text not null references public.crm_workspaces(id),
    provider text not null, external_id text not null, total_cents integer not null check(total_cents>=0),
    currency text not null, employee_profile_id uuid, created_by uuid not null,
    status text not null default 'completed', sold_at timestamptz not null default now(),
    tip_cents integer not null default 0,
    unique(workspace_id,provider,external_id)
  );
  create table public.crm_pos_sale_lines(
    id uuid primary key default gen_random_uuid(), sale_id uuid not null references public.crm_pos_sales(id),
    workspace_id text not null, item_id uuid not null references public.crm_inventory_items(id),
    quantity numeric(12,3) not null check(quantity>0), unit_price_cents integer not null check(unit_price_cents>=0)
  );
  create table public.crm_inventory_movements(
    id uuid primary key default gen_random_uuid(), workspace_id text not null,
    item_id uuid not null references public.crm_inventory_items(id), quantity_delta numeric(12,3) not null,
    movement_type text not null, source_type text, source_id text,
    employee_profile_id uuid, notes text not null default '', created_by uuid not null
  );
  create function public.crm_apply_inventory_movement() returns trigger language plpgsql security definer set search_path='' as $$
  begin
    update public.crm_inventory_items i set on_hand=i.on_hand+new.quantity_delta,updated_at=now()
      where i.id=new.item_id and i.workspace_id=new.workspace_id;
    if not found then raise exception 'inventory item does not belong to workspace'; end if;
    return new;
  end;
  $$;
  create trigger crm_inventory_movement_apply after insert on public.crm_inventory_movements
    for each row execute function public.crm_apply_inventory_movement();
  alter table public.crm_pos_sales enable row level security;
  alter table public.crm_pos_sale_lines enable row level security;
  grant select,insert,update,delete on public.crm_pos_sales,public.crm_pos_sale_lines to authenticated;
`;

before(async () => {
  await db.exec(fixture);
  await db.exec(migration);
});
after(async () => { await db.close(); });
beforeEach(async () => {
  await db.exec('reset role; truncate public.crm_pos_sales, public.crm_pos_sale_lines, public.crm_inventory_movements, public.crm_inventory_items, public.crm_workspaces, public.crm_workspace_members, public.crm_workspace_entitlements;');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  await db.exec(`
    insert into public.crm_workspaces(id,currency) values('test-workspace','EUR'),('other-workspace','EUR');
    insert into public.crm_workspace_members values('test-workspace','${user}','active','staff'),('test-workspace','${otherUser}','active','staff');
    insert into public.crm_workspace_entitlements values('test-workspace','pos',true);
    insert into public.crm_inventory_items(id,workspace_id,sku,name,unit,sale_price_cents,on_hand) values
      ('${itemA}','test-workspace','A','Coffee','unit',250,100),
      ('${itemB}','test-workspace','B','Fresh fruit','kg',101,100),
      ('${otherItem}','other-workspace','C','Other business','unit',250,100);
  `);
});

const line = (item_id=itemA, quantity=1, unit_price_cents=250) => ({ item_id, quantity, unit_price_cents });
async function checkout({ workspace='test-workspace', provider='cash', reference='request-1', total=250,
  currency='EUR', employee=user, lines=[line()] }={}) {
  const { rows } = await db.query('select public.crm_record_pos_sale($1,$2,$3,$4,$5,$6,$7::jsonb) as id',
    [workspace, provider, reference, total, currency, employee, JSON.stringify(lines)]);
  return rows[0].id;
}
async function noWrites() {
  const { rows } = await db.query(`select (select count(*) from public.crm_pos_sales)::int as sales,
    (select count(*) from public.crm_pos_sale_lines)::int as lines,
    (select count(*) from public.crm_inventory_movements)::int as movements,
    (select on_hand from public.crm_inventory_items where id=$1) as stock`, [itemA]);
  assert.deepEqual(rows[0], {sales:0,lines:0,movements:0,stock:'100.000'});
}

test('server saves catalogue prices, descriptions, operator and rounded amount atomically', async () => {
  const id = await checkout({total:500,lines:[line(itemA,2)]});
  const sale = (await db.query('select * from public.crm_pos_sales where id=$1',[id])).rows[0];
  const detail = (await db.query('select * from public.crm_pos_sale_lines where sale_id=$1',[id])).rows[0];
  assert.equal(sale.checkout_integrity_version,1);
  assert.equal(sale.total_cents,500);
  assert.equal(sale.employee_profile_id,user);
  assert.equal(sale.created_by,user);
  assert.equal(detail.item_name_snapshot,'Coffee');
  assert.equal(detail.sku_snapshot,'A');
  assert.equal(detail.unit_snapshot,'unit');
  assert.equal(detail.line_total_cents,500);
  assert.equal((await db.query('select on_hand from public.crm_inventory_items where id=$1',[itemA])).rows[0].on_hand,'98.000');
});

test('forged quoted price and client total each fail without stock or sale writes', async () => {
  await assert.rejects(checkout({total:1,lines:[line(itemA,1,1)]}),/catalogue price changed/);
  await assert.rejects(checkout({total:1}),/server-calculated/);
  await noWrites();
});

test('rejects missing/null lines, non-arrays, scalars, nonnumeric values and overprecision', async () => {
  const badLines = [null, {}, [], [null], [250], [{}], [line(itemA,null)], [line(itemA,'1')],
    [line(itemA,'NaN')], [line(itemA,'Infinity')], [line(itemA,0)], [line(itemA,-1)],
    [line(itemA,0.0001)], [line(itemA,1000000000)], [line(itemA,1,1.5)],
    [line(itemA,1,-1)], [line(itemA,1,2147483648)], [line(itemA,1,null)], [line('not-a-uuid')]];
  for (const lines of badLines) await assert.rejects(checkout({lines}), /sale|quantity|price|UUID/);
  await noWrites();
});

test('requires currency matching workspace, a bounded stable reference and non-null integer total', async () => {
  for (const currency of ['USD','eur',null,'EURO']) await assert.rejects(checkout({currency}), /currency/);
  for (const reference of ['', '  ', null, 'a'.repeat(201)]) await assert.rejects(checkout({reference}), /reference/);
  for (const provider of ['', null, 'a'.repeat(81)]) await assert.rejects(checkout({provider}), /provider/);
  await assert.rejects(checkout({total:null}), /integer total/);
  await assert.rejects(checkout({total:-1}), /integer total/);
  await noWrites();
});

test('cannot impersonate another active employee', async () => {
  await assert.rejects(checkout({employee:otherUser}), /authenticated user/);
  await noWrites();
  const id = await checkout({employee:null});
  assert.equal((await db.query('select employee_profile_id from public.crm_pos_sales where id=$1',[id])).rows[0].employee_profile_id,user);
});

test('denies unauthenticated, cross-workspace, inactive membership and missing POS entitlement', async () => {
  await assert.rejects(checkout({workspace:'other-workspace'}), /access required/);
  await db.query("select set_config('request.jwt.claim.sub','',false)");
  await assert.rejects(checkout(), /access required/);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
  await db.exec("update public.crm_workspace_members set status='inactive'");
  await assert.rejects(checkout(), /access required/);
  await db.exec("update public.crm_workspace_members set status='active'; update public.crm_workspace_entitlements set active=false");
  await assert.rejects(checkout(), /access required/);
  await noWrites();
});

test('inactive/missing/cross-tenant items and suspended workspaces cannot be sold', async () => {
  await assert.rejects(checkout({lines:[line(otherItem)]}), /does not belong/);
  await assert.rejects(checkout({lines:[line('10000000-0000-4000-8000-000000000099')]}), /does not belong/);
  await db.query('update public.crm_inventory_items set active=false where id=$1',[itemA]);
  await assert.rejects(checkout(), /inactive/);
  await db.exec("update public.crm_inventory_items set active=true; update public.crm_workspaces set status='suspended'");
  await assert.rejects(checkout(), /active workspace/);
  await noWrites();
});

test('aggregates duplicate lines before rounding and decrements stock exactly once', async () => {
  // 0.004 * 101 => 0 cents each, but 0.008 * 101 => 1 cent as one item.
  const id = await checkout({total:1,lines:[line(itemB,0.004,101),line(itemB,0.004,101)]});
  const lines = (await db.query('select quantity,line_total_cents from public.crm_pos_sale_lines where sale_id=$1',[id])).rows;
  assert.deepEqual(lines,[{quantity:'0.008',line_total_cents:1}]);
  assert.equal((await db.query('select count(*)::int as n from public.crm_inventory_movements')).rows[0].n,1);
  assert.equal((await db.query('select on_hand from public.crm_inventory_items where id=$1',[itemB])).rows[0].on_hand,'99.992');
  await assert.rejects(checkout({reference:'different-prices',total:3,lines:[line(itemB,0.01,101),line(itemB,0.01,102)]}),/duplicate item/);
});

test('fractional quantities use exact positive half-up cents rounding, once per item', async () => {
  const id = await checkout({total:176,lines:[line(itemB,0.5,101),line(itemA,0.5,250)]});
  assert.equal((await db.query('select total_cents from public.crm_pos_sales where id=$1',[id])).rows[0].total_cents,176);
  const totals = (await db.query('select line_total_cents from public.crm_pos_sale_lines where sale_id=$1 order by item_id',[id])).rows;
  assert.deepEqual(totals,[{line_total_cents:125},{line_total_cents:51}]);
});

test('insufficient aggregate stock aborts the entire multi-item checkout', async () => {
  await assert.rejects(checkout({total:10701,lines:[line(itemA,2),line(itemB,101,101)]}), /insufficient inventory/);
  await noWrites();
});

test('a failing downstream movement trigger rolls back header, lines and stock', async () => {
  await db.exec(`create function public.test_fail_movement() returns trigger language plpgsql as $$
    begin raise exception 'simulated inventory failure'; end; $$;
    create trigger test_fail_movement before insert on public.crm_inventory_movements
    for each row execute function public.test_fail_movement();`);
  try {
    await assert.rejects(checkout(), /simulated inventory failure/);
    await noWrites();
  } finally {
    await db.exec('drop trigger test_fail_movement on public.crm_inventory_movements; drop function public.test_fail_movement();');
  }
});

test('same request replays original sale after item price, name, availability and workspace currency change', async () => {
  const id = await checkout();
  await db.query("update public.crm_inventory_items set sale_price_cents=500,name='Renamed',active=false where id=$1",[itemA]);
  await db.exec("update public.crm_workspaces set currency='USD' where id='test-workspace'");
  assert.equal(await checkout(),id);
  assert.equal((await db.query('select count(*)::int as n from public.crm_pos_sales')).rows[0].n,1);
  assert.equal((await db.query('select count(*)::int as n from public.crm_inventory_movements')).rows[0].n,1);
});

test('normalized retries tolerate reordered lines, split quantities, decimal scale and trimmed reference', async () => {
  const id = await checkout({total:601,lines:[line(itemA,2),line(itemB,1,101)]});
  const retry = await checkout({total:601,provider:' cash ',reference:' request-1 ',employee:null,
    lines:[line(itemB,1.000,101),line(itemA,0.75),line(itemA,1.25)]});
  assert.equal(retry,id);
  assert.equal((await db.query('select count(*)::int as n from public.crm_pos_sale_lines')).rows[0].n,2);
});

test('same request reference rejects changed payload, currency or user even if sale exists', async () => {
  await checkout();
  for (const options of [{total:500,lines:[line(itemA,2)]},{total:1,lines:[line(itemA,1,1)]},{currency:'USD'}]) {
    await assert.rejects(checkout(options),/different contents/);
  }
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[otherUser]);
  await assert.rejects(checkout({employee:otherUser}),/different contents/);
  assert.equal((await db.query('select on_hand from public.crm_inventory_items where id=$1',[itemA])).rows[0].on_hand,'99.000');
});

test('a burst of identical queued submissions produces exactly one sale and decrement', async () => {
  // PGlite serializes connections: this checks replay behavior, not multi-session MVCC.
  const ids = await Promise.all(Array.from({length:10},()=>checkout()));
  assert.equal(new Set(ids).size,1);
  assert.equal((await db.query('select count(*)::int as n from public.crm_inventory_movements')).rows[0].n,1);
});

test('legacy retry matches stored snapshots without repricing or blessing historical data', async () => {
  const id = await checkout();
  await db.exec('update public.crm_pos_sales set checkout_request=null,checkout_integrity_version=null');
  await db.query('update public.crm_inventory_items set sale_price_cents=999 where id=$1',[itemA]);
  assert.equal(await checkout(),id);
  await assert.rejects(checkout({total:999,lines:[line(itemA,1,999)]}), /legacy checkout reference/);
  assert.equal((await db.query('select checkout_integrity_version from public.crm_pos_sales')).rows[0].checkout_integrity_version,null);
});

test('zero-priced goods are allowed but excessive totals are rejected before integer cast', async () => {
  await db.query('update public.crm_inventory_items set sale_price_cents=0 where id=$1',[itemA]);
  await checkout({total:0,lines:[line(itemA,1,0)]});
  await db.query('update public.crm_inventory_items set sale_price_cents=2147483647 where id=$1',[itemB]);
  await assert.rejects(checkout({reference:'overflow',total:1,lines:[line(itemB,2,2147483647)]}), /supported integer cents limit/);
  assert.equal((await db.query('select count(*)::int as n from public.crm_pos_sales')).rows[0].n,1);
});

test('authenticated RPC works but direct mutations and anonymous RPC are denied', async () => {
  await db.exec('set role authenticated');
  const id = await checkout();
  assert.ok(id);
  await assert.rejects(db.exec("insert into public.crm_pos_sales(workspace_id,provider,external_id,total_cents,currency,created_by) values('test-workspace','cash','bypass',0,'EUR','00000000-0000-4000-8000-000000000001')"), /permission denied/);
  await assert.rejects(db.exec('delete from public.crm_pos_sales'), /permission denied/);
  await db.exec('reset role; set role anon');
  await assert.rejects(checkout(), /permission denied for function/);
  await db.exec('reset role');
});

test('migration locks down its definer search path and public execution privilege', async () => {
  const row = (await db.query("select prosecdef,proconfig,has_function_privilege('anon',oid,'execute') as anon_can_execute from pg_proc where proname='crm_record_pos_sale'")).rows[0];
  assert.equal(row.prosecdef,true);
  assert.ok(row.proconfig.includes('search_path=""'));
  assert.equal(row.anon_can_execute,false);
});

test('only verified new-request rejection uses the safe-to-reset P0N01 code', async () => {
  await assert.rejects(checkout({total:1}), {code:'P0N01'});
  await noWrites();
  await checkout();
  await assert.rejects(checkout({total:1}), {code:'22023'});
  await db.exec("update public.crm_workspace_entitlements set active=false");
  await assert.rejects(checkout(), {code:'42501'});
  assert.equal((await db.query('select count(*)::int as n from public.crm_pos_sales')).rows[0].n,1);
});

test('old transaction snapshots cannot claim an unrecorded request', async () => {
  await db.exec('begin isolation level repeatable read');
  try { await assert.rejects(checkout({total:1}), {code:'25001'}); }
  finally { await db.exec('rollback'); }
  await noWrites();
});

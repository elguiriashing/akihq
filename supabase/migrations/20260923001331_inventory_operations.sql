-- Operational stock ledger. This does not constitute an accounting general ledger,
-- supplier invoice book, lot traceability system or certified historical valuation.
begin;

create schema if not exists akihq_inventory;
revoke all on schema akihq_inventory from public;
grant usage on schema akihq_inventory to authenticated;

create table public.crm_inventory_locations (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.crm_workspaces(id) on delete restrict,
  code text not null check (code ~ '^[A-Z0-9_-]{1,32}$'),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  is_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default clock_timestamp(),
  created_by uuid,
  unique (workspace_id, code), unique(workspace_id, id)
);
create unique index crm_inventory_one_default_location on public.crm_inventory_locations(workspace_id) where is_default;

create table public.crm_inventory_operations (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.crm_workspaces(id) on delete restrict,
  request_key text not null check (char_length(request_key) between 8 and 160),
  operation_type text not null check (operation_type in ('receive','transfer','count','waste')),
  request jsonb not null,
  reason text not null check(char_length(btrim(reason)) between 3 and 1000),
  supplier_name text,
  reference text,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  actor_id uuid not null,
  approved_by uuid,
  recorded_at timestamptz not null default clock_timestamp(),
  unique(workspace_id, request_key), unique(workspace_id, id)
);

create table public.crm_inventory_operation_cancellations (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.crm_workspaces(id) on delete restrict,
  request_key text not null check(char_length(request_key) between 8 and 160),
  request jsonb not null,
  actor_id uuid not null,
  recorded_at timestamptz not null default clock_timestamp(),
  unique(workspace_id,request_key)
);

create table public.crm_inventory_location_balances (
  workspace_id text not null references public.crm_workspaces(id) on delete restrict,
  item_id uuid not null references public.crm_inventory_items(id) on delete restrict,
  location_id uuid not null,
  quantity numeric not null default 0 check(quantity >= 0 and quantity <> 'NaN'::numeric),
  -- Fractions of a cent are retained until presentation. NULL means cost is unknown.
  carrying_value_cents numeric(30,6) check(carrying_value_cents >= 0),
  updated_at timestamptz not null default clock_timestamp(),
  primary key(workspace_id,item_id,location_id),
  foreign key(workspace_id,location_id) references public.crm_inventory_locations(workspace_id,id) on delete restrict
);

create table public.crm_inventory_value_events (
  id bigint generated always as identity primary key,
  workspace_id text not null references public.crm_workspaces(id) on delete restrict,
  item_id uuid not null references public.crm_inventory_items(id) on delete restrict,
  location_id uuid not null,
  movement_id uuid unique references public.crm_inventory_movements(id) deferrable initially deferred,
  operation_id uuid,
  event_type text not null,
  quantity_delta numeric not null,
  quantity_after numeric not null check(quantity_after >= 0),
  unit_cost_cents numeric(24,6),
  value_delta_cents numeric(30,6),
  carrying_value_cents numeric(30,6),
  currency text not null check(currency ~ '^[A-Z]{3}$'),
  sku text,
  item_name text not null,
  unit text not null,
  actor_id uuid,
  recorded_at timestamptz not null default clock_timestamp(),
  foreign key(workspace_id,location_id) references public.crm_inventory_locations(workspace_id,id) on delete restrict,
  foreign key(workspace_id,operation_id) references public.crm_inventory_operations(workspace_id,id) on delete restrict
);
create index crm_inventory_value_events_asof on public.crm_inventory_value_events(workspace_id,item_id,location_id,recorded_at desc,id desc);
create index crm_inventory_operations_recorded on public.crm_inventory_operations(workspace_id,recorded_at desc,id);

alter table public.crm_inventory_movements
  add column location_id uuid,
  add column operation_id uuid,
  add column receipt_unit_cost_cents numeric(24,6),
  add column movement_value_cents numeric(30,6),
  add constraint crm_inventory_movement_location_fk foreign key(workspace_id,location_id) references public.crm_inventory_locations(workspace_id,id) on delete restrict,
  add constraint crm_inventory_movement_operation_fk foreign key(workspace_id,operation_id) references public.crm_inventory_operations(workspace_id,id) on delete restrict;

alter table public.crm_inventory_locations enable row level security;
alter table public.crm_inventory_operations enable row level security;
alter table public.crm_inventory_operation_cancellations enable row level security;
alter table public.crm_inventory_location_balances enable row level security;
alter table public.crm_inventory_value_events enable row level security;
create policy inventory_locations_read on public.crm_inventory_locations for select to authenticated using(public.crm_has_tool(workspace_id,'inventory') or public.crm_has_tool(workspace_id,'pos'));
create policy inventory_operations_read on public.crm_inventory_operations for select to authenticated using(public.crm_has_tool(workspace_id,'inventory'));
create policy inventory_cancellations_read on public.crm_inventory_operation_cancellations for select to authenticated using(public.crm_has_tool(workspace_id,'inventory'));
create policy inventory_balances_read on public.crm_inventory_location_balances for select to authenticated using(public.crm_has_tool(workspace_id,'inventory'));
create policy inventory_values_read on public.crm_inventory_value_events for select to authenticated using(public.crm_has_tool(workspace_id,'inventory'));
revoke all on public.crm_inventory_locations,public.crm_inventory_operations,public.crm_inventory_operation_cancellations,public.crm_inventory_location_balances,public.crm_inventory_value_events from anon,authenticated;
grant select on public.crm_inventory_locations,public.crm_inventory_operations,public.crm_inventory_operation_cancellations,public.crm_inventory_location_balances,public.crm_inventory_value_events to authenticated;

-- The old aggregate trigger remains the only writer of crm_inventory_items.on_hand.
-- This hook mirrors the SAME movement into the location/value subledger, never
-- inserts a second sale deduction and never modifies the aggregate quantity.
create function akihq_inventory.ensure_item(p_workspace text,p_item uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_item public.crm_inventory_items%rowtype; v_default uuid; v_currency text;
begin
  if (select auth.uid()) is null then raise exception 'Authenticated stock operator required'; end if;
  select * into v_item from public.crm_inventory_items where id=p_item and workspace_id=p_workspace for update;
  if not found then raise exception 'Inventory item does not belong to workspace'; end if;
  select id into v_default from public.crm_inventory_locations where workspace_id=p_workspace and is_default;
  if v_default is null then
    insert into public.crm_inventory_locations(workspace_id,code,name,is_default,created_by)
      values(p_workspace,'MAIN','Main stock / PoS',true,(select auth.uid()))
      on conflict (workspace_id) where is_default do nothing returning id into v_default;
    if v_default is null then select id into v_default from public.crm_inventory_locations where workspace_id=p_workspace and is_default; end if;
  end if;
  if not exists(select 1 from public.crm_inventory_location_balances where workspace_id=p_workspace and item_id=p_item) then
    select currency into v_currency from public.crm_workspaces where id=p_workspace;
    insert into public.crm_inventory_location_balances(workspace_id,item_id,location_id,quantity,carrying_value_cents)
      values(p_workspace,p_item,v_default,v_item.on_hand,case when v_item.on_hand=0 then 0 else null end);
    insert into public.crm_inventory_value_events(workspace_id,item_id,location_id,event_type,quantity_delta,quantity_after,carrying_value_cents,currency,sku,item_name,unit,actor_id)
      values(p_workspace,p_item,v_default,'opening_unverified',v_item.on_hand,v_item.on_hand,case when v_item.on_hand=0 then 0 else null end,v_currency,v_item.sku,v_item.name,v_item.unit,(select auth.uid()));
  end if;
  return v_default;
end;
$$;

create function akihq_inventory.apply_movement()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  v_default uuid; v_balance public.crm_inventory_location_balances%rowtype;
  v_item public.crm_inventory_items%rowtype; v_delta numeric; v_value numeric;
  v_currency text; v_type text; v_receipt_cost numeric;
begin
  if (select auth.uid()) is null then raise exception 'Authenticated stock operator required'; end if;
  if not (public.crm_has_tool(new.workspace_id,'inventory') or public.crm_has_tool(new.workspace_id,'pos'))
      or not public.crm_can_operate_workspace(new.workspace_id) then raise exception 'Stock operation access required'; end if;
  if new.quantity_delta is null or new.quantity_delta::text in ('NaN','Infinity','-Infinity') or new.quantity_delta=0
      or new.quantity_delta <> round(new.quantity_delta,3) or abs(new.quantity_delta)>1000000000 then raise exception 'Stock quantities require at most 3 decimal places and must be nonzero'; end if;
  v_default:=akihq_inventory.ensure_item(new.workspace_id,new.item_id);
  new.location_id:=coalesce(new.location_id,v_default);
  if not exists(select 1 from public.crm_inventory_locations where id=new.location_id and workspace_id=new.workspace_id and active) then raise exception 'Active workspace location required'; end if;
  select * into v_item from public.crm_inventory_items where id=new.item_id and workspace_id=new.workspace_id;
  select currency into v_currency from public.crm_workspaces where id=new.workspace_id;
  insert into public.crm_inventory_location_balances(workspace_id,item_id,location_id,quantity,carrying_value_cents)
    values(new.workspace_id,new.item_id,new.location_id,0,0) on conflict do nothing;
  select * into v_balance from public.crm_inventory_location_balances where workspace_id=new.workspace_id and item_id=new.item_id and location_id=new.location_id for update;
  if v_balance.quantity+new.quantity_delta < 0 then raise exception 'Insufficient stock at selected location; transfer stock to Main stock / PoS before checkout'; end if;
  if new.operation_id is not null then
    select operation_type into v_type from public.crm_inventory_operations where id=new.operation_id and workspace_id=new.workspace_id;
    if v_type is null then raise exception 'Inventory operation not found'; end if;
  end if;
  -- Only the validated receiving RPC may assert a purchase cost.
  if new.quantity_delta > 0 and v_type='receive' then
    v_receipt_cost:=new.receipt_unit_cost_cents;
    if v_receipt_cost is null or v_receipt_cost::text in ('NaN','Infinity','-Infinity') or v_receipt_cost<0 then raise exception 'Receipt cost required'; end if;
    v_delta:=round(new.quantity_delta*v_receipt_cost,6);
  elsif v_type='transfer' and new.quantity_delta>0 then
    -- Transfer carries exactly the value removed from the source, including NULL.
    select -e.value_delta_cents into v_delta from public.crm_inventory_value_events e
      where e.operation_id=new.operation_id and e.item_id=new.item_id and e.quantity_delta<0 order by e.id desc limit 1;
    if not found then raise exception 'Transfer credit requires paired stock debit'; end if;
  elsif new.quantity_delta>0 and v_type is distinct from 'count' then
    -- A legacy return has no verified link to its original removed cost. It must
    -- not silently fabricate a reversal of historical cost of goods sold.
    v_delta:=null;
  elsif v_balance.carrying_value_cents is null then
    v_delta:=null;
  elsif v_balance.quantity>0 then
    v_delta:=case when new.quantity_delta=-v_balance.quantity then -v_balance.carrying_value_cents
      else round(new.quantity_delta*v_balance.carrying_value_cents/v_balance.quantity,6) end;
  else
    -- Positive count adjustments without a defensible cost never create zero-cost stock.
    v_delta:=null;
  end if;
  v_value:=case when v_balance.quantity+new.quantity_delta=0 then 0 else v_balance.carrying_value_cents+v_delta end;
  new.movement_value_cents:=v_delta;
  new.receipt_unit_cost_cents:=v_receipt_cost;
  new.created_by:=(select auth.uid());
  new.occurred_at:=clock_timestamp();
  update public.crm_inventory_location_balances set quantity=quantity+new.quantity_delta,carrying_value_cents=v_value,updated_at=new.occurred_at
    where workspace_id=new.workspace_id and item_id=new.item_id and location_id=new.location_id;
  insert into public.crm_inventory_value_events(workspace_id,item_id,location_id,movement_id,operation_id,event_type,quantity_delta,quantity_after,unit_cost_cents,value_delta_cents,carrying_value_cents,currency,sku,item_name,unit,actor_id,recorded_at)
    values(new.workspace_id,new.item_id,new.location_id,new.id,new.operation_id,new.movement_type,new.quantity_delta,v_balance.quantity+new.quantity_delta,v_receipt_cost,v_delta,v_value,v_currency,v_item.sku,v_item.name,v_item.unit,(select auth.uid()),new.occurred_at);
  return new;
end;
$$;
create trigger crm_inventory_00_location_value before insert on public.crm_inventory_movements for each row execute function akihq_inventory.apply_movement();

create function akihq_inventory.immutable_record()
returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Recorded stock evidence is immutable; post a new approved correction'; end;
$$;
create trigger inventory_operation_immutable before update or delete on public.crm_inventory_operations for each row execute function akihq_inventory.immutable_record();
create trigger inventory_cancellation_immutable before update or delete on public.crm_inventory_operation_cancellations for each row execute function akihq_inventory.immutable_record();
create trigger inventory_value_immutable before update or delete on public.crm_inventory_value_events for each row execute function akihq_inventory.immutable_record();
create trigger inventory_movement_immutable before update or delete on public.crm_inventory_movements for each row execute function akihq_inventory.immutable_record();

create function akihq_inventory.guard_item_unit()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' then
    if new.on_hand<>0 then raise exception 'Create stock items with zero opening balance; record opening stock through receiving'; end if;
    return new;
  end if;
  if new.workspace_id is distinct from old.workspace_id then raise exception 'Stock items cannot move between workspaces'; end if;
  if new.on_hand is distinct from old.on_hand and pg_trigger_depth()<2 then raise exception 'Stock balances change only through recorded movements'; end if;
  if new.unit is distinct from old.unit and (old.on_hand<>0 or exists(select 1 from public.crm_inventory_movements where item_id=old.id)) then
    raise exception 'A stocked item cannot change units; create a separate SKU and record a documented conversion';
  end if;
  return new;
end;
$$;
create trigger inventory_unit_history before insert or update on public.crm_inventory_items for each row execute function akihq_inventory.guard_item_unit();

create function akihq_inventory.guard_currency()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.currency is distinct from old.currency and exists(select 1 from public.crm_inventory_value_events where workspace_id=old.id) then raise exception 'Stock valuation currency is locked after tracking begins; use a reviewed currency migration'; end if;
  return new;
end;
$$;
create trigger inventory_currency_history before update on public.crm_workspaces for each row execute function akihq_inventory.guard_currency();

create function akihq_inventory.location_create(p_workspace text,p_name text,p_code text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  if (select auth.uid()) is null or not public.crm_can_manage_workspace(p_workspace) or not public.crm_has_tool(p_workspace,'inventory') then raise exception 'Inventory manager access required'; end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 120 or p_code is null or upper(btrim(p_code)) !~ '^[A-Z0-9_-]{1,32}$' or upper(btrim(p_code))='MAIN' then raise exception 'Name and unique location code required; MAIN is reserved'; end if;
  insert into public.crm_inventory_locations(workspace_id,name,code,created_by) values(p_workspace,btrim(p_name),upper(btrim(p_code)),(select auth.uid())) returning id into v_id;
  return v_id;
end;
$$;
create function public.crm_inventory_location_create(p_workspace text,p_name text,p_code text)
returns uuid language sql security invoker set search_path='' as $$ select akihq_inventory.location_create(p_workspace,p_name,p_code); $$;

create function akihq_inventory.operation(p_workspace text,p_key text,p_operation jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_id uuid; v_existing public.crm_inventory_operations%rowtype; v_type text:=p_operation->>'type';
  v_line record; v_default uuid; v_from uuid; v_to uuid; v_quantity numeric;
  v_currency text; v_delta numeric; v_cost numeric; v_reason text:=btrim(p_operation->>'reason');
begin
  if (select auth.uid()) is null or not public.crm_can_operate_workspace(p_workspace) or not public.crm_has_tool(p_workspace,'inventory') then raise exception 'Inventory operation access required'; end if;
  if p_key is null or char_length(p_key) not between 8 and 160 then raise exception 'Stable inventory request key required'; end if;
  if jsonb_typeof(p_operation) is distinct from 'object' or v_type is null or v_type not in ('receive','transfer','count','waste') then raise exception 'Unsupported inventory operation'; end if;
  if v_reason is null or char_length(v_reason) not between 3 and 1000 then raise exception 'Record a reason between 3 and 1000 characters'; end if;
  if jsonb_typeof(p_operation->'lines') is distinct from 'array' or jsonb_array_length(p_operation->'lines') not between 1 and 100 then raise exception 'Provide between 1 and 100 stock lines'; end if;
  if v_type in ('count','waste') and not public.crm_can_manage_workspace(p_workspace) then raise exception 'Stock counts and waste require manager approval'; end if;
  if v_type='receive' and (coalesce(char_length(btrim(p_operation->>'supplier_name')),0) not between 1 and 200 or coalesce(char_length(btrim(p_operation->>'reference')),0) not between 1 and 160) then raise exception 'Supplier and delivery or invoice reference required'; end if;
  perform 1 from public.crm_workspaces where id=p_workspace for share;
  perform pg_advisory_xact_lock(hashtextextended(p_workspace||':inventory:'||p_key,0));
  if exists(select 1 from public.crm_inventory_operation_cancellations where workspace_id=p_workspace and request_key=p_key) then raise exception 'Inventory request was cancelled; create a new reviewed request'; end if;
  select * into v_existing from public.crm_inventory_operations where workspace_id=p_workspace and request_key=p_key;
  if found then
    if v_existing.request<>p_operation or v_existing.actor_id<>(select auth.uid()) then raise exception 'Inventory request key already used for different contents or operator'; end if;
    return v_existing.id;
  end if;
  if exists(select 1 from jsonb_array_elements(p_operation->'lines') l where jsonb_typeof(l) is distinct from 'object' or not (l ? 'item_id') or not (l ? 'quantity')) then raise exception 'Invalid stock line'; end if;
  if (select count(*) from jsonb_array_elements(p_operation->'lines')) <> (select count(distinct (l->>'item_id')::uuid) from jsonb_array_elements(p_operation->'lines') l) then raise exception 'Combine duplicate item lines'; end if;
  -- Consistent item lock order also coordinates with checkout.
  for v_line in select * from jsonb_to_recordset(p_operation->'lines') as l(item_id uuid,quantity numeric,unit_cost_cents numeric,expected_quantity numeric) order by item_id loop
    if v_line.item_id is null or v_line.quantity is null or v_line.quantity::text in ('NaN','Infinity','-Infinity') or v_line.quantity<>round(v_line.quantity,3) or v_line.quantity>1000000000 or v_line.quantity<0 or (v_type<>'count' and v_line.quantity=0) then raise exception 'Invalid quantity; use at most 3 decimals'; end if;
    perform 1 from public.crm_inventory_items where id=v_line.item_id and workspace_id=p_workspace and active for update;
    if not found then raise exception 'Active workspace inventory item required'; end if;
    if v_type='receive' and (v_line.unit_cost_cents is null or v_line.unit_cost_cents::text in ('NaN','Infinity','-Infinity') or v_line.unit_cost_cents<0 or v_line.unit_cost_cents>1000000000000 or v_line.unit_cost_cents<>round(v_line.unit_cost_cents,6)) then raise exception 'Receipt unit cost required; use at most 6 decimal places in cents'; end if;
    if v_type='count' and (v_line.expected_quantity is null or v_line.expected_quantity::text in ('NaN','Infinity','-Infinity') or v_line.expected_quantity<0) then raise exception 'Count requires the balance observed before counting'; end if;
  end loop;
  select currency into v_currency from public.crm_workspaces where id=p_workspace;
  insert into public.crm_inventory_operations(workspace_id,request_key,operation_type,request,reason,supplier_name,reference,currency,actor_id,approved_by)
    values(p_workspace,p_key,v_type,p_operation,v_reason,case when v_type='receive' then btrim(p_operation->>'supplier_name') end,case when v_type='receive' then btrim(p_operation->>'reference') end,v_currency,(select auth.uid()),case when v_type in ('count','waste') then (select auth.uid()) end) returning id into v_id;
  for v_line in select * from jsonb_to_recordset(p_operation->'lines') as l(item_id uuid,quantity numeric,unit_cost_cents numeric,expected_quantity numeric) order by item_id loop
    v_default:=akihq_inventory.ensure_item(p_workspace,v_line.item_id);
    v_from:=coalesce(nullif(case when v_type='transfer' then p_operation->>'from_location_id' else p_operation->>'location_id' end,'')::uuid,v_default);
    if not exists(select 1 from public.crm_inventory_locations where id=v_from and workspace_id=p_workspace and active) then raise exception 'Active source location required'; end if;
    insert into public.crm_inventory_location_balances(workspace_id,item_id,location_id,quantity,carrying_value_cents) values(p_workspace,v_line.item_id,v_from,0,0) on conflict do nothing;
    select quantity into v_quantity from public.crm_inventory_location_balances where workspace_id=p_workspace and item_id=v_line.item_id and location_id=v_from;
    if v_type='count' and v_quantity<>v_line.expected_quantity then raise exception 'Stock changed since the count began; refresh and recount'; end if;
    v_delta:=case v_type when 'receive' then v_line.quantity when 'count' then v_line.quantity-v_quantity else -v_line.quantity end;
    if v_delta<>0 then
      insert into public.crm_inventory_movements(workspace_id,item_id,quantity_delta,movement_type,source_type,source_id,employee_profile_id,notes,created_by,location_id,operation_id,receipt_unit_cost_cents)
        values(p_workspace,v_line.item_id,v_delta,case v_type when 'receive' then 'purchase' else v_type end,'inventory_operation',v_id::text,(select auth.uid()),v_reason,(select auth.uid()),v_from,v_id,case when v_type='receive' then v_line.unit_cost_cents end);
    end if;
    if v_type='transfer' then
      v_to:=nullif(p_operation->>'to_location_id','')::uuid;
      if v_to is null or v_to=v_from or not exists(select 1 from public.crm_inventory_locations where id=v_to and workspace_id=p_workspace and active) then raise exception 'Choose a different active destination location'; end if;
      insert into public.crm_inventory_movements(workspace_id,item_id,quantity_delta,movement_type,source_type,source_id,employee_profile_id,notes,created_by,location_id,operation_id)
        values(p_workspace,v_line.item_id,v_line.quantity,'transfer','inventory_operation',v_id::text,(select auth.uid()),v_reason,(select auth.uid()),v_to,v_id);
    end if;
  end loop;
  return v_id;
end;
$$;
create function public.crm_inventory_operation(p_workspace text,p_key text,p_operation jsonb)
returns uuid language sql security invoker set search_path='' as $$ select akihq_inventory.operation(p_workspace,p_key,p_operation); $$;

-- Reconciliation serializes against submission on the identical advisory lock.
-- A committed request is returned; an absent request is permanently cancelled.
-- An old HTTP request that arrives afterwards cannot resurrect a cancelled key.
create function akihq_inventory.reconcile_operation(p_workspace text,p_key text,p_operation jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_existing public.crm_inventory_operations%rowtype; v_cancel public.crm_inventory_operation_cancellations%rowtype;
begin
  if (select auth.uid()) is null or not public.crm_can_operate_workspace(p_workspace) or not public.crm_has_tool(p_workspace,'inventory') then raise exception 'Inventory operation access required'; end if;
  if p_key is null or char_length(p_key) not between 8 and 160 or jsonb_typeof(p_operation) is distinct from 'object' then raise exception 'Original request key and payload required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_workspace||':inventory:'||p_key,0));
  select * into v_existing from public.crm_inventory_operations where workspace_id=p_workspace and request_key=p_key;
  if found then
    if v_existing.actor_id<>(select auth.uid()) or v_existing.request<>p_operation then raise exception 'Recorded request belongs to different contents or operator'; end if;
    return jsonb_build_object('status','committed','request_key',p_key,'operation_id',v_existing.id);
  end if;
  select * into v_cancel from public.crm_inventory_operation_cancellations where workspace_id=p_workspace and request_key=p_key;
  if found then
    if v_cancel.actor_id<>(select auth.uid()) or v_cancel.request<>p_operation then raise exception 'Cancelled request belongs to different contents or operator'; end if;
  else
    insert into public.crm_inventory_operation_cancellations(workspace_id,request_key,request,actor_id) values(p_workspace,p_key,p_operation,(select auth.uid()));
  end if;
  return jsonb_build_object('status','cancelled','request_key',p_key,'operation_id',null);
end;
$$;
create function public.crm_inventory_reconcile_operation(p_workspace text,p_key text,p_operation jsonb)
returns jsonb language sql security invoker set search_path='' as $$ select akihq_inventory.reconcile_operation(p_workspace,p_key,p_operation); $$;

-- A snapshot has validity only from the date its evidence was recorded. Unknown
-- legacy costs and pre-tracking quantities remain NULL, never fictitious zeroes.
create function public.crm_inventory_valuation(p_workspace text,p_at timestamptz default now())
returns table(item_id uuid,location_id uuid,sku text,item_name text,unit text,quantity numeric,carrying_value_cents numeric,currency text,cost_status text,recorded_at timestamptz)
language sql stable security invoker set search_path='' as $$
  with latest as (
    select distinct on(e.item_id,e.location_id) e.* from public.crm_inventory_value_events e
    where e.workspace_id=p_workspace and e.recorded_at<=p_at and p_at<=now()
    order by e.item_id,e.location_id,e.recorded_at desc,e.id desc
  )
  select l.item_id,l.location_id,l.sku,l.item_name,l.unit,l.quantity_after,l.carrying_value_cents,l.currency,
    case when l.carrying_value_cents is null then 'unknown_cost' else 'recorded_weighted_average' end,l.recorded_at from latest l
  union all
  select i.id,null::uuid,i.sku,i.name,i.unit,null::numeric,null::numeric,w.currency,'not_recorded',null::timestamptz
  from public.crm_inventory_items i join public.crm_workspaces w on w.id=i.workspace_id
  where i.workspace_id=p_workspace and public.crm_has_tool(p_workspace,'inventory') and not exists(select 1 from latest l where l.item_id=i.id);
$$;

revoke all on function akihq_inventory.ensure_item(text,uuid),akihq_inventory.apply_movement(),akihq_inventory.immutable_record(),akihq_inventory.guard_item_unit(),akihq_inventory.guard_currency(),akihq_inventory.location_create(text,text,text),akihq_inventory.operation(text,text,jsonb),akihq_inventory.reconcile_operation(text,text,jsonb) from public,anon,authenticated;
grant execute on function akihq_inventory.location_create(text,text,text),akihq_inventory.operation(text,text,jsonb),akihq_inventory.reconcile_operation(text,text,jsonb) to authenticated;
revoke all on function public.crm_inventory_location_create(text,text,text),public.crm_inventory_operation(text,text,jsonb),public.crm_inventory_reconcile_operation(text,text,jsonb),public.crm_inventory_valuation(text,timestamptz) from public,anon;
grant execute on function public.crm_inventory_location_create(text,text,text),public.crm_inventory_operation(text,text,jsonb),public.crm_inventory_reconcile_operation(text,text,jsonb),public.crm_inventory_valuation(text,timestamptz) to authenticated;

-- Direct writes bypass receiving evidence and manager approvals. Rollout must
-- ship the new frontend alongside this migration; old clients fail visibly.
revoke insert,update,delete on public.crm_inventory_movements from authenticated;
comment on table public.crm_inventory_value_events is 'Append-only operational valuation from adoption onward. NULL cost is unknown. Not a general ledger or evidence of pre-adoption stock value.';
commit;

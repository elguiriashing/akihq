-- Operational checkout integrity only. This does not issue fiscal invoices,
-- calculate IVA, collect payment, or declare SIF/VERI*FACTU compliance.
begin;

alter table public.crm_pos_sales
  add column if not exists checkout_request jsonb
    check (checkout_request is null or jsonb_typeof(checkout_request) = 'object'),
  add column if not exists checkout_integrity_version smallint
    check (checkout_integrity_version is null or checkout_integrity_version = 1);

alter table public.crm_pos_sale_lines
  add column if not exists item_name_snapshot text,
  add column if not exists sku_snapshot text,
  add column if not exists unit_snapshot text,
  add column if not exists line_total_cents integer check (line_total_cents >= 0);

comment on column public.crm_pos_sales.checkout_request is
  'Original normalized checkout request, compared structurally for retries before looking up mutable catalogue values. Null means legacy/unverified.';
comment on column public.crm_pos_sale_lines.line_total_cents is
  'Operational amount in currency minor units: round(aggregated item quantity * catalogue unit price). Not a tax basis or fiscal invoice amount.';

create or replace function public.crm_record_pos_sale(
  p_workspace text,
  p_provider text,
  p_external_id text,
  p_total_cents integer,
  p_currency text,
  p_employee_profile uuid,
  p_lines jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_provider text := btrim(p_provider);
  v_external_id text := btrim(p_external_id);
  v_sale public.crm_pos_sales%rowtype;
  v_item public.crm_inventory_items%rowtype;
  v_line jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_normalized jsonb;
  v_priced jsonb := '[]'::jsonb;
  v_request jsonb;
  v_legacy_request jsonb;
  v_item_id uuid;
  v_quantity numeric;
  v_price numeric;
  v_line_total numeric;
  v_total numeric := 0;
  v_currency text;
  v_sale_id uuid;
begin
  if v_actor is null
     or not coalesce(public.crm_can_operate_workspace(p_workspace), false)
     or not coalesce(public.crm_has_tool(p_workspace, 'pos'), false) then
    raise exception using errcode = '42501', message = 'point-of-sale access required';
  end if;
  -- An administrator can operate an authorised workspace but cannot attribute
  -- a sale to another employee. Delegated attribution needs a separate audit flow.
  if p_employee_profile is not null and p_employee_profile <> v_actor then
    raise exception using errcode = '42501', message = 'sale operator must be the authenticated user';
  end if;
  if v_provider is null or char_length(v_provider) not between 1 and 80
     or v_external_id is null or char_length(v_external_id) not between 1 and 200
     or p_total_cents is null or p_total_cents < 0
     or p_currency is null or p_currency !~ '^[A-Z]{3}$' then
    raise exception using errcode = '22023', message = 'valid provider, request reference, currency and integer total required';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception using errcode = '22023', message = 'sale lines must be a JSON array';
  end if;
  if jsonb_array_length(p_lines) not between 1 and 500 then
    raise exception using errcode = '22023', message = 'between 1 and 500 sale lines required';
  end if;

  -- Check JSON types before casts: do not silently turn fractional cents into
  -- integers or accept numeric strings/NaN/Infinity as quantities.
  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    if jsonb_typeof(v_line) <> 'object'
       or jsonb_typeof(v_line->'item_id') is distinct from 'string'
       or jsonb_typeof(v_line->'quantity') is distinct from 'number'
       or jsonb_typeof(v_line->'unit_price_cents') is distinct from 'number' then
      raise exception using errcode = '22023', message = 'each sale line requires an item UUID, numeric quantity and integer unit price';
    end if;
    begin
      v_item_id := (v_line->>'item_id')::uuid;
    exception when invalid_text_representation then
      raise exception using errcode = '22023', message = 'invalid sale item UUID';
    end;
    v_quantity := (v_line->>'quantity')::numeric;
    v_price := (v_line->>'unit_price_cents')::numeric;
    if v_quantity <= 0 or v_quantity > 999999999.999
       or v_quantity <> round(v_quantity, 3)
       or v_price < 0 or v_price > 2147483647 or v_price <> trunc(v_price) then
      raise exception using errcode = '22023', message = 'quantity must be positive with at most 3 decimals; price must be integer cents';
    end if;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'item_id', v_item_id, 'quantity', v_quantity, 'unit_price_cents', v_price));
  end loop;

  if exists (
    select 1 from jsonb_to_recordset(v_lines) as line(item_id uuid, quantity numeric, unit_price_cents integer)
    group by item_id having count(distinct unit_price_cents) <> 1 or sum(quantity) > 999999999.999
  ) then
    raise exception using errcode = '22023', message = 'duplicate item lines must quote the same price and fit the quantity limit';
  end if;
  -- One item has one rounded line total and one stock movement, regardless of
  -- whether the browser submitted that item once or in multiple lines.
  select jsonb_agg(jsonb_build_object(
    'item_id', line.item_id, 'quantity', line.quantity, 'unit_price_cents', line.unit_price_cents
  ) order by line.item_id) into v_normalized
  from (
    select item_id, sum(quantity) as quantity, min(unit_price_cents) as unit_price_cents
    from jsonb_to_recordset(v_lines) as input(item_id uuid, quantity numeric, unit_price_cents integer)
    group by item_id
  ) line;
  v_request := jsonb_build_object('version', 1, 'actor', v_actor,
    'provider', v_provider, 'currency', p_currency, 'total_cents', p_total_cents, 'lines', v_normalized);

  -- The lock key includes the entire legacy idempotency namespace. Hash
  -- collisions only serialize unrelated requests; they cannot equate payloads.
  perform pg_advisory_xact_lock(hashtextextended(
    jsonb_build_array('crm-pos-checkout-v1', p_workspace, v_provider, v_external_id)::text, 0));
  select * into v_sale from public.crm_pos_sales
  where workspace_id = p_workspace and provider = v_provider and external_id = v_external_id
  for update;
  if found then
    if v_sale.checkout_request is not null then
      if v_sale.checkout_request is distinct from v_request then
        raise exception using errcode = '22023', message = 'checkout request reference already used for different contents';
      end if;
    else
      -- Old completed sales are never repriced, backfilled as verified, or
      -- blindly acknowledged for a different payload.
      select jsonb_build_object('version', 1, 'actor', v_sale.created_by,
        'provider', v_sale.provider, 'currency', v_sale.currency, 'total_cents', v_sale.total_cents,
        'lines', jsonb_agg(jsonb_build_object('item_id', line.item_id, 'quantity', line.quantity,
          'unit_price_cents', line.unit_price_cents) order by line.item_id, line.unit_price_cents))
      into v_legacy_request
      from (
        select item_id, sum(quantity) as quantity, unit_price_cents
        from public.crm_pos_sale_lines where sale_id = v_sale.id and workspace_id = p_workspace
        group by item_id, unit_price_cents
      ) line;
      if v_sale.employee_profile_id is distinct from v_actor or v_legacy_request is distinct from v_request then
        raise exception using errcode = '22023', message = 'legacy checkout reference does not match this request';
      end if;
    end if;
    return v_sale.id;
  end if;

  -- P0N01 means this reference was absent after the same-key lock and this new
  -- attempt was rejected without a sale. That evidence requires a fresh
  -- READ COMMITTED snapshot; do not make an absence claim from an older one.
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception using errcode = '25001', message = 'new checkout requires READ COMMITTED transaction isolation';
  end if;

  select currency into v_currency from public.crm_workspaces
  where id = p_workspace and status = 'active' for share;
  if not found or p_currency is distinct from v_currency then
    raise exception using errcode = 'P0N01', message = 'sale currency must match the active workspace currency';
  end if;
  -- All items are locked in UUID order to prevent overselling and avoid
  -- deadlocks between baskets containing the same products in different order.
  for v_line in select value from jsonb_array_elements(v_normalized)
  loop
    v_item_id := (v_line->>'item_id')::uuid;
    v_quantity := (v_line->>'quantity')::numeric;
    select * into v_item from public.crm_inventory_items
    where id = v_item_id and workspace_id = p_workspace and active for update;
    if not found then
      raise exception using errcode = 'P0N01', message = 'sale item is inactive or does not belong to this workspace';
    end if;
    if v_item.sale_price_cents is null or v_item.sale_price_cents < 0
       or v_item.sale_price_cents <> (v_line->>'unit_price_cents')::integer then
      raise exception using errcode = 'P0N01', message = 'catalogue price changed; refresh and confirm a new checkout request';
    end if;
    if v_item.on_hand::text in ('NaN', 'Infinity', '-Infinity') or v_item.on_hand < v_quantity then
      raise exception using errcode = 'P0N01', message = 'insufficient inventory for sale';
    end if;
    v_line_total := round(v_quantity * v_item.sale_price_cents::numeric, 0);
    v_total := v_total + v_line_total;
    if v_total > 2147483647 then
      raise exception using errcode = 'P0N01', message = 'sale total exceeds supported integer cents limit';
    end if;
    v_priced := v_priced || jsonb_build_array(v_line || jsonb_build_object(
      'item_name_snapshot', v_item.name, 'sku_snapshot', v_item.sku,
      'unit_snapshot', v_item.unit, 'line_total_cents', v_line_total));
  end loop;
  if p_total_cents <> v_total then
    raise exception using errcode = 'P0N01', message = 'sale total does not match server-calculated line totals';
  end if;

  insert into public.crm_pos_sales(workspace_id, provider, external_id, total_cents,
    currency, employee_profile_id, created_by, checkout_request, checkout_integrity_version)
  values (p_workspace, v_provider, v_external_id, v_total::integer,
    p_currency, v_actor, v_actor, v_request, 1) returning id into v_sale_id;

  for v_line in select value from jsonb_array_elements(v_priced)
  loop
    insert into public.crm_pos_sale_lines(sale_id, workspace_id, item_id, quantity,
      unit_price_cents, item_name_snapshot, sku_snapshot, unit_snapshot, line_total_cents)
    values (v_sale_id, p_workspace, (v_line->>'item_id')::uuid, (v_line->>'quantity')::numeric,
      (v_line->>'unit_price_cents')::integer, v_line->>'item_name_snapshot',
      v_line->>'sku_snapshot', v_line->>'unit_snapshot', (v_line->>'line_total_cents')::integer);
    -- Existing aggregate movement trigger applies the stock decrement. The
    -- inventory-ledger migration additionally records default-location valuation.
    insert into public.crm_inventory_movements(workspace_id, item_id, quantity_delta,
      movement_type, source_type, source_id, employee_profile_id, notes, created_by)
    values (p_workspace, (v_line->>'item_id')::uuid, -(v_line->>'quantity')::numeric,
      'sale', 'pos_sale', v_sale_id::text, v_actor, 'Recorded by ' || v_provider, v_actor);
  end loop;
  return v_sale_id;
end;
$function$;

revoke all on function public.crm_record_pos_sale(text,text,text,integer,text,uuid,jsonb) from public, anon;
grant execute on function public.crm_record_pos_sale(text,text,text,integer,text,uuid,jsonb) to authenticated;
-- Ordinary clients cannot bypass the RPC and its price/actor/stock checks.
revoke insert, update, delete on public.crm_pos_sales, public.crm_pos_sale_lines from anon, authenticated;

commit;

-- Shared hospitality orders are operational records, not fiscal invoices.
-- Apply after the five September 23 compliance migrations.
begin;
create schema akihq_hospitality;
revoke all on schema akihq_hospitality from public,anon,authenticated;
create table akihq_hospitality.rooms (
 workspace_id text primary key references public.crm_workspaces(id),
 version bigint not null default 0,
 layout jsonb not null default '{"mode":"till","pages":[],"tables":[]}'
);
create table akihq_hospitality.orders (
 id uuid primary key default gen_random_uuid(), workspace_id text not null references public.crm_workspaces(id),
 operation_id uuid not null default gen_random_uuid(), table_id text, label text not null, status text not null default 'open' check(status in ('open','closed','cancelled')),
 version bigint not null default 0, note text not null default '', guests integer not null default 1 check(guests between 1 and 999),
 lines jsonb not null default '[]', payments jsonb not null default '[]', sent jsonb not null default '[]',
 opened_by uuid not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 sale_id uuid references public.crm_pos_sales(id)
);
create unique index hospitality_table_occupied on akihq_hospitality.orders(workspace_id,table_id) where status='open' and table_id is not null;
create index hospitality_operation_group on akihq_hospitality.orders(workspace_id,operation_id);
create index hospitality_open_orders on akihq_hospitality.orders(workspace_id,status,updated_at desc);
create table akihq_hospitality.commands (
 workspace_id text not null, key uuid not null, actor uuid not null, request jsonb not null, response jsonb not null,
 created_at timestamptz not null default now(), primary key(workspace_id,key)
);
create table akihq_hospitality.events (
 id bigint generated always as identity primary key, workspace_id text not null, order_id uuid,
 actor uuid not null, command_id uuid not null, action text not null, metadata jsonb not null default '{}', before_state jsonb, after_state jsonb,
 created_at timestamptz not null default now()
);
create index hospitality_events_order on akihq_hospitality.events(workspace_id,order_id,id);
create table akihq_hospitality.tickets (
 id uuid primary key default gen_random_uuid(), workspace_id text not null, order_id uuid not null,
 station text not null check(station in ('kitchen','bar','receipt')), kind text not null,
 payload jsonb not null, status text not null default 'queued' check(status in ('queued','claimed','confirmed','uncertain')),
 claimed_by uuid, claimed_at timestamptz, created_at timestamptz not null default now()
);
create index hospitality_print_queue on akihq_hospitality.tickets(workspace_id,status,created_at);
-- No direct API access, including service_role. Entry points below check live access.
alter table akihq_hospitality.rooms enable row level security;
alter table akihq_hospitality.orders enable row level security;
alter table akihq_hospitality.commands enable row level security;
alter table akihq_hospitality.events enable row level security;
alter table akihq_hospitality.tickets enable row level security;
revoke all on all tables in schema akihq_hospitality from public,anon,authenticated,service_role;
create function akihq_hospitality.immutable_evidence() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Hospitality evidence is append-only'; end $$;
create trigger hospitality_events_immutable before update or delete on akihq_hospitality.events for each row execute function akihq_hospitality.immutable_evidence();
create trigger hospitality_commands_immutable before update or delete on akihq_hospitality.commands for each row execute function akihq_hospitality.immutable_evidence();
create function akihq_hospitality.protect_ticket() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'Retain the original ticket'; end if;
 if (to_jsonb(new)-array['status','claimed_by','claimed_at']) is distinct from (to_jsonb(old)-array['status','claimed_by','claimed_at']) then raise exception 'Ticket contents are immutable'; end if;
 return new;
end $$;
create trigger hospitality_ticket_immutable before update or delete on akihq_hospitality.tickets for each row execute function akihq_hospitality.protect_ticket();
create function akihq_hospitality.guard(w text) returns void language plpgsql set search_path='' as $$
begin
 if auth.uid() is null or not coalesce(public.crm_has_tool(w,'pos'),false) or not coalesce(public.crm_can_operate_workspace(w),false) then
 raise exception 'point-of-sale access required' using errcode='42501'; end if;
end $$;
create function akihq_hospitality.total(lines jsonb) returns bigint language sql immutable set search_path='' as $$
 select coalesce(sum(round(q*p)),0)::bigint from (
 select sum(quantity) q,unit_price_cents p from jsonb_to_recordset(lines) as l(item_id uuid,quantity numeric,unit_price_cents integer)
 group by item_id,unit_price_cents) a
$$;
create function akihq_hospitality.paid(payments jsonb) returns bigint language sql immutable set search_path='' as $$
 select coalesce(sum((p->>'amount_cents')::bigint),0)::bigint from jsonb_array_elements(payments) p
$$;
create function public.crm_hospitality_overview(p_workspace text) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform akihq_hospitality.guard(p_workspace);
 select jsonb_build_object('layout',coalesce((select layout from akihq_hospitality.rooms where workspace_id=p_workspace),'{"mode":"till","pages":[],"tables":[]}'::jsonb),
 'layout_version',coalesce((select version from akihq_hospitality.rooms where workspace_id=p_workspace),0),
 'can_manage',akihq_security.can_administer(p_workspace),'can_export',akihq_security.can_export(p_workspace,'pos'),
 'orders',coalesce((select jsonb_agg(to_jsonb(o)||jsonb_build_object('total_cents',akihq_hospitality.total(o.lines),'paid_cents',akihq_hospitality.paid(o.payments)) order by o.created_at) from akihq_hospitality.orders o where workspace_id=p_workspace and status='open'),'[]'),
 'tickets',coalesce((select jsonb_agg(to_jsonb(t)) from (select id,order_id,station,kind,status,created_at,claimed_at,claimed_by from akihq_hospitality.tickets where workspace_id=p_workspace order by case when status='confirmed' then 1 else 0 end,created_at limit 100) t),'[]'),
 'recent',coalesce((select jsonb_agg(to_jsonb(o)) from (select id,label,status,sale_id,updated_at from akihq_hospitality.orders where workspace_id=p_workspace and status<>'open' order by updated_at desc limit 30)o),'[]'),
 'catalogue',public.crm_pos_catalogue(p_workspace),'server_time',now()) into result;
 return result;
end $$;
create function public.crm_hospitality_command(p_workspace text,p_key uuid,p_command jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 a text:=p_command->>'action'; actor uuid:=auth.uid(); cmd akihq_hospitality.commands%rowtype;
 o akihq_hospitality.orders%rowtype; dest akihq_hospitality.orders%rowtype; old_o jsonb; old_dest jsonb;
 item public.crm_inventory_items%rowtype; ticket akihq_hospitality.tickets%rowtype;
 l jsonb; lines jsonb; selected jsonb; sent_line jsonb; transfer_id uuid; sent_q numeric; v_layout jsonb; response jsonb:='{}'; q numeric; price integer; total bigint; paid bigint; amount numeric;
 v_ticket_id uuid; target text; station text; v bigint; sale uuid; currency text; reason text;
begin
 perform akihq_hospitality.guard(p_workspace);
 if p_key is null or jsonb_typeof(p_command) is distinct from 'object' or octet_length(p_command::text)>100000 then raise exception 'Invalid command'; end if;
 perform pg_advisory_xact_lock(hashtextextended('akihq-hospitality:'||p_workspace,0));
 select * into cmd from akihq_hospitality.commands where workspace_id=p_workspace and key=p_key;
 if found then
  if cmd.actor<>actor or cmd.request<>p_command then raise exception 'Request reference already used'; end if;
  return cmd.response;
 end if;
 -- A cancellation tombstone safely prevents a delayed network request from executing.
 if a='abandon' then
  if p_command->>'key' is null then raise exception 'Request reference required'; end if;
  select * into cmd from akihq_hospitality.commands where workspace_id=p_workspace and key=(p_command->>'key')::uuid;
  if found then
   if cmd.actor<>actor then raise exception 'Request belongs to another operator'; end if;
   return jsonb_build_object('already_completed',true,'response',cmd.response);
  end if;
  insert into akihq_hospitality.commands values(p_workspace,(p_command->>'key')::uuid,actor,'{"action":"abandoned"}','{"abandoned":true}',now());
  return '{"abandoned":true}';
 end if;
 if a='layout' then
  if not akihq_security.can_administer(p_workspace) then raise exception 'Administrator access required' using errcode='42501'; end if;
  insert into akihq_hospitality.rooms(workspace_id) values(p_workspace) on conflict do nothing;
  select version into v from akihq_hospitality.rooms where workspace_id=p_workspace;
  if (p_command->>'version')::bigint is distinct from v then raise exception 'Layout changed; reload before saving'; end if;
  v_layout:=p_command->'layout';
  if v_layout->>'mode' not in ('till','restaurant') or v_layout->>'mode' is null or jsonb_typeof(v_layout->'pages') is distinct from 'array' or jsonb_typeof(v_layout->'tables') is distinct from 'array' then raise exception 'Invalid layout'; end if;
  if jsonb_array_length(v_layout->'pages')>30 or jsonb_array_length(v_layout->'tables')>300 then raise exception 'Layout capacity exceeded'; end if;
  for l in select value from jsonb_array_elements(v_layout->'pages') loop
   if length(coalesce(l->>'id','')) not between 1 and 80 or length(btrim(coalesce(l->>'name',''))) not between 1 and 80 then raise exception 'Page ID and name required'; end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(v_layout->'pages') x group by x->>'id' having count(*)>1) then raise exception 'Duplicate page'; end if;
  for l in select value from jsonb_array_elements(v_layout->'tables') loop
   if length(coalesce(l->>'id','')) not between 1 and 80 or length(btrim(coalesce(l->>'name',''))) not between 1 and 80 or l->>'shape' not in ('rectangle','circle','rounded') or l->>'shape' is null
    or not exists(select 1 from jsonb_array_elements(v_layout->'pages') p where p->>'id'=l->>'page') then raise exception 'Invalid table'; end if;
   if exists(select 1 from unnest(array['x','y','width','height','seats']) k where jsonb_typeof(l->k) is distinct from 'number') or (l->>'x')::numeric<0 or (l->>'y')::numeric<0 or (l->>'width')::numeric not between 5 and 100 or (l->>'height')::numeric not between 5 and 100
    or (l->>'x')::numeric+(l->>'width')::numeric>100 or (l->>'y')::numeric+(l->>'height')::numeric>100 or (l->>'seats')::numeric not between 1 and 999 or (l->>'seats')::numeric<>trunc((l->>'seats')::numeric) then raise exception 'Table dimensions out of bounds'; end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(v_layout->'tables') x group by x->>'id' having count(*)>1) then raise exception 'Duplicate table'; end if;
  if exists(select 1 from akihq_hospitality.orders r where r.workspace_id=p_workspace and r.status='open' and r.table_id is not null and (v_layout->>'mode'='till' or not exists(select 1 from jsonb_array_elements(v_layout->'tables') t where t->>'id'=r.table_id))) then raise exception 'Close or move occupied tables first'; end if;
  select r.layout into old_o from akihq_hospitality.rooms r where workspace_id=p_workspace;
  update akihq_hospitality.rooms set layout=p_command->'layout',version=version+1 where workspace_id=p_workspace;
  response:=jsonb_build_object('layout_version',v+1);
 elsif a in ('claim_ticket','begin_print','confirm_ticket','uncertain_ticket','reprint') then
  select * into ticket from akihq_hospitality.tickets where workspace_id=p_workspace and id=(p_command->>'ticket_id')::uuid for update;
  if not found then raise exception 'Ticket not found'; end if;
  old_o:=to_jsonb(ticket);
  if a='claim_ticket' then
   if ticket.status<>'queued' then raise exception 'Ticket already claimed. Check printer before requesting a copy'; end if;
   update akihq_hospitality.tickets set status='claimed',claimed_by=actor,claimed_at=now() where id=ticket.id;
   response:=to_jsonb(ticket)||jsonb_build_object('status','claimed');
  elsif a='begin_print' then
   if ticket.status<>'claimed' or ticket.claimed_by<>actor then raise exception 'Ticket already attempted or claimed by another operator; inspect printer before requesting a copy'; end if;
   update akihq_hospitality.tickets set status='uncertain' where tickets.id=ticket.id;
  elsif a='reprint' then
   reason:=btrim(coalesce(p_command->>'reason',''));
   if length(reason) not between 3 and 500 then raise exception 'Reprint reason required'; end if;
   insert into akihq_hospitality.tickets(workspace_id,order_id,station,kind,payload)
   values(p_workspace,ticket.order_id,ticket.station,ticket.kind,ticket.payload||jsonb_build_object('copy_of',ticket.id,'copy_reason',reason)) returning tickets.id into v_ticket_id;
   response:=jsonb_build_object('ticket_id',v_ticket_id);
  else
   if ticket.status not in ('claimed','uncertain') or (ticket.claimed_by<>actor and not akihq_security.can_administer(p_workspace)) then raise exception 'Only the print operator or administrator can acknowledge this ticket'; end if;
   update akihq_hospitality.tickets set status=case when a='confirm_ticket' then 'confirmed' else 'uncertain' end where id=ticket.id;
  end if;
 elsif a='open' then
  if (select count(*) from akihq_hospitality.orders where workspace_id=p_workspace and status='open')>=200 then raise exception 'Close existing orders before opening more'; end if;
  target:=nullif(p_command->>'table_id','');
  if target is not null then
   if not exists(select 1 from akihq_hospitality.rooms r,jsonb_array_elements(r.layout->'tables') t where r.workspace_id=p_workspace and r.layout->>'mode'='restaurant' and t->>'id'=target) then raise exception 'Unknown table'; end if;
   select * into o from akihq_hospitality.orders where workspace_id=p_workspace and table_id=target and status='open';
  end if;
  if o.id is null then
   insert into akihq_hospitality.orders(workspace_id,table_id,label,opened_by) values(p_workspace,target,case when target is null then left(coalesce(nullif(btrim(p_command->>'label'),''),'Walk-in'),80) else (select 'Table '||(t->>'name') from akihq_hospitality.rooms r,jsonb_array_elements(r.layout->'tables') t where r.workspace_id=p_workspace and t->>'id'=target) end,actor) returning * into o;
  end if;
  response:=jsonb_build_object('order_id',o.id);
 else
  select * into o from akihq_hospitality.orders where workspace_id=p_workspace and id=(p_command->>'order_id')::uuid for update;
  if not found or o.status<>'open' then raise exception 'Open order not found'; end if;
  if (p_command->>'version')::bigint is distinct from o.version then raise exception 'Order changed on another device; reload and review'; end if;
  old_o:=to_jsonb(o); paid:=akihq_hospitality.paid(o.payments);
  if a in ('add','line','transfer','reprice','cancel') and paid<>0 then raise exception 'Reverse recorded payments before editing or transferring items'; end if;
  if a='add' then
   if jsonb_array_length(o.lines)>=100 then raise exception 'Maximum 100 lines per order'; end if;
   select * into item from public.crm_inventory_items where workspace_id=p_workspace and id=(p_command->>'item_id')::uuid and active;
   if not found then raise exception 'Active product not found'; end if;
   select (x->>'unit_price_cents')::integer into price from jsonb_array_elements(o.lines) x where x->>'item_id'=item.id::text limit 1;
   o.lines:=o.lines||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'item_id',item.id,'name',item.name,'quantity',1,'unit_price_cents',coalesce(price,item.sale_price_cents),'note','','seat','','station','kitchen'));
  elsif a='line' then
   q:=(p_command->>'quantity')::numeric;
   if q is null or q<0 or q>999999 or q<>round(q,3) then raise exception 'Quantity must have at most three decimals'; end if;
   if p_command->>'station' not in ('kitchen','bar') or p_command->>'station' is null or length(coalesce(p_command->>'note',''))>1000 or length(coalesce(p_command->>'seat',''))>30 then raise exception 'Invalid line details'; end if;
   if not exists(select 1 from jsonb_array_elements(o.lines) x where x->>'id'=p_command->>'line_id') then raise exception 'Line not found'; end if;
   select coalesce(jsonb_agg(case when x->>'id'=p_command->>'line_id' then x||jsonb_build_object('quantity',q,'note',coalesce(p_command->>'note',''),'seat',coalesce(p_command->>'seat',''),'station',p_command->>'station') else x end),'[]') into o.lines from jsonb_array_elements(o.lines) x where x->>'id'<>p_command->>'line_id' or q>0;
  elsif a='note' then
   if length(coalesce(p_command->>'note',''))>2000 then raise exception 'Order note too long'; end if;
   o.note:=coalesce(p_command->>'note','');o.guests:=coalesce((p_command->>'guests')::integer,1);
   if o.sent<>'[]' and o.note is distinct from old_o->>'note' then
    foreach station in array array['kitchen','bar'] loop
     insert into akihq_hospitality.tickets(workspace_id,order_id,station,kind,payload) values(p_workspace,o.id,station,'note_change',jsonb_build_object('instruction','NOTE CHANGE ONLY — do not prepare again','order',to_jsonb(o),'previous_note',old_o->>'note'));
    end loop;
   end if;
  elsif a='reprice' then
   if not akihq_security.can_administer(p_workspace) or length(btrim(coalesce(p_command->>'reason','')))<3 then raise exception 'Administrator and reason required'; end if;
   for l in select value from jsonb_array_elements(o.lines) loop
    select * into item from public.crm_inventory_items where workspace_id=p_workspace and id=(l->>'item_id')::uuid and active;
    if not found then raise exception 'Product no longer available'; end if;
    lines:=coalesce(lines,'[]')||jsonb_build_array(l||jsonb_build_object('unit_price_cents',item.sale_price_cents));
   end loop;o.lines:=coalesce(lines,'[]');
  elsif a in ('move','transfer') then
   target:=nullif(p_command->>'table_id','');
   if target is not null and not exists(select 1 from akihq_hospitality.rooms r,jsonb_array_elements(r.layout->'tables') t where r.workspace_id=p_workspace and r.layout->>'mode'='restaurant' and t->>'id'=target) then raise exception 'Unknown destination table'; end if;
   if target is not null and target=o.table_id then raise exception 'Choose a different table'; end if;
   if a='move' then
    if exists(select 1 from akihq_hospitality.orders where workspace_id=p_workspace and table_id=target and status='open') then raise exception 'Destination occupied; transfer items instead'; end if;
    o.table_id:=target;
    o.label:=case when target is null then 'Walk-in' else (select 'Table '||(t->>'name') from akihq_hospitality.rooms r,jsonb_array_elements(r.layout->'tables') t where r.workspace_id=p_workspace and t->>'id'=target) end;
   else
    if jsonb_typeof(p_command->'lines') is distinct from 'array' or jsonb_array_length(p_command->'lines') not between 1 and 100 then raise exception 'Select items to transfer'; end if;
    select * into dest from akihq_hospitality.orders where workspace_id=p_workspace and table_id=target and status='open';
    if dest.id is null then
     if (select count(*) from akihq_hospitality.orders where workspace_id=p_workspace and status='open')>=200 then raise exception 'Order capacity exceeded'; end if;
     insert into akihq_hospitality.orders(workspace_id,table_id,label,opened_by) values(p_workspace,target,case when target is null then 'Split from '||left(o.label,60) else (select 'Table '||(t->>'name') from akihq_hospitality.rooms r,jsonb_array_elements(r.layout->'tables') t where r.workspace_id=p_workspace and t->>'id'=target) end,actor) returning * into dest;
    else
     if (p_command->>'destination_version')::bigint is distinct from dest.version then raise exception 'Destination changed; reload'; end if;
    end if;
    if akihq_hospitality.paid(dest.payments)<>0 then raise exception 'Destination has payments'; end if;
    old_dest:=to_jsonb(dest);
    if dest.operation_id<>o.operation_id then
     insert into akihq_hospitality.events(workspace_id,order_id,actor,command_id,action,metadata)
     values(p_workspace,dest.id,actor,p_key,'link_operations',jsonb_build_object('from_operation',dest.operation_id,'to_operation',o.operation_id));
     update akihq_hospitality.orders set operation_id=o.operation_id where workspace_id=p_workspace and operation_id=dest.operation_id;
     dest.operation_id:=o.operation_id;
    end if;
    for selected in select value from jsonb_array_elements(p_command->'lines') loop
     select x into l from jsonb_array_elements(o.lines) x where x->>'id'=selected->>'id';
     q:=(selected->>'quantity')::numeric;
     if l is null or q is null or q<=0 or q<>round(q,3) or q>(l->>'quantity')::numeric then raise exception 'Invalid transfer quantity'; end if;
     if exists(select 1 from jsonb_array_elements(dest.lines) x where x->>'item_id'=l->>'item_id' and x->>'unit_price_cents'<>l->>'unit_price_cents') then raise exception 'Reprice orders to the same catalogue before merging'; end if;
     transfer_id:=gen_random_uuid();
     dest.lines:=dest.lines||jsonb_build_array(l||jsonb_build_object('id',transfer_id,'quantity',q));
     select x into sent_line from jsonb_array_elements(o.sent) x where x->>'id'=l->>'id';
     if sent_line is not null then
      sent_q:=least(q,(sent_line->>'quantity')::numeric);
      dest.sent:=dest.sent||jsonb_build_array(sent_line||jsonb_build_object('id',transfer_id,'quantity',sent_q));
      select coalesce(jsonb_agg(case when x->>'id'=l->>'id' then x||jsonb_build_object('quantity',(x->>'quantity')::numeric-sent_q) else x end),'[]') into o.sent from jsonb_array_elements(o.sent) x where x->>'id'<>l->>'id' or (x->>'quantity')::numeric>sent_q;
     end if;
     select coalesce(jsonb_agg(case when x->>'id'=l->>'id' then x||jsonb_build_object('quantity',(x->>'quantity')::numeric-q) else x end),'[]') into o.lines from jsonb_array_elements(o.lines) x where x->>'id'<>l->>'id' or (x->>'quantity')::numeric>q;
    end loop;
    if akihq_hospitality.total(old_o->'lines')+akihq_hospitality.total(old_dest->'lines')<>akihq_hospitality.total(o.lines)+akihq_hospitality.total(dest.lines) then raise exception 'This fractional split changes rounding. Transfer a different quantity or split payment amounts instead'; end if;
    if jsonb_array_length(dest.lines)>100 then raise exception 'Destination exceeds 100 lines'; end if;
    update akihq_hospitality.orders set lines=dest.lines,sent=dest.sent,version=version+1,updated_at=now() where id=dest.id returning * into dest;
    insert into akihq_hospitality.events(workspace_id,order_id,actor,command_id,action,metadata,before_state,after_state) values(p_workspace,dest.id,actor,p_key,'transfer_in',p_command,old_dest,to_jsonb(dest));
    response:=jsonb_build_object('destination_id',dest.id);
   end if;
   -- Relocation is explicitly informational: it must never re-fire food.
   foreach station in array array['kitchen','bar'] loop
    if old_o->'sent'<>'[]' or coalesce(dest.sent,'[]')<>'[]' then
     insert into akihq_hospitality.tickets(workspace_id,order_id,station,kind,payload) values(p_workspace,o.id,station,'relocation',jsonb_build_object('instruction','RELOCATION ONLY — do not prepare again','before',old_o,'after',to_jsonb(o),'destination',to_jsonb(dest)));
    end if;
   end loop;
   -- Keep unsent work explicit; next preparation ticket includes before/current.
  elsif a='send' then
   if o.lines=o.sent then raise exception 'No item changes to send'; end if;
   foreach station in array array['kitchen','bar'] loop
    select coalesce(jsonb_agg(x),'[]') into lines from jsonb_array_elements(o.lines) x where x->>'station'=station;
    select coalesce(jsonb_agg(x),'[]') into selected from jsonb_array_elements(o.sent) x where x->>'station'=station;
    if lines<>selected then insert into akihq_hospitality.tickets(workspace_id,order_id,station,kind,payload) values(p_workspace,o.id,station,'preparation',jsonb_build_object('instruction','REVISION — compare previous and current; prepare only changes','order',to_jsonb(o),'previous',selected,'current',lines)); end if;
   end loop;o.sent:=o.lines;
  elsif a='cancel' then
   if not akihq_security.can_administer(p_workspace) or length(btrim(coalesce(p_command->>'reason','')))<3 then raise exception 'Administrator and cancellation reason required'; end if;
   o.status:='cancelled';
   foreach station in array array['kitchen','bar'] loop
    if o.sent<>'[]' then insert into akihq_hospitality.tickets(workspace_id,order_id,station,kind,payload) values(p_workspace,o.id,station,'cancellation',jsonb_build_object('order',to_jsonb(o),'reason',p_command->>'reason')); end if;
   end loop;
  elsif a in ('payment','reverse_payment') then
   if jsonb_array_length(o.payments)>=500 then raise exception 'Payment history capacity reached; contact support'; end if;
   if a='reverse_payment' then
    if not akihq_security.can_administer(p_workspace) or length(btrim(coalesce(p_command->>'reason','')))<3 then raise exception 'Administrator and reversal reason required'; end if;
    select x into l from jsonb_array_elements(o.payments) x where x->>'id'=p_command->>'payment_id' and (x->>'amount_cents')::bigint>0;
    if l is null or exists(select 1 from jsonb_array_elements(o.payments) x where x->>'reverses'=l->>'id') then raise exception 'Payment not available for reversal'; end if;
    o.payments:=o.payments||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'amount_cents',-(l->>'amount_cents')::bigint,'method',l->>'method','actor',actor,'at',now(),'reverses',l->>'id','reason',p_command->>'reason'));
   else
    total:=akihq_hospitality.total(o.lines);amount:=(p_command->>'amount_cents')::numeric;
    if amount is null or amount<>trunc(amount) or amount<=0 or amount>total-paid then raise exception 'Payment must be integer cents within the remaining balance'; end if;
    if p_command->>'method' not in ('cash','card','other') or p_command->>'method' is null then raise exception 'Payment method required'; end if;
    if p_command->>'method'<>'cash' and length(btrim(coalesce(p_command->>'reference',''))) not between 3 and 120 then raise exception 'External payment reference required; this records payments and does not charge cards'; end if;
    if p_command->>'method'<>'cash' and exists(select 1 from akihq_hospitality.orders r,jsonb_array_elements(r.payments) x where r.workspace_id=p_workspace and x->>'method'=p_command->>'method' and x->>'reference'=p_command->>'reference' and (x->>'amount_cents')::bigint>0) then raise exception 'External payment reference already recorded'; end if;
    -- Validate current catalogue before recording even a partial payment.
    if exists(select 1 from jsonb_array_elements(o.lines) x left join public.crm_inventory_items i on i.id=(x->>'item_id')::uuid and i.workspace_id=p_workspace where i.id is null or not i.active or i.sale_price_cents<>(x->>'unit_price_cents')::integer) then raise exception 'Catalogue changed: administrator must reprice before payment'; end if;
    if p_command->>'method'='cash' then
     if (select w.currency from public.crm_workspaces w where w.id=p_workspace)<>'EUR' then raise exception 'Cash policy is currently supported only for EUR'; end if;
     if (select coalesce(sum(akihq_hospitality.total(r.lines)),0) from akihq_hospitality.orders r where r.workspace_id=p_workspace and r.operation_id=o.operation_id and r.status<>'cancelled')>=100000 then raise exception 'Cash is blocked for linked operations of EUR 1000 or more, including split bills'; end if;
    end if;
    if p_command->>'method'='cash' and p_command ? 'tendered_cents' and (jsonb_typeof(p_command->'tendered_cents') is distinct from 'number' or (p_command->>'tendered_cents')::numeric<amount or (p_command->>'tendered_cents')::numeric>2147483647 or (p_command->>'tendered_cents')::numeric<>trunc((p_command->>'tendered_cents')::numeric)) then raise exception 'Cash tendered must be integer cents covering this payment'; end if;
    o.payments:=o.payments||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'amount_cents',amount,'method',p_command->>'method','reference',left(coalesce(p_command->>'reference',''),120),'tendered_cents',case when p_command->>'method'='cash' then coalesce((p_command->>'tendered_cents')::numeric,amount) else amount end,'change_cents',case when p_command->>'method'='cash' then coalesce((p_command->>'tendered_cents')::numeric,amount)-amount else 0 end,'actor',actor,'at',now()));
    if paid+amount=total then
     select w.currency into currency from public.crm_workspaces w where w.id=p_workspace;
     sale:=public.crm_record_pos_sale(p_workspace,'hospitality',o.id::text,total::integer,currency,actor,o.lines);
     o.sale_id:=sale;o.status:='closed';
    end if;
   end if;
   insert into akihq_hospitality.tickets(workspace_id,order_id,station,kind,payload) values(p_workspace,o.id,'receipt','payment',jsonb_build_object('order',to_jsonb(o),'total_cents',akihq_hospitality.total(o.lines),'paid_cents',akihq_hospitality.paid(o.payments),'notice','PAYMENT RECORD — NOT A FISCAL INVOICE / NO ES FACTURA'));
  elsif a='prebill' then
   insert into akihq_hospitality.tickets(workspace_id,order_id,station,kind,payload) values(p_workspace,o.id,'receipt','prebill',jsonb_build_object('order',to_jsonb(o),'total_cents',akihq_hospitality.total(o.lines),'paid_cents',paid,'notice','PROFORMA — NOT A FISCAL INVOICE / NO ES FACTURA'));
  else raise exception 'Unknown hospitality action'; end if;
  if akihq_hospitality.total(o.lines)>2147483647 then raise exception 'Order total exceeds supported amount'; end if;
  -- Linked orders retain the original cash-policy operation across table splits.
  if exists(select 1 from akihq_hospitality.orders r,jsonb_array_elements(r.payments) p where r.workspace_id=p_workspace and r.operation_id=o.operation_id and p->>'method'='cash' and (p->>'amount_cents')::bigint>0)
   and akihq_hospitality.total(o.lines)+(select coalesce(sum(akihq_hospitality.total(r.lines)),0) from akihq_hospitality.orders r where r.workspace_id=p_workspace and r.operation_id=o.operation_id and r.id<>o.id and r.status<>'cancelled')>=100000 then raise exception 'This change would take an operation with cash history to EUR 1000 or more'; end if;
  update akihq_hospitality.orders set table_id=o.table_id,label=o.label,status=o.status,note=o.note,guests=o.guests,lines=o.lines,payments=o.payments,sent=o.sent,sale_id=o.sale_id,version=version+1,updated_at=now() where id=o.id returning * into o;
  response:=response||jsonb_build_object('order_id',o.id,'version',o.version,'status',o.status,'sale_id',o.sale_id);
 end if;
 insert into akihq_hospitality.events(workspace_id,order_id,actor,command_id,action,metadata,before_state,after_state) values(p_workspace,o.id,actor,p_key,a,p_command,old_o,case when a='layout' then p_command->'layout' when o.id is not null then to_jsonb(o) else response end);
 insert into akihq_hospitality.commands(workspace_id,key,actor,request,response) values(p_workspace,p_key,actor,p_command,response);
 return response;
end $$;
-- Bounded accountant evidence export. Dates are explicit UTC instants supplied
-- from the workspace timezone; payments include partial collections and reversals.
create function public.crm_hospitality_export(p_workspace text,p_from timestamptz,p_until timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform akihq_hospitality.guard(p_workspace);
 if not akihq_security.can_export(p_workspace,'pos') then raise exception 'Export access required' using errcode='42501'; end if;
 if p_from is null or p_until is null or p_until<=p_from or p_until-p_from>interval '32 days' then raise exception 'Choose a period no longer than 31 local days'; end if;
 if (select count(*) from akihq_hospitality.events where workspace_id=p_workspace and created_at>=p_from and created_at<p_until)>10000
 or (select count(*) from akihq_hospitality.tickets where workspace_id=p_workspace and created_at>=p_from and created_at<p_until)>10000 then raise exception 'Export too large; choose a shorter period'; end if;
 select jsonb_build_object('schema_version',1,'workspace_id',p_workspace,'from',p_from,'until',p_until,'exported_at',now(),
 'notice','Operational evidence, not an official tax book or fiscal invoice. Payment records do not independently confirm bank settlement.',
 'orders',coalesce((select jsonb_agg(to_jsonb(o)) from akihq_hospitality.orders o where workspace_id=p_workspace and exists(select 1 from akihq_hospitality.events e where e.workspace_id=p_workspace and e.order_id=o.id and e.created_at>=p_from and e.created_at<p_until)),'[]'),
 'events',coalesce((select jsonb_agg(to_jsonb(e) order by id) from akihq_hospitality.events e where workspace_id=p_workspace and created_at>=p_from and created_at<p_until),'[]'),
 'tickets',coalesce((select jsonb_agg(to_jsonb(t) order by created_at,id) from akihq_hospitality.tickets t where workspace_id=p_workspace and created_at>=p_from and created_at<p_until),'[]'),
 'payments',coalesce((select jsonb_agg(p||jsonb_build_object('order_id',o.id,'sale_id',o.sale_id) order by p->>'at') from akihq_hospitality.orders o,jsonb_array_elements(o.payments) p where o.workspace_id=p_workspace and (p->>'at')::timestamptz>=p_from and (p->>'at')::timestamptz<p_until),'[]')) into result;
 insert into akihq_hospitality.events(workspace_id,actor,command_id,action,metadata) values(p_workspace,auth.uid(),gen_random_uuid(),'export',jsonb_build_object('from',p_from,'until',p_until));
 return result;
end $$;
revoke all on function public.crm_hospitality_export(text,timestamptz,timestamptz) from public,anon;
grant execute on function public.crm_hospitality_export(text,timestamptz,timestamptz) to authenticated;
revoke all on all functions in schema akihq_hospitality from public,anon,authenticated,service_role;
revoke all on function public.crm_hospitality_overview(text),public.crm_hospitality_command(text,uuid,jsonb) from public,anon;
grant execute on function public.crm_hospitality_overview(text),public.crm_hospitality_command(text,uuid,jsonb) to authenticated;
commit;

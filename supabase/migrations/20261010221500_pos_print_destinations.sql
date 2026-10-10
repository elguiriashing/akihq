-- AkiHQ printer destinations and settlement lifecycle.
-- No ticket is deleted: superseded means it is no longer eligible for unattended printing.
-- Deployment requires the hospitality + unattended printer migrations already applied.
begin;

alter table akihq_hospitality.tickets drop constraint if exists tickets_status_check;
alter table akihq_hospitality.tickets add constraint tickets_status_check
 check (status in ('queued','claimed','confirmed','uncertain','spooled','superseded'));

-- A partial payment is NOT a paid client bill; a pre-bill cannot be sent again
-- after settlement. Do not alter claimed/uncertain jobs whose physical output is unknown.
create or replace function akihq_hospitality.route_new_ticket()
returns trigger language plpgsql security definer set search_path='' as $$
declare order_state text;
begin
 if new.status <> 'queued' then return new; end if;
 select o.status into order_state from akihq_hospitality.orders o
 where o.id=new.order_id and o.workspace_id=new.workspace_id;
 if new.kind='prebill' and order_state='open' then
   -- Only the newest unprinted customer pre-bill should remain actionable.
   update akihq_hospitality.tickets t set status='superseded'
   where t.workspace_id=new.workspace_id and t.order_id=new.order_id
     and t.kind='prebill' and t.status='queued';
 end if;
 if new.kind='payment' and
   ((new.payload->>'paid_cents')::bigint is distinct from (new.payload->>'total_cents')::bigint
     or order_state='cancelled') then
   new.status:='superseded';
 elsif order_state='closed' and new.kind<>'payment' then
   new.status:='superseded';
 end if;
 return new;
end $$;
drop trigger if exists hospitality_ticket_lifecycle_insert on akihq_hospitality.tickets;
create trigger hospitality_ticket_lifecycle_insert
 before insert on akihq_hospitality.tickets
 for each row execute function akihq_hospitality.route_new_ticket();

-- On the final payment, retire still-queued preparation/unpaid bills and
-- prior payment records. Retain ONE final payment receipt for the customer.
-- Already claimed/spooled/uncertain tickets remain visible for manual reconciliation.
create or replace function akihq_hospitality.retire_paid_order_tickets()
returns trigger language plpgsql security definer set search_path='' as $$
declare last_receipt uuid;
begin
 if old.status='open' and new.status='closed' then
   select t.id into last_receipt
   from akihq_hospitality.tickets t
   where t.workspace_id=new.workspace_id and t.order_id=new.id
     and t.station='receipt' and t.kind='payment'
     and t.status='queued'
     and (t.payload->>'paid_cents')::bigint=(t.payload->>'total_cents')::bigint
   order by t.created_at desc,t.id desc limit 1;
   update akihq_hospitality.tickets t
      set status='superseded'
   where t.workspace_id=new.workspace_id and t.order_id=new.id
     and t.status='queued'
     and (last_receipt is null or t.id<>last_receipt);
 end if;
 return new;
end $$;
drop trigger if exists hospitality_retire_paid_print_jobs on akihq_hospitality.orders;
create trigger hospitality_retire_paid_print_jobs
 after update of status on akihq_hospitality.orders
 for each row execute function akihq_hospitality.retire_paid_order_tickets();

-- Reconcile existing settled orders without modifying uncertain or claimed jobs.
update akihq_hospitality.tickets t
 set status='superseded'
 from akihq_hospitality.orders o
 where o.id=t.order_id and o.workspace_id=t.workspace_id and o.status='closed'
   and t.status='queued'
   and t.id is distinct from (
     select pt.id from akihq_hospitality.tickets pt
     where pt.workspace_id=o.workspace_id and pt.order_id=o.id
       and pt.kind='payment' and pt.station='receipt' and pt.status='queued'
       and (pt.payload->>'paid_cents')::bigint=(pt.payload->>'total_cents')::bigint
     order by pt.created_at desc,pt.id desc limit 1
   );
-- Collapse historic unprinted duplicates of the same unpaid customer bill.
-- Keep tickets that were already claimed or whose print outcome is uncertain.
update akihq_hospitality.tickets t set status='superseded'
where t.kind='prebill' and t.status='queued'
  and exists (
   select 1 from akihq_hospitality.tickets newer
   where newer.workspace_id=t.workspace_id and newer.order_id=t.order_id
     and newer.kind='prebill' and newer.status='queued'
     and (newer.created_at, newer.id)>(t.created_at,t.id)
  );

-- Old partial payment slips are archived, not misrepresented as paid bills.
update akihq_hospitality.tickets t set status='superseded'
 where t.kind='payment' and t.status='queued'
   and (t.payload->>'paid_cents')::bigint is distinct from
       (t.payload->>'total_cents')::bigint;

-- Keep the overview response backwards compatible while exposing lifecycle
-- metadata so old completed tables cannot masquerade as new active print jobs.
create or replace function public.crm_hospitality_overview(p_workspace text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform akihq_hospitality.guard(p_workspace);
 select jsonb_build_object(
 'layout',coalesce((select layout from akihq_hospitality.rooms where workspace_id=p_workspace),'{"mode":"till","pages":[],"tables":[]}'::jsonb),
 'layout_version',coalesce((select version from akihq_hospitality.rooms where workspace_id=p_workspace),0),
 'can_manage',akihq_security.can_administer(p_workspace),
 'can_export',akihq_security.can_export(p_workspace,'pos'),
 'orders',coalesce((select jsonb_agg(to_jsonb(o)||jsonb_build_object('total_cents',akihq_hospitality.total(o.lines),'paid_cents',akihq_hospitality.paid(o.payments)) order by o.created_at)
      from akihq_hospitality.orders o where o.workspace_id=p_workspace and o.status='open'),'[]'::jsonb),
 'tickets',coalesce((select jsonb_agg(to_jsonb(t))
      from (select t.id,t.order_id,t.station,t.kind,t.status,t.created_at,t.claimed_at,t.claimed_by,
                   o.status as order_status,o.label as order_label
            from akihq_hospitality.tickets t
            left join akihq_hospitality.orders o on o.id=t.order_id and o.workspace_id=t.workspace_id
            where t.workspace_id=p_workspace
            order by case when t.status in ('confirmed','spooled','superseded') then 1 else 0 end,
                     t.created_at limit 100) t),'[]'::jsonb),
 'recent',coalesce((select jsonb_agg(to_jsonb(o))
     from (select id,label,status,sale_id,updated_at from akihq_hospitality.orders
           where workspace_id=p_workspace and status<>'open' order by updated_at desc limit 30)o),'[]'::jsonb),
 'catalogue',public.crm_pos_catalogue(p_workspace),
 'server_time',now()) into result;
 return result;
end $$;
-- Original RPC permissions remain unchanged.
commit;

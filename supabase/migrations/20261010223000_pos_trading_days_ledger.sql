-- Trading days are real start/end windows, not midnight calendar buckets.
-- Completed order facts are derived from the immutable hospitality events ledger.
begin;

create table if not exists akihq_hospitality.trading_days (
 id uuid primary key default gen_random_uuid(),
 workspace_id text not null references public.crm_workspaces(id),
 label text not null default '',
 started_at timestamptz not null default now(),
 ended_at timestamptz,
 started_by uuid not null,
 ended_by uuid,
 note text not null default '',
 created_at timestamptz not null default now(),
 constraint trading_day_end_after_start check (ended_at is null or ended_at > started_at),
 constraint trading_day_label_max check (length(label) <= 100),
 constraint trading_day_note_max check (length(note) <= 500)
);
create unique index if not exists one_active_hospitality_trading_day on akihq_hospitality.trading_days(workspace_id) where ended_at is null;
create index if not exists trading_days_timeline on akihq_hospitality.trading_days(workspace_id,started_at desc);
alter table akihq_hospitality.trading_days enable row level security;
revoke all on akihq_hospitality.trading_days from public,anon,authenticated,service_role;

-- These immutable close events are the source of closing time and staff identity.
-- A trading day is attributed by the exact real-world window containing closure.
create or replace view akihq_hospitality.closed_bill_audit as
select o.workspace_id,o.id,o.sale_id,o.table_id,o.label,o.created_at as opened_at,
       e.created_at as closed_at,e.actor as closed_by,
       coalesce(nullif(p.display_name,''),nullif(u.email,''),e.actor::text) as closed_by_name,
       o.lines,o.payments,o.guests,o.note,
       akihq_hospitality.total(o.lines) as total_cents,
       day.id as trading_day_id
from akihq_hospitality.orders o
join lateral (
  select ev.created_at,ev.actor from akihq_hospitality.events ev
   where ev.workspace_id=o.workspace_id and ev.order_id=o.id
     and ev.action='payment' and ev.after_state->>'status'='closed'
   order by ev.id desc limit 1
) e on true
left join public.profiles p on p.id=e.actor
left join auth.users u on u.id=e.actor
left join lateral (
 select d.id from akihq_hospitality.trading_days d
 where d.workspace_id=o.workspace_id and d.started_at<=e.created_at
   and (d.ended_at is null or e.created_at<d.ended_at)
 order by d.started_at desc limit 1
) day on true
where o.status='closed' and o.sale_id is not null;
revoke all on akihq_hospitality.closed_bill_audit from public,anon,authenticated,service_role;

-- Manager controlled. Do not block live PoS orders if no trading day exists.
-- A second start is idempotent and returns the current open day.
create or replace function public.crm_pos_trading_day(p_workspace text,p_action text,p_day uuid default null,p_label text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare d akihq_hospitality.trading_days%rowtype; open_bills integer;
begin
 perform akihq_hospitality.guard(p_workspace);
 if not akihq_security.can_administer(p_workspace) then
   raise exception 'Manager permission is required to start or end a trading day' using errcode='42501';
 end if;
 if p_action not in ('start','end') or p_action is null then raise exception 'Invalid trading day action'; end if;
 perform pg_advisory_xact_lock(hashtextextended('akihq-trading-day:'||p_workspace,0));
 if p_action='start' then
  select * into d from akihq_hospitality.trading_days
   where workspace_id=p_workspace and ended_at is null for update;
  if d.id is null then
   insert into akihq_hospitality.trading_days(workspace_id,label,started_by)
   values(p_workspace,left(btrim(coalesce(p_label,'')),100),auth.uid()) returning * into d;
  end if;
 else
  select * into d from akihq_hospitality.trading_days
   where workspace_id=p_workspace and (p_day is null and ended_at is null or id=p_day)
   order by started_at desc limit 1 for update;
  if d.id is null then raise exception 'No trading day to close'; end if;
  if d.ended_at is null then
   update akihq_hospitality.trading_days set ended_at=now(),ended_by=auth.uid()
   where id=d.id returning * into d;
  end if;
 end if;
 select count(*) into open_bills from akihq_hospitality.orders
  where workspace_id=p_workspace and status='open';
 return jsonb_build_object('day',to_jsonb(d),'open_bills',open_bills);
end $$;
revoke all on function public.crm_pos_trading_day(text,text,uuid,text) from public,anon;
grant execute on function public.crm_pos_trading_day(text,text,uuid,text) to authenticated;

-- Searchable, paginated closed bills; dates are LOCAL calendar dates in workspace timezone.
-- Revenue uses final order totals, not ticket counts or partial-payment duplication.
create or replace function public.crm_pos_ledger(p_workspace text,p_filters jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 tz text; now_local timestamp; from_at timestamptz; until_at timestamptz;
 term_item text;term_table text;term_account text;term_shift text;
 min_price bigint;max_price bigint;take integer;skip integer;
 result_rows jsonb;filtered_count bigint;
 days jsonb;opened jsonb;actors jsonb;calendar_cents bigint;weekly_cents bigint;current_cents bigint;
 calendar_count bigint;weekly_count bigint;current_count bigint;unassigned bigint;
begin
 perform akihq_hospitality.guard(p_workspace);
 if p_filters is null then p_filters:='{}'::jsonb; end if;
 if jsonb_typeof(p_filters)<>'object' or octet_length(p_filters::text)>4000 then raise exception 'Invalid lookup filters'; end if;
 select coalesce(nullif(timezone,''),'Europe/Madrid') into tz from public.crm_workspaces where id=p_workspace;
 now_local:=now() at time zone tz;
 term_item:=left(btrim(coalesce(p_filters->>'item','')),100);
 term_table:=left(btrim(coalesce(p_filters->>'table','')),100);
 term_account:=left(btrim(coalesce(p_filters->>'account','')),100);
 term_shift:=coalesce(p_filters->>'trading_day','');
 if length(term_shift)>100 then raise exception 'Invalid trading day filter'; end if;
 if p_filters ? 'from_date' and nullif(p_filters->>'from_date','') is not null then
  from_at:=(p_filters->>'from_date')::date::timestamp at time zone tz;
 end if;
 if p_filters ? 'to_date' and nullif(p_filters->>'to_date','') is not null then
  until_at:=((p_filters->>'to_date')::date+1)::timestamp at time zone tz;
 end if;
 if from_at is not null and until_at is not null and until_at<=from_at then raise exception 'Invalid date range'; end if;
 min_price:=nullif(p_filters->>'min_cents','')::bigint;
 max_price:=nullif(p_filters->>'max_cents','')::bigint;
 if min_price<0 or max_price<0 or (min_price is not null and max_price is not null and min_price>max_price) then raise exception 'Invalid price range'; end if;
 take:=least(greatest(coalesce(nullif(p_filters->>'limit','')::integer,30),1),60);
 skip:=least(greatest(coalesce(nullif(p_filters->>'offset','')::integer,0),0),100000);
 -- Avoid resolving a broad, unbounded calendar range into a gigantic response:
 -- only lightweight totals are calculated over the entire workspace.
 with selected as (
  select b.* from akihq_hospitality.closed_bill_audit b
  where b.workspace_id=p_workspace
    and (from_at is null or b.closed_at>=from_at)
    and (until_at is null or b.closed_at<until_at)
    and (term_item='' or exists(select 1 from jsonb_array_elements(b.lines) x where x->>'name' ilike '%'||term_item||'%'))
    and (term_table='' or b.label ilike '%'||term_table||'%' or b.table_id::text ilike '%'||term_table||'%')
    and (term_account='' or b.closed_by_name ilike '%'||term_account||'%' or b.closed_by::text ilike '%'||term_account||'%')
    and (min_price is null or b.total_cents>=min_price)
    and (max_price is null or b.total_cents<=max_price)
    and (term_shift='' or (term_shift='unassigned' and b.trading_day_id is null) or
         (term_shift<>'unassigned' and b.trading_day_id::text=term_shift))
 ),
 paged as (
   select * from selected order by closed_at desc,id desc limit take offset skip
 )
 select (select count(*) from selected),
        coalesce((select jsonb_agg(jsonb_build_object(
         'id',p.id,'sale_id',p.sale_id,'closed_at',p.closed_at,'opened_at',p.opened_at,
         'label',p.label,'table_id',p.table_id,'closed_by',p.closed_by,
         'closed_by_name',p.closed_by_name,'total_cents',p.total_cents,
         'trading_day_id',p.trading_day_id,'lines',p.lines,'payments',p.payments,
         'guests',p.guests,'note',p.note,
         'history',coalesce((
           select jsonb_agg(jsonb_build_object('action',ev.action,'at',ev.created_at,
            'actor',coalesce(nullif(actor_profile.display_name,''),ev.actor::text))
            order by ev.id)
           from akihq_hospitality.events ev
           left join public.profiles actor_profile on actor_profile.id=ev.actor
           where ev.workspace_id=p_workspace and ev.order_id=p.id
         ),'[]'::jsonb)
        ) order by p.closed_at desc,p.id desc) from paged p),'[]'::jsonb)
 into filtered_count,result_rows;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.started_at desc),'[]'::jsonb) into days
 from (
  select d.id,d.label,d.started_at,d.ended_at,d.started_by,d.ended_by,
    coalesce((select sum(b.total_cents) from akihq_hospitality.closed_bill_audit b
      where b.workspace_id=p_workspace and b.trading_day_id=d.id),0)::bigint total_cents,
    (select count(*) from akihq_hospitality.closed_bill_audit b
      where b.workspace_id=p_workspace and b.trading_day_id=d.id)::bigint bill_count
  from akihq_hospitality.trading_days d where d.workspace_id=p_workspace
  order by d.started_at desc limit 120
 ) x;
 select to_jsonb(d) into opened from akihq_hospitality.trading_days d
   where workspace_id=p_workspace and ended_at is null order by started_at desc limit 1;
 select coalesce(sum(b.total_cents) filter (where b.closed_at >= (date_trunc('day',now_local) at time zone tz)),0),
        count(*) filter (where b.closed_at >= (date_trunc('day',now_local) at time zone tz)),
        coalesce(sum(b.total_cents) filter (where b.closed_at >= (date_trunc('week',now_local) at time zone tz)),0),
        count(*) filter (where b.closed_at >= (date_trunc('week',now_local) at time zone tz)),
        coalesce(sum(b.total_cents) filter (where b.trading_day_id=(opened->>'id')::uuid),0),
        count(*) filter (where b.trading_day_id=opened.id),
        count(*) filter (where b.trading_day_id is null)
 into calendar_cents,calendar_count,weekly_cents,weekly_count,current_cents,current_count,unassigned
 from akihq_hospitality.closed_bill_audit b where b.workspace_id=p_workspace;
 select coalesce(jsonb_agg(to_jsonb(a) order by a.actor_name),'[]'::jsonb) into actors from (
  select distinct b.closed_by::text actor_id,b.closed_by_name actor_name
  from akihq_hospitality.closed_bill_audit b where b.workspace_id=p_workspace
 ) a;
 return jsonb_build_object('rows',result_rows,'total_count',filtered_count,'offset',skip,'limit',take,
  'trading_days',days,'active_day',opened,'staff',actors,'timezone',tz,
  'summary',jsonb_build_object('calendar_cents',calendar_cents,'calendar_count',calendar_count,
    'week_cents',weekly_cents,'week_count',weekly_count,
    'active_cents',current_cents,'active_count',current_count,
    'unassigned_count',unassigned));
end $$;
revoke all on function public.crm_pos_ledger(text,jsonb) from public,anon;
grant execute on function public.crm_pos_ledger(text,jsonb) to authenticated;

-- Index covers historical close events and actor filtering without changing evidence.
create index if not exists hospitality_events_closed_orders_idx
 on akihq_hospitality.events(workspace_id,order_id,id desc)
 where action='payment' and after_state->>'status'='closed';

commit;
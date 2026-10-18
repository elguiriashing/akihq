-- Operational kitchen/bar progress. No fiscal, payment or printer-state changes.
-- Defaults OFF per workspace. Requires the shared hospitality/security migrations.
begin;
create table akihq_hospitality.kds_settings (
 workspace_id text primary key references public.crm_workspaces(id),
 enabled boolean not null default false, updated_by uuid not null,
 updated_at timestamptz not null default now()
);
create table akihq_hospitality.kds_cards (
 workspace_id text not null references public.crm_workspaces(id),
 order_id uuid not null references akihq_hospitality.orders(id),
 station text not null check (station in ('kitchen','bar')),
 version bigint not null default 1,
 source jsonb not null, previous_source jsonb not null default '{}',
 progress jsonb not null default '{}', previous_progress jsonb not null default '{}',
 review_required boolean not null default false,
 change_kind text not null default 'new',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 changed_at timestamptz not null default now(), completed_at timestamptz,
 primary key (workspace_id,order_id,station)
);
create index kds_active_cards on akihq_hospitality.kds_cards(workspace_id,completed_at,created_at);
alter table akihq_hospitality.kds_settings enable row level security;
alter table akihq_hospitality.kds_cards enable row level security;
revoke all on akihq_hospitality.kds_settings,akihq_hospitality.kds_cards from public,anon,authenticated,service_role;

-- Keep a culinary snapshot, not prices, payment references or customer records.
-- Only SENT lines reach the kitchen. Payment closure does not complete preparation.
create function akihq_hospitality.kds_sync(p_order jsonb,p_kind text) returns void
language plpgsql set search_path='' as $$
declare
 w text:=p_order->>'workspace_id'; oid uuid:=(p_order->>'id')::uuid;
 st text; src jsonb; ls jsonb; prog jsonb; l jsonb; old_line jsonb;
 c akihq_hospitality.kds_cards%rowtype; needs_review boolean; prior jsonb; prior_prog jsonb;
begin
 if not coalesce((select enabled from akihq_hospitality.kds_settings where workspace_id=w),false) then return; end if;
 foreach st in array array['kitchen','bar'] loop
  select coalesce(jsonb_agg(x-'unit_price_cents' order by x->>'id'),'[]') into ls
   from jsonb_array_elements(p_order->'sent') x where x->>'station'=st;
  src:=jsonb_build_object('label',p_order->>'label','table_id',p_order->'table_id',
   'note',p_order->>'note','guests',p_order->'guests','cancelled',p_order->>'status'='cancelled','lines',ls);
  select * into c from akihq_hospitality.kds_cards where workspace_id=w and order_id=oid and station=st for update;
  if not found then
   if ls='[]' then continue; end if;
   select coalesce(jsonb_object_agg(x->>'id','queued'::text),'{}') into prog from jsonb_array_elements(ls) x;
   insert into akihq_hospitality.kds_cards(workspace_id,order_id,station,source,progress,review_required,change_kind)
    values(w,oid,st,src,prog,p_kind in ('relocation','imported','cancellation'),p_kind);
  elsif src is distinct from c.source then
   -- Preserve unchanged dishes; changed quantities/notes cannot inherit readiness.
   prog:='{}';
   for l in select value from jsonb_array_elements(ls) loop
    select x into old_line from jsonb_array_elements(c.source->'lines') x where x->>'id'=l->>'id';
    prog:=prog||jsonb_build_object(l->>'id',case when l=old_line then coalesce(c.progress->> (l->>'id'),'queued') else 'queued' end);
   end loop;
   needs_review:=c.review_required or p_kind in ('relocation','imported','cancellation')
    or src->>'note' is distinct from c.source->>'note'
    or (ls is distinct from c.source->'lines' and c.source->'lines'<>'[]');
   -- Multiple revisions before acknowledgement retain the last acknowledged baseline.
   prior:=case when c.review_required then c.previous_source else c.source end;
   prior_prog:=case when c.review_required then c.previous_progress else c.progress end;
   update akihq_hospitality.kds_cards set source=src,previous_source=prior,previous_progress=prior_prog,
    progress=prog,review_required=needs_review,change_kind=p_kind,version=version+1,
    updated_at=now(),changed_at=now(),completed_at=case when not needs_review and c.completed_at is not null
      and not exists(select 1 from jsonb_each_text(prog) where value<>'served') then c.completed_at else null end
    where workspace_id=w and order_id=oid and station=st;
  end if;
 end loop;
end $$;
create function akihq_hospitality.kds_order_changed() returns trigger
language plpgsql set search_path='' as $$
declare kind text:='revision';
begin
 if new.status='cancelled' then kind:='cancellation';
 elsif tg_op='UPDATE' and (new.table_id is distinct from old.table_id or new.label is distinct from old.label
   or (new.sent is distinct from old.sent and new.lines is distinct from old.lines)
   or exists(select 1 from jsonb_array_elements(new.sent) n join jsonb_array_elements(old.sent) o
     on n->>'id'=o->>'id' where n->>'station' is distinct from o->>'station')) then kind:='relocation';
 elsif tg_op='UPDATE' and new.note is distinct from old.note then kind:='note';
 elsif tg_op='INSERT' or old.sent='[]' then kind:='new'; end if;
 perform akihq_hospitality.kds_sync(to_jsonb(new),kind);
 return new;
end $$;
create trigger hospitality_kds_sync after insert or update on akihq_hospitality.orders
 for each row execute function akihq_hospitality.kds_order_changed();

create function public.crm_kds_overview(p_workspace text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare enabled boolean; result jsonb;
begin
 perform akihq_hospitality.guard(p_workspace);
 select coalesce(s.enabled,false) into enabled from akihq_hospitality.kds_settings s where workspace_id=p_workspace;
 if coalesce(enabled,false) and (select count(*) from akihq_hospitality.kds_cards where workspace_id=p_workspace and completed_at is null)>2000
  then raise exception 'Kitchen capacity exceeded; contact support. No orders have been hidden.'; end if;
 select jsonb_build_object('contract_version',1,'enabled',coalesce(enabled,false),
  'can_manage',akihq_security.can_administer(p_workspace),'server_time',now(),'history_limit',50,
  'cards',case when coalesce(enabled,false) then coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from (
   select * from akihq_hospitality.kds_cards where workspace_id=p_workspace and completed_at is null
   union all
   (select * from akihq_hospitality.kds_cards where workspace_id=p_workspace and completed_at is not null order by completed_at desc limit 50)
  ) c),'[]') else '[]'::jsonb end) into result;
 return result;
end $$;

-- Uses the existing hospitality command journal and workspace lock. Existing
-- abandon/retry recovery therefore protects KDS commands across devices too.
create function public.crm_kds_command(p_workspace text,p_key uuid,p_command jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 a text:=p_command->>'action'; actor uuid:=auth.uid(); prior akihq_hospitality.commands%rowtype;
 c akihq_hospitality.kds_cards%rowtype; before_card jsonb; response jsonb:='{}';
 o record; l jsonb; id text; old_state text; new_state text; changed integer:=0; prog jsonb;
 reason text:=btrim(coalesce(p_command->>'reason','')); target text:=p_command->>'state'; enabled boolean;
begin
 perform akihq_hospitality.guard(p_workspace);
 if p_key is null or jsonb_typeof(p_command) is distinct from 'object' or octet_length(p_command::text)>30000 then raise exception 'Invalid kitchen command'; end if;
 perform pg_advisory_xact_lock(hashtextextended('akihq-hospitality:'||p_workspace,0));
 select * into prior from akihq_hospitality.commands where workspace_id=p_workspace and key=p_key;
 if found then
  if prior.actor<>actor or prior.request<>p_command then raise exception 'Request reference already used'; end if;
  return prior.response;
 end if;
 if a in ('kds_enable','kds_disable') then
  if not akihq_security.can_administer(p_workspace) then raise exception 'Manager access required' using errcode='42501'; end if;
  select coalesce(s.enabled,false) into enabled from akihq_hospitality.kds_settings s where workspace_id=p_workspace;
  if a='kds_enable' then
   if p_command->'confirmed' is distinct from 'true'::jsonb then raise exception 'Confirm the service handover before enabling the kitchen display'; end if;
   if coalesce(enabled,false) then raise exception 'Kitchen display already enabled'; end if;
   insert into akihq_hospitality.kds_settings(workspace_id,enabled,updated_by) values(p_workspace,true,actor)
    on conflict(workspace_id) do update set enabled=true,updated_by=actor,updated_at=now();
   -- Closed bills predating activation must be finished in the previous workflow.
   -- Open sent orders are imported, but require manual progress reconciliation.
   for o in select * from akihq_hospitality.orders where workspace_id=p_workspace and status='open' and sent<>'[]' loop
    perform akihq_hospitality.kds_sync(to_jsonb(o),'imported');
   end loop;
  else
   if exists(select 1 from akihq_hospitality.kds_cards where workspace_id=p_workspace and completed_at is null) then raise exception 'Finish or reconcile outstanding kitchen cards before disabling'; end if;
   update akihq_hospitality.kds_settings set enabled=false,updated_by=actor,updated_at=now() where workspace_id=p_workspace;
  end if;
  response:=jsonb_build_object('enabled',a='kds_enable');
 else
  if not coalesce((select s.enabled from akihq_hospitality.kds_settings s where workspace_id=p_workspace),false) then raise exception 'Kitchen display is not enabled'; end if;
  select * into c from akihq_hospitality.kds_cards where workspace_id=p_workspace
   and order_id=(p_command->>'order_id')::uuid and station=p_command->>'station' for update;
  if not found then raise exception 'Kitchen card not found'; end if;
  if (p_command->>'version')::bigint is distinct from c.version then raise exception 'Kitchen card changed; reload and review' using errcode='PT409'; end if;
  before_card:=to_jsonb(c);prog:=c.progress;
  if a='kds_review' then
   if not c.review_required then raise exception 'No kitchen revision to review'; end if;
   if p_command->'confirmed' is distinct from 'true'::jsonb or length(reason) not between 3 and 500 then raise exception 'Confirm the revision and record a reconciliation reason'; end if;
   if jsonb_typeof(p_command->'progress') is distinct from 'object' then raise exception 'Reviewed line progress is required'; end if;
   if exists(select 1 from jsonb_object_keys(p_command->'progress') k where not (c.progress ? k)) then raise exception 'Unknown reviewed line'; end if;
   prog:='{}';
   for l in select value from jsonb_array_elements(c.source->'lines') loop
    id:=l->>'id';new_state:=p_command->'progress'->>id;
    if new_state is null or new_state not in ('queued','preparing','ready','served') then raise exception 'Review every current line'; end if;
    prog:=prog||jsonb_build_object(id,new_state);
   end loop;
   c.review_required:=false;
  elsif a='kds_advance' then
   if c.review_required or (c.source->>'cancelled')::boolean or c.completed_at is not null then raise exception 'Review the kitchen changes before advancing'; end if;
   if target not in ('preparing','ready','served') or target is null then raise exception 'Invalid preparation state'; end if;
   old_state:=case target when 'preparing' then 'queued' when 'ready' then 'preparing' else 'ready' end;
   for l in select value from jsonb_array_elements(c.source->'lines') loop
    id:=l->>'id';
    if (p_command->>'line_id'='*' or p_command->>'line_id'=id) and prog->>id=old_state then
     prog:=prog||jsonb_build_object(id,target);changed:=changed+1;
    end if;
   end loop;
   if changed=0 then raise exception 'No matching lines in the expected preparation state'; end if;
  elsif a='kds_recall' then
   if not akihq_security.can_administer(p_workspace) then raise exception 'Manager access required' using errcode='42501'; end if;
   if c.review_required or (c.source->>'cancelled')::boolean then raise exception 'Review the revision first; cancelled orders cannot be recalled'; end if;
   if length(reason) not between 3 and 500 then raise exception 'Recall reason required'; end if;
   id:=p_command->>'line_id';
   if id is null or not (prog ? id) then raise exception 'Kitchen line not found'; end if;
   prog:=prog||jsonb_build_object(id,'queued');
  else raise exception 'Unknown kitchen command'; end if;
  update akihq_hospitality.kds_cards set progress=prog,review_required=c.review_required,
   version=version+1,updated_at=now(),completed_at=case when not c.review_required and
     ((c.source->>'cancelled')::boolean or not exists(select 1 from jsonb_each_text(prog) where value<>'served')) then now() else null end
   where workspace_id=p_workspace and order_id=c.order_id and station=c.station returning * into c;
  response:=jsonb_build_object('kds_order_id',c.order_id,'station',c.station,'version',c.version);
 end if;
 insert into akihq_hospitality.events(workspace_id,order_id,actor,command_id,action,metadata,before_state,after_state)
  values(p_workspace,c.order_id,actor,p_key,a,p_command,before_card,case when c.order_id is null then response else to_jsonb(c) end);
 insert into akihq_hospitality.commands(workspace_id,key,actor,request,response) values(p_workspace,p_key,actor,p_command,response);
 return response;
end $$;
revoke all on function akihq_hospitality.kds_sync(jsonb,text),akihq_hospitality.kds_order_changed() from public,anon,authenticated,service_role;
revoke all on function public.crm_kds_overview(text),public.crm_kds_command(text,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.crm_kds_overview(text),public.crm_kds_command(text,uuid,jsonb) to authenticated;
commit;

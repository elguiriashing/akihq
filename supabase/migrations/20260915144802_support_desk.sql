-- Requires AkiPasa CRM tenant/role-template migrations (through 0080).
-- Version matches the additive production migration applied on 2026-09-15.
-- Additive migration. No existing email or customer data is moved or deleted.
begin;

insert into public.crm_tool_catalog(tool_key,name,description,category,billable,sort_order,active)
values ('support','Customer Support','Email tickets, approved-answer AI and human handover.','communications',true,35,true)
on conflict (tool_key) do nothing;

create schema if not exists support_private;
revoke all on schema support_private from public,anon,authenticated;
grant usage on schema support_private to service_role;

create table public.crm_support_settings (
  workspace_id text primary key references public.crm_workspaces(id),
  enabled boolean not null default true,
  ai_mode text not null default 'off' check(ai_mode in ('off','draft','auto')),
  max_ai_replies integer not null default 2 check(max_ai_replies between 1 and 3),
  daily_ai_limit integer not null default 25 check(daily_ai_limit between 1 and 100),
  knowledge jsonb not null default '[]' check(jsonb_typeof(knowledge)='array' and jsonb_array_length(knowledge)<=30),
  next_ticket bigint not null default 1,
  ai_day date, ai_requests integer not null default 0,
  updated_at timestamptz not null default now()
);
create table public.crm_support_mailboxes (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.crm_workspaces(id),
  address text not null unique check(address=lower(address) and address ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
  active boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique(workspace_id,id)
);
create index crm_support_mailboxes_workspace on public.crm_support_mailboxes(workspace_id);
create table public.crm_support_contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.crm_workspaces(id),
  email text not null check(email=lower(email)),
  name text not null default '',
  created_at timestamptz not null default now(),
  unique(workspace_id,email), unique(workspace_id,id)
);
create table public.crm_support_tickets (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.crm_workspaces(id),
  number bigint not null, mailbox_id uuid not null, contact_id uuid not null,
  subject text not null check(char_length(subject)<=500),
  status text not null default 'new' check(status in ('new','ai_active','needs_human','in_progress','waiting_customer','resolved','spam')),
  priority text not null default 'normal' check(priority in ('low','normal','high','urgent')),
  assigned_to uuid references public.profiles(id),
  human_control boolean not null default false,
  handover_reason text not null default '',
  ai_replies integer not null default 0,
  ai_draft text not null default '',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,number), unique(workspace_id,id), unique(workspace_id,id,mailbox_id),
  foreign key(workspace_id,mailbox_id) references public.crm_support_mailboxes(workspace_id,id),
  foreign key(workspace_id,contact_id) references public.crm_support_contacts(workspace_id,id)
);
create index crm_support_tickets_queue on public.crm_support_tickets(workspace_id,status,updated_at desc);
create index crm_support_tickets_contact on public.crm_support_tickets(workspace_id,contact_id);
create index crm_support_tickets_mailbox on public.crm_support_tickets(workspace_id,mailbox_id);
create index crm_support_tickets_assignee on public.crm_support_tickets(assigned_to);
create table public.crm_support_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  ticket_id uuid not null, mailbox_id uuid not null,
  direction text not null check(direction in ('inbound','outbound','note')),
  author_kind text not null check(author_kind in ('customer','human','ai')),
  text text not null check(char_length(text)<=20000),
  message_id text,
  in_reply_to text,
  request_id uuid,
  attachments jsonb not null default '[]',
  original_key text check(original_key is null or left(original_key,char_length(workspace_id)+1)=workspace_id||'/'),
  delivery_status text not null default 'received' check(delivery_status in ('received','queued','sending','sent','failed','uncertain','cancelled','internal')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(mailbox_id,message_id), unique(workspace_id,ticket_id,request_id),
  foreign key(workspace_id,ticket_id,mailbox_id) references public.crm_support_tickets(workspace_id,id,mailbox_id)
);
create index crm_support_messages_thread on public.crm_support_messages(workspace_id,ticket_id,created_at);
create index crm_support_messages_outbox on public.crm_support_messages(delivery_status,created_at) where direction='outbound';
create index crm_support_messages_author on public.crm_support_messages(created_by);
create table public.crm_support_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.crm_workspaces(id),
  ticket_id uuid, actor_id uuid references public.profiles(id),
  kind text not null, detail jsonb not null default '{}', created_at timestamptz not null default now(),
  foreign key(workspace_id,ticket_id) references public.crm_support_tickets(workspace_id,id)
);
create index crm_support_events_ticket on public.crm_support_events(workspace_id,ticket_id,created_at);
create index crm_support_events_actor on public.crm_support_events(actor_id);

-- No platform-admin bypass: even an administrator needs an active membership
-- in this tenant, an enabled tool and an explicit matching tenant role.
create function support_private.allowed(w text,a uuid,capability text default 'read')
returns boolean language sql stable set search_path='' as $$
  select a is not null and exists (
    select 1 from public.crm_workspace_members m
    join public.crm_workspaces ws on ws.id=m.workspace_id
    join public.crm_workspace_entitlements e on e.workspace_id=ws.id and e.tool_key='support'
    join public.crm_tool_catalog c on c.tool_key=e.tool_key
    where m.workspace_id=w and m.profile_id=a and m.status='active'
      and ws.status in ('active','trial') and c.active and e.active and e.starts_at<=now() and (e.ends_at is null or e.ends_at>now())
      and (ws.id='ws_akipasa' or public.has_active_entitlement(ws.owner_profile_id,'business'))
      and (m.role='owner' or (m.role='admin' and m.role_template_id is null) or exists (
        select 1 from public.crm_role_template_tools rt join public.crm_role_templates t on t.id=rt.template_id
        where rt.template_id=m.role_template_id and rt.tool_key='support' and t.workspace_id=w))
      and (capability='read' or (capability='write' and m.role<>'viewer') or (capability='manage' and m.role in ('owner','admin')))
  );
$$;
revoke all on function support_private.allowed(text,uuid,text) from public,anon,authenticated;
grant execute on function support_private.allowed(text,uuid,text) to service_role;
create function public.crm_support_access(p_workspace text)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('read',support_private.allowed(p_workspace,(select auth.uid()),'read'),
    'write',support_private.allowed(p_workspace,(select auth.uid()),'write'),
    'manage',support_private.allowed(p_workspace,(select auth.uid()),'manage'));
$$;
revoke all on function public.crm_support_access(text) from public,anon;
grant execute on function public.crm_support_access(text) to authenticated;

do $$ declare t text; begin
  foreach t in array array['crm_support_settings','crm_support_mailboxes','crm_support_contacts','crm_support_tickets','crm_support_messages','crm_support_events'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('grant all on public.%I to service_role',t);
    execute format('create policy support_read on public.%I for select to authenticated using ((public.crm_support_access(workspace_id)->>''read'')::boolean)',t);
  end loop;
end $$;

create function public.crm_support_overview(p_workspace text,p_actor uuid,p_filter text default 'open',p_search text default '',p_page integer default 0)
returns jsonb language plpgsql set search_path='' as $$
declare result jsonb;
begin
  if not support_private.allowed(p_workspace,p_actor) then raise insufficient_privilege; end if;
  if p_page<0 or p_page>10000 or char_length(p_search)>100 then raise invalid_parameter_value; end if;
  select jsonb_build_object(
    'settings',coalesce((select to_jsonb(s)-'next_ticket'-'ai_requests'-'ai_day' from public.crm_support_settings s where s.workspace_id=p_workspace),'{"enabled":true,"ai_mode":"off","knowledge":[],"max_ai_replies":2,"daily_ai_limit":25}'::jsonb),
    'mailboxes',(select coalesce(jsonb_agg(jsonb_build_object('address',b.address,'active',b.active,'verified',b.verified_at is not null)),'[]') from public.crm_support_mailboxes b where b.workspace_id=p_workspace),
    'members',(select coalesce(jsonb_agg(jsonb_build_object('id',m.profile_id,'name',p.display_name)),'[]') from public.crm_workspace_members m join public.profiles p on p.id=m.profile_id where m.workspace_id=p_workspace and support_private.allowed(p_workspace,m.profile_id,'write')),
    'counts',(select coalesce(jsonb_object_agg(status,n),'{}') from (select status,count(*) n from public.crm_support_tickets where workspace_id=p_workspace group by status) grouped),
    'attention',(select jsonb_build_object('count',count(*),'at',max(updated_at)) from public.crm_support_tickets where workspace_id=p_workspace and status='needs_human'),
    'tickets',(select coalesce(jsonb_agg(to_jsonb(q)),'[]') from (
      select t.*,c.name as requester_name,c.email as requester_email from public.crm_support_tickets t join public.crm_support_contacts c on c.workspace_id=t.workspace_id and c.id=t.contact_id
      where t.workspace_id=p_workspace
      and (p_filter='all' or (p_filter='open' and t.status not in ('resolved','spam')) or (p_filter='mine' and t.assigned_to=p_actor and t.status not in ('resolved','spam')) or t.status=p_filter)
      and (p_search='' or strpos(lower(t.subject||' '||c.name||' '||c.email||' SUP-'||lpad(t.number::text,6,'0')),lower(p_search))>0)
      order by t.updated_at desc,t.id limit 31 offset p_page*30
    ) q)
  ) into result;
  return result;
end $$;

create function public.crm_support_detail(p_workspace text,p_actor uuid,p_ticket uuid)
returns jsonb language plpgsql set search_path='' as $$
declare t public.crm_support_tickets;
begin
  if not support_private.allowed(p_workspace,p_actor) then raise insufficient_privilege; end if;
  select * into strict t from public.crm_support_tickets where workspace_id=p_workspace and id=p_ticket;
  return jsonb_build_object('ticket',to_jsonb(t),
    'contact',(select to_jsonb(c) from public.crm_support_contacts c where c.workspace_id=p_workspace and c.id=t.contact_id),
    'mailbox',(select jsonb_build_object('address',b.address) from public.crm_support_mailboxes b where b.workspace_id=p_workspace and b.id=t.mailbox_id),
    'messages',(select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at),'[]') from (select * from public.crm_support_messages where workspace_id=p_workspace and ticket_id=p_ticket order by created_at desc limit 200) q),
    'events',(select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc),'[]') from (select * from public.crm_support_events where workspace_id=p_workspace and ticket_id=p_ticket order by created_at desc limit 100) q));
end $$;

create function public.crm_support_settings_save(p_workspace text,p_actor uuid,p_settings jsonb)
returns void language plpgsql set search_path='' as $$
begin
  if not support_private.allowed(p_workspace,p_actor,'manage') then raise insufficient_privilege; end if;
  insert into public.crm_support_settings(workspace_id,enabled,ai_mode,max_ai_replies,daily_ai_limit,knowledge)
  values(p_workspace,(p_settings->>'enabled')::boolean,p_settings->>'ai_mode',(p_settings->>'max_ai_replies')::int,(p_settings->>'daily_ai_limit')::int,p_settings->'knowledge')
  on conflict(workspace_id) do update set enabled=excluded.enabled,ai_mode=excluded.ai_mode,max_ai_replies=excluded.max_ai_replies,daily_ai_limit=excluded.daily_ai_limit,knowledge=excluded.knowledge,updated_at=now();
  insert into public.crm_support_events(workspace_id,actor_id,kind,detail) values(p_workspace,p_actor,'settings_changed',jsonb_build_object('enabled',p_settings->'enabled','ai_mode',p_settings->'ai_mode'));
end $$;

create function public.crm_support_ingest(p_recipient text,p_from text,p_name text,p_subject text,p_text text,p_message_id text,p_references text[],p_attachments jsonb,p_reason text,p_original_key text default null)
returns jsonb language plpgsql set search_path='' as $$
declare b public.crm_support_mailboxes; s public.crm_support_settings; t public.crm_support_tickets; cid uuid; mid uuid; ticket_number bigint;
begin
  select * into b from public.crm_support_mailboxes where address=p_recipient for update;
  if b.id is null then return jsonb_build_object('handled',false); end if;
  if exists(select 1 from public.crm_support_messages where mailbox_id=b.id and message_id=p_message_id) then return jsonb_build_object('handled',true,'duplicate',true,'workspace_id',b.workspace_id); end if;
  insert into public.crm_support_settings(workspace_id) values(b.workspace_id) on conflict do nothing;
  select * into strict s from public.crm_support_settings where workspace_id=b.workspace_id;
  insert into public.crm_support_contacts(workspace_id,email,name) values(b.workspace_id,p_from,p_name)
    on conflict(workspace_id,email) do update set name=case when excluded.name<>'' then excluded.name else crm_support_contacts.name end returning id into cid;
  -- References alone never grant access to someone else's thread.
  select ticket.* into t from public.crm_support_tickets ticket where ticket.workspace_id=b.workspace_id and ticket.mailbox_id=b.id and ticket.contact_id=cid and exists (
    select 1 from public.crm_support_messages m where m.workspace_id=b.workspace_id and m.ticket_id=ticket.id and m.message_id=any(p_references))
    order by ticket.updated_at desc limit 1 for update;
  if t.id is null then
    update public.crm_support_settings set next_ticket=next_ticket+1 where workspace_id=b.workspace_id returning next_ticket-1 into ticket_number;
    insert into public.crm_support_tickets(workspace_id,number,mailbox_id,contact_id,subject)
    values(b.workspace_id,ticket_number,b.id,cid,p_subject) returning * into t;
  end if;
  insert into public.crm_support_messages(workspace_id,ticket_id,mailbox_id,direction,author_kind,text,message_id,in_reply_to,attachments,original_key)
  values(b.workspace_id,t.id,b.id,'inbound','customer',p_text,p_message_id,p_references[cardinality(p_references)],p_attachments,p_original_key) returning id into mid;
  update public.crm_support_tickets set status=case when status='spam' then 'spam' when p_reason<>'' or human_control or not s.enabled or s.ai_mode='off' or not b.active or b.verified_at is null then 'needs_human' else 'new' end,
    handover_reason=case when p_reason<>'' then p_reason when human_control then 'Customer replied; human follow-up needed.' when s.ai_mode='off' or not s.enabled then 'Automatic support is off.' else '' end,
    human_control=human_control or p_reason<>'',ai_draft='',version=version+1,updated_at=now() where workspace_id=b.workspace_id and id=t.id;
  insert into public.crm_support_events(workspace_id,ticket_id,kind,detail) values(b.workspace_id,t.id,'email_received',jsonb_build_object('message_id',mid));
  return jsonb_build_object('handled',true,'ticket_id',t.id,'workspace_id',b.workspace_id);
end $$;

create function public.crm_support_original(p_workspace text,p_actor uuid,p_message uuid)
returns jsonb language plpgsql set search_path='' as $$
declare m public.crm_support_messages;
begin
  if not support_private.allowed(p_workspace,p_actor) then raise insufficient_privilege; end if;
  select * into strict m from public.crm_support_messages where workspace_id=p_workspace and id=p_message and original_key is not null;
  insert into public.crm_support_events(workspace_id,ticket_id,actor_id,kind,detail) values(p_workspace,m.ticket_id,p_actor,'original_download',jsonb_build_object('message_id',m.id));
  return jsonb_build_object('key',m.original_key);
end $$;

create function public.crm_support_action(p_workspace text,p_actor uuid,p_ticket uuid,p_version integer,p_action jsonb)
returns jsonb language plpgsql set search_path='' as $$
declare t public.crm_support_tickets; mid uuid; kind text:=p_action->>'kind'; rid uuid; prior text;
begin
  if not support_private.allowed(p_workspace,p_actor,'write') then raise insufficient_privilege; end if;
  select * into strict t from public.crm_support_tickets where workspace_id=p_workspace and id=p_ticket for update;
  if kind in ('reply','note') then
    rid:=(p_action->>'request_id')::uuid;
    select id into mid from public.crm_support_messages where workspace_id=p_workspace and ticket_id=p_ticket and request_id=rid;
    if mid is not null then return jsonb_build_object('outbound_id',case when kind='reply' then mid else null end); end if;
  end if;
  if t.version<>p_version then raise serialization_failure; end if;
  if kind='update' then
    if nullif(p_action->>'assigned_to','') is not null and not support_private.allowed(p_workspace,(p_action->>'assigned_to')::uuid,'write') then raise invalid_parameter_value; end if;
    if p_action->>'status' in ('new','ai_active') then raise invalid_parameter_value; end if;
    update public.crm_support_tickets set status=p_action->>'status',priority=p_action->>'priority',assigned_to=(p_action->>'assigned_to')::uuid,human_control=true where id=t.id and workspace_id=p_workspace;
  elsif kind='takeover' then
    update public.crm_support_tickets set status='in_progress',assigned_to=p_actor,human_control=true,handover_reason='A team member took over.' where id=t.id and workspace_id=p_workspace;
  elsif kind in ('reply','note') then
    if char_length(btrim(p_action->>'text')) not between 1 and 20000 or rid is null then raise invalid_parameter_value; end if;
    if kind='reply' and (t.status='spam' or not exists(select 1 from public.crm_support_settings where workspace_id=p_workspace and enabled)) then raise invalid_parameter_value; end if;
    select message_id into prior from public.crm_support_messages where workspace_id=p_workspace and ticket_id=t.id and direction='inbound' order by created_at desc limit 1;
    insert into public.crm_support_messages(workspace_id,ticket_id,mailbox_id,direction,author_kind,text,request_id,in_reply_to,delivery_status,created_by)
    values(p_workspace,t.id,t.mailbox_id,case when kind='reply' then 'outbound' else 'note' end,'human',p_action->>'text',rid,prior,case when kind='reply' then 'queued' else 'internal' end,p_actor) returning id into mid;
    update public.crm_support_tickets set human_control=true,status=case when kind='reply' then 'in_progress' else status end,assigned_to=coalesce(assigned_to,p_actor),ai_draft='' where id=t.id and workspace_id=p_workspace;
  else raise invalid_parameter_value;
  end if;
  -- Cancels AI still queued. A provider request already in flight cannot be recalled.
  update public.crm_support_messages set delivery_status='cancelled',updated_at=now() where workspace_id=p_workspace and ticket_id=t.id and author_kind='ai' and delivery_status='queued';
  update public.crm_support_tickets set version=version+1,updated_at=now() where workspace_id=p_workspace and id=t.id;
  insert into public.crm_support_events(workspace_id,ticket_id,actor_id,kind,detail) values(p_workspace,t.id,p_actor,kind,p_action-'text');
  return jsonb_build_object('outbound_id',case when kind='reply' then mid else null end);
end $$;

create function public.crm_support_claim_ai()
returns jsonb language plpgsql set search_path='' as $$
declare t record; s public.crm_support_settings; result jsonb:='[]';
begin
  update public.crm_support_tickets set status='needs_human',human_control=true,handover_reason='AI processing timed out.',version=version+1,updated_at=now() where status='ai_active' and updated_at<now()-interval '5 minutes';
  for t in select ticket.* from public.crm_support_tickets ticket join public.crm_support_settings s0 on s0.workspace_id=ticket.workspace_id
    where ticket.status='new' and not ticket.human_control and s0.enabled and s0.ai_mode<>'off' order by ticket.created_at limit 3 for update of ticket skip locked loop
    select * into strict s from public.crm_support_settings where workspace_id=t.workspace_id for update;
    if not exists(select 1 from public.crm_workspace_members m where m.workspace_id=t.workspace_id and support_private.allowed(t.workspace_id,m.profile_id,'manage'))
      or not exists(select 1 from public.crm_support_mailboxes b where b.id=t.mailbox_id and b.workspace_id=t.workspace_id and b.active and b.verified_at is not null) then
      update public.crm_support_tickets set status='needs_human',human_control=true,handover_reason='Support access or mailbox is inactive.',version=version+1,updated_at=now() where id=t.id;
      continue;
    end if;
    if t.ai_replies>=s.max_ai_replies or jsonb_array_length(s.knowledge)=0 or (s.ai_day=current_date and s.ai_requests>=s.daily_ai_limit) then
      update public.crm_support_tickets set status='needs_human',human_control=true,handover_reason='AI answer or daily limit reached.',version=version+1,updated_at=now() where id=t.id;
      continue;
    end if;
    update public.crm_support_settings set ai_requests=case when ai_day=current_date then ai_requests+1 else 1 end,ai_day=current_date where workspace_id=t.workspace_id;
    update public.crm_support_tickets set status='ai_active',version=version+1,updated_at=now() where id=t.id;
    result:=result||jsonb_build_array(jsonb_build_object('id',t.id,'workspace_id',t.workspace_id,'version',t.version+1,'subject',t.subject,'knowledge',s.knowledge,'knowledge_version',s.updated_at,
      'text',(select text from public.crm_support_messages where workspace_id=t.workspace_id and ticket_id=t.id and direction='inbound' order by created_at desc limit 1)));
  end loop;
  return result;
end $$;

create function public.crm_support_finish_ai(p_workspace text,p_ticket uuid,p_version integer,p_answer_id text,p_reason text,p_knowledge_version timestamptz)
returns void language plpgsql set search_path='' as $$
declare t public.crm_support_tickets; s public.crm_support_settings; answer text; prior text;
begin
  select * into strict t from public.crm_support_tickets where workspace_id=p_workspace and id=p_ticket for update;
  if t.version<>p_version or t.human_control or t.status<>'ai_active' then return; end if;
  select * into strict s from public.crm_support_settings where workspace_id=p_workspace;
  if not s.enabled or s.ai_mode='off' or s.updated_at is distinct from p_knowledge_version then answer:=null;
  else select item->>'answer' into answer from jsonb_array_elements(s.knowledge) item where item->>'id'=p_answer_id limit 1; end if;
  if answer is null or s.ai_mode='draft' then
    update public.crm_support_tickets set status='needs_human',human_control=true,ai_draft=coalesce(answer,''),handover_reason=case when answer is not null then 'AI draft ready for human approval.' else left(coalesce(p_reason,'No approved answer matched.'),1000) end,version=version+1,updated_at=now() where id=t.id;
  else
    select message_id into prior from public.crm_support_messages where workspace_id=p_workspace and ticket_id=t.id and direction='inbound' order by created_at desc limit 1;
    insert into public.crm_support_messages(workspace_id,ticket_id,mailbox_id,direction,author_kind,text,in_reply_to,delivery_status)
    values(p_workspace,t.id,t.mailbox_id,'outbound','ai',answer,prior,'queued');
    update public.crm_support_tickets set ai_replies=ai_replies+1,version=version+1,updated_at=now() where id=t.id;
  end if;
  insert into public.crm_support_events(workspace_id,ticket_id,kind,detail) values(p_workspace,t.id,'ai_triage',jsonb_build_object('answer_id',p_answer_id,'mode',s.ai_mode,'reason',left(p_reason,1000)));
end $$;

create function public.crm_support_pending_delivery()
returns jsonb language plpgsql set search_path='' as $$
begin
  with stale as (update public.crm_support_messages set delivery_status='uncertain',updated_at=now() where delivery_status='sending' and updated_at<now()-interval '5 minutes' returning workspace_id,ticket_id)
  update public.crm_support_tickets t set status='needs_human',human_control=true,handover_reason='Email outcome unknown. Check delivery logs before replying again.',version=version+1,updated_at=now() from stale where t.id=stale.ticket_id and t.workspace_id=stale.workspace_id;
  return (select coalesce(jsonb_agg(to_jsonb(q)),'[]') from (select id,workspace_id from public.crm_support_messages where delivery_status='queued' order by created_at limit 10) q);
end $$;

create function public.crm_support_claim_delivery(p_workspace text,p_message uuid)
returns jsonb language plpgsql set search_path='' as $$
declare m public.crm_support_messages; t public.crm_support_tickets; b public.crm_support_mailboxes; s public.crm_support_settings; recipient text;
begin
  -- Ticket then message lock order is shared with human takeover/ingestion.
  select ticket.* into t from public.crm_support_tickets ticket join public.crm_support_messages msg on msg.ticket_id=ticket.id and msg.workspace_id=ticket.workspace_id where msg.id=p_message and msg.workspace_id=p_workspace for update of ticket;
  if t.id is null then return null; end if;
  select * into m from public.crm_support_messages where id=p_message and workspace_id=p_workspace for update;
  if m.delivery_status<>'queued' then return null; end if;
  select * into strict b from public.crm_support_mailboxes where id=t.mailbox_id and workspace_id=p_workspace;
  select * into strict s from public.crm_support_settings where workspace_id=p_workspace;
  if not s.enabled or not b.active or b.verified_at is null or t.status in ('resolved','spam')
    or (m.author_kind='human' and not support_private.allowed(p_workspace,m.created_by,'write'))
    or (m.author_kind='ai' and (t.human_control or s.ai_mode<>'auto' or not exists(select 1 from jsonb_array_elements(s.knowledge) item where item->>'answer'=m.text)))
    or not exists(select 1 from public.crm_workspace_members member where member.workspace_id=p_workspace and support_private.allowed(p_workspace,member.profile_id,'write')) then
    update public.crm_support_messages set delivery_status='cancelled',updated_at=now() where id=m.id;
    update public.crm_support_tickets set status='needs_human',human_control=true,handover_reason='Reply cancelled because support settings or permissions changed.',version=version+1,updated_at=now() where id=t.id;
    return null;
  end if;
  select email into strict recipient from public.crm_support_contacts where id=t.contact_id and workspace_id=p_workspace;
  update public.crm_support_messages set delivery_status='sending',updated_at=now() where id=m.id;
  return jsonb_build_object('from',b.address,'to',recipient,'subject','Re: [SUP-'||lpad(t.number::text,6,'0')||'] '||t.subject,'text',m.text,'in_reply_to',m.in_reply_to);
end $$;

create function public.crm_support_delivery_result(p_workspace text,p_message uuid,p_outcome text,p_provider_id text)
returns void language plpgsql set search_path='' as $$
declare m public.crm_support_messages;
begin
  if p_outcome not in ('sent','failed','uncertain') then raise invalid_parameter_value; end if;
  update public.crm_support_messages set delivery_status=p_outcome,message_id=nullif(p_provider_id,''),updated_at=now() where workspace_id=p_workspace and id=p_message and delivery_status in ('sending','uncertain') returning * into m;
  if m.id is null then return; end if;
  update public.crm_support_tickets t set status=case when p_outcome<>'sent' then 'needs_human'
    when t.updated_at<=m.created_at or t.status='ai_active' then 'waiting_customer' else t.status end,
    human_control=human_control or p_outcome<>'sent',
    handover_reason=case when p_outcome='sent' then handover_reason else 'Email not confirmed sent. Check delivery logs before sending another reply.' end,
    version=version+1,updated_at=now() where workspace_id=p_workspace and id=m.ticket_id;
  insert into public.crm_support_events(workspace_id,ticket_id,kind,detail) values(p_workspace,m.ticket_id,'email_'||p_outcome,jsonb_build_object('message_id',m.id));
end $$;

-- All mutation/aggregate RPCs above are service-only and SECURITY INVOKER.
-- No anonymous webhook, authenticated RPC backdoor or direct client writes.
do $$ declare fn record; begin
  for fn in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'crm_support_%' and p.proname<>'crm_support_access' loop
    execute format('revoke all on function %s from public,anon,authenticated',fn.signature);
    execute format('grant execute on function %s to service_role',fn.signature);
  end loop;
end $$;

-- Original MIME emails include attachments and can contain private material.
-- Do not expose public/signed links or inherit unrelated permissive policies.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('crm-support-mail','crm-support-mail',false,26214400,array['message/rfc822']);
create policy support_originals_gateway_only on storage.objects as restrictive
for all to anon,authenticated using(bucket_id<>'crm-support-mail') with check(bucket_id<>'crm-support-mail');

-- Register known AkiPasa alias. Activation is a separate verified deployment
-- step; never let a tenant self-claim another tenant's email address.
insert into public.crm_support_settings(workspace_id) select id from public.crm_workspaces where id='ws_akipasa';
insert into public.crm_support_mailboxes(workspace_id,address)
  select id,'support@akipasa.com' from public.crm_workspaces where id='ws_akipasa';
insert into public.crm_workspace_entitlements(workspace_id,tool_key,active,source)
  select id,'support',true,'manual' from public.crm_workspaces where id='ws_akipasa' on conflict do nothing;
commit;

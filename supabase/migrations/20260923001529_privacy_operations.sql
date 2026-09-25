-- Tenant privacy operations and an audited, consent-gated marketing outbox.
-- No existing business data is changed, copied, or deleted by this migration.
begin;
create schema if not exists privacy_private;
revoke all on schema privacy_private from public,anon,authenticated;
grant usage on schema privacy_private to service_role;

create function privacy_private.allowed(w text,a uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select a is not null and exists(select 1 from public.crm_workspace_members m
    join public.crm_workspaces ws on ws.id=m.workspace_id
    where m.workspace_id=w and m.profile_id=a and m.status='active'
      and (m.role='owner' or (m.role='admin' and m.role_template_id is null)));
$$;
revoke all on function privacy_private.allowed(text,uuid) from public,anon,authenticated;
create function public.crm_privacy_access(p_workspace text)
returns boolean language sql stable security definer set search_path='' as $$
  select privacy_private.allowed(p_workspace,(select auth.uid()));
$$;
revoke all on function public.crm_privacy_access(text) from public,anon;
grant execute on function public.crm_privacy_access(text) to authenticated;

create table public.crm_privacy_settings(
  workspace_id text primary key references public.crm_workspaces(id),
  controller_name text not null check(char_length(controller_name) between 2 and 300),
  controller_address text not null check(char_length(controller_address) between 5 and 1000),
  privacy_email text not null check(privacy_email=lower(privacy_email) and privacy_email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
  policy_url text not null check(policy_url ~ '^https://'),
  retention_days integer not null check(retention_days between 30 and 3650),
  updated_at timestamptz not null default now()
);
create table public.crm_privacy_consents(
  id uuid primary key default gen_random_uuid(), workspace_id text not null references public.crm_workspaces(id),
  email text not null check(email=lower(email) and email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
  channel text not null default 'email' check(channel='email'), purpose text not null default 'marketing' check(purpose='marketing'),
  status text not null check(status in ('granted','withdrawn')),
  source text not null check(char_length(source) between 3 and 1000),
  evidence text not null check(char_length(evidence) between 10 and 4000),
  notice_version text not null check(char_length(notice_version) between 1 and 100),
  occurred_at timestamptz not null, recorded_at timestamptz not null default now(),
  actor_id uuid references public.profiles(id)
);
create index crm_privacy_consents_subject on public.crm_privacy_consents(workspace_id,email,occurred_at desc,recorded_at desc);
create index crm_privacy_consents_actor on public.crm_privacy_consents(actor_id);
create table public.crm_privacy_suppressions(
  workspace_id text not null references public.crm_workspaces(id), email text not null check(email=lower(email)),
  reason text not null check(reason in ('withdrawn','unsubscribe','bounce','complaint','objection')),
  created_at timestamptz not null default now(), primary key(workspace_id,email)
);
create table public.crm_privacy_requests(
  id uuid primary key default gen_random_uuid(), workspace_id text not null references public.crm_workspaces(id),
  email text not null check(email=lower(email) and email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
  kind text not null check(kind in ('access','erasure','rectification','restriction','objection','portability')),
  status text not null default 'received' check(status in ('received','verified','completed','rejected')),
  note text not null default '', received_at timestamptz not null default now(),
  due_at timestamptz not null default (now()+interval '1 month'),
  extended boolean not null default false, verified_at timestamptz, resolved_at timestamptz,
  created_by uuid references public.profiles(id), unique(workspace_id,id)
);
create index crm_privacy_requests_due on public.crm_privacy_requests(workspace_id,status,due_at);
create index crm_privacy_requests_actor on public.crm_privacy_requests(created_by);
create table public.crm_privacy_events(
  id bigint generated always as identity primary key, workspace_id text not null references public.crm_workspaces(id),
  actor_id uuid references public.profiles(id), kind text not null,
  subject_email text, detail jsonb not null default '{}', created_at timestamptz not null default now()
);
create index crm_privacy_events_workspace on public.crm_privacy_events(workspace_id,created_at desc);
create index crm_privacy_events_actor on public.crm_privacy_events(actor_id);
create table privacy_private.marketing_outbox(
  id uuid primary key default gen_random_uuid(), workspace_id text not null references public.crm_workspaces(id),
  request_id uuid not null, actor_id uuid references public.profiles(id),
  email text not null, sender text not null, subject text not null, body_digest text not null,
  unsubscribe_token uuid not null default gen_random_uuid() unique,
  consent_id uuid not null references public.crm_privacy_consents(id),
  status text not null default 'sending' check(status in ('sending','sent','failed','uncertain')),
  provider_id text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(workspace_id,request_id)
);
create unique index marketing_outbox_provider on privacy_private.marketing_outbox(provider_id) where provider_id is not null;
create index marketing_outbox_actor on privacy_private.marketing_outbox(actor_id);
create index marketing_outbox_consent on privacy_private.marketing_outbox(consent_id);
create table privacy_private.delivery_events(id text primary key,kind text not null,provider_id text not null,created_at timestamptz not null default now());
create index delivery_events_provider on privacy_private.delivery_events(provider_id);
alter table privacy_private.marketing_outbox enable row level security;
alter table privacy_private.delivery_events enable row level security;

create function privacy_private.append_only() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Audit evidence is append-only' using errcode='42501'; end $$;
create trigger privacy_consents_immutable before update or delete on public.crm_privacy_consents for each row execute function privacy_private.append_only();
create trigger privacy_events_immutable before update or delete on public.crm_privacy_events for each row execute function privacy_private.append_only();
create trigger privacy_suppressions_immutable before update or delete on public.crm_privacy_suppressions for each row execute function privacy_private.append_only();

do $$ declare t text; begin
  foreach t in array array['crm_privacy_settings','crm_privacy_consents','crm_privacy_suppressions','crm_privacy_requests','crm_privacy_events'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('grant all on public.%I to service_role',t);
    execute format('create policy privacy_manager_read on public.%I for select to authenticated using (public.crm_privacy_access(workspace_id))',t);
  end loop;
end $$;
grant usage,select on sequence public.crm_privacy_events_id_seq to service_role;
grant all on all tables in schema privacy_private to service_role;

create function public.crm_privacy_overview(p_workspace text,p_actor uuid)
returns jsonb language plpgsql set search_path='' as $$
begin
  if not privacy_private.allowed(p_workspace,p_actor) then raise insufficient_privilege; end if;
  return jsonb_build_object(
    'settings',(select to_jsonb(s) from public.crm_privacy_settings s where s.workspace_id=p_workspace),
    'requests',coalesce((select jsonb_agg(to_jsonb(q)) from (select * from public.crm_privacy_requests where workspace_id=p_workspace order by received_at desc limit 200) q),'[]'),
    'counts',jsonb_build_object('consent_records',(select count(*) from public.crm_privacy_consents where workspace_id=p_workspace),
      'suppressed',(select count(*) from public.crm_privacy_suppressions where workspace_id=p_workspace),
      'overdue',(select count(*) from public.crm_privacy_requests where workspace_id=p_workspace and status in ('received','verified') and due_at<now())),
    'recent_events',coalesce((select jsonb_agg(to_jsonb(q)) from (select * from public.crm_privacy_events where workspace_id=p_workspace order by id desc limit 50) q),'[]'),
    'retention_review',jsonb_build_object('support_tickets',(select count(*) from public.crm_support_tickets t join public.crm_privacy_settings s using(workspace_id)
      where t.workspace_id=p_workspace and t.status in ('resolved','spam') and t.updated_at < now()-make_interval(days=>s.retention_days)),
      'action','review_required','automatic_deletion',false));
end $$;

create function public.crm_privacy_settings_save(p_workspace text,p_actor uuid,p_settings jsonb)
returns jsonb language plpgsql set search_path='' as $$
begin
  if not privacy_private.allowed(p_workspace,p_actor) then raise insufficient_privilege; end if;
  insert into public.crm_privacy_settings(workspace_id,controller_name,controller_address,privacy_email,policy_url,retention_days)
  values(p_workspace,p_settings->>'controller_name',p_settings->>'controller_address',lower(p_settings->>'privacy_email'),p_settings->>'policy_url',(p_settings->>'retention_days')::integer)
  on conflict(workspace_id) do update set controller_name=excluded.controller_name,controller_address=excluded.controller_address,
    privacy_email=excluded.privacy_email,policy_url=excluded.policy_url,retention_days=excluded.retention_days,updated_at=now();
  insert into public.crm_privacy_events(workspace_id,actor_id,kind,detail) values(p_workspace,p_actor,'settings_updated',jsonb_build_object('retention_days',p_settings->'retention_days'));
  return jsonb_build_object('ok',true);
end $$;

create function public.crm_privacy_consent_record(p_workspace text,p_actor uuid,p_consent jsonb)
returns jsonb language plpgsql set search_path='' as $$
declare e text:=lower(trim(p_consent->>'email')); c public.crm_privacy_consents; occurred timestamptz:=(p_consent->>'occurred_at')::timestamptz;
begin
  if not privacy_private.allowed(p_workspace,p_actor) then raise insufficient_privilege; end if;
  if occurred is null or occurred>now()+interval '5 minutes' then raise invalid_parameter_value; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_workspace||':'||e,0));
  insert into public.crm_privacy_consents(workspace_id,email,status,source,evidence,notice_version,occurred_at,actor_id)
    values(p_workspace,e,p_consent->>'status',p_consent->>'source',p_consent->>'evidence',p_consent->>'notice_version',occurred,p_actor) returning * into c;
  if c.status='withdrawn' then
    insert into public.crm_privacy_suppressions(workspace_id,email,reason) values(p_workspace,e,'withdrawn') on conflict do nothing;
  end if;
  insert into public.crm_privacy_events(workspace_id,actor_id,kind,subject_email,detail) values(p_workspace,p_actor,'consent_'||c.status,e,jsonb_build_object('consent_id',c.id));
  return jsonb_build_object('ok',true,'id',c.id,'suppressed',exists(select 1 from public.crm_privacy_suppressions where workspace_id=p_workspace and email=e));
end $$;

create function public.crm_privacy_request_create(p_workspace text,p_actor uuid,p_request jsonb)
returns jsonb language plpgsql set search_path='' as $$
declare r public.crm_privacy_requests; e text:=lower(trim(p_request->>'email'));
  received timestamptz:=coalesce((p_request->>'received_at')::timestamptz,now());
begin
  if not privacy_private.allowed(p_workspace,p_actor) then raise insufficient_privilege; end if;
  if char_length(coalesce(p_request->>'note',''))>4000 or received>now()+interval '5 minutes' then raise invalid_parameter_value; end if;
  insert into public.crm_privacy_requests(workspace_id,email,kind,note,created_by,received_at,due_at)
    values(p_workspace,e,p_request->>'kind',coalesce(p_request->>'note',''),p_actor,received,received+interval '1 month') returning * into r;
  if r.kind in ('objection','restriction','erasure') then
    perform pg_advisory_xact_lock(hashtextextended(p_workspace||':'||e,0));
    insert into public.crm_privacy_suppressions(workspace_id,email,reason) values(p_workspace,e,'objection') on conflict do nothing;
  end if;
  insert into public.crm_privacy_events(workspace_id,actor_id,kind,subject_email,detail) values(p_workspace,p_actor,'rights_request_received',e,jsonb_build_object('request_id',r.id,'kind',r.kind,'received_at',received));
  return to_jsonb(r);
end $$;

create function public.crm_privacy_request_action(p_workspace text,p_actor uuid,p_id uuid,p_action text,p_note text)
returns jsonb language plpgsql set search_path='' as $$
declare r public.crm_privacy_requests;
begin
  if not privacy_private.allowed(p_workspace,p_actor) then raise insufficient_privilege; end if;
  if char_length(trim(coalesce(p_note,'')))<10 or char_length(p_note)>4000 then raise invalid_parameter_value; end if;
  select * into strict r from public.crm_privacy_requests where workspace_id=p_workspace and id=p_id for update;
  if r.status in ('completed','rejected') then raise invalid_parameter_value; end if;
  if p_action='verify' and r.status='received' then
    update public.crm_privacy_requests set status='verified',verified_at=now() where id=r.id;
  elsif p_action='extend' and not r.extended and now()<=r.due_at then
    update public.crm_privacy_requests set due_at=received_at+interval '3 months',extended=true where id=r.id;
  elsif p_action='complete' and r.status='verified' then
    update public.crm_privacy_requests set status='completed',resolved_at=now() where id=r.id;
  elsif p_action='reject' then
    update public.crm_privacy_requests set status='rejected',resolved_at=now() where id=r.id;
  else raise invalid_parameter_value;
  end if;
  insert into public.crm_privacy_events(workspace_id,actor_id,kind,subject_email,detail) values(p_workspace,p_actor,'rights_request_'||p_action,r.email,jsonb_build_object('request_id',r.id,'note',p_note));
  return (select to_jsonb(q) from public.crm_privacy_requests q where id=r.id);
end $$;

create function public.crm_privacy_subject_export(p_workspace text,p_actor uuid,p_id uuid)
returns jsonb language plpgsql set search_path='' as $$
declare r public.crm_privacy_requests;
begin
  if not privacy_private.allowed(p_workspace,p_actor) then raise insufficient_privilege; end if;
  select * into strict r from public.crm_privacy_requests where workspace_id=p_workspace and id=p_id;
  if r.verified_at is null or r.kind not in ('access','portability') then raise insufficient_privilege; end if;
  insert into public.crm_privacy_events(workspace_id,actor_id,kind,subject_email,detail) values(p_workspace,p_actor,'subject_export_prepared',r.email,jsonb_build_object('request_id',r.id));
  return jsonb_build_object('schema','akihq.subject-data.v1','generated_at',now(),'request_id',r.id,'subject_email',r.email,
    'coverage',jsonb_build_object('included',jsonb_build_array('privacy_consent','privacy_suppression','privacy_requests','support_contact','support_tickets','customer_correspondence'),
      'requires_separate_review',jsonb_build_array('CRM workspace snapshots','company mailbox','sales and statutory invoices','booking and membership data','staff records','provider records','backups'),
      'complete_subject_export',false),
    'consents',coalesce((select jsonb_agg(to_jsonb(c)-'actor_id') from public.crm_privacy_consents c where c.workspace_id=p_workspace and c.email=r.email),'[]'),
    'suppressions',coalesce((select jsonb_agg(to_jsonb(c)) from public.crm_privacy_suppressions c where c.workspace_id=p_workspace and c.email=r.email),'[]'),
    'rights_requests',coalesce((select jsonb_agg(to_jsonb(c)-'created_by') from public.crm_privacy_requests c where c.workspace_id=p_workspace and c.email=r.email),'[]'),
    'support_contacts',coalesce((select jsonb_agg(to_jsonb(c)) from public.crm_support_contacts c where c.workspace_id=p_workspace and c.email=r.email),'[]'),
    'support_tickets',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'number',t.number,'subject',t.subject,'status',t.status,'created_at',t.created_at))
      from public.crm_support_tickets t join public.crm_support_contacts c on c.workspace_id=t.workspace_id and c.id=t.contact_id where t.workspace_id=p_workspace and c.email=r.email),'[]'),
    'correspondence',coalesce((select jsonb_agg(jsonb_build_object('ticket_id',m.ticket_id,'direction',m.direction,'text',m.text,'created_at',m.created_at) order by m.created_at)
      from public.crm_support_messages m join public.crm_support_tickets t on t.workspace_id=m.workspace_id and t.id=m.ticket_id
      join public.crm_support_contacts c on c.workspace_id=t.workspace_id and c.id=t.contact_id where m.workspace_id=p_workspace and c.email=r.email and m.direction<>'note'),'[]'));
end $$;

create function public.crm_marketing_prepare(p_workspace text,p_actor uuid,p_request_id uuid,p_email text,p_sender text,p_subject text,p_digest text)
returns jsonb language plpgsql set search_path='' as $$
declare e text:=lower(trim(p_email)); o privacy_private.marketing_outbox; c public.crm_privacy_consents; s public.crm_privacy_settings;
begin
  if not privacy_private.allowed(p_workspace,p_actor) then raise insufficient_privilege; end if;
  if p_request_id is null or e !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' or char_length(p_subject) not between 1 and 300 or p_digest !~ '^[a-f0-9]{64}$' then raise invalid_parameter_value; end if;
  perform pg_advisory_xact_lock(hashtextextended('marketing-limit:'||p_workspace,0));
  perform pg_advisory_xact_lock(hashtextextended(p_workspace||':'||e,0));
  select * into o from privacy_private.marketing_outbox where workspace_id=p_workspace and request_id=p_request_id;
  if found then
    if o.email<>e or o.sender<>p_sender or o.subject<>p_subject or o.body_digest<>p_digest then raise invalid_parameter_value; end if;
    return jsonb_build_object('duplicate',true,'id',o.id,'status',o.status);
  end if;
  select * into strict s from public.crm_privacy_settings where workspace_id=p_workspace;
  if not exists(select 1 from public.crm_support_mailboxes where workspace_id=p_workspace and address=p_sender and active and verified_at is not null) then raise insufficient_privilege; end if;
  if exists(select 1 from public.crm_privacy_suppressions where workspace_id=p_workspace and email=e) then raise insufficient_privilege; end if;
  -- An unresolved provider outcome is not permission to try a new key and send
  -- another copy. Review the provider ledger before releasing this recipient.
  if exists(select 1 from privacy_private.marketing_outbox where workspace_id=p_workspace and email=e and status in ('sending','uncertain')) then raise insufficient_privilege; end if;
  select * into c from public.crm_privacy_consents where workspace_id=p_workspace and email=e order by occurred_at desc,recorded_at desc,id desc limit 1;
  if c.id is null or c.status<>'granted' then raise insufficient_privilege; end if;
  if (select count(*) from privacy_private.marketing_outbox where workspace_id=p_workspace and created_at>now()-interval '1 hour')>=100 then raise exception 'Hourly marketing limit reached' using errcode='22023'; end if;
  insert into privacy_private.marketing_outbox(workspace_id,request_id,actor_id,email,sender,subject,body_digest,consent_id)
    values(p_workspace,p_request_id,p_actor,e,p_sender,p_subject,p_digest,c.id) returning * into o;
  insert into public.crm_privacy_events(workspace_id,actor_id,kind,subject_email,detail) values(p_workspace,p_actor,'marketing_reserved',e,jsonb_build_object('send_id',o.id,'consent_id',c.id));
  return jsonb_build_object('duplicate',false,'id',o.id,'token',o.unsubscribe_token,'settings',to_jsonb(s));
end $$;

create function public.crm_marketing_finish(p_id uuid,p_status text,p_provider_id text default null)
returns void language plpgsql set search_path='' as $$
declare o privacy_private.marketing_outbox;
begin
  if p_status not in ('sent','failed','uncertain') then raise invalid_parameter_value; end if;
  select * into strict o from privacy_private.marketing_outbox where id=p_id for update;
  if o.status<>'sending' then return; end if;
  if p_provider_id is not null then perform pg_advisory_xact_lock(hashtextextended('delivery:'||p_provider_id,0)); end if;
  update privacy_private.marketing_outbox set status=p_status,provider_id=p_provider_id,updated_at=now() where id=o.id;
  -- A signed callback can beat the provider HTTP response/database update.
  -- Reconcile such early events here so a complaint can never be silently lost.
  if p_provider_id is not null and exists(select 1 from privacy_private.delivery_events where provider_id=p_provider_id) then
    perform pg_advisory_xact_lock(hashtextextended(o.workspace_id||':'||o.email,0));
    insert into public.crm_privacy_suppressions(workspace_id,email,reason)
      select o.workspace_id,o.email,case when exists(select 1 from privacy_private.delivery_events where provider_id=p_provider_id and kind='email.complained') then 'complaint' else 'bounce' end on conflict do nothing;
    insert into public.crm_privacy_events(workspace_id,kind,subject_email,detail) values(o.workspace_id,'marketing_delivery_reconciled',o.email,jsonb_build_object('send_id',o.id));
  end if;
  insert into public.crm_privacy_events(workspace_id,actor_id,kind,subject_email,detail) values(o.workspace_id,o.actor_id,'marketing_'||p_status,o.email,jsonb_build_object('send_id',o.id));
end $$;

create function public.crm_marketing_unsubscribe(p_token uuid)
returns void language plpgsql set search_path='' as $$
declare o privacy_private.marketing_outbox;
begin
  select * into o from privacy_private.marketing_outbox where unsubscribe_token=p_token;
  if not found then return; end if;
  perform pg_advisory_xact_lock(hashtextextended(o.workspace_id||':'||o.email,0));
  insert into public.crm_privacy_suppressions(workspace_id,email,reason) values(o.workspace_id,o.email,'unsubscribe') on conflict do nothing;
  if found then
    insert into public.crm_privacy_events(workspace_id,kind,subject_email,detail) values(o.workspace_id,'marketing_unsubscribe',o.email,jsonb_build_object('send_id',o.id));
  end if;
end $$;

create function public.crm_marketing_delivery(p_event_id text,p_kind text,p_provider_id text)
returns void language plpgsql set search_path='' as $$
declare o privacy_private.marketing_outbox;
begin
  if p_kind not in ('email.bounced','email.complained') or char_length(p_event_id) not between 1 and 300 then raise invalid_parameter_value; end if;
  if char_length(coalesce(p_provider_id,'')) not between 1 and 300 then raise invalid_parameter_value; end if;
  perform pg_advisory_xact_lock(hashtextextended('delivery:'||p_provider_id,0));
  insert into privacy_private.delivery_events(id,kind,provider_id) values(p_event_id,p_kind,p_provider_id) on conflict do nothing;
  if not found then return; end if;
  select * into o from privacy_private.marketing_outbox where provider_id=p_provider_id;
  if not found then return; end if;
  perform pg_advisory_xact_lock(hashtextextended(o.workspace_id||':'||o.email,0));
  insert into public.crm_privacy_suppressions(workspace_id,email,reason) values(o.workspace_id,o.email,case when p_kind='email.bounced' then 'bounce' else 'complaint' end) on conflict do nothing;
  insert into public.crm_privacy_events(workspace_id,kind,subject_email,detail) values(o.workspace_id,'marketing_'||p_kind,o.email,jsonb_build_object('send_id',o.id,'provider_event_id',p_event_id));
end $$;

do $$ declare f record; begin
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and (p.proname like 'crm_privacy_%' or p.proname like 'crm_marketing_%') and p.proname<>'crm_privacy_access' loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
revoke all on all functions in schema privacy_private from public,anon,authenticated;
grant execute on all functions in schema privacy_private to service_role;
commit;

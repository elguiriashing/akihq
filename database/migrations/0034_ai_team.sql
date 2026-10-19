begin;

create type ai_agent_status as enum ('idle','working','waiting','failed');
create type ai_task_status as enum ('queued','in_progress','waiting','completed','failed','cancelled');
create type ai_approval_status as enum ('pending','approved','rejected','executed','failed','expired');
create type ai_usage_status as enum ('reserved','completed','failed','released');

create table ai_agents (
  id uuid primary key default gen_random_uuid(),
  agent_key text unique not null check (agent_key ~ '^[a-z][a-z0-9_]{1,31}$'),
  display_name text not null check (char_length(trim(display_name)) between 2 and 80),
  role_description text not null check (char_length(trim(role_description)) between 10 and 500),
  system_instructions text not null check (char_length(trim(system_instructions)) between 40 and 12000),
  permissions jsonb not null default '[]'::jsonb check (jsonb_typeof(permissions) = 'array'),
  provider text not null default 'openai' check (provider ~ '^[a-z][a-z0-9_-]{1,31}$'),
  model text not null default 'gpt-5.6-luna' check (char_length(trim(model)) between 2 and 120),
  status ai_agent_status not null default 'idle',
  enabled boolean not null default true,
  last_active_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table ai_agent_memory (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references ai_agents(id) on delete cascade,
  memory_key text not null check (char_length(trim(memory_key)) between 1 and 120),
  content text not null check (char_length(trim(content)) between 1 and 8000),
  importance smallint not null default 3 check (importance between 1 and 5),
  source text not null default 'agent' check (source in ('agent','operator','handoff','task')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(agent_id, memory_key)
);

create table ai_chat_messages (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references ai_agents(id) on delete cascade,
  actor_id uuid references profiles(id) on delete set null,
  role text not null check (role in ('user','assistant','tool','system')),
  content text not null check (char_length(content) between 1 and 24000),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create table ai_schedules (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references ai_agents(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  prompt text not null check (char_length(trim(prompt)) between 5 and 8000),
  interval_minutes integer not null check (interval_minutes between 5 and 43200),
  enabled boolean not null default true,
  next_run_at timestamptz not null,
  last_run_at timestamptz,
  last_error text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table ai_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 2 and 200),
  description text not null check (char_length(trim(description)) between 2 and 8000),
  status ai_task_status not null default 'queued',
  priority smallint not null default 3 check (priority between 1 and 5),
  created_by_agent_id uuid references ai_agents(id) on delete set null,
  assigned_agent_id uuid references ai_agents(id) on delete set null,
  created_by_profile_id uuid references profiles(id) on delete set null,
  schedule_id uuid references ai_schedules(id) on delete set null,
  parent_task_id uuid references ai_tasks(id) on delete set null,
  due_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  result text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table ai_handoffs (
  id uuid primary key default gen_random_uuid(),
  from_agent_id uuid not null references ai_agents(id) on delete cascade,
  to_agent_id uuid not null references ai_agents(id) on delete cascade,
  task_id uuid references ai_tasks(id) on delete set null,
  context text not null check (char_length(trim(context)) between 2 and 12000),
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  check (from_agent_id <> to_agent_id)
);

create table ai_approvals (
  id uuid primary key default gen_random_uuid(),
  requested_by_agent_id uuid not null references ai_agents(id) on delete cascade,
  task_id uuid references ai_tasks(id) on delete set null,
  tool_name text not null check (tool_name ~ '^[a-z][a-z0-9_]{1,63}$'),
  arguments jsonb not null check (jsonb_typeof(arguments) = 'object'),
  reason text not null check (char_length(trim(reason)) between 2 and 2000),
  status ai_approval_status not null default 'pending',
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references profiles(id) on delete set null,
  decision_note text,
  executed_at timestamptz,
  execution_result jsonb,
  error text
);

create table ai_activity_log (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references ai_agents(id) on delete set null,
  task_id uuid references ai_tasks(id) on delete set null,
  approval_id uuid references ai_approvals(id) on delete set null,
  event_type text not null check (event_type ~ '^[a-z][a-z0-9_.-]{1,79}$'),
  level text not null default 'info' check (level in ('info','warning','error')),
  message text not null check (char_length(trim(message)) between 2 and 2000),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);

create table ai_budget_settings (
  singleton boolean primary key default true check (singleton),
  monthly_limit_eur numeric(10,6) not null default 4.00 check (monthly_limit_eur between 0 and 100000),
  hard_cap_enabled boolean not null default true,
  requests_per_minute integer not null default 6 check (requests_per_minute between 1 and 300),
  requests_per_hour integer not null default 60 check (requests_per_hour between 1 and 10000),
  max_concurrent_requests integer not null default 2 check (max_concurrent_requests between 1 and 20),
  updated_by uuid references profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table ai_model_pricing (
  provider text not null,
  model text not null,
  input_cost_per_million_eur numeric(12,6) not null check (input_cost_per_million_eur >= 0),
  output_cost_per_million_eur numeric(12,6) not null check (output_cost_per_million_eur >= 0),
  source_note text not null,
  updated_at timestamptz not null default now(),
  primary key(provider, model)
);

create table ai_usage_ledger (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id) on delete set null,
  agent_id uuid references ai_agents(id) on delete set null,
  provider text not null,
  model text not null,
  request_kind text not null check (request_kind in ('chat','scheduled','task')),
  status ai_usage_status not null default 'reserved',
  billing_month date not null,
  estimated_input_tokens integer not null check (estimated_input_tokens >= 0),
  reserved_output_tokens integer not null check (reserved_output_tokens >= 0),
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  reserved_cost_eur numeric(12,6) not null check (reserved_cost_eur >= 0),
  actual_cost_eur numeric(12,6) check (actual_cost_eur is null or actual_cost_eur >= 0),
  provider_request_id text,
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index ai_chat_messages_agent_created_idx on ai_chat_messages(agent_id, created_at desc);
create index ai_memory_agent_importance_idx on ai_agent_memory(agent_id, importance desc, updated_at desc);
create index ai_tasks_status_assignee_idx on ai_tasks(status, assigned_agent_id, created_at desc);
create index ai_schedules_due_idx on ai_schedules(next_run_at) where enabled;
create index ai_approvals_pending_idx on ai_approvals(requested_at desc) where status = 'pending';
create index ai_activity_created_idx on ai_activity_log(created_at desc);
create index ai_usage_month_created_idx on ai_usage_ledger(billing_month, created_at desc);
create index ai_usage_actor_created_idx on ai_usage_ledger(actor_id, created_at desc);

insert into ai_budget_settings(singleton) values(true);

-- EUR estimates intentionally use a conservative 1:1 USD/EUR accounting rate.
-- Administrators can update the catalogue when provider pricing or exchange assumptions change.
insert into ai_model_pricing(provider,model,input_cost_per_million_eur,output_cost_per_million_eur,source_note)
values ('openai','gpt-5.6-luna',1.00,6.00,'OpenAI list price checked 2026-08-11; conservative USD-to-EUR estimate of 1:1');

insert into ai_agents(
  id, agent_key, display_name, role_description, system_instructions, permissions
) values
(
  'a1000000-0000-4000-8000-000000000001','manager','Manager',
  'Coordinates the AI team, delegates work, tracks delivery, and reports decisions and blockers to the operator.',
  'You are the AkiPasa AI Team Manager. Turn operator goals into bounded tasks, assign work to the best specialist, track dependencies, and synthesize evidence-based updates. Read only the CRM data exposed by approved tools. Never invent business facts or claim an action completed without a successful tool result. Ask for operator approval before any sensitive or externally visible action. Keep reports concise, identify blockers, and preserve useful durable context through the memory tool. Specialists must report significant results back to you through handoffs.',
  '["crm:summary:read","crm:support:read","crm:catalogue:read","ai:tasks:create","ai:tasks:delegate","ai:memory:write","ai:handoffs:create","crm:catalogue:request_update"]'::jsonb
),
(
  'a1000000-0000-4000-8000-000000000002','marketing','Marketing',
  'Plans campaigns, positioning, editorial calendars, and growth experiments grounded in approved catalogue data.',
  'You are the AkiPasa Marketing specialist. Develop specific campaigns and content plans from verified CRM and catalogue facts. Label drafts clearly, never fabricate testimonials, popularity, partnerships, or sponsorships, and never publish or contact anyone without operator approval. Create measurable follow-up tasks, share material findings with the Manager, and store only durable, relevant marketing context.',
  '["crm:summary:read","crm:catalogue:read","ai:tasks:create","ai:memory:write","ai:handoffs:create"]'::jsonb
),
(
  'a1000000-0000-4000-8000-000000000003','sales','Sales',
  'Qualifies commercial opportunities, prepares outreach, and keeps follow-up work organized without sending messages autonomously.',
  'You are the AkiPasa Sales specialist. Use approved business and promotion pipeline data to qualify opportunities and draft practical next steps. Do not expose personal data unnecessarily, promise terms, alter commercial records, or send outreach without operator approval. Keep recommendations factual, create follow-up tasks, and report material pipeline findings to the Manager.',
  '["crm:summary:read","crm:catalogue:read","ai:tasks:create","ai:memory:write","ai:handoffs:create"]'::jsonb
),
(
  'a1000000-0000-4000-8000-000000000004','research','Research',
  'Investigates markets, catalogue gaps, and business questions while separating sourced facts from inference.',
  'You are the AkiPasa Research specialist. Investigate the requested question using only data returned by approved tools and context supplied by the operator. Distinguish evidence, inference, and unknowns. Never invent sources or access private customer data outside your permission set. Convert findings into concise recommendations, store durable research context, and hand significant results to the Manager.',
  '["crm:summary:read","crm:catalogue:read","ai:tasks:create","ai:memory:write","ai:handoffs:create"]'::jsonb
),
(
  'a1000000-0000-4000-8000-000000000005','support','Support',
  'Triages customer reports, prepares response guidance, and escalates sensitive or unresolved cases.',
  'You are the AkiPasa Support specialist. Triage only the support records exposed by approved tools, protect personal data, and provide calm, actionable response drafts. Never claim a case is resolved or contact a customer without a successful approved action. Create follow-up tasks for unresolved cases, flag risk and urgency, and report recurring or high-impact issues to the Manager.',
  '["crm:support:read","crm:catalogue:read","ai:tasks:create","ai:memory:write","ai:handoffs:create"]'::jsonb
),
(
  'a1000000-0000-4000-8000-000000000006','analyst','Analyst',
  'Analyzes business and product signals, explains assumptions, and produces decision-ready summaries.',
  'You are the AkiPasa Analyst. Analyze approved aggregate CRM and operational data, state assumptions, and avoid false precision. Never infer sensitive personal attributes or present incomplete data as comprehensive. Highlight data-quality limits, create tasks for required follow-up, preserve durable analytical context, and report decision-relevant findings to the Manager.',
  '["crm:summary:read","crm:support:read","crm:catalogue:read","ai:tasks:create","ai:memory:write","ai:handoffs:create"]'::jsonb
);

create or replace function reserve_ai_budget(
  p_actor_id uuid,
  p_agent_id uuid,
  p_provider text,
  p_model text,
  p_request_kind text,
  p_estimated_input_tokens integer,
  p_reserved_output_tokens integer,
  p_max_provider_rounds integer default 3
) returns table(
  reservation_id uuid,
  reserved_cost_eur numeric,
  remaining_eur numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings ai_budget_settings%rowtype;
  v_pricing ai_model_pricing%rowtype;
  v_month date := date_trunc('month', now() at time zone 'UTC')::date;
  v_spent numeric(12,6);
  v_reserve numeric(12,6);
  v_id uuid := gen_random_uuid();
  v_minute_count integer;
  v_hour_count integer;
  v_concurrent integer;
begin
  if p_actor_id is not null and not exists(
    select 1 from profiles where id = p_actor_id and app_role = 'administrator'
  ) then
    raise exception 'administrator role required';
  end if;
  if p_agent_id is null or not exists(select 1 from ai_agents where id=p_agent_id and enabled) then
    raise exception 'AI agent is unavailable';
  end if;
  if p_request_kind not in ('chat','scheduled','task')
    or p_estimated_input_tokens < 0
    or p_reserved_output_tokens < 1
    or p_max_provider_rounds not between 1 and 6 then
    raise exception 'invalid AI budget reservation';
  end if;

  select * into v_settings from ai_budget_settings where singleton for update;
  select * into v_pricing from ai_model_pricing where provider=p_provider and model=p_model;
  if not found then raise exception 'AI model pricing is not configured'; end if;

  update ai_usage_ledger
  set status='released', completed_at=now(), error_code='reservation_expired'
  where status='reserved' and created_at < now() - interval '15 minutes';

  select count(*) into v_minute_count from ai_usage_ledger
  where created_at >= now() - interval '1 minute'
    and (p_actor_id is null or actor_id=p_actor_id)
    and status <> 'released';
  select count(*) into v_hour_count from ai_usage_ledger
  where created_at >= now() - interval '1 hour'
    and (p_actor_id is null or actor_id=p_actor_id)
    and status <> 'released';
  select count(*) into v_concurrent from ai_usage_ledger where status='reserved';

  if v_minute_count >= v_settings.requests_per_minute then raise exception 'AI minute rate limit reached'; end if;
  if v_hour_count >= v_settings.requests_per_hour then raise exception 'AI hourly rate limit reached'; end if;
  if v_concurrent >= v_settings.max_concurrent_requests then raise exception 'AI concurrency limit reached'; end if;

  v_reserve := round((
    (p_estimated_input_tokens::numeric * p_max_provider_rounds * v_pricing.input_cost_per_million_eur)
    + (p_reserved_output_tokens::numeric * p_max_provider_rounds * v_pricing.output_cost_per_million_eur)
  ) / 1000000, 6);
  v_reserve := greatest(v_reserve, 0.000001);

  select coalesce(sum(coalesce(ledger.actual_cost_eur,ledger.reserved_cost_eur)),0)
  into v_spent from ai_usage_ledger as ledger
  where ledger.billing_month=v_month
    and ledger.status in ('reserved','completed','failed');

  if v_settings.hard_cap_enabled and v_spent + v_reserve > v_settings.monthly_limit_eur then
    raise exception 'AI monthly budget exhausted';
  end if;

  insert into ai_usage_ledger(
    id,actor_id,agent_id,provider,model,request_kind,billing_month,
    estimated_input_tokens,reserved_output_tokens,reserved_cost_eur
  ) values(
    v_id,p_actor_id,p_agent_id,p_provider,p_model,p_request_kind,v_month,
    p_estimated_input_tokens,p_reserved_output_tokens,v_reserve
  );

  return query select v_id, v_reserve,
    greatest(v_settings.monthly_limit_eur - v_spent - v_reserve,0);
end;
$$;

create or replace function complete_ai_budget(
  p_reservation_id uuid,
  p_input_tokens integer,
  p_output_tokens integer,
  p_provider_request_id text default null
) returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usage ai_usage_ledger%rowtype;
  v_pricing ai_model_pricing%rowtype;
  v_actual numeric(12,6);
begin
  select * into v_usage from ai_usage_ledger where id=p_reservation_id for update;
  if not found or v_usage.status <> 'reserved' then raise exception 'AI reservation is not active'; end if;
  if p_input_tokens < 0 or p_output_tokens < 0 then raise exception 'invalid AI usage'; end if;
  select * into v_pricing from ai_model_pricing where provider=v_usage.provider and model=v_usage.model;
  if not found then raise exception 'AI model pricing is not configured'; end if;
  v_actual := round((
    p_input_tokens::numeric * v_pricing.input_cost_per_million_eur
    + p_output_tokens::numeric * v_pricing.output_cost_per_million_eur
  ) / 1000000, 6);
  update ai_usage_ledger set
    status='completed', input_tokens=p_input_tokens, output_tokens=p_output_tokens,
    actual_cost_eur=v_actual, provider_request_id=nullif(trim(p_provider_request_id),''),
    completed_at=now()
  where id=p_reservation_id;
  return v_actual;
end;
$$;

create or replace function fail_ai_budget(
  p_reservation_id uuid,
  p_error_code text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update ai_usage_ledger set
    status='failed', actual_cost_eur=reserved_cost_eur,
    error_code=left(coalesce(nullif(trim(p_error_code),''),'provider_error'),120),
    completed_at=now()
  where id=p_reservation_id and status='reserved';
end;
$$;

create or replace function claim_due_ai_schedules(p_limit integer default 3)
returns table(schedule_id uuid, task_id uuid, agent_id uuid, prompt text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_schedule ai_schedules%rowtype;
  v_task_id uuid;
begin
  for v_schedule in
    select * from ai_schedules
    where enabled and next_run_at <= now()
    order by next_run_at
    for update skip locked
    limit least(greatest(coalesce(p_limit,3),1),10)
  loop
    v_task_id := gen_random_uuid();
    update ai_schedules set
      last_run_at=now(), last_error=null,
      next_run_at=now() + make_interval(mins => interval_minutes), updated_at=now()
    where id=v_schedule.id;
    insert into ai_tasks(id,title,description,status,priority,assigned_agent_id,schedule_id,started_at)
    values(v_task_id,v_schedule.name,v_schedule.prompt,'in_progress',3,v_schedule.agent_id,v_schedule.id,now());
    return query select v_schedule.id,v_task_id,v_schedule.agent_id,v_schedule.prompt;
  end loop;
end;
$$;

alter table ai_agents enable row level security;
alter table ai_agent_memory enable row level security;
alter table ai_chat_messages enable row level security;
alter table ai_schedules enable row level security;
alter table ai_tasks enable row level security;
alter table ai_handoffs enable row level security;
alter table ai_approvals enable row level security;
alter table ai_activity_log enable row level security;
alter table ai_budget_settings enable row level security;
alter table ai_model_pricing enable row level security;
alter table ai_usage_ledger enable row level security;

create policy ai_agents_admin_read on ai_agents for select to authenticated
using (has_platform_role(array['administrator']::app_role[]));
create policy ai_memory_admin_read on ai_agent_memory for select to authenticated
using (has_platform_role(array['administrator']::app_role[]));
create policy ai_chat_admin_read on ai_chat_messages for select to authenticated
using (has_platform_role(array['administrator']::app_role[]));
create policy ai_schedules_admin_read on ai_schedules for select to authenticated
using (has_platform_role(array['administrator']::app_role[]));
create policy ai_tasks_admin_read on ai_tasks for select to authenticated
using (has_platform_role(array['administrator']::app_role[]));
create policy ai_handoffs_admin_read on ai_handoffs for select to authenticated
using (has_platform_role(array['administrator']::app_role[]));
create policy ai_approvals_admin_read on ai_approvals for select to authenticated
using (has_platform_role(array['administrator']::app_role[]));
create policy ai_activity_admin_read on ai_activity_log for select to authenticated
using (has_platform_role(array['administrator']::app_role[]));
create policy ai_budget_admin_read on ai_budget_settings for select to authenticated
using (has_platform_role(array['administrator']::app_role[]));
create policy ai_pricing_admin_read on ai_model_pricing for select to authenticated
using (has_platform_role(array['administrator']::app_role[]));
create policy ai_usage_admin_read on ai_usage_ledger for select to authenticated
using (has_platform_role(array['administrator']::app_role[]));

grant select on ai_agents,ai_agent_memory,ai_chat_messages,ai_schedules,ai_tasks,
  ai_handoffs,ai_approvals,ai_activity_log,ai_budget_settings,ai_model_pricing,
  ai_usage_ledger to authenticated;
grant all on ai_agents,ai_agent_memory,ai_chat_messages,ai_schedules,ai_tasks,
  ai_handoffs,ai_approvals,ai_activity_log,ai_budget_settings,ai_model_pricing,
  ai_usage_ledger to service_role;

revoke all on function reserve_ai_budget(uuid,uuid,text,text,text,integer,integer,integer) from public;
revoke all on function complete_ai_budget(uuid,integer,integer,text) from public;
revoke all on function fail_ai_budget(uuid,text) from public;
revoke all on function claim_due_ai_schedules(integer) from public;
grant execute on function reserve_ai_budget(uuid,uuid,text,text,text,integer,integer,integer) to service_role;
grant execute on function complete_ai_budget(uuid,integer,integer,text) to service_role;
grant execute on function fail_ai_budget(uuid,text) to service_role;
grant execute on function claim_due_ai_schedules(integer) to service_role;

commit;

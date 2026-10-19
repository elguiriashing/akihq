-- Migration 0055: governed external web research for internal AI agents
begin;

alter table public.ai_tasks
  add column if not exists allow_web_search boolean not null default false;

alter table public.ai_schedules
  add column if not exists allow_web_search boolean not null default false;

update public.ai_agents
set permissions = case
      when permissions @> '["web:search"]'::jsonb then permissions
      else permissions || '["web:search"]'::jsonb
    end,
    updated_at = now()
where agent_key in (
  'manager',
  'marketing',
  'sales',
  'research',
  'analyst',
  'coder'
);

drop function if exists public.claim_due_ai_schedules(integer);

create function public.claim_due_ai_schedules(p_limit integer default 3)
returns table(
  schedule_id uuid,
  task_id uuid,
  agent_id uuid,
  prompt text,
  allow_web_search boolean
)
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
    insert into ai_tasks(
      id,title,description,status,priority,assigned_agent_id,schedule_id,
      started_at,allow_web_search
    )
    values(
      v_task_id,v_schedule.name,v_schedule.prompt,'in_progress',3,
      v_schedule.agent_id,v_schedule.id,now(),v_schedule.allow_web_search
    );
    return query select
      v_schedule.id,v_task_id,v_schedule.agent_id,v_schedule.prompt,
      v_schedule.allow_web_search;
  end loop;
end;
$$;

revoke all on function public.claim_due_ai_schedules(integer)
from public, anon, authenticated;
grant execute on function public.claim_due_ai_schedules(integer)
to service_role;

commit;

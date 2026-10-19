begin;

-- Claim both recurring schedules and ordinary tasks. One SKIP LOCKED boundary
-- lets multiple scheduler invocations overlap without executing work twice.
create or replace function claim_due_ai_schedules(p_limit integer default 3)
returns table(schedule_id uuid, task_id uuid, agent_id uuid, prompt text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_schedule ai_schedules%rowtype;
  v_task ai_tasks%rowtype;
  v_task_id uuid;
  v_claimed integer := 0;
  v_limit integer := least(greatest(coalesce(p_limit,3),1),10);
begin
  for v_schedule in
    select * from ai_schedules
    where enabled and next_run_at <= now()
    order by next_run_at
    for update skip locked
    limit v_limit
  loop
    v_task_id := gen_random_uuid();
    update ai_schedules set
      last_run_at=now(), last_error=null,
      next_run_at=now() + make_interval(mins => interval_minutes), updated_at=now()
    where id=v_schedule.id;
    insert into ai_tasks(id,title,description,status,priority,assigned_agent_id,schedule_id,started_at)
    values(v_task_id,v_schedule.name,v_schedule.prompt,'in_progress',3,v_schedule.agent_id,v_schedule.id,now());
    v_claimed := v_claimed + 1;
    return query select v_schedule.id,v_task_id,v_schedule.agent_id,v_schedule.prompt;
  end loop;

  if v_claimed < v_limit then
    for v_task in
      select * from ai_tasks
      where status='queued'
        and assigned_agent_id is not null
        and (due_at is null or due_at <= now())
      order by priority desc, created_at
      for update skip locked
      limit (v_limit - v_claimed)
    loop
      update ai_tasks set status='in_progress',started_at=now(),updated_at=now()
      where id=v_task.id and status='queued';
      return query select null::uuid,v_task.id,v_task.assigned_agent_id,v_task.description;
    end loop;
  end if;
end;
$$;

create or replace function sync_ai_agent_approval_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status='pending' and new.status<>'pending' then
    update ai_agents
    set status='idle',updated_at=now()
    where id=new.requested_by_agent_id
      and status='waiting'
      and not exists(
        select 1 from ai_approvals
        where requested_by_agent_id=new.requested_by_agent_id
          and status='pending'
          and id<>new.id
      );
  end if;
  return new;
end;
$$;

create trigger ai_approvals_sync_agent_status
after update of status on ai_approvals
for each row execute function sync_ai_agent_approval_status();

revoke all on function sync_ai_agent_approval_status() from public;

commit;

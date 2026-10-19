begin;

create or replace function report_ai_task_result_to_manager()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manager uuid;
  v_context text;
begin
  if new.status not in ('completed','failed')
    or new.status = old.status
    or new.assigned_agent_id is null then
    return new;
  end if;

  select id into v_manager from ai_agents
  where agent_key='manager' and enabled
  limit 1;
  if v_manager is null or v_manager=new.assigned_agent_id then return new; end if;

  v_context := case
    when new.status='completed'
      then 'Completed task "' || new.title || '": ' || coalesce(new.result,'No result was recorded.')
    else 'Failed task "' || new.title || '": ' || coalesce(new.error,'No error detail was recorded.')
  end;

  insert into ai_handoffs(from_agent_id,to_agent_id,task_id,context)
  values(new.assigned_agent_id,v_manager,new.id,left(v_context,12000));
  return new;
end;
$$;

create trigger ai_tasks_report_result_to_manager
after update of status on ai_tasks
for each row execute function report_ai_task_result_to_manager();

revoke all on function report_ai_task_result_to_manager() from public;

commit;

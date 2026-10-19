begin;

-- Supabase grants new public-schema functions directly to its API roles by
-- default. These security-definer functions are internal backend primitives
-- and must only be callable through the server-side service role.
revoke all on function reserve_ai_budget(uuid,uuid,text,text,text,integer,integer,integer)
  from public, anon, authenticated;
revoke all on function complete_ai_budget(uuid,integer,integer,text)
  from public, anon, authenticated;
revoke all on function fail_ai_budget(uuid,text)
  from public, anon, authenticated;
revoke all on function claim_due_ai_schedules(integer)
  from public, anon, authenticated;
revoke all on function sync_ai_agent_approval_status()
  from public, anon, authenticated;
revoke all on function report_ai_task_result_to_manager()
  from public, anon, authenticated;

grant execute on function reserve_ai_budget(uuid,uuid,text,text,text,integer,integer,integer)
  to service_role;
grant execute on function complete_ai_budget(uuid,integer,integer,text)
  to service_role;
grant execute on function fail_ai_budget(uuid,text)
  to service_role;
grant execute on function claim_due_ai_schedules(integer)
  to service_role;

commit;

-- Migration 0057: full synchronized AkiHQ access for Manager and governed agent changes
begin;

update public.ai_agents
set permissions = permissions || coalesce((
      select jsonb_agg(permission)
      from jsonb_array_elements_text('["crm:workspace:manage","ai:tools:request","ai:agents:request_change"]'::jsonb) permission
      where not permissions @> jsonb_build_array(permission)
    ), '[]'::jsonb),
    updated_at = now()
where agent_key = 'manager';

commit;

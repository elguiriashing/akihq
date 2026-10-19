-- Migration 0056: governed AkiHQ workspace management and tool-gap requests
begin;

update public.ai_agents
set permissions = permissions || coalesce((
      select jsonb_agg(permission)
      from jsonb_array_elements_text('["crm:workspace:manage","ai:tools:request"]'::jsonb) permission
      where not permissions @> jsonb_build_array(permission)
    ), '[]'::jsonb),
    updated_at = now()
where agent_key = 'manager';

commit;

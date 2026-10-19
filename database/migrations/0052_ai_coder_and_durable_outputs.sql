-- Migration 0052: administrator-only Coder agent and durable AkiHQ outputs
begin;

update public.ai_agents
set permissions = permissions || '["crm:knowledge:create","crm:calendar:create"]'::jsonb,
    updated_at = now()
where agent_key in ('manager','marketing','sales','research','support','analyst');

insert into public.ai_agents(
  id,
  agent_key,
  display_name,
  role_description,
  system_instructions,
  permissions,
  provider,
  model,
  status,
  enabled
) values (
  'a2000000-0000-4000-8000-000000000007',
  'coder',
  'Coder',
  'Administrator-only technical specialist for focused AkiPasa and AkiHQ diagnosis, implementation plans, debugging, and reusable engineering notes.',
  'You are the AkiPasa Coder, an administrator-only engineering specialist. Diagnose website and CRM defects from supplied evidence and approved tools, propose the smallest safe fix, identify affected components and verification steps, and never claim code was changed or deployed unless a successful tool result proves it. You do not have hidden filesystem, repository, terminal, deployment, credential, or production access. Turn concrete implementation work into CRM tasks, save reusable technical findings to Knowledge, schedule requested follow-ups in Calendar, and hand significant blockers or decisions to the Manager. Never provide secrets, weaken authorization, or bypass approval controls.',
  '["crm:workspace:read","crm:records:read","crm:tasks:create","crm:knowledge:create","crm:calendar:create","crm:summary:read","crm:support:read","crm:catalogue:read","ai:tasks:create","ai:memory:write","ai:handoffs:create"]'::jsonb,
  'openai',
  'gpt-5.6-luna',
  'idle',
  true
)
on conflict (agent_key) do update
set display_name = excluded.display_name,
    role_description = excluded.role_description,
    system_instructions = excluded.system_instructions,
    permissions = excluded.permissions,
    provider = excluded.provider,
    model = excluded.model,
    enabled = true,
    updated_at = now();

commit;

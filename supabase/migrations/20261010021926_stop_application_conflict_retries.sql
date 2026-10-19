begin;

-- Production migration version: 20261010021926.

-- Stale application revisions are permanent conflicts, not serialization failures.
-- PostgREST 14 retries 40001 indefinitely; PT409 returns once with HTTP 409.
do $migration$
declare
  target regprocedure;
  signature text;
  definition text;
  updated_definition text;
begin
  foreach signature in array array[
    'public.save_venue_catalogue(uuid,integer,jsonb,boolean)',
    'public.unpublish_venue_catalogue(uuid,integer)',
    'public.admin_resolve_venue_relevance(uuid,uuid,text,numeric,text,text)',
    'public.crm_company_save(text,integer,jsonb,boolean)',
    'akihq_security.write_workspace_snapshot(text,jsonb,timestamp with time zone)'
  ] loop
    target := to_regprocedure(signature);
    -- CRM functions can be absent from a public-app-only development database.
    if target is null then
      continue;
    end if;
    definition := pg_get_functiondef(target);
    updated_definition := regexp_replace(
      definition,
      'errcode[[:space:]]*=[[:space:]]*''40001''',
      'errcode=''PT409''',
      'gi'
    );
    if updated_definition <> definition then
      execute updated_definition;
    end if;
  end loop;
end
$migration$;

notify pgrst, 'reload schema';
commit;

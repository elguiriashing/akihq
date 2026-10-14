begin;

-- PostgREST 14 can retry application-raised 40001 errors indefinitely.
-- Existing installations may still have the old function bodies even though
-- fresh installs now declare PT409 in their source migrations.
do $migration$
declare
  target regprocedure;
  signature text;
  definition text;
  updated_definition text;
begin
  foreach signature in array array[
    'public.crm_company_save(text,integer,jsonb,boolean)',
    'akihq_security.write_workspace_snapshot(text,jsonb,timestamp with time zone)'
  ] loop
    target := to_regprocedure(signature);
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

begin;

do $$
declare
  definition text;
  updated_definition text;
begin
  select pg_get_functiondef(
    'reserve_ai_budget(uuid,uuid,text,text,text,integer,integer,integer)'::regprocedure
  ) into definition;
  updated_definition := regexp_replace(
    definition,
    'p_max_provider_rounds\s+not\s+between\s+1\s+and\s+6',
    'p_max_provider_rounds not between 1 and 16',
    'i'
  );
  if updated_definition = definition then
    raise exception 'reserve_ai_budget provider-round guard was not found';
  end if;
  execute updated_definition;
end;
$$;

commit;

begin;

update venues
set description_es = U&'Negocio sin reclamar. Informaci\00F3n pendiente de verificaci\00F3n.'
where accessibility @> '{"claim_status":"unclaimed"}'::jsonb
  and description_es = U&'Negocio sin reclamar. Informaci\00C3\00B3n pendiente de verificaci\00C3\00B3n.';

do $$
declare
  definition text;
begin
  select pg_get_functiondef(
    'publish_crm_lead_as_unclaimed_venue(text,text,text,text,text,text,text,double precision,double precision)'::regprocedure
  )
  into definition;

  definition := replace(
    definition,
    U&'Negocio sin reclamar. Informaci\00C3\00B3n pendiente de verificaci\00C3\00B3n.',
    U&'Negocio sin reclamar. Informaci\00F3n pendiente de verificaci\00F3n.'
  );
  execute definition;
end
$$;

commit;

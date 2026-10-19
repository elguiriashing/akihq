begin;

-- RETURNS TABLE exposes reserved_cost_eur as a PL/pgSQL output variable. Qualify
-- the ledger columns so PostgreSQL never confuses that variable with the table
-- column while calculating the monthly hard-cap reservation.
create or replace function reserve_ai_budget(
  p_actor_id uuid,
  p_agent_id uuid,
  p_provider text,
  p_model text,
  p_request_kind text,
  p_estimated_input_tokens integer,
  p_reserved_output_tokens integer,
  p_max_provider_rounds integer default 3
) returns table(
  reservation_id uuid,
  reserved_cost_eur numeric,
  remaining_eur numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings ai_budget_settings%rowtype;
  v_pricing ai_model_pricing%rowtype;
  v_month date := date_trunc('month', now() at time zone 'UTC')::date;
  v_spent numeric(12,6);
  v_reserve numeric(12,6);
  v_id uuid := gen_random_uuid();
  v_minute_count integer;
  v_hour_count integer;
  v_concurrent integer;
begin
  if p_actor_id is not null and not exists(
    select 1 from profiles where id = p_actor_id and app_role = 'administrator'
  ) then
    raise exception 'administrator role required';
  end if;
  if p_agent_id is null or not exists(select 1 from ai_agents where id=p_agent_id and enabled) then
    raise exception 'AI agent is unavailable';
  end if;
  if p_request_kind not in ('chat','scheduled','task')
    or p_estimated_input_tokens < 0
    or p_reserved_output_tokens < 1
    or p_max_provider_rounds not between 1 and 6 then
    raise exception 'invalid AI budget reservation';
  end if;

  select * into v_settings from ai_budget_settings where singleton for update;
  select * into v_pricing from ai_model_pricing where provider=p_provider and model=p_model;
  if not found then raise exception 'AI model pricing is not configured'; end if;

  update ai_usage_ledger
  set status='released', completed_at=now(), error_code='reservation_expired'
  where status='reserved' and created_at < now() - interval '15 minutes';

  select count(*) into v_minute_count from ai_usage_ledger
  where created_at >= now() - interval '1 minute'
    and (p_actor_id is null or actor_id=p_actor_id)
    and status <> 'released';
  select count(*) into v_hour_count from ai_usage_ledger
  where created_at >= now() - interval '1 hour'
    and (p_actor_id is null or actor_id=p_actor_id)
    and status <> 'released';
  select count(*) into v_concurrent from ai_usage_ledger where status='reserved';

  if v_minute_count >= v_settings.requests_per_minute then raise exception 'AI minute rate limit reached'; end if;
  if v_hour_count >= v_settings.requests_per_hour then raise exception 'AI hourly rate limit reached'; end if;
  if v_concurrent >= v_settings.max_concurrent_requests then raise exception 'AI concurrency limit reached'; end if;

  v_reserve := round((
    (p_estimated_input_tokens::numeric * p_max_provider_rounds * v_pricing.input_cost_per_million_eur)
    + (p_reserved_output_tokens::numeric * p_max_provider_rounds * v_pricing.output_cost_per_million_eur)
  ) / 1000000, 6);
  v_reserve := greatest(v_reserve, 0.000001);

  select coalesce(
    sum(coalesce(ledger.actual_cost_eur, ledger.reserved_cost_eur)),
    0
  )
  into v_spent
  from ai_usage_ledger as ledger
  where ledger.billing_month = v_month
    and ledger.status in ('reserved','completed','failed');

  if v_settings.hard_cap_enabled and v_spent + v_reserve > v_settings.monthly_limit_eur then
    raise exception 'AI monthly budget exhausted';
  end if;

  insert into ai_usage_ledger(
    id,actor_id,agent_id,provider,model,request_kind,billing_month,
    estimated_input_tokens,reserved_output_tokens,reserved_cost_eur
  ) values(
    v_id,p_actor_id,p_agent_id,p_provider,p_model,p_request_kind,v_month,
    p_estimated_input_tokens,p_reserved_output_tokens,v_reserve
  );

  return query select v_id, v_reserve,
    greatest(v_settings.monthly_limit_eur - v_spent - v_reserve,0);
end;
$$;

commit;

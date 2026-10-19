begin;

create or replace function fail_ai_budget(
  p_reservation_id uuid,
  p_error_code text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_error_code text :=
    left(coalesce(nullif(trim(p_error_code), ''), 'provider_error'), 120);
  v_rejected_without_usage boolean;
begin
  v_rejected_without_usage := v_error_code ~
    '^openai_(4[0-9]{2}|invalid_|credit_balance_exhausted|rate_limit|quota|insufficient_quota|billing_)';

  update ai_usage_ledger
  set
    status = 'failed',
    actual_cost_eur = case
      when v_rejected_without_usage then 0
      else reserved_cost_eur
    end,
    error_code = v_error_code,
    completed_at = now()
  where id = p_reservation_id
    and status = 'reserved';
end;
$$;

revoke all on function fail_ai_budget(uuid,text)
  from public, anon, authenticated;
grant execute on function fail_ai_budget(uuid,text)
  to service_role;

update ai_usage_ledger
set actual_cost_eur = 0
where status = 'failed'
  and coalesce(input_tokens, 0) = 0
  and coalesce(output_tokens, 0) = 0
  and error_code ~
    '^openai_(4[0-9]{2}|invalid_|credit_balance_exhausted|rate_limit|quota|insufficient_quota|billing_)';

commit;

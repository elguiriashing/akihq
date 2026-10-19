begin;

create or replace function claim_stripe_webhook_event(
  p_event_id text,
  p_event_type text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed boolean := false;
  current_state text;
begin
  if char_length(trim(coalesce(p_event_id, ''))) < 3
    or char_length(trim(coalesce(p_event_type, ''))) < 3
  then
    raise exception 'invalid stripe event';
  end if;

  insert into stripe_webhook_events(event_id, event_type)
  values(trim(p_event_id), trim(p_event_type))
  on conflict(event_id) do nothing;
  get diagnostics claimed = row_count;
  if claimed then return true; end if;

  select state into current_state
  from stripe_webhook_events
  where event_id = trim(p_event_id)
  for update;

  if current_state <> 'failed' then return false; end if;

  update stripe_webhook_events
  set state = 'processing',
      event_type = trim(p_event_type),
      error = null,
      processed_at = null
  where event_id = trim(p_event_id);
  return true;
end;
$$;

revoke all on function claim_stripe_webhook_event(text,text) from public;
grant execute on function claim_stripe_webhook_event(text,text) to service_role;

commit;

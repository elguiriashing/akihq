begin;

-- Claim-submitted staff notifications, distinct from claimant-facing decisions.
-- Only new INSERTs queue alerts; historical claims are not re-sent.
create table if not exists public.claim_submission_alerts (
  claim_id uuid primary key references public.venue_claims(id) on delete cascade,
  claimant_id uuid not null references public.profiles(id) on delete cascade,
  payload jsonb not null,
  status text not null default 'pending'
    check (status in ('pending','sending','sent','failed','blocked','review')),
  attempts integer not null default 0 check(attempts between 0 and 12),
  delivery_uncertain boolean not null default false,
  created_at timestamptz not null default now(),
  available_at timestamptz not null default now(),
  first_attempt_at timestamptz,
  attempted_at timestamptz,
  lease_id uuid,
  sent_at timestamptz,
  provider_message_id text,
  last_error text
);
create index if not exists claim_submission_alert_due
  on public.claim_submission_alerts (status, available_at);

alter table public.claim_submission_alerts enable row level security;
revoke all on public.claim_submission_alerts from public, anon, authenticated;
grant select, insert, update, delete on public.claim_submission_alerts to service_role;
-- No claimant or public policy. Staff alert recipient addresses are fixed in the
-- server mailer rather than being attacker-controlled database contents.

create or replace function public.queue_claim_submission_alert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_name text;
begin
  if new.status::text <> 'pending' then return new; end if;
  select v.name into v_name from public.venues v where v.id=new.venue_id;
  insert into public.claim_submission_alerts (
    claim_id, claimant_id, payload, status
  ) values (
    new.id, new.claimant_id,
    jsonb_build_object(
      'claimId', new.id,
      'venueId', new.venue_id,
      'venueName', coalesce(v_name, 'Venue'),
      'submittedAt', new.created_at
    ),
    'pending'
  ) on conflict (claim_id) do nothing;
  return new;
end;
$$;
drop trigger if exists venue_claim_submission_alert on public.venue_claims;
create trigger venue_claim_submission_alert
  after insert on public.venue_claims
  for each row execute function public.queue_claim_submission_alert();

revoke all on function public.queue_claim_submission_alert()
  from public, anon, authenticated;

-- Service-role-only lease: the same claim is never dispatched in parallel.
-- A provider idempotency key is held constant across retries for both recipients.
create or replace function public.claim_due_submission_alerts(
  p_claim uuid default null
)
returns setof public.claim_submission_alerts
language plpgsql security definer set search_path = '' as $$
begin
  update public.claim_submission_alerts
    set status='review', lease_id=null,
        last_error='delivery_confirmation_required'
  where status in ('sending','failed')
    and first_attempt_at < now() - interval '23 hours';

  return query
  with due as (
    select a.claim_id
      from public.claim_submission_alerts a
      where (p_claim is null or a.claim_id=p_claim)
        and a.attempts < 12 and a.available_at <= now()
        and (
          a.status in ('pending','failed')
          or (a.status='sending' and a.attempted_at < now()-interval '10 minutes')
        )
      order by a.created_at,a.claim_id
      limit 8
      for update of a skip locked
  )
  update public.claim_submission_alerts a
    set status='sending',
        attempts=a.attempts+1,
        lease_id=gen_random_uuid(),
        attempted_at=now(),
        first_attempt_at=coalesce(a.first_attempt_at,now()),
        delivery_uncertain=a.delivery_uncertain or a.status='sending'
    from due
    where a.claim_id=due.claim_id
    returning a.*;
end;
$$;

create or replace function public.finish_claim_submission_alert(
  p_claim uuid,
  p_lease uuid,
  p_ok boolean,
  p_message text default null,
  p_error text default null,
  p_ambiguous boolean default true,
  p_retryable boolean default true
)
returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_ok and nullif(btrim(p_message),'') is null then
    raise exception 'provider message required';
  end if;

  update public.claim_submission_alerts
  set status=case
    when p_ok then 'sent'
    when not p_retryable then 'blocked'
    when attempts>=12 then 'review'
    else 'failed'
  end,
  sent_at=case when p_ok then now() else null end,
  provider_message_id=case when p_ok then p_message else null end,
  last_error=case when p_ok then null else left(p_error,80) end,
  first_attempt_at=case
    when not p_ok and not p_ambiguous and not delivery_uncertain
    then null else first_attempt_at end,
  delivery_uncertain=delivery_uncertain or (not p_ok and p_ambiguous),
  available_at=now()+make_interval(secs=>least(3600,60*power(2,least(attempts,6)))::integer),
  lease_id=null
  where claim_id=p_claim and lease_id=p_lease and status='sending';

  return found;
end;
$$;

revoke all on function public.claim_due_submission_alerts(uuid),
  public.finish_claim_submission_alert(uuid,uuid,boolean,text,text,boolean,boolean)
  from public, anon, authenticated;
grant execute on function public.claim_due_submission_alerts(uuid),
  public.finish_claim_submission_alert(uuid,uuid,boolean,text,text,boolean,boolean)
  to service_role;

commit;

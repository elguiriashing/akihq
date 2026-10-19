begin;
-- Future decisions only: no backfill and no changes to ownership or existing decisions.
create table public.claim_decision_emails (
 claim_id uuid primary key references public.venue_claims(id) on delete cascade,
 claimant_id uuid not null references public.profiles(id) on delete cascade,
 recipient text,
 payload jsonb not null,
 status text not null check(status in ('pending','sending','sent','failed','blocked','review')),
 attempts integer not null default 0,
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
create index claim_email_due on public.claim_decision_emails(status,available_at);
alter table public.claim_decision_emails enable row level security;
revoke all on public.claim_decision_emails from public,anon,authenticated;
grant select on public.claim_decision_emails to authenticated;
grant all on public.claim_decision_emails to service_role;
create policy claim_email_read on public.claim_decision_emails for select to authenticated
 using(claimant_id=(select auth.uid()) or exists(select 1 from public.profiles p
   where p.id=(select auth.uid()) and p.app_role::text in ('moderator','administrator')));

create function public.queue_claim_decision_email() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_recipient text; v_payload jsonb;
begin
 if old.status::text<>'pending' or new.status::text not in ('approved','rejected') then return new; end if;
 if auth.uid() is null or not exists(select 1 from public.profiles p where p.id=auth.uid()
   and p.app_role::text in ('moderator','administrator')) then
   raise exception 'staff role required' using errcode='42501';
 end if;
 if new.decided_by is distinct from auth.uid() or char_length(btrim(coalesce(new.decision_reason,'')))<3 then
   raise exception 'decision reason and reviewer required';
 end if;
 select case when u.deleted_at is null and u.email_confirmed_at is not null
   and char_length(u.email::text) between 5 and 254
   and u.email::text ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then u.email::text end,
   jsonb_build_object('claimId',new.id,'venueId',new.venue_id,'venueName',v.name,
     'applicantName',p.display_name,'decision',new.status::text,'reason',coalesce(new.decision_reason,''),
     'locale',case when p.preferred_locale='en' then 'en' else 'es' end)
 into v_recipient,v_payload from public.venues v join public.profiles p on p.id=new.claimant_id
 left join auth.users u on u.id=p.id where v.id=new.venue_id;
 insert into public.claim_decision_emails(claim_id,claimant_id,recipient,payload,status,last_error)
 values(new.id,new.claimant_id,v_recipient,v_payload,
   case when v_recipient is null then 'blocked' else 'pending' end,
   case when v_recipient is null then 'verified_account_email_missing' end)
 on conflict(claim_id) do nothing;
 return new;
end; $$;
create trigger claim_decision_queue after update of status on public.venue_claims
 for each row execute function public.queue_claim_decision_email();
revoke all on function public.queue_claim_decision_email() from public,anon,authenticated;

-- Service-key-only leases; row locks prevent concurrent sends. Frozen payloads and
-- a stable provider key prevent duplicate notifications after transient failures.
create function public.claim_claim_decision_emails(p_claim uuid default null)
returns setof public.claim_decision_emails language plpgsql security definer set search_path='' as $$
begin
 update public.claim_decision_emails e set status='blocked',lease_id=null,last_error='account_email_unavailable'
 where e.status in ('pending','failed','sending') and not exists(select 1 from auth.users u
   where u.id=e.claimant_id and u.deleted_at is null and u.email_confirmed_at is not null and u.email::text=e.recipient);
 update public.claim_decision_emails set status='review',lease_id=null,last_error='delivery_confirmation_required'
 where status in ('sending','failed') and first_attempt_at<now()-interval '23 hours';
 return query with due as (
  select e.claim_id from public.claim_decision_emails e
  where (p_claim is null or e.claim_id=p_claim) and e.recipient is not null and e.attempts<12 and e.available_at<=now()
   and (e.status in ('pending','failed') or (e.status='sending' and e.attempted_at<now()-interval '10 minutes'))
  order by e.created_at,e.claim_id limit 8 for update of e skip locked
 ) update public.claim_decision_emails e set status='sending',attempts=e.attempts+1,
   lease_id=gen_random_uuid(),attempted_at=now(),first_attempt_at=coalesce(e.first_attempt_at,now()),
   delivery_uncertain=e.delivery_uncertain or e.status='sending'
 from due where e.claim_id=due.claim_id returning e.*;
end; $$;
create function public.finish_claim_decision_email(p_claim uuid,p_lease uuid,p_ok boolean,
 p_message text default null,p_error text default null,p_ambiguous boolean default true,p_retryable boolean default true)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_ok and nullif(btrim(p_message),'') is null then raise exception 'provider message required'; end if;
 update public.claim_decision_emails set
  status=case when p_ok then 'sent' when not p_retryable then 'blocked' when attempts>=12 then 'review' else 'failed' end,
  sent_at=case when p_ok then now() end,provider_message_id=case when p_ok then p_message end,
  last_error=case when p_ok then null else left(p_error,80) end,
  first_attempt_at=case when not p_ok and not p_ambiguous and not delivery_uncertain then null else first_attempt_at end,
  delivery_uncertain=delivery_uncertain or (not p_ok and p_ambiguous),
  available_at=now()+make_interval(secs=>least(3600,60*power(2,least(attempts,6)))::integer),lease_id=null
 where claim_id=p_claim and lease_id=p_lease and status='sending';
 return found;
end; $$;
revoke all on function public.claim_claim_decision_emails(uuid),
 public.finish_claim_decision_email(uuid,uuid,boolean,text,text,boolean,boolean) from public,anon,authenticated;
grant execute on function public.claim_claim_decision_emails(uuid),
 public.finish_claim_decision_email(uuid,uuid,boolean,text,text,boolean,boolean) to service_role;
commit;

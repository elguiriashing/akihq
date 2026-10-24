-- Owner-approved monthly EUR offers, 24 October 2026.
-- Only new checkout validation changes. Existing reservations, subscriptions,
-- verified legacy schedules, tenant roles and payment activation are retained.
begin;
set local lock_timeout = '2s';
set local statement_timeout = '8s';
CREATE OR REPLACE FUNCTION public.crm_operations_migration_status(p_workspace text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if not akibusiness_private.operations_owner(p_workspace) then
  raise exception 'Location owner required' using errcode='42501';
 end if;
 return (
  select jsonb_build_object('tier','basico','effective_at',to_timestamp((c.source_snapshot->>'periodEnd')::double precision),'state','scheduled')
  from akibusiness_private.operations_migration_commands c
  join akibusiness_private.operations_subscriptions b on b.subscription_id=c.subscription_id and b.workspace_id=c.workspace_id
  join public.crm_workspaces w on w.id=b.workspace_id
  join public.billing_subscriptions s on s.stripe_subscription_id=b.subscription_id and s.profile_id=b.profile_id and s.stripe_customer_id=b.customer_id
  where c.workspace_id=p_workspace and b.profile_id=auth.uid() and b.source_token is null
   and b.next_tier='basico' and akibusiness_private.valid_tools('basico',b.next_tools)
   and w.source_venue_id is null and s.plan_code in ('business','business_pro') and s.status='active'
   and c.state='scheduled' and c.completed_at is not null and c.schedule_id is not null
   and c.preview_evidence->'verified'='true'::jsonb
   and c.preview_evidence->>'scheduleId'=c.schedule_id
   and c.preview_evidence->>'manifestSha256'=c.manifest_sha256
   and c.preview_evidence->>'targetPrice' in ('price_1USgZRGfzDhsgsQZaZYnAjZC','price_1UTt5EGfzDhsgsQZe6z78bZb')
   and c.preview_evidence->'amountDue'='0'::jsonb and c.preview_evidence->>'currency'='eur'
   and c.preview_evidence->>'currentStatus'='active'
   and c.preview_evidence->>'effectiveAt'=c.source_snapshot->>'periodEnd'
   and c.preview_evidence->>'invoicePreviewId' is not null
   and c.source_snapshot->>'id'=b.subscription_id and c.source_snapshot->>'customer'=b.customer_id
   and c.source_snapshot->>'profileId'=auth.uid()::text
   and c.source_snapshot->>'status'='active' and c.source_snapshot->>'invoiceStatus'='paid'
   and c.source_snapshot->>'quantity'='1'
   and case when c.source_snapshot->>'periodEnd' ~ '^[0-9]{9,10}$'
       then (c.source_snapshot->>'periodEnd')::bigint between 946684800 and 4102444800 else false end
   and exists(select 1 from akibusiness_private.operations_billing_events e
    where e.event_id='migration-scheduled:'||c.command_id::text and e.subscription_id=b.subscription_id
      and e.evidence=c.manifest_sha256||':schedule:'||c.schedule_id)
   and not exists(select 1 from akibusiness_private.toolboxes t where t.workspace_id=b.workspace_id)
 );
end $function$
;
CREATE OR REPLACE FUNCTION public.reserve_crm_operations_checkout(p_workspace text, p_tier text, p_tools text[], p_price text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c akibusiness_private.operations_checkouts; customer text;
begin
 if not akibusiness_private.operations_owner(p_workspace) then raise exception 'Location owner required' using errcode='42501'; end if;
 if not akibusiness_private.valid_tools(p_tier,p_tools) or p_price is distinct from (case p_tier when 'basico' then 'price_1UTt5EGfzDhsgsQZe6z78bZb' when 'standard' then 'price_1UTt5XGfzDhsgsQZp5nKlb1r' when 'pro' then 'price_1UTt5YGfzDhsgsQZhdYtU3YP' else '' end) then raise exception 'Unapproved operating offer'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_workspace,7723));
 if exists(select 1 from akibusiness_private.operations_subscriptions where workspace_id=p_workspace) then raise exception 'Existing subscription requires change workflow' using errcode='PT409'; end if;
 if exists(select 1 from public.billing_subscriptions where profile_id=auth.uid() and plan_code in ('business','business_pro') and status in ('active','trialing','past_due','unpaid','paused','incomplete')) then raise exception 'Existing business migration required' using errcode='PT409'; end if;
 select stripe_customer_id into customer from public.billing_customers where profile_id=auth.uid();
 if customer is null then raise exception 'Verified billing customer required'; end if;
 select * into c from akibusiness_private.operations_checkouts where workspace_id=p_workspace for update;
 if found and c.state='reserved' then
  -- Never automatically free a token: Stripe asynchronous payments can complete late.
  if c.profile_id<>auth.uid() or c.customer_id<>customer or c.tier<>p_tier or c.tools<>p_tools or c.price_id<>p_price or c.expires_at<=now() then raise exception 'Checkout needs authoritative reconciliation' using errcode='PT409'; end if;
  return to_jsonb(c);
 end if;
 insert into akibusiness_private.operations_checkouts(workspace_id,profile_id,customer_id,tier,tools,price_id)
 values(p_workspace,auth.uid(),customer,p_tier,p_tools,p_price)
 on conflict(workspace_id) do update set profile_id=excluded.profile_id,customer_id=excluded.customer_id,tier=excluded.tier,tools=excluded.tools,price_id=excluded.price_id,token=gen_random_uuid(),state='reserved',session_id=null,expires_at=now()+interval '35 minutes',created_at=now()
 returning * into c;
 return to_jsonb(c);
end $function$
;
revoke all on function public.reserve_crm_operations_checkout(text,text,text[],text),public.crm_operations_migration_status(text) from public,anon;
grant execute on function public.reserve_crm_operations_checkout(text,text,text[],text),public.crm_operations_migration_status(text) to authenticated;
commit;

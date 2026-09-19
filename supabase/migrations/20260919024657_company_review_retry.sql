begin;
create schema if not exists crm_private;
revoke all on schema crm_private from public;
grant usage on schema crm_private to authenticated;

-- Restricted definer: CRM records deliberately do not allow direct client writes.
create or replace function crm_private.company_review_retry(
 p_requeue boolean default false,p_after bigint default 0,p_until bigint default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare n bigint; last_seq bigint; cap numeric; spent numeric; hard boolean;
begin
 if auth.uid() is null or not public.crm_company_access(true) then
   raise exception 'Administrator required' using errcode='42501';
 end if;
 if p_requeue then
   if p_until is null or p_after is null or p_after<0 or p_until<0 then raise exception 'Invalid retry range';end if;
   with chosen as (
     select c.seq from public.crm_company_records c
     where c.workspace_id='ws_akipasa' and c.deleted_at is null and c.publish_state='skipped'
       and c.seq>p_after and c.seq<=p_until and nullif(c.data->>'catalogueVenueId','') is null
       and not exists(select 1 from public.crm_catalogue_venues v where v.workspace_id=c.workspace_id and v.lead_id=c.id)
       and (c.import_id is null or exists(select 1 from public.crm_company_imports i where i.id=c.import_id and i.status not in ('undoing','undone')))
     order by c.seq limit 500 for update
   ), changed as (
     update public.crm_company_records c set publish_state='pending',publish_token=null,publish_lease=null
     from chosen x where c.seq=x.seq returning c.seq
   ) select count(*),max(seq) into n,last_seq from changed;
   return jsonb_build_object('queued',n,'cursor',coalesce(last_seq,p_after),'done',n<500);
 end if;
 select s.monthly_limit_eur,s.hard_cap_enabled into cap,hard from public.ai_budget_settings s where singleton;
 select coalesce(sum(coalesce(l.actual_cost_eur,l.reserved_cost_eur)),0) into spent
 from public.ai_usage_ledger l where l.billing_month=date_trunc('month',now() at time zone 'UTC')::date
 and l.status in ('reserved','completed','failed');
 select count(*),coalesce(max(seq),0) into n,last_seq from public.crm_company_records
 where workspace_id='ws_akipasa' and deleted_at is null and publish_state='skipped' and nullif(data->>'catalogueVenueId','') is null;
 return jsonb_build_object('count',n,'until',last_seq,'spent',spent,'limit',cap,'hard_cap',hard);
end $$;
revoke all on function crm_private.company_review_retry(boolean,bigint,bigint) from public,anon;
grant execute on function crm_private.company_review_retry(boolean,bigint,bigint) to authenticated;
create or replace function public.crm_company_review_retry(
 p_requeue boolean default false,p_after bigint default 0,p_until bigint default null
) returns jsonb language sql security invoker set search_path='' as $$
 select crm_private.company_review_retry(p_requeue,p_after,p_until);
$$;
revoke all on function public.crm_company_review_retry(boolean,bigint,bigint) from public,anon;
grant execute on function public.crm_company_review_retry(boolean,bigint,bigint) to authenticated;
commit;

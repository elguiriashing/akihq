begin;

-- Some production projects received the entitlement functions before this
-- compatibility flag was represented in the Supabase migration history.
alter table public.profiles
  add column if not exists business_plan_active boolean not null default false;

update public.profiles
set business_plan_active = true
where business_tier in ('business', 'business_pro')
  and not business_plan_active;

commit;

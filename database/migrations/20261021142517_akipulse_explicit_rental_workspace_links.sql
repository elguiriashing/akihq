begin;
create schema akipulse_private;
revoke all on schema akipulse_private from public,anon,authenticated;
create table public.akipulse_rental_workspaces(company_id uuid primary key references public.car_rental_companies(id) on delete cascade,workspace_id text not null references public.crm_workspaces(id),linked_by uuid references public.profiles(id) on delete set null,linked_at timestamptz not null default now());
create index akipulse_rental_workspace_scope on public.akipulse_rental_workspaces(workspace_id,company_id);
alter table public.akipulse_rental_workspaces enable row level security;
revoke all on public.akipulse_rental_workspaces from public,anon,authenticated,service_role;
create index akipulse_rental_link_actor on public.akipulse_rental_workspaces(linked_by);
create table akipulse_private.rental_link_audit(id bigint generated always as identity primary key,company_id uuid not null,old_workspace text,new_workspace text,actor uuid references public.profiles(id) on delete set null,created_at timestamptz not null default now());
alter table akipulse_private.rental_link_audit enable row level security;
revoke all on akipulse_private.rental_link_audit from public,anon,authenticated,service_role;
create index akipulse_rental_audit_actor on akipulse_private.rental_link_audit(actor);
create function akipulse_private.immutable_link_audit() returns trigger language plpgsql set search_path='' as $$begin
 if tg_op='UPDATE' and pg_trigger_depth()>1 and new.actor is null and (to_jsonb(new)-'actor')=(to_jsonb(old)-'actor') then return new;end if;
 raise exception 'Immutable management link audit';end $$;
create trigger akipulse_rental_link_audit_immutable before update or delete on akipulse_private.rental_link_audit for each row execute function akipulse_private.immutable_link_audit();
revoke all on function akipulse_private.immutable_link_audit() from public,anon,authenticated;
-- This link is an explicit management association only, never a paid entitlement or organisation attachment.
commit;

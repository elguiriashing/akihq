alter table public.crm_pos_sales
  add column if not exists tip_cents integer not null default 0 check (tip_cents >= 0),
  add column if not exists tipped_profile_id uuid references public.profiles(id) on delete set null;

create table if not exists public.crm_tip_adjustments (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.crm_workspaces(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  sale_id uuid references public.crm_pos_sales(id) on delete restrict,
  amount_cents integer not null check (amount_cents <> 0),
  adjustment_type text not null check (adjustment_type in ('sale_tip','manual_credit','cash_payout','correction')),
  note text not null default '',
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict
);

create index if not exists crm_tip_adjustments_workspace_profile_time_idx
  on public.crm_tip_adjustments (workspace_id,profile_id,created_at desc);

alter table public.crm_tip_adjustments enable row level security;

create policy crm_tip_adjustments_read on public.crm_tip_adjustments for select to authenticated
using (public.crm_has_tool(workspace_id,'pos'));

revoke all on public.crm_tip_adjustments from public, anon;
grant select on public.crm_tip_adjustments to authenticated;
grant all on public.crm_tip_adjustments to service_role;
grant select (tip_cents,tipped_profile_id) on public.crm_pos_sales to authenticated;

create or replace function public.crm_set_pos_sale_tip(
  p_workspace text,
  p_sale uuid,
  p_profile uuid,
  p_tip_cents integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_old_tip integer;
  v_old_profile uuid;
  v_sale_employee uuid;
  v_delta integer;
begin
  if p_tip_cents < 0 then raise exception 'tip cannot be negative'; end if;
  if not public.crm_can_operate_workspace(p_workspace) or not public.crm_has_tool(p_workspace,'pos') then
    raise exception 'point-of-sale access required';
  end if;
  if not exists (
    select 1 from public.crm_workspace_members member
    where member.workspace_id = p_workspace and member.profile_id = p_profile and member.status = 'active'
  ) then raise exception 'tip recipient must be an active workspace member'; end if;

  select sale.tip_cents,sale.tipped_profile_id,sale.employee_profile_id
  into v_old_tip,v_old_profile,v_sale_employee
  from public.crm_pos_sales sale
  where sale.id = p_sale and sale.workspace_id = p_workspace and sale.status = 'completed'
  for update;
  if not found then raise exception 'sale not found'; end if;

  if not public.crm_can_manage_workspace(p_workspace)
     and (v_sale_employee is distinct from v_actor or p_profile is distinct from v_actor) then
    raise exception 'workspace manager required to assign another worker tip';
  end if;

  if v_old_tip > 0 and v_old_profile is not null then
    insert into public.crm_tip_adjustments
      (workspace_id,profile_id,sale_id,amount_cents,adjustment_type,note,created_by)
    values (p_workspace,v_old_profile,p_sale,-v_old_tip,'correction','Replaced sale tip',v_actor);
  end if;
  if p_tip_cents > 0 then
    insert into public.crm_tip_adjustments
      (workspace_id,profile_id,sale_id,amount_cents,adjustment_type,note,created_by)
    values (p_workspace,p_profile,p_sale,p_tip_cents,'sale_tip','Tip assigned to sale',v_actor);
  end if;
  update public.crm_pos_sales
  set tip_cents = p_tip_cents, tipped_profile_id = case when p_tip_cents > 0 then p_profile else null end
  where id = p_sale;
end;
$$;

create or replace function public.crm_adjust_tip_balance(
  p_workspace text,
  p_profile uuid,
  p_amount_cents integer,
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  if not public.crm_can_manage_workspace(p_workspace) then raise exception 'workspace manager required'; end if;
  if p_amount_cents = 0 then raise exception 'tip adjustment cannot be zero'; end if;
  if not exists (
    select 1 from public.crm_workspace_members member
    where member.workspace_id = p_workspace and member.profile_id = p_profile and member.status = 'active'
  ) then raise exception 'worker is not an active workspace member'; end if;
  insert into public.crm_tip_adjustments
    (workspace_id,profile_id,amount_cents,adjustment_type,note,created_by)
  values (
    p_workspace,p_profile,p_amount_cents,
    case when p_amount_cents < 0 then 'cash_payout' else 'manual_credit' end,
    coalesce(btrim(p_note),''),(select auth.uid())
  ) returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.crm_set_pos_sale_tip(text,uuid,uuid,integer) from public, anon;
revoke all on function public.crm_adjust_tip_balance(text,uuid,integer,text) from public, anon;
grant execute on function public.crm_set_pos_sale_tip(text,uuid,uuid,integer) to authenticated;
grant execute on function public.crm_adjust_tip_balance(text,uuid,integer,text) to authenticated;


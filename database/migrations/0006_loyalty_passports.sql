begin;

create type check_in_state as enum ('accepted','duplicate','cooldown','rate_limited');
create type redemption_state as enum ('requested','confirmed','cancelled');

create table loyalty_programs (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid unique not null references venues(id) on delete cascade,
  title_es text not null check(char_length(title_es) between 3 and 160),
  title_en text,
  reward_es text not null check(char_length(reward_es) between 3 and 500),
  reward_en text,
  stamps_required integer not null check(stamps_required between 2 and 50),
  check_in_token uuid unique not null default gen_random_uuid(),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table check_ins (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  venue_id uuid not null references venues(id) on delete cascade,
  idempotency_key uuid not null,
  state check_in_state not null,
  risk_flags text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique(profile_id,idempotency_key)
);
create index check_ins_cooldown_idx on check_ins(profile_id,venue_id,created_at desc) where state='accepted';

create table loyalty_ledger (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  program_id uuid not null references loyalty_programs(id) on delete cascade,
  check_in_id uuid references check_ins(id),
  delta integer not null check(delta <> 0),
  reason text not null,
  created_at timestamptz not null default now(),
  unique(check_in_id)
);

create table xp_ledger (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  check_in_id uuid references check_ins(id),
  delta integer not null check(delta <> 0),
  reason text not null,
  idempotency_key text unique not null,
  created_at timestamptz not null default now()
);

create table passports (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title_es text not null,
  title_en text,
  description_es text not null,
  description_en text,
  reward_es text not null,
  reward_en text,
  starts_at timestamptz not null,
  ends_at timestamptz not null check(ends_at > starts_at),
  status content_status not null default 'draft',
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table passport_steps (
  id uuid primary key default gen_random_uuid(),
  passport_id uuid not null references passports(id) on delete cascade,
  venue_id uuid not null references venues(id) on delete cascade,
  label_es text not null,
  label_en text,
  sort_order integer not null default 0,
  unique(passport_id,venue_id)
);

create table passport_progress (
  profile_id uuid not null references profiles(id) on delete cascade,
  step_id uuid not null references passport_steps(id) on delete cascade,
  check_in_id uuid not null references check_ins(id),
  completed_at timestamptz not null default now(),
  primary key(profile_id,step_id)
);

create table reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  program_id uuid not null references loyalty_programs(id) on delete cascade,
  state redemption_state not null default 'requested',
  requested_at timestamptz not null default now(),
  confirmed_by uuid references profiles(id),
  confirmed_at timestamptz
);

alter table loyalty_programs enable row level security;
alter table check_ins enable row level security;
alter table loyalty_ledger enable row level security;
alter table xp_ledger enable row level security;
alter table passports enable row level security;
alter table passport_steps enable row level security;
alter table passport_progress enable row level security;
alter table reward_redemptions enable row level security;

create policy loyalty_programs_public_read on loyalty_programs for select using(active or is_venue_member(venue_id));
create policy loyalty_programs_owner_manage on loyalty_programs for all using(is_venue_member(venue_id,array['manager','owner']::venue_member_role[])) with check(is_venue_member(venue_id,array['manager','owner']::venue_member_role[]));
create policy check_ins_own_read on check_ins for select using(profile_id=auth.uid() or is_venue_member(venue_id) or has_platform_role(array['moderator','administrator']::app_role[]));
create policy loyalty_ledger_own_read on loyalty_ledger for select using(profile_id=auth.uid() or exists(select 1 from loyalty_programs p where p.id=program_id and is_venue_member(p.venue_id)));
create policy xp_ledger_own_read on xp_ledger for select using(profile_id=auth.uid());
create policy passports_public_read on passports for select using(status='published' or has_platform_role(array['administrator']::app_role[]));
create policy passports_admin_manage on passports for all using(has_platform_role(array['administrator']::app_role[])) with check(has_platform_role(array['administrator']::app_role[]));
create policy passport_steps_public_read on passport_steps for select using(exists(select 1 from passports p where p.id=passport_id and (p.status='published' or has_platform_role(array['administrator']::app_role[]))));
create policy passport_steps_admin_manage on passport_steps for all using(has_platform_role(array['administrator']::app_role[])) with check(has_platform_role(array['administrator']::app_role[]));
create policy passport_progress_own_read on passport_progress for select using(profile_id=auth.uid());
create policy redemptions_read on reward_redemptions for select using(profile_id=auth.uid() or exists(select 1 from loyalty_programs p where p.id=program_id and is_venue_member(p.venue_id)));

create or replace function check_in_by_token(p_token uuid, p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare
  v_profile uuid := auth.uid(); v_program loyalty_programs%rowtype;
  v_check_in uuid; v_existing check_ins%rowtype; v_count integer; v_step record;
begin
  if v_profile is null then raise exception 'authentication required'; end if;
  select * into v_program from loyalty_programs where check_in_token=p_token and active for update;
  if v_program.id is null then raise exception 'invalid check-in token'; end if;
  select * into v_existing from check_ins where profile_id=v_profile and idempotency_key=p_idempotency_key;
  if v_existing.id is not null then return jsonb_build_object('state',v_existing.state,'check_in_id',v_existing.id); end if;
  select count(*) into v_count from check_ins where profile_id=v_profile and state='accepted' and created_at > now()-interval '24 hours';
  if v_count >= 20 then
    insert into check_ins(profile_id,venue_id,idempotency_key,state,risk_flags) values(v_profile,v_program.venue_id,p_idempotency_key,'rate_limited',array['daily_limit']) returning id into v_check_in;
    return jsonb_build_object('state','rate_limited','check_in_id',v_check_in);
  end if;
  if exists(select 1 from check_ins where profile_id=v_profile and venue_id=v_program.venue_id and state='accepted' and created_at > now()-interval '6 hours') then
    insert into check_ins(profile_id,venue_id,idempotency_key,state,risk_flags) values(v_profile,v_program.venue_id,p_idempotency_key,'cooldown',array['venue_cooldown']) returning id into v_check_in;
    return jsonb_build_object('state','cooldown','check_in_id',v_check_in);
  end if;
  insert into check_ins(profile_id,venue_id,idempotency_key,state) values(v_profile,v_program.venue_id,p_idempotency_key,'accepted') returning id into v_check_in;
  insert into loyalty_ledger(profile_id,program_id,check_in_id,delta,reason) values(v_profile,v_program.id,v_check_in,1,'check_in');
  insert into xp_ledger(profile_id,check_in_id,delta,reason,idempotency_key) values(v_profile,v_check_in,10,'check_in','check_in:'||v_check_in);
  for v_step in select s.id from passport_steps s join passports p on p.id=s.passport_id where s.venue_id=v_program.venue_id and p.status='published' and now() between p.starts_at and p.ends_at loop
    insert into passport_progress(profile_id,step_id,check_in_id) values(v_profile,v_step.id,v_check_in) on conflict do nothing;
  end loop;
  return jsonb_build_object('state','accepted','check_in_id',v_check_in,'stamps_awarded',1,'xp_awarded',10);
end;
$$;

create or replace function request_reward_redemption(p_program uuid)
returns uuid language plpgsql security definer set search_path=public
as $$
declare v_required integer; v_balance integer; v_id uuid;
begin
  select stamps_required into v_required from loyalty_programs where id=p_program and active;
  if v_required is null then raise exception 'program unavailable'; end if;
  select coalesce(sum(delta),0) into v_balance from loyalty_ledger where profile_id=auth.uid() and program_id=p_program;
  if v_balance < v_required then raise exception 'insufficient stamps'; end if;
  if exists(select 1 from reward_redemptions where profile_id=auth.uid() and program_id=p_program and state='requested') then raise exception 'redemption already requested'; end if;
  insert into reward_redemptions(profile_id,program_id) values(auth.uid(),p_program) returning id into v_id;
  return v_id;
end;
$$;

create or replace function confirm_reward_redemption(p_redemption uuid)
returns void language plpgsql security definer set search_path=public
as $$
declare v_row reward_redemptions%rowtype; v_program loyalty_programs%rowtype; v_balance integer;
begin
  select * into v_row from reward_redemptions where id=p_redemption and state='requested' for update;
  if v_row.id is null then raise exception 'redemption unavailable'; end if;
  select * into v_program from loyalty_programs where id=v_row.program_id;
  if not is_venue_member(v_program.venue_id,array['manager','owner']::venue_member_role[]) then raise exception 'venue manager required'; end if;
  select coalesce(sum(delta),0) into v_balance from loyalty_ledger where profile_id=v_row.profile_id and program_id=v_row.program_id;
  if v_balance < v_program.stamps_required then raise exception 'insufficient stamps'; end if;
  insert into loyalty_ledger(profile_id,program_id,delta,reason) values(v_row.profile_id,v_row.program_id,-v_program.stamps_required,'reward_redemption:'||v_row.id);
  update reward_redemptions set state='confirmed',confirmed_by=auth.uid(),confirmed_at=now() where id=v_row.id;
end;
$$;

grant execute on function check_in_by_token(uuid,uuid) to authenticated;
grant execute on function request_reward_redemption(uuid) to authenticated;
grant execute on function confirm_reward_redemption(uuid) to authenticated;
revoke execute on function check_in_by_token(uuid,uuid) from anon;
revoke execute on function request_reward_redemption(uuid) from anon;
revoke execute on function confirm_reward_redemption(uuid) from anon;

commit;

begin;

alter table account_deletion_requests
  drop constraint if exists account_deletion_requests_profile_id_fkey;
alter table account_deletion_requests
  alter column profile_id drop not null;
alter table account_deletion_requests
  add constraint account_deletion_requests_profile_id_fkey
  foreign key(profile_id) references profiles(id) on delete set null;

alter table account_deletion_requests
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by uuid references profiles(id),
  add column if not exists resolution text;

create or replace function update_deletion_request(
  p_request uuid,
  p_state deletion_request_state,
  p_reason text,
  p_confirmed_deleted boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_state deletion_request_state;
  target_profile uuid;
begin
  if not has_platform_role(array['administrator']::app_role[]) then
    raise exception 'administrator role required';
  end if;
  if p_state not in ('processing', 'completed', 'cancelled') then
    raise exception 'invalid deletion state';
  end if;
  if char_length(trim(p_reason)) < 10 then raise exception 'reason required'; end if;

  select state, profile_id into previous_state, target_profile
  from account_deletion_requests
  where id = p_request
  for update;
  if previous_state is null then raise exception 'deletion request not found'; end if;
  if previous_state in ('completed', 'cancelled') then
    raise exception 'deletion request already closed';
  end if;
  if p_state = 'completed' and not p_confirmed_deleted then
    raise exception 'identity deletion confirmation required';
  end if;
  if p_state = 'completed' and target_profile is not null then
    raise exception 'linked identity still exists';
  end if;

  update account_deletion_requests
  set state = p_state,
      resolution = trim(p_reason),
      updated_by = auth.uid(),
      updated_at = now(),
      completed_at = case when p_state = 'completed' then now() else null end
  where id = p_request;

  insert into moderation_actions(
    actor_id,
    action,
    target_type,
    target_id,
    reason,
    metadata
  )
  values(
    auth.uid(),
    'deletion_request_' || p_state::text,
    'account_deletion_request',
    p_request,
    trim(p_reason),
    jsonb_build_object(
      'previous_state', previous_state,
      'confirmed_deleted', p_confirmed_deleted
    )
  );
end;
$$;

revoke all on function update_deletion_request(uuid,deletion_request_state,text,boolean) from public;
grant execute on function update_deletion_request(uuid,deletion_request_state,text,boolean) to authenticated;

commit;

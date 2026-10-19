begin;

create or replace function delete_owned_event(
  p_event uuid,
  p_confirmation text,
  p_reason text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_venue uuid;
begin
  if p_confirmation <> 'DELETE' or char_length(trim(p_reason)) < 10 then
    raise exception 'confirmation and reason required';
  end if;

  select venue_id into target_venue
  from events
  where id = p_event;

  if target_venue is null
    or not is_venue_member(
      target_venue,
      array['manager','owner']::venue_member_role[]
    )
  then
    raise exception 'event management permission required';
  end if;

  update event_submissions
  set duplicate_of = null
  where duplicate_of = p_event;

  delete from events where id = p_event;
  if not found then raise exception 'event not found'; end if;

  insert into moderation_actions(
    actor_id,
    action,
    target_type,
    target_id,
    reason,
    metadata
  ) values (
    auth.uid(),
    'deleted',
    'event',
    p_event,
    trim(p_reason),
    jsonb_build_object('venue_id', target_venue)
  );
end;
$$;

create or replace function delete_owned_venue(
  p_venue uuid,
  p_confirmation text,
  p_reason text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  owned boolean;
  removed_events uuid[];
begin
  if p_confirmation <> 'DELETE' or char_length(trim(p_reason)) < 10 then
    raise exception 'confirmation and reason required';
  end if;

  select exists(
    select 1
    from venue_members
    where venue_id = p_venue
      and profile_id = auth.uid()
      and role = 'owner'
  ) into owned;

  if not owned then raise exception 'venue owner permission required'; end if;

  select coalesce(array_agg(id), array[]::uuid[])
  into removed_events
  from events
  where venue_id = p_venue;

  update event_submissions
  set duplicate_of = null
  where duplicate_of = any(removed_events);

  delete from events where venue_id = p_venue;
  delete from venues where id = p_venue;
  if not found then raise exception 'venue not found'; end if;

  insert into moderation_actions(
    actor_id,
    action,
    target_type,
    target_id,
    reason,
    metadata
  ) values (
    auth.uid(),
    'deleted',
    'venue',
    p_venue,
    trim(p_reason),
    jsonb_build_object('event_ids', removed_events)
  );
end;
$$;

revoke all on function delete_owned_event(uuid,text,text) from public;
revoke all on function delete_owned_venue(uuid,text,text) from public;
grant execute on function delete_owned_event(uuid,text,text) to authenticated;
grant execute on function delete_owned_venue(uuid,text,text) to authenticated;

commit;

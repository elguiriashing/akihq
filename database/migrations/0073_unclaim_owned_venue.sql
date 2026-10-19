begin;

create or replace function public.unclaim_owned_venue(
  p_venue uuid,
  p_confirmation text,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_owner_count integer;
  v_removed_members integer := 0;
  v_last_owner boolean;
begin
  if v_actor is null then
    raise exception 'authentication required';
  end if;
  if p_confirmation <> 'UNCLAIM' or char_length(trim(coalesce(p_reason, ''))) < 10 then
    raise exception 'confirmation and reason required';
  end if;

  perform 1
  from public.venues
  where id = p_venue
  for update;
  if not found then
    raise exception 'venue not found';
  end if;

  if not exists (
    select 1
    from public.venue_members
    where venue_id = p_venue
      and profile_id = v_actor
      and role = 'owner'::public.venue_member_role
  ) then
    raise exception 'venue owner permission required';
  end if;

  select count(*)::integer
  into v_owner_count
  from public.venue_members
  where venue_id = p_venue
    and role = 'owner'::public.venue_member_role;

  v_last_owner := v_owner_count = 1;

  if v_last_owner then
    update public.venues
    set verified = false,
        status = 'published'::public.content_status,
        accessibility = coalesce(accessibility, '{}'::jsonb)
          || jsonb_build_object('claim_status', 'unclaimed'),
        updated_at = now()
    where id = p_venue;

    delete from public.venue_members
    where venue_id = p_venue;
  else
    delete from public.venue_members
    where venue_id = p_venue
      and profile_id = v_actor;
  end if;
  get diagnostics v_removed_members = row_count;

  insert into public.moderation_actions(
    actor_id,
    action,
    target_type,
    target_id,
    reason,
    metadata
  ) values (
    v_actor,
    'unclaimed',
    'venue',
    p_venue,
    trim(p_reason),
    jsonb_build_object(
      'last_owner', v_last_owner,
      'removed_member_count', v_removed_members,
      'venue_kept_public', true
    )
  );

  return jsonb_build_object(
    'venue_id', p_venue,
    'last_owner', v_last_owner,
    'removed_member_count', v_removed_members
  );
end;
$$;

revoke all on function public.unclaim_owned_venue(uuid,text,text) from public;
revoke all on function public.unclaim_owned_venue(uuid,text,text) from anon;
grant execute on function public.unclaim_owned_venue(uuid,text,text) to authenticated;

commit;

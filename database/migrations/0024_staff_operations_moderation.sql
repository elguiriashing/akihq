begin;

create or replace function moderate_item(
  target_type text,
  target_id uuid,
  decision text,
  reason text,
  p_duplicate_of uuid default null
) returns void language plpgsql security definer set search_path = public
as $$
begin
  if not has_platform_role(array['moderator','administrator']::app_role[]) then
    raise exception 'moderator role required';
  end if;
  if char_length(trim(reason)) < 3 then
    raise exception 'reason required';
  end if;

  if target_type = 'submission' then
    if decision not in ('approved','rejected') then raise exception 'invalid decision'; end if;
    update event_submissions
    set state=decision::moderation_state,
      duplicate_of=p_duplicate_of,
      reviewed_by=auth.uid(),
      review_reason=trim(reason),
      reviewed_at=now()
    where id=target_id and state='pending';
  elsif target_type = 'venue' then
    if decision not in ('published','rejected') then raise exception 'invalid decision'; end if;
    update venues
    set status=decision::content_status,
      verified=(decision='published'),
      updated_at=now()
    where id=target_id and status='pending';
  elsif target_type = 'event' then
    if decision not in ('published','rejected') then raise exception 'invalid decision'; end if;
    update events
    set status=decision::content_status,
      updated_at=now()
    where id=target_id and status='pending';
  elsif target_type = 'offer' then
    if decision not in ('published','rejected') then raise exception 'invalid decision'; end if;
    update offers
    set status=decision::content_status
    where id=target_id and status='pending';
  elsif target_type = 'venue_claim' then
    if decision not in ('approved','rejected') then raise exception 'invalid decision'; end if;
    update venue_claims
    set status=decision::claim_status,
      decided_by=auth.uid(),
      decision_reason=trim(reason),
      decided_at=now()
    where id=target_id and status='pending';
    if decision='approved' then
      insert into venue_members(venue_id,profile_id,role)
      select venue_id,claimant_id,'owner'::venue_member_role
      from venue_claims
      where id=target_id
      on conflict (venue_id,profile_id) do update set role='owner';
      update venues
      set verified=true,status='published',updated_at=now()
      where id=(select venue_id from venue_claims where id=target_id);
    end if;
  else
    raise exception 'invalid target type';
  end if;

  if not found then
    raise exception 'item not pending or not found';
  end if;

  insert into moderation_actions(actor_id,action,target_type,target_id,reason,metadata)
  values(
    auth.uid(),
    decision,
    target_type,
    target_id,
    trim(reason),
    jsonb_build_object('duplicate_of',p_duplicate_of)
  );
end;
$$;

revoke all on function moderate_item(text,uuid,text,text,uuid) from public;
grant execute on function moderate_item(text,uuid,text,text,uuid) to authenticated;

commit;

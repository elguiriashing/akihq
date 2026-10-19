begin;

alter table feature_slots
  add column promotion_request_id uuid unique
  references promotion_requests(id) on delete cascade;

alter table feature_slots alter column label_es set default 'Destacado';
alter table feature_slots alter column label_en set default 'Featured';

create index feature_slots_active_window_idx
  on feature_slots(starts_at, ends_at, event_id);

drop policy promotion_requests_create on promotion_requests;
create policy promotion_requests_create
on promotion_requests for insert
to authenticated
with check (
  requester_id = auth.uid()
  and is_venue_member(venue_id)
  and (service <> 'featured_listing' or event_id is not null)
  and (
    event_id is null
    or exists (
      select 1
      from events e
      where e.id = promotion_requests.event_id
        and e.venue_id = promotion_requests.venue_id
        and e.status = 'published'
    )
  )
);

create or replace function resolve_promotion_request(
  p_request uuid,
  p_state promotion_state,
  p_notes text,
  p_event uuid default null,
  p_starts timestamptz default null,
  p_ends timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request promotion_requests%rowtype;
begin
  if not has_platform_role(array['administrator']::app_role[]) then
    raise exception 'administrator role required';
  end if;

  select * into v_request
  from promotion_requests
  where id = p_request
  for update;

  if not found then raise exception 'promotion request not found'; end if;

  if p_event is not null and not exists (
    select 1
    from events e
    where e.id = p_event
      and e.venue_id = v_request.venue_id
      and e.status = 'published'
  ) then
    raise exception 'event must be a published event for the requested venue';
  end if;

  if v_request.service = 'featured_listing' and p_state = 'won' then
    if p_event is null then raise exception 'featured event required'; end if;
    if p_starts is null or p_ends is null or p_ends <= p_starts then
      raise exception 'valid feature window required';
    end if;

    insert into feature_slots(
      event_id,
      promotion_request_id,
      label_es,
      label_en,
      starts_at,
      ends_at,
      created_by
    ) values (
      p_event,
      p_request,
      'Destacado',
      'Featured',
      p_starts,
      p_ends,
      auth.uid()
    )
    on conflict(promotion_request_id) do update set
      event_id = excluded.event_id,
      label_es = excluded.label_es,
      label_en = excluded.label_en,
      starts_at = excluded.starts_at,
      ends_at = excluded.ends_at;
  else
    delete from feature_slots where promotion_request_id = p_request;
  end if;

  update promotion_requests
  set state = p_state,
      event_id = coalesce(p_event, event_id),
      operator_notes = nullif(trim(p_notes), ''),
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_request;
end;
$$;

revoke all on function resolve_promotion_request(
  uuid,
  promotion_state,
  text,
  uuid,
  timestamptz,
  timestamptz
) from public, anon, authenticated;
grant execute on function resolve_promotion_request(
  uuid,
  promotion_state,
  text,
  uuid,
  timestamptz,
  timestamptz
) to authenticated;

commit;

begin;

create or replace function resolve_report(
  report_id uuid,
  decision report_state,
  resolution text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not has_platform_role(array['moderator','administrator']::app_role[]) then
    raise exception 'moderator role required';
  end if;
  if resolve_report.decision not in ('resolved','dismissed')
    or char_length(trim(resolve_report.resolution)) < 3 then
    raise exception 'invalid resolution';
  end if;

  update reports r
  set
    state = resolve_report.decision,
    resolved_by = auth.uid(),
    resolution = trim(resolve_report.resolution),
    resolved_at = now()
  where r.id = resolve_report.report_id
    and r.state = 'open';

  if not found then raise exception 'report not open or not found'; end if;

  insert into moderation_actions(actor_id,action,target_type,target_id,reason)
  values(
    auth.uid(),
    resolve_report.decision::text,
    'report',
    resolve_report.report_id,
    trim(resolve_report.resolution)
  );
end;
$$;

commit;

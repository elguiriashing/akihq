-- Staff may continue moderating claims and cases but cannot read the platform-wide audit.
-- The administrator dashboard and audit route are the only intended consumers.
begin;

alter policy moderation_actions_operator_read
  on public.moderation_actions
  to authenticated
  using (public.has_platform_role(array['administrator']::public.app_role[]));

commit;

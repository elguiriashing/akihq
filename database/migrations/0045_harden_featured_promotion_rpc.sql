begin;

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

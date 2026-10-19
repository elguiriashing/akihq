begin;

alter table profiles
  drop constraint if exists profiles_terms_acceptance_consistent;
alter table profiles
  add constraint profiles_terms_acceptance_consistent
  check (
    (terms_version is null and terms_accepted_at is null)
    or
    (terms_version is not null and terms_accepted_at is not null)
  );

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  accepted_version text := nullif(trim(new.raw_user_meta_data->>'terms_version'), '');
begin
  insert into profiles(
    id,
    display_name,
    preferred_locale,
    terms_version,
    terms_accepted_at
  )
  values (
    new.id,
    nullif(new.raw_user_meta_data->>'display_name', ''),
    coalesce(nullif(new.raw_user_meta_data->>'preferred_locale', ''), 'es'),
    accepted_version,
    case when accepted_version is not null then now() else null end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function handle_new_user() from public;

create or replace function accept_current_terms(
  p_version text,
  p_locale text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_version !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'invalid terms version';
  end if;
  if p_locale not in ('es', 'en') then raise exception 'invalid locale'; end if;
  update profiles
  set terms_version = p_version,
      terms_accepted_at = now(),
      preferred_locale = p_locale,
      updated_at = now()
  where id = auth.uid();
  if not found then raise exception 'profile not found'; end if;
end;
$$;

-- Do not rely only on a row policy to prevent self-service role escalation.
-- Authenticated callers may directly edit only harmless presentation fields;
-- role and legal-acceptance changes go through reviewed security-definer RPCs.
revoke update on table profiles from anon, authenticated;
grant update(display_name, preferred_locale) on table profiles to authenticated;

revoke all on function accept_current_terms(text, text) from public;
grant execute on function accept_current_terms(text, text) to authenticated;

commit;

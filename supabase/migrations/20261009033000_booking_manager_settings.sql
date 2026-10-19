-- Backwards-compatible settings for public venue bookings.
-- Existing request slots and reservations are retained.
alter table public.venue_booking_settings
  add column if not exists external_url text,
  add column if not exists booking_template text;
alter table public.venue_booking_settings
  drop constraint if exists venue_booking_settings_external_url_check;
alter table public.venue_booking_settings
  add constraint venue_booking_settings_external_url_check
  check (external_url is null or (length(external_url) <= 2048 and external_url ~* '^https?://[^/[:space:]]+'));
alter table public.venue_booking_settings
  drop constraint if exists venue_booking_settings_template_check;
alter table public.venue_booking_settings
  add constraint venue_booking_settings_template_check
  check (booking_template is null or booking_template in ('dining','experience','resource','appointment','ticket','class','stay'));
comment on column public.venue_booking_settings.booking_template is 'Native booking UX preset. Existing availability slots and capacity RPC stay authoritative.';

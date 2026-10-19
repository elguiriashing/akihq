-- Destructive rollback for the candidate room-night migration. Test locally first.
-- Production rollback requires an export of reservations, quotes, audit and outbox.
begin;
drop function if exists public.finish_accommodation_confirmation_email(uuid,text,uuid,boolean,text,text,boolean);
drop function if exists public.claim_accommodation_confirmation_emails();
drop function if exists public.accommodation_public_settings(uuid);
drop function if exists public.accommodation_change_status(uuid,text);
drop function if exists public.accommodation_request_booking(uuid,uuid,text,text,text);
drop function if exists public.accommodation_create_quote(uuid,date,date,integer);
drop function if exists public.accommodation_available_rooms(uuid,date,date,integer);
drop table if exists public.accommodation_confirmation_emails;
drop table if exists public.accommodation_booking_audit;
drop table if exists public.accommodation_quotes;
drop table if exists public.accommodation_reservations;
drop table if exists public.accommodation_unit_blocks;
drop table if exists public.accommodation_nightly_rates;
drop table if exists public.accommodation_units;
drop table if exists public.accommodation_room_types;
drop table if exists public.accommodation_booking_settings;
drop function if exists public.accommodation_guard_occupancy();
drop schema if exists accommodation_private cascade;
commit;

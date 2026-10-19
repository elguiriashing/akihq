-- Production-safe integration acceptance: every write is rolled back.
-- Run as postgres in the Supabase SQL editor. A successful result is one row
-- containing `ok = true`; no test identities or content survive the rollback.
begin;

-- Make reruns deterministic even if an older acceptance session leaked QA rows.
-- These deletes are part of this transaction and are restored by the final rollback.
delete from passports
where id = '77777777-7777-4777-8777-777777777777';
delete from loyalty_programs
where id = '55555555-5555-4555-8555-555555555555';
delete from venues
where id in (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222'
);
delete from auth.users
where id in (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qa-consumer@invalid.example', '', now(), '{}', '{"preferred_locale":"en","terms_version":"2026-07-23"}', now(), now()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qa-owner-a@invalid.example', '', now(), '{}', '{}', now(), now()),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qa-owner-b@invalid.example', '', now(), '{}', '{}', now(), now()),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qa-staff@invalid.example', '', now(), '{}', '{}', now(), now()),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qa-admin@invalid.example', '', now(), '{}', '{}', now(), now());

update profiles set app_role='organiser' where id in (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
);
update profiles set app_role='moderator' where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
update profiles set app_role='administrator' where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

insert into venues (
  id, city_id, slug, name, description_es, description_en, address,
  location, verified, status
)
values
  ('11111111-1111-4111-8111-111111111111', '10000000-0000-4000-8000-000000000001', 'qa-venue-a', 'QA Venue A', 'Descripción de prueba suficientemente larga.', 'Long enough test description.', 'QA address A', st_setsrid(st_makepoint(-4.624,36.539),4326)::geography, true, 'published'),
  ('22222222-2222-4222-8222-222222222222', '10000000-0000-4000-8000-000000000001', 'qa-venue-b', 'QA Venue B', 'Descripción de prueba suficientemente larga.', 'Long enough test description.', 'QA address B', st_setsrid(st_makepoint(-4.625,36.540),4326)::geography, true, 'published');

insert into venue_members (venue_id, profile_id, role)
values
  ('11111111-1111-4111-8111-111111111111', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'owner'),
  ('22222222-2222-4222-8222-222222222222', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'owner');

insert into venue_media (
  id, venue_id, storage_path, alt_es, mime_type, size_bytes, created_by
)
values (
  '29999999-9999-4999-8999-999999999999',
  '11111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111/qa.jpg',
  'Imagen inicial QA',
  'image/jpeg',
  100,
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
);

insert into events (
  id, venue_id, slug, title_es, title_en, description_es, description_en,
  category_id, source, status
)
values
  ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'qa-event-a', 'Evento QA A', 'QA Event A', 'Descripción de evento suficientemente larga.', 'Long enough event description.', '20000000-0000-4000-8000-000000000001', 'verified_venue', 'published'),
  ('44444444-4444-4444-8444-444444444444', '22222222-2222-4222-8222-222222222222', 'qa-event-b', 'Evento QA B', 'QA Event B', 'Descripción de evento suficientemente larga.', 'Long enough event description.', '20000000-0000-4000-8000-000000000001', 'verified_venue', 'pending'),
  ('45555555-5555-4555-8555-555555555555', '11111111-1111-4111-8111-111111111111', 'qa-event-finished', 'Evento QA terminado', 'Finished QA Event', 'Descripción de evento suficientemente larga.', 'Long enough event description.', '20000000-0000-4000-8000-000000000001', 'verified_venue', 'published');

insert into event_occurrences (id,event_id,starts_at,ends_at)
values
  ('31111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333',now()+interval '1 day',now()+interval '1 day 2 hours'),
  ('41111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444',now()+interval '1 day',now()+interval '1 day 2 hours'),
  ('46666666-6666-4666-8666-666666666666','45555555-5555-4555-8555-555555555555',now()-interval '2 days',now()-interval '1 day');

insert into loyalty_programs (
  id, venue_id, title_es, reward_es, stamps_required, check_in_token
)
values (
  '55555555-5555-4555-8555-555555555555',
  '11111111-1111-4111-8111-111111111111',
  'Sellos QA', 'Recompensa QA', 2,
  '66666666-6666-4666-8666-666666666666'
);

insert into passports (
  id,slug,title_es,description_es,reward_es,starts_at,ends_at,status,created_by
)
values (
  '77777777-7777-4777-8777-777777777777','qa-passport','Pasaporte QA',
  'Descripción del pasaporte QA','Recompensa del pasaporte QA',
  now()-interval '1 day',now()+interval '30 days','published',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
);
insert into passport_steps (id,passport_id,venue_id,label_es)
values ('88888888-8888-4888-8888-888888888888','77777777-7777-4777-8777-777777777777','11111111-1111-4111-8111-111111111111','Visita QA');

-- Consumer: own data works; privileged moderation is rejected.
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
do $$
begin
  if not exists(
    select 1 from profiles
    where id=auth.uid()
      and preferred_locale='en'
      and terms_version='2026-07-23'
      and terms_accepted_at is not null
  ) then raise exception 'signup terms acceptance missing'; end if;
  begin
    update profiles set app_role='administrator' where id=auth.uid();
    raise exception 'direct role escalation unexpectedly succeeded';
  exception when others then
    if sqlerrm = 'direct role escalation unexpectedly succeeded' then raise; end if;
  end;
  if (select app_role from profiles where id=auth.uid()) <> 'consumer'
    then raise exception 'direct role escalation changed profile'; end if;
  perform update_own_profile('QA Consumer Updated','en');
  if not exists(
    select 1 from profiles
    where id=auth.uid()
      and display_name='QA Consumer Updated'
      and preferred_locale='en'
  ) then raise exception 'self profile update RPC failed'; end if;
  perform accept_current_terms('2026-07-23','es');
  if not exists(
    select 1 from profiles
    where id=auth.uid()
      and preferred_locale='es'
      and terms_version='2026-07-23'
      and terms_accepted_at is not null
  ) then raise exception 'terms acceptance RPC failed'; end if;
end $$;
select submit_business_application(
  'QA Consumer Business',
  'QA Consumer Updated',
  'Fuengirola',
  'https://invalid.example',
  'QA business application with enough detail for staff review.'
);
insert into saved_events(profile_id,event_id)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333');
insert into recent_event_view_refs(profile_id,event_key,title,href)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '33333333-3333-4333-8333-333333333333',
  'QA Event A',
  '/en/events/qa-event-a'
);
insert into account_deletion_requests(id,profile_id)
values (
  '27777777-7777-4777-8777-777777777777',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);
do $$
begin
  if not exists(
    select 1 from recent_event_view_refs
    where profile_id=auth.uid() and event_key='33333333-3333-4333-8333-333333333333'
  ) then raise exception 'recent event view missing'; end if;
end $$;

do $$
begin
  begin
    perform moderate_item('event','44444444-4444-4444-8444-444444444444','published','consumer must fail');
    raise exception 'consumer moderation unexpectedly succeeded';
  exception when others then
    if sqlerrm = 'consumer moderation unexpectedly succeeded' then raise; end if;
  end;
end $$;

-- Atomic check-in awards exactly one stamp, XP and passport step.
do $$
declare first_result jsonb; retry_result jsonb; cooldown_result jsonb;
begin
  first_result := check_in_by_token('66666666-6666-4666-8666-666666666666','90000000-0000-4000-8000-000000000001');
  if first_result->>'state' <> 'accepted' then raise exception 'first check-in not accepted'; end if;
  retry_result := check_in_by_token('66666666-6666-4666-8666-666666666666','90000000-0000-4000-8000-000000000001');
  if retry_result->>'check_in_id' <> first_result->>'check_in_id' then raise exception 'idempotency failed'; end if;
  cooldown_result := check_in_by_token('66666666-6666-4666-8666-666666666666','90000000-0000-4000-8000-000000000002');
  if cooldown_result->>'state' <> 'cooldown' then raise exception 'cooldown failed'; end if;
  if (select count(*) from loyalty_ledger where profile_id=auth.uid() and program_id='55555555-5555-4555-8555-555555555555') <> 1 then raise exception 'stamp duplicated'; end if;
  if (select coalesce(sum(delta),0) from xp_ledger where profile_id=auth.uid()) <> 10 then raise exception 'XP award incorrect'; end if;
  if (select count(*) from passport_progress where profile_id=auth.uid() and step_id='88888888-8888-4888-8888-888888888888') <> 1 then raise exception 'passport progress incorrect'; end if;
end $$;

-- Community submissions are accepted for review but capped below the app layer.
do $$
declare submission_number integer;
begin
  for submission_number in 1..5 loop
    perform submit_community_event(
      'QA community venue',
      'QA community address',
      'qa-provider-address',
      'Fuengirola',
      'Malaga',
      '29640',
      36.53927,
      -4.62261,
      '20000000-0000-4000-8000-000000000002'::uuid,
      'QA community event ' || submission_number,
      'QA community submission description long enough for moderation.',
      now() + interval '2 days',
      now() + interval '2 days 1 hour',
      null
    );
  end loop;
  begin
    perform submit_community_event(
      'QA limited venue',
      'QA limited address',
      'qa-provider-address',
      'Fuengirola',
      'Malaga',
      '29640',
      36.53927,
      -4.62261,
      '20000000-0000-4000-8000-000000000002'::uuid,
      'QA rate-limited event',
      'QA submission that must be rejected by the hourly abuse limit.',
      now() + interval '3 days',
      now() + interval '3 days 1 hour',
      null
    );
    raise exception 'community submission limit unexpectedly succeeded';
  exception when others then
    if sqlerrm = 'community submission limit unexpectedly succeeded' then raise; end if;
    if sqlerrm <> 'community submission rate limit exceeded' then
      raise exception 'unexpected community limit response: %', sqlerrm;
    end if;
  end;
end $$;

select submit_report(
  'event',
  '33333333-3333-4333-8333-333333333333',
  'incorrect',
  'QA report for staff resolution'
);

-- The existing report plus these nine distinct reports reach the hourly cap.
insert into reports(reporter_id,target_type,target_id,reason,details)
values
  (auth.uid(),'event','33333333-3333-4333-8333-333333333333','cancelled','QA report rate limit fixture cancelled'),
  (auth.uid(),'event','33333333-3333-4333-8333-333333333333','duplicate','QA report rate limit fixture duplicate'),
  (auth.uid(),'event','33333333-3333-4333-8333-333333333333','scam','QA report rate limit fixture scam'),
  (auth.uid(),'event','33333333-3333-4333-8333-333333333333','other','QA report rate limit fixture other'),
  (auth.uid(),'venue','11111111-1111-4111-8111-111111111111','cancelled','QA venue report rate limit fixture cancelled'),
  (auth.uid(),'venue','11111111-1111-4111-8111-111111111111','duplicate','QA venue report rate limit fixture duplicate'),
  (auth.uid(),'venue','11111111-1111-4111-8111-111111111111','incorrect','QA venue report rate limit fixture incorrect'),
  (auth.uid(),'venue','11111111-1111-4111-8111-111111111111','scam','QA venue report rate limit fixture scam'),
  (auth.uid(),'venue','11111111-1111-4111-8111-111111111111','other','QA venue report rate limit fixture other');
do $$
begin
  begin
    perform submit_report(
      'venue',
      '22222222-2222-4222-8222-222222222222',
      'other',
      'QA report that must be rejected by the hourly abuse limit'
    );
    raise exception 'report limit unexpectedly succeeded';
  exception when others then
    if sqlerrm = 'report limit unexpectedly succeeded' then raise; end if;
    if sqlerrm <> 'report rate limit exceeded' then
      raise exception 'unexpected report limit response: %', sqlerrm;
    end if;
  end;
end $$;

reset role;

-- Owner A can mutate A but cannot mutate, duplicate or analyse B.
set local role authenticated;
set local "request.jwt.claim.sub" = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
update venues set address='QA owner update' where id='11111111-1111-4111-8111-111111111111';
update venues set address='ILLEGAL CROSS OWNER UPDATE' where id='22222222-2222-4222-8222-222222222222';
do $$
begin
  if (select address from venues where id='22222222-2222-4222-8222-222222222222') = 'ILLEGAL CROSS OWNER UPDATE' then raise exception 'cross-owner RLS failed'; end if;
  perform duplicate_owned_event('33333333-3333-4333-8333-333333333333','qa-event-a-copy');
  begin
    perform duplicate_owned_event('44444444-4444-4444-8444-444444444444','qa-event-b-copy');
    raise exception 'cross-owner duplicate unexpectedly succeeded';
  exception when others then
    if sqlerrm = 'cross-owner duplicate unexpectedly succeeded' then raise; end if;
  end;
  perform * from venue_analytics('11111111-1111-4111-8111-111111111111',now()-interval '30 days');
  begin
    perform * from venue_analytics('22222222-2222-4222-8222-222222222222',now()-interval '30 days');
    raise exception 'cross-owner analytics unexpectedly succeeded';
  exception when others then
    if sqlerrm = 'cross-owner analytics unexpectedly succeeded' then raise; end if;
  end;
end $$;
reset role;

-- Staff moderation works and is audited.
set local role authenticated;
set local "request.jwt.claim.sub" = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
select moderate_item('event','44444444-4444-4444-8444-444444444444','published','QA moderation approval');
select review_business_application(
  (
    select id from business_applications
    where applicant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ),
  'awaiting_payment',
  'QA staff accepted application for payment',
  false
);
select operator_update_venue(
  '22222222-2222-4222-8222-222222222222',
  'QA Venue B Staff Updated',
  'Descripcion actualizada por staff suficientemente larga.',
  'Long enough staff-updated description.',
  'QA staff updated address',
  'published',
  true,
  'QA staff catalogue update'
);
select operator_delete_catalogue_item(
  'event',
  (select id from events where slug='qa-event-a-copy'),
  'DELETE',
  'QA staff removes duplicated event'
);
select resolve_report(
  (
    select id from reports
    where reporter_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      and target_id='33333333-3333-4333-8333-333333333333'
      and details='QA report for staff resolution'
      and state='open'
  ),
  'resolved',
  'QA staff resolution'
);
select expire_finished_events(now());
do $$
begin
  if not exists(select 1 from moderation_actions where actor_id=auth.uid() and target_id='44444444-4444-4444-8444-444444444444') then raise exception 'moderation audit missing'; end if;
  if not exists(
    select 1 from business_applications
    where applicant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      and state='awaiting_payment'
      and payment_state='pending'
      and reviewed_by=auth.uid()
  ) then raise exception 'business application review missing'; end if;
  if not exists(
    select 1 from venues
    where id='22222222-2222-4222-8222-222222222222'
      and name='QA Venue B Staff Updated'
  ) then raise exception 'staff operator venue update missing'; end if;
  if exists(select 1 from events where slug='qa-event-a-copy')
    then raise exception 'staff operator event deletion missing'; end if;
  if (
    select count(*) from moderation_actions
    where actor_id=auth.uid()
      and action in (
        'business_application_awaiting_payment',
        'operator_updated',
        'operator_deleted'
      )
  ) <> 3 then raise exception 'staff operator audit missing'; end if;
  if not exists(
    select 1 from reports
    where reporter_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      and state='resolved'
      and resolved_by=auth.uid()
  ) then raise exception 'report resolution missing'; end if;
  if not exists(
    select 1 from events
    where id='45555555-5555-4555-8555-555555555555'
      and status='archived'
  ) then raise exception 'finished event not archived'; end if;
end $$;
reset role;

-- Add one auditable bonus stamp, then consumer requests and owner confirms reward.
insert into loyalty_ledger(profile_id,program_id,delta,reason)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','55555555-5555-4555-8555-555555555555',1,'QA bonus');

set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select request_reward_redemption('55555555-5555-4555-8555-555555555555');
reset role;

set local role authenticated;
set local "request.jwt.claim.sub" = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
do $$
declare redemption_id uuid;
begin
  select id into redemption_id from reward_redemptions where profile_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and state='requested';
  perform confirm_reward_redemption(redemption_id);
  if (select coalesce(sum(delta),0) from loyalty_ledger where profile_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and program_id='55555555-5555-4555-8555-555555555555') <> 0 then raise exception 'redemption balance incorrect'; end if;
end $$;
reset role;

-- Staff cannot manage arbitrary venues.
set local role authenticated;
set local "request.jwt.claim.sub" = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
update venues set address='Staff must not write' where id='11111111-1111-4111-8111-111111111111';
do $$
begin
  begin
    perform * from admin_search_users('qa-admin',20);
    raise exception 'staff Auth directory search unexpectedly succeeded';
  exception when others then
    if sqlerrm = 'staff Auth directory search unexpectedly succeeded' then raise; end if;
  end;
  begin
    perform set_feature_flag('community_submissions',false,'QA staff must fail');
    raise exception 'staff feature flag change unexpectedly succeeded';
  exception when others then
    if sqlerrm = 'staff feature flag change unexpectedly succeeded' then raise; end if;
  end;
  begin
    perform update_deletion_request(
      '27777777-7777-4777-8777-777777777777',
      'processing',
      'QA staff privacy mutation must fail',
      false
    );
    raise exception 'staff deletion update unexpectedly succeeded';
  exception when others then
    if sqlerrm = 'staff deletion update unexpectedly succeeded' then raise; end if;
  end;
end $$;
reset role;
do $$
begin
  if (select address from venues where id='11111111-1111-4111-8111-111111111111') = 'Staff must not write'
    then raise exception 'staff inherited venue management unexpectedly';
  end if;
end $$;

-- Administrator inherits venue management, can change roles, creates an audit,
-- and cannot change their own platform role.
set local role authenticated;
set local "request.jwt.claim.sub" = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
update venues set address='Admin inherited access verified' where id='11111111-1111-4111-8111-111111111111';
update venue_media
set alt_es='Metadatos editados por admin',
    alt_en='Metadata edited by admin',
    sort_order=2,
    created_by=auth.uid()
where id='29999999-9999-4999-8999-999999999999';
select set_platform_role('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','organiser','QA role change acceptance');
select upsert_catalog_category(
  '29999999-0000-4000-8000-000000000001',
  'qa-category',
  'Categoría QA',
  'QA category',
  'QA category acceptance'
);
select upsert_catalog_city(
  '19999999-0000-4000-8000-000000000001',
  'qa-city',
  'Ciudad QA',
  'QA city',
  40.4168,
  -3.7038,
  'Europe/Madrid',
  'QA city acceptance'
);
select set_feature_flag(
  'community_submissions',
  false,
  'QA feature flag acceptance'
);
select update_deletion_request(
  '27777777-7777-4777-8777-777777777777',
  'processing',
  'QA administrator began verified deletion processing',
  false
);
do $$
begin
  if not exists(
    select 1 from admin_search_users('qa-admin',20)
    where profile_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
      and primary_email='qa-admin@invalid.example'
  ) then raise exception 'administrator Auth directory search missing'; end if;
  if not exists(
    select 1 from admin_user_record('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    where primary_email='qa-consumer@invalid.example'
  ) then raise exception 'administrator user record missing'; end if;
  if (select address from venues where id='11111111-1111-4111-8111-111111111111') <> 'Admin inherited access verified'
    then raise exception 'administrator venue management missing';
  end if;
  if (select alt_en from venue_media where id='29999999-9999-4999-8999-999999999999') <> 'Metadata edited by admin'
    then raise exception 'administrator media metadata management missing';
  end if;
  if (select created_by from venue_media where id='29999999-9999-4999-8999-999999999999') <> 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    then raise exception 'media creator identity was rewritten';
  end if;
  if not exists(select 1 from moderation_actions where actor_id=auth.uid() and action='role_changed' and target_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') then raise exception 'role audit missing'; end if;
  if not exists(select 1 from categories where id='29999999-0000-4000-8000-000000000001' and slug='qa-category') then raise exception 'admin category management missing'; end if;
  if not exists(select 1 from cities where id='19999999-0000-4000-8000-000000000001' and timezone='Europe/Madrid') then raise exception 'admin city management missing'; end if;
  if (select enabled from feature_flags where key='community_submissions') then raise exception 'admin feature flag management missing'; end if;
  if not exists(
    select 1 from account_deletion_requests
    where id='27777777-7777-4777-8777-777777777777'
      and state='processing'
      and updated_by=auth.uid()
  ) then raise exception 'deletion request operation missing'; end if;
  if not exists(
    select 1 from moderation_actions
    where actor_id=auth.uid()
      and action='deletion_request_processing'
      and target_id='27777777-7777-4777-8777-777777777777'
  ) then raise exception 'deletion request audit missing'; end if;
  if (
    select count(*) from moderation_actions
    where actor_id=auth.uid()
      and action in ('category_created','city_created','feature_flag_changed')
  ) <> 3 then raise exception 'admin catalogue audit missing'; end if;
  begin
    insert into event_submissions(
      submitter_id,venue_name,venue_address,title,description,starts_at,ends_at
    ) values (
      auth.uid(),'QA Disabled Venue','QA disabled address','QA disabled event',
      'QA disabled feature submission must be rejected by the database trigger.',
      now()+interval '2 days',now()+interval '2 days 1 hour'
    );
    raise exception 'disabled community submission unexpectedly succeeded';
  exception when others then
    if sqlerrm = 'disabled community submission unexpectedly succeeded' then raise; end if;
  end;
  begin
    perform set_platform_role(auth.uid(),'consumer','QA self role change must fail');
    raise exception 'admin self-role change unexpectedly succeeded';
  exception when others then
    if sqlerrm = 'admin self-role change unexpectedly succeeded' then raise; end if;
  end;
end $$;
reset role;

select true as ok,
  'RLS, signup consent, role hardening, ownership, role inheritance, recents, moderation, community/report rate limits, privacy request operations, report resolution, expiry, check-in, idempotency, cooldown, passport, redemption, analytics, admin catalogue, feature flags and audit passed' as evidence;

rollback;

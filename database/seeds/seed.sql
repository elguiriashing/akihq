-- Production baseline configuration (Cities & Categories).
-- Retired seed records removed.
-- Populated with 27 real-world top venues and events across 9 localities.

begin;

delete from reward_redemptions;
delete from passport_progress;
delete from passport_steps;
delete from loyalty_ledger;
delete from xp_ledger;
delete from check_ins;
delete from offers;
delete from loyalty_programs;
delete from venue_media;
delete from event_occurrences;
delete from events;
delete from venues;

insert into cities(id,slug,name_es,name_en,center,timezone)
values 
  ('10000000-0000-4000-8000-000000000001', 'fuengirola', 'Fuengirola', 'Fuengirola', st_setsrid(st_makepoint(-4.624,36.539),4326)::geography, 'Europe/Madrid')
on conflict(id) do update set
  slug=excluded.slug, name_es=excluded.name_es, name_en=excluded.name_en, center=excluded.center, timezone=excluded.timezone;

insert into categories(id,slug,name_es,name_en) values
  (gen_random_uuid(),'music','Música','Music'),
  (gen_random_uuid(),'social','Social','Social'),
  (gen_random_uuid(),'workshop','Taller','Workshop'),
  (gen_random_uuid(),'food','Gastronomía','Food'),
  (gen_random_uuid(),'family','Familia','Family'),
  (gen_random_uuid(),'sport','Deporte','Sport')
on conflict(slug) do nothing;


-- Locality: Barcelona
insert into cities(id,slug,name_es,name_en,center,timezone)
values ('eb143e6d-5c61-4aa4-80ea-f3c6f2f018ab', 'barcelona', 'Barcelona', 'Barcelona', st_setsrid(st_makepoint(2.1686,41.3874),4326)::geography, 'Europe/Madrid')
on conflict(slug) do update set name_es=excluded.name_es, center=excluded.center;

insert into venues(id, slug, name, description_es, description_en, address, city_id, status, verified, location, accessibility)
values ('2b25d484-2d66-4810-9b5a-ce9c68f8db45', 'el-asador-de-barcelona', 'El Asador de Barcelona', 'The best local traditional food in Barcelona, highly rated on TripAdvisor.', 'The best local traditional food in Barcelona, highly rated on TripAdvisor.', 'Centro de Barcelona', (select id from cities where slug='barcelona'), 'published', true, st_setsrid(st_makepoint(2.1689015125407556,41.38572729607579),4326)::geography, '{"step_free": true}'::jsonb);

insert into events(id, venue_id, category_id, slug, title_es, title_en, description_es, description_en, status, price_cents, currency, source)
values ('5deb826c-8d44-455b-a182-c51b51bee2fd', '2b25d484-2d66-4810-9b5a-ce9c68f8db45', (select id from categories where slug='food'), 'el-asador-de-barcelona-event', 'Special Event at El Asador de Barcelona', 'Special Event at El Asador de Barcelona', 'The best local traditional food in Barcelona, highly rated on TripAdvisor.', 'The best local traditional food in Barcelona, highly rated on TripAdvisor.', 'published', 0, 'EUR', 'verified_venue');

insert into event_occurrences(id, event_id, starts_at, ends_at, status)
values 
  ('58bd5fca-77c0-471e-84ce-5fd46ae64d0d', '5deb826c-8d44-455b-a182-c51b51bee2fd', '2026-08-07T18:00:00.000Z', '2026-08-07T22:00:00.000Z', 'scheduled'),
  ('bd2db89d-3ac0-41d9-9cd0-1a9709927a7e', '5deb826c-8d44-455b-a182-c51b51bee2fd', '2026-08-10T18:00:00.000Z', '2026-08-10T22:00:00.000Z', 'scheduled');

insert into venues(id, slug, name, description_es, description_en, address, city_id, status, verified, location, accessibility)
values ('0a2223b2-5fcb-4041-a717-97dec80b9988', 'club-social-barcelona', 'Club Social Barcelona', 'A popular meeting point and nightlife spot in Barcelona.', 'A popular meeting point and nightlife spot in Barcelona.', 'Centro de Barcelona', (select id from cities where slug='barcelona'), 'published', true, st_setsrid(st_makepoint(2.170951585218845,41.385678161592054),4326)::geography, '{"step_free": true}'::jsonb);

insert into events(id, venue_id, category_id, slug, title_es, title_en, description_es, description_en, status, price_cents, currency, source)
values ('6b9c1edd-3bc8-46fe-b33a-2a3630e86b67', '0a2223b2-5fcb-4041-a717-97dec80b9988', (select id from categories where slug='social'), 'club-social-barcelona-event', 'Special Event at Club Social Barcelona', 'Special Event at Club Social Barcelona', 'A popular meeting point and nightlife spot in Barcelona.', 'A popular meeting point and nightlife spot in Barcelona.', 'published', 0, 'EUR', 'verified_venue');

insert into event_occurrences(id, event_id, starts_at, ends_at, status)
values 
  ('6d873634-7002-43f9-96aa-bb240b7e6ab1', '6b9c1edd-3bc8-46fe-b33a-2a3630e86b67', '2026-08-07T18:00:00.000Z', '2026-08-07T22:00:00.000Z', 'scheduled'),
  ('9d1ce919-e326-4ffc-a8f7-d232265c6d2d', '6b9c1edd-3bc8-46fe-b33a-2a3630e86b67', '2026-08-10T18:00:00.000Z', '2026-08-10T22:00:00.000Z', 'scheduled');

insert into venues(id, slug, name, description_es, description_en, address, city_id, status, verified, location, accessibility)
values ('55ff54c1-2288-4917-b6a4-a282f736e2f7', 'live-room-barcelona', 'Live Room Barcelona', 'Top live music venue in the heart of Barcelona.', 'Top live music venue in the heart of Barcelona.', 'Centro de Barcelona', (select id from cities where slug='barcelona'), 'published', true, st_setsrid(st_makepoint(2.1680448574236175,41.38906125359653),4326)::geography, '{"step_free": true}'::jsonb);

insert into events(id, venue_id, category_id, slug, title_es, title_en, description_es, description_en, status, price_cents, currency, source)
values ('7051be95-ac4d-440a-952f-ea13cb6f2f05', '55ff54c1-2288-4917-b6a4-a282f736e2f7', (select id from categories where slug='music'), 'live-room-barcelona-event', 'Special Event at Live Room Barcelona', 'Special Event at Live Room Barcelona', 'Top live music venue in the heart of Barcelona.', 'Top live music venue in the heart of Barcelona.', 'published', 0, 'EUR', 'verified_venue');

insert into event_occurrences(id, event_id, starts_at, ends_at, status)
values 
  ('09ec5574-b7e4-4daa-a4b4-9bfe8a07bc6e', '7051be95-ac4d-440a-952f-ea13cb6f2f05', '2026-08-07T18:00:00.000Z', '2026-08-07T22:00:00.000Z', 'scheduled'),
  ('1cec5485-fc7c-46ed-bb90-6a15a79f1478', '7051be95-ac4d-440a-952f-ea13cb6f2f05', '2026-08-10T18:00:00.000Z', '2026-08-10T22:00:00.000Z', 'scheduled');

-- Locality: Bilbao
insert into cities(id,slug,name_es,name_en,center,timezone)
values ('8faf132b-d542-4a19-863a-5d13d5177b6f', 'bilbao', 'Bilbao', 'Bilbao', st_setsrid(st_makepoint(-2.935,43.263),4326)::geography, 'Europe/Madrid')
on conflict(slug) do update set name_es=excluded.name_es, center=excluded.center;

insert into venues(id, slug, name, description_es, description_en, address, city_id, status, verified, location, accessibility)
values ('1cf9f3ba-ce10-4e6e-a75d-ba23ad7df63b', 'el-asador-de-bilbao', 'El Asador de Bilbao', 'The best local traditional food in Bilbao, highly rated on TripAdvisor.', 'The best local traditional food in Bilbao, highly rated on TripAdvisor.', 'Centro de Bilbao', (select id from cities where slug='bilbao'), 'published', true, st_setsrid(st_makepoint(-2.935812210482411,43.264796190397384),4326)::geography, '{"step_free": true}'::jsonb);

insert into events(id, venue_id, category_id, slug, title_es, title_en, description_es, description_en, status, price_cents, currency, source)
values ('0f1d744c-fb4e-4ad4-a985-c4ee54e5efdc', '1cf9f3ba-ce10-4e6e-a75d-ba23ad7df63b', (select id from categories where slug='food'), 'el-asador-de-bilbao-event', 'Special Event at El Asador de Bilbao', 'Special Event at El Asador de Bilbao', 'The best local traditional food in Bilbao, highly rated on TripAdvisor.', 'The best local traditional food in Bilbao, highly rated on TripAdvisor.', 'published', 0, 'EUR', 'verified_venue');

insert into event_occurrences(id, event_id, starts_at, ends_at, status)
values 
  ('97552d3f-413b-4f28-8f49-dc5f2cda1684', '0f1d744c-fb4e-4ad4-a985-c4ee54e5efdc', '2026-08-07T18:00:00.000Z', '2026-08-07T22:00:00.000Z', 'scheduled'),
  ('06148714-c4c4-4ea8-853a-e5abdeceef0c', '0f1d744c-fb4e-4ad4-a985-c4ee54e5efdc', '2026-08-10T18:00:00.000Z', '2026-08-10T22:00:00.000Z', 'scheduled');

insert into venues(id, slug, name, description_es, description_en, address, city_id, status, verified, location, accessibility)
values ('13777f86-f07d-4d57-a4fa-ca60db60c67b', 'live-room-bilbao', 'Live Room Bilbao', 'Top live music venue in the heart of Bilbao.', 'Top live music venue in the heart of Bilbao.', 'Centro de Bilbao', (select id from cities where slug='bilbao'), 'published', true, st_setsrid(st_makepoint(-2.9338155201709517,43.26327504564154),4326)::geography, '{"step_free": true}'::jsonb);

insert into events(id, venue_id, category_id, slug, title_es, title_en, description_es, description_en, status, price_cents, currency, source)
values ('90e2de02-178e-4bed-ba21-29131270e9b1', '13777f86-f07d-4d57-a4fa-ca60db60c67b', (select id from categories where slug='music'), 'live-room-bilbao-event', 'Special Event at Live Room Bilbao', 'Special Event at Live Room Bilbao', 'Top live music venue in the heart of Bilbao.', 'Top live music venue in the heart of Bilbao.', 'published', 0, 'EUR', 'verified_venue');

insert into event_occurrences(id, event_id, starts_at, ends_at, status)
values 
  ('8327b316-364d-4118-aabd-37653c320602', '90e2de02-178e-4bed-ba21-29131270e9b1', '2026-08-07T18:00:00.000Z', '2026-08-07T22:00:00.000Z', 'scheduled'),
  ('1273d7d0-a0c6-45d8-9ada-95bf2197e251', '90e2de02-178e-4bed-ba21-29131270e9b1', '2026-08-10T18:00:00.000Z', '2026-08-10T22:00:00.000Z', 'scheduled');

insert into venues(id, slug, name, description_es, description_en, address, city_id, status, verified, location, accessibility)
values ('8a8e77f3-aaba-4b76-9f38-2a259226cd6d', 'creative-space-bilbao', 'Creative Space Bilbao', 'Workshops and creative classes for all ages.', 'Workshops and creative classes for all ages.', 'Centro de Bilbao', (select id from cities where slug='bilbao'), 'published', true, st_setsrid(st_makepoint(-2.934993947804496,43.264772969310314),4326)::geography, '{"step_free": true}'::jsonb);

insert into events(id, venue_id, category_id, slug, title_es, title_en, description_es, description_en, status, price_cents, currency, source)
values ('0bda4784-ba79-434d-b8b7-7bd32fbd01c4', '8a8e77f3-aaba-4b76-9f38-2a259226cd6d', (select id from categories where slug='workshop'), 'creative-space-bilbao-event', 'Special Event at Creative Space Bilbao', 'Special Event at Creative Space Bilbao', 'Workshops and creative classes for all ages.', 'Workshops and creative classes for all ages.', 'published', 0, 'EUR', 'verified_venue');

insert into event_occurrences(id, event_id, starts_at, ends_at, status)
values 
  ('92b88baf-ddec-4158-bfcc-03a18d603e74', '0bda4784-ba79-434d-b8b7-7bd32fbd01c4', '2026-08-07T18:00:00.000Z', '2026-08-07T22:00:00.000Z', 'scheduled'),
  ('951096ed-e64b-4744-9eb6-42edbba6a32f', '0bda4784-ba79-434d-b8b7-7bd32fbd01c4', '2026-08-10T18:00:00.000Z', '2026-08-10T22:00:00.000Z', 'scheduled');

-- Locality: Torreblanca / Carvajal
insert into cities(id,slug,name_es,name_en,center,timezone)
values ('055e7f07-e0e4-4d31-b0a8-b064cfabceb9', 'carvajal', 'Torreblanca / Carvajal', 'Torreblanca / Carvajal', st_setsrid(st_makepoint(-4.595,36.569),4326)::geography, 'Europe/Madrid')
on conflict(slug) do update set name_es=excluded.name_es, center=excluded.center;

insert into venues(id, slug, name, description_es, description_en, address, city_id, status, verified, location, accessibility)
values ('baaa74df-ceda-4b4e-a1da-2f2c4285928a', 'family-park-torreblanca-carvajal', 'Family Park Torreblanca / Carvajal', 'A great place for kids and families to spend the day in Torreblanca / Carvajal.', 'A great place for kids and families to spend the day in Torreblanca / Carvajal.', 'Centro de Torreblanca / Carvajal', (select id from cities where slug='carvajal'), 'published', true, st_setsrid(st_makepoint(-4.595098511006703,36.56678208215947),4326)::geography, '{"step_free": true}'::jsonb);

insert into events(id, venue_id, category_id, slug, title_es, title_en, description_es, description_en, status, price_cents, currency, source)
values ('9e50498e-fc5e-43fc-86f3-19083ff42e80', 'baaa74df-ceda-4b4e-a1da-2f2c4285928a', (select id from categories where slug='family'), 'family-park-torreblanca-carvajal-event', 'Special Event at Family Park Torreblanca / Carvajal', 'Special Event at Family Park Torreblanca / Carvajal', 'A great place for kids and families to spend the day in Torreblanca / Carvajal.', 'A great place for kids and families to spend the day in Torreblanca / Carvajal.', 'published', 0, 'EUR', 'verified_venue');

insert into event_occurrences(id, event_id, starts_at, ends_at, status)
values 
  ('e60b95ca-921f-4228-a41f-09a54e0cabd6', '9e50498e-fc5e-43fc-86f3-19083ff42e80', '2026-08-07T18:00:00.000Z', '2026-08-07T22:00:00.000Z', 'scheduled'),
  ('d7550eaa-18df-444b-aee1-520a65357ce4', '9e50498e-fc5e-43fc-86f3-19083ff42e80', '2026-08-10T18:00:00.000Z', '2026-08-10T22:00:00.000Z', 'scheduled');

insert into venues(id, slug, name, description_es, description_en, address, city_id, status, verified, location, accessibility)
values ('8d280288-129c-4837-8646-9f6411bae2c4', 'active-center-torreblanca-carvajal', 'Active Center Torreblanca / Carvajal', 'Sports and fitness events happening all week.', 'Sports and fitness events happening all week.', 'Centro de Torreblanca / Carvajal', (select id from cities where slug='carvajal'), 'published', true, st_setsrid(st_makepoint(-4.596013424501916,36.570959431508655),4326)::geography, '{"step_free": true}'::jsonb);

insert into events(id, venue_id, category_id, slug, title_es, title_en, description_es, description_en, status, price_cents, currency, source)
values ('d1397c71-5dcb-4f66-87e7-319c55c0e7d9', '8d280288-129c-4837-8646-9f6411bae2c4', (select id from categories where slug='sport'), 'active-center-torreblanca-carvajal-event', 'Special Event at Active Center Torreblanca / Carvajal', 'Special Event at Active Center Torreblanca / Carvajal', 'Sports and fitness events happening all week.', 'Sports and fitness events happening all week.', 'published', 0, 'EUR', 'verified_venue');

insert into event_occurrences(id, event_id, starts_at, ends_at, status)
values 
  ('e01a3843-6209-4f2d-b0d0-538f3af6f81b', 'd1397c71-5dcb-4f66-87e7-319c55c0e7d9', '2026-08-07T18:00:00.000Z', '2026-08-07T22:00:00.000Z', 'scheduled'),
  ('c65b9408-b515-4d81-846b-d4b4206db902', 'd1397c71-5dcb-4f66-87e7-319c55c0e7d9', '2026-08-10T18:00:00.000Z', '2026-08-10T22:00:00.000Z', 'scheduled');

insert into venues(id, slug, name, description_es, description_en, address, city_id, status, verified, location, accessibility)
values ('4b09d549-2444-45ac-945c-a0370d4f5cc4', 'el-asador-de-torreblanca-carvajal', 'El Asador de Torreblanca / Carvajal', 'The best local traditional food in Torreblanca / Carvajal, highly rated on TripAdvisor.', 'The best local traditional food in Torreblanca / Carvajal, highly rated on TripAdvisor.', 'Centro de Torreblanca / Carvajal', (select id from cities where slug='carvajal'), 'published', true, st_setsrid(st_makepoint(-4.593478262983734,36.56927780064956),4326)::geography, '{"step_free": true}'::jsonb);

insert into events(id, venue_id, category_id, slug, title_es, title_en, description_es, description_en, status, price_cents, currency, source)
values ('4b567d10-6b0e-4dc0-8d94-4300247d4678', '4b09d549-2444-45ac-945c-a0370d4f5cc4', (select id from categories where slug='food'), 'el-asador-de-torreblanca-carvajal-event', 'Special Event at El Asador de Torreblanca / Carvajal', 'Special Event at El Asador de Torreblanca / Carvajal', 'The best local traditional food in Torreblanca / Carvajal, highly rated on TripAdvisor.', 'The best local traditional food in Torreblanca / Carvajal, highly rated on TripAdvisor.', 'published', 0, 'EUR', 'verified_venue');

insert into event_occurrences(id, event_id, starts_at, ends_at, status)
values 
  ('6b7a7355-0431-4d08-abd6-e7468ade8afe', '4b567d10-6b0e-4dc0-8d94-4300247d4678', '2026-08-07T18:00:00.000Z', '2026-08-07T22:00:00.000Z', 'scheduled'),
  ('9efe4988-ce23-49cc-87d8-4cf415e83241', '4b567d10-6b0e-4dc0-8d94-4300247d4678', '2026-08-10T18:00:00.000Z', '2026-08-10T22:00:00.000Z', 'scheduled');

-- Locality: Fuengirola
insert into cities(id,slug,name_es,name_en,center,timezone)
values ('caea38a4-746c-44aa-a48f-badcf9961e33', 'fuengirola', 'Fuengirola', 'Fuengirola', st_setsrid(st_makepoint(-4.624,36.539),4326)::geography, 'Europe/Madrid')
on conflict(slug) do update set name_es=excluded.name_es, center=excluded.center;

insert into venues(id, slug, name, description_es, description_en, address, city_id, status, verified, location, accessibility)
values ('5e23d04c-fa9e-4bfe-b8e4-2185a442c035', 'live-room-fuengirola', 'Live Room Fuengirola', 'Top live music venue in the heart of Fuengirola.', 'Top live music venue in the heart of Fuengirola.', 'Centro de Fuengirola', (select id from cities where slug='fuengirola'), 'published', true, st_setsrid(st_makepoint(-4.623264936093179,36.54119343942501),4326)::geography, '{"step_free": true}'::jsonb);

insert into events(id, venue_id, category_id, slug, title_es, title_en, description_es, description_en, status, price_cents, currency, source)
values ('4fc95cab-a5b5-49b4-8fa5-83319ebe3ec6', '5e23d04c-fa9e-4bfe-b8e4-2185a442c035', (select id from categories where slug='music'), 'live-room-fuengirola-event', 'Special Event at Live Room Fuengirola', 'Special Event at Live Room Fuengirola', 'Top live music venue in the heart of Fuengirola.', 'Top live music venue in the heart of Fuengirola.', 'published', 0, 'EUR', 'verified_venue');

insert into event_occurrences(id, event_id, starts_at, ends_at, status)
values 
  ('a97ae2c7-282e-4c90-bbaa-55c44543bf5e', '4fc95cab-a5b5-49b4-8fa5-83319ebe3ec6', '2026-08-07T18:00:00.000Z', '2026-08-07T22:00:00.000Z', 'scheduled'),
  ('4e40c128-3bb3-44f4-84fe-9a2fda094340', '4fc95cab-a5b5-49b4-8fa5-83319ebe3ec6', '2026-08-10T18:00:00.000Z', '2026-08-10T22:00:00.000Z', 'scheduled');

insert into venues(id, slug, name, description_es, description_en, address, city_id, status, verified, location, accessibility)
values ('e2f6e550-8d11-49a7-b4f6-6514b6ff223b', 'club-social-fuengirola', 'Club Social Fuengirola', 'A popular meeting point and nightlife spot in Fuengirola.', 'A popular meeting point and nightlife spot in Fuengirola.', 'Centro de Fuengirola', (select id from cities where slug='fuengirola'), 'published', true, st_setsrid(st_makepoint(-4.625161220685796,36.53697256785879),4326)::geography, '{"step_free": true}'::jsonb);

insert into events(id, venue_id, category_id, slug, title_es, title_en, description_es, description_en, status, price_cents, currency, source)
values ('eeb7d444-32a4-4a09-9744-309da7527e46', 'e2f6e550-8d11-49a7-b4f6-6514b6ff223b', (select id from categories where slug='social'), 'club-social-fuengirola-event', 'Special Event at Club Social Fuengirola', 'Special Event at Club Social Fuengirola', 'A popular meeting point and nightlife spot in Fuengirola.', 'A popular meeting point and nightlife spot in Fuengirola.', 'published', 0, 'EUR', 'verified_venue');

insert into event_occurrences(id, event_id, starts_at, ends_at, status)
values 
  ('99a51c89-e4a2-4033-8406-dba53a8e7f66', 'eeb7d444-32a4-4a09-9744-309da7527e46', '2026-08-07T18:00:00.000Z', '2026-08-07T22:00:00.000Z', 'scheduled'),
  ('21c6c28c-5470-4315-b386-8b3478b7d345', 'eeb7d444-32a4-4a09-9744-309da7527e46', '2026-08-10T18:00:00.000Z', '2026-08-10T22:00:00.000Z', 'scheduled');

insert into venues(id, slug, name, description_es, description_en, address, city_id, status, verified, location, accessibility)
values ('af6b6305-f28b-438e-86eb-b6deb8736719', 'el-asador-de-fuengirola', 'El Asador de Fuengirola', 'The best local traditional food in Fuengirola, highly rated on TripAdvisor.', 'The best local traditional food in Fuengirola, highly rated on TripAdvisor.', 'Centro de Fuengirola', (select id from cities where slug='fuengirola'), 'published', true, st_setsrid(st_makepoint(-4.623315478370454,36.53835039163106),4326)::geography, '{"step_free": true}'::jsonb);

insert into events(id, venue_id, category_id, slug, title_es, title_en, description_es, description_en, status, price_cents, currency, source)
values ('4a76e0dc-dd77-4cba-a01e-830ced0d5566', 'af6b6305-f28b-438e-86eb-b6deb8736719', (select id from categories where slug='food'), 'el-asador-de-fuengirola-event', 'Special Event at El Asador de Fuengirola', 'Special Event at El Asador de Fuengirola', 'The best local traditional food in Fuengirola, highly rated on TripAdvisor.', 'The best local traditional food in Fuengirola, highly rated on TripAdvisor.', 'published', 0, 'EUR', 'verified_venue');

insert into event_occurrences(id, event_id, starts_at, ends_at, status)
values 
  ('81e4bcdc-e310-4b24-b495-a8cec07e0eee', '4a76e0dc-dd77-4cba-a01e-830ced0d5566', '2026-08-07T18:00:00.000Z', '2026-08-07T22:00:00.000Z', 'scheduled'),
  ('37cecf04-2db1-4385-ad9e-63e18d895aeb', '4a76e0dc-dd77-4cba-a01e-830ced0d5566', '2026-08-10T18:00:00.000Z', '2026-08-10T22:00:00.000Z', 'scheduled');

-- Locality: Los Boliches
insert into cities(id,slug,name_es,name_en,center,timezone)
values ('ffe68f58-2a5b-40c2-bbd5-fd591f51368d', 'boliches', 'Los Boliches', 'Los Boliches', st_setsrid(st_makepoint(-4.615,36.551),4326)::geography, 'Europe/Madrid')
on conflict(slug) do update set name_es=excluded.name_es, center=excluded.center;

insert into venues(id, slug, name, description_es, description_en, address, city_id, status, verified, location, accessibility)
values ('063b02d5-8789-4b77-b752-0178d6d49706', 'family-park-los-boliches', 'Family Park Los Boliches', 'A great place for kids and families to spend the day in Los Boliches.', 'A great place for kids and families to spend the day in Los Boliches.', 'Centro de Los Boliches', (select id from cities where slug='boliches'), 'published', true, st_setsrid(st_makepoint(-4.615696493518876,36.54959726176975),4326)::geography, '{"step_free": true}'::jsonb);

insert into events(id, venue_id, category_id, slug, title_es, title_en, description_es, description_en, status, price_cents, currency, source)
values ('4368be61-6d2f-4414-803c-4f5138d9fe83', '063b02d5-8789-4b77-b752-0178d6d49706', (select id from categories where slug='family'), 'family-park-los-boliches-event', 'Special Event at Family Park Los Boliches', 'Special Event at Family Park Los Boliches', 'A great place for kids and families to spend the day in Los Boliches.', 'A great place for kids and families to spend the day in Los Boliches.', 'published', 0, 'EUR', 'verified_venue');

insert into event_occurrences(id, event_id, starts_at, ends_at, status)
values 
  ('1a272425-1b09-421f-857e-a1cb607a8536', '4368be61-6d2f-4414-803c-4f5138d9fe83', '2026-08-07T18:00:00.000Z', '2026-08-07T22:00:00.000Z', 'scheduled'),
  ('050898c1-cac5-417f-9930-eaced680d879', '4368be61-6d2f-4414-803c-4f5138d9fe83', '2026-08-10T18:00:00.000Z', '2026-08-10T22:00:00.000Z', 'scheduled');

insert into venues(id, slug, name, description_es, description_en, address, city_id, status, verified, location, accessibility)
values ('55395c39-bf4c-4442-8d03-72c45f93b6b4', 'el-asador-de-los-boliches', 'El Asador de Los Boliches', 'The best local traditional food in Los Boliches, highly rated on TripAdvisor.', 'The best local traditional food in Los Boliches, highly rated on TripAdvisor.', 'Centro de Los Boliches', (select id from cities where slug='boliches'), 'published', true, st_setsrid(st_makepoint(-4.614257002717584,36.550623576423064),4326)::geography, '{"step_free": true}'::jsonb);

insert into events(id, venue_id, category_id, slug, title_es, title_en, description_es, description_en, status, price_cents, currency, source)
values ('36a6c362-d06e-4d2d-a101-868a1237441d', '55395c39-bf4c-4442-8d03-72c45f93b6b4', (select id from categories where slug='food'), 'el-asador-de-los-boliches-event', 'Special Event at El Asador de Los Boliches', 'Special Event at El Asador de Los Boliches', 'The best local traditional food in Los Boliches, highly rated on TripAdvisor.', 'The best local traditional food in Los Boliches, highly rated on TripAdvisor.', 'published', 0, 'EUR', 'verified_venue');

insert into event_occurrences(id, event_id, starts_at, ends_at, status)
values 
  ('4c3e8be3-ab9d-4366-aacb-ded7710d3886', '36a6c362-d06e-4d2d-a101-868a1237441d', '2026-08-07T18:00:00.000Z', '2026-08-07T22:00:00.000Z', 'scheduled'),
  ('48ec01bc-d0b9-4931-932c-fa202606ad5d', '36a6c362-d06e-4d2d-a101-868a1237441d', '2026-08-10T18:00:00.000Z', '2026-08-10T22:00:00.000Z', 'scheduled');

insert into venues(id, slug, name, description_es, description_en, address, city_id, status, verified, location, accessibility)
values ('2d589aa8-6ac0-46b8-ad0a-1b486721f004', 'club-social-los-boliches', 'Club Social Los Boliches', 'A popular meeting point and nightlife spot in Los Boliches.', 'A popular meeting point and nightlife spot in Los Boliches.', 'Centro de Los Boliches', (select id from cities where slug='boliches'), 'published', true, st_setsrid(st_makepoint(-4.61275140959931,36.553390474194735),4326)::geography, '{"step_free": true}'::jsonb);

insert into events(id, venue_id, category_id, slug, title_es, title_en, description_es, description_en, status, price_cents, currency, source)
values ('2d83d965-94ab-4461-8d04-da803f284d44', '2d589aa8-6ac0-46b8-ad0a-1b486721f004', (select id from categories where slug='social'), 'club-social-los-boliches-event', 'Special Event at Club Social Los Boliches', 'Special Event at Club Social Los Boliches', 'A popular meeting point and nightlife spot in Los Boliches.', 'A popular meeting point and nightlife spot in Los Boliches.', 'published', 0, 'EUR', 'verified_venue');

insert into event_occurrences(id, event_id, starts_at, ends_at, status)
values 
  ('c33204ab-6265-4a3b-a4a1-39b824cf2c64', '2d83d965-94ab-4461-8d04-da803f284d44', '2026-08-07T18:00:00.000Z', '2026-08-07T22:00:00.000Z', 'scheduled'),
  ('2d246182-a75c-4ad0-9be9-b9b3d29455a4', '2d83d965-94ab-4461-8d04-da803f284d44', '2026-08-10T18:00:00.000Z', '2026-08-10T22:00:00.000Z', 'scheduled');

-- Locality: Madrid
insert into cities(id,slug,name_es,name_en,center,timezone)
values ('70e5e482-cf72-4714-b2c6-045763827f75', 'madrid', 'Madrid', 'Madrid', st_setsrid(st_makepoint(-3.7038,40.4168),4326)::geography, 'Europe/Madrid')
on conflict(slug) do update set name_es=excluded.name_es, center=excluded.center;

insert into venues(id, slug, name, description_es, description_en, address, city_id, status, verified, location, accessibility)
values ('206db488-ed5f-4db1-b76a-96f71e9aaaf4', 'club-social-madrid', 'Club Social Madrid', 'A popular meeting point and nightlife spot in Madrid.', 'A popular meeting point and nightlife spot in Madrid.', 'Centro de Madrid', (select id from cities where slug='madrid'), 'published', true, st_setsrid(st_makepoint(-3.7022937188880247,40.41627849060417),4326)::geography, '{"step_free": true}'::jsonb);

insert into events(id, venue_id, category_id, slug, title_es, title_en, description_es, description_en, status, price_cents, currency, source)
values ('6c1edbdf-5920-4474-aaf9-d24b8a9b12f0', '206db488-ed5f-4db1-b76a-96f71e9aaaf4', (select id from categories where slug='social'), 'club-social-madrid-event', 'Special Event at Club Social Madrid', 'Special Event at Club Social Madrid', 'A popular meeting point and nightlife spot in Madrid.', 'A popular meeting point and nightlife spot in Madrid.', 'published', 0, 'EUR', 'verified_venue');

insert into event_occurrences(id, event_id, starts_at, ends_at, status)
values 
  ('81c49a01-2c82-41d9-8a0c-39705524c5d1', '6c1edbdf-5920-4474-aaf9-d24b8a9b12f0', '2026-08-07T18:00:00.000Z', '2026-08-07T22:00:00.000Z', 'scheduled'),
  ('f5e3db5d-d016-4e0c-88ff-93f2fbd08de0', '6c1edbdf-5920-4474-aaf9-d24b8a9b12f0', '2026-08-10T18:00:00.000Z', '2026-08-10T22:00:00.000Z', 'scheduled');

insert into venues(id, slug, name, description_es, description_en, address, city_id, status, verified, location, accessibility)
values ('a130929b-0067-4869-a409-7c70e27b3374', 'live-room-madrid', 'Live Room Madrid', 'Top live music venue in the heart of Madrid.', 'Top live music venue in the heart of Madrid.', 'Centro de Madrid', (select id from cities where slug='madrid'), 'published', true, st_setsrid(st_makepoint(-3.705542121410873,40.41767192238534),4326)::geography, '{"step_free": true}'::jsonb);

insert into events(id, venue_id, category_id, slug, title_es, title_en, description_es, description_en, status, price_cents, currency, source)
values ('7899d26b-7650-4fe8-8fc6-41d4677eb54a', 'a130929b-0067-4869-a409-7c70e27b3374', (select id from categories where slug='music'), 'live-room-madrid-event', 'Special Event at Live Room Madrid', 'Special Event at Live Room Madrid', 'Top live music venue in the heart of Madrid.', 'Top live music venue in the heart of Madrid.', 'published', 0, 'EUR', 'verified_venue');

insert into event_occurrences(id, event_id, starts_at, ends_at, status)
values 
  ('9f79a7d5-4c9b-40be-8b07-4323f8c0502d', '7899d26b-7650-4fe8-8fc6-41d4677eb54a', '2026-08-07T18:00:00.000Z', '2026-08-07T22:00:00.000Z', 'scheduled'),
  ('f6e199fc-2ff0-4c30-a960-c4db449fade2', '7899d26b-7650-4fe8-8fc6-41d4677eb54a', '2026-08-10T18:00:00.000Z', '2026-08-10T22:00:00.000Z', 'scheduled');

insert into venues(id, slug, name, description_es, description_en, address, city_id, status, verified, location, accessibility)
values ('2d6fc712-f484-4abe-a1f1-78e9bdef680b', 'el-asador-de-madrid', 'El Asador de Madrid', 'The best local traditional food in Madrid, highly rated on TripAdvisor.', 'The best local traditional food in Madrid, highly rated on TripAdvisor.', 'Centro de Madrid', (select id from cities where slug='madrid'), 'published', true, st_setsrid(st_makepoint(-3.7050581020869227,40.418937600423526),4326)::geography, '{"step_free": true}'::jsonb);

insert into events(id, venue_id, category_id, slug, title_es, title_en, description_es, description_en, status, price_cents, currency, source)
values ('2ad8f166-9b3f-43fd-a2a0-0f9663502bac', '2d6fc712-f484-4abe-a1f1-78e9bdef680b', (select id from categories where slug='food'), 'el-asador-de-madrid-event', 'Special Event at El Asador de Madrid', 'Special Event at El Asador de Madrid', 'The best local traditional food in Madrid, highly rated on TripAdvisor.', 'The best local traditional food in Madrid, highly rated on TripAdvisor.', 'published', 0, 'EUR', 'verified_venue');

insert into event_occurrences(id, event_id, starts_at, ends_at, status)
values 
  ('680b9900-bf3b-45d4-aa41-8d93df8284e8', '2ad8f166-9b3f-43fd-a2a0-0f9663502bac', '2026-08-07T18:00:00.000Z', '2026-08-07T22:00:00.000Z', 'scheduled'),
  ('b1ec01fe-9eba-42e2-8090-cb67a6ecfe4f', '2ad8f166-9b3f-43fd-a2a0-0f9663502bac', '2026-08-10T18:00:00.000Z', '2026-08-10T22:00:00.000Z', 'scheduled');

-- Locality: Palma
insert into cities(id,slug,name_es,name_en,center,timezone)
values ('8dec6bd5-19a4-432c-ab68-2d6069e6a961', 'palma', 'Palma', 'Palma', st_setsrid(st_makepoint(2.6502,39.5696),4326)::geography, 'Europe/Madrid')
on conflict(slug) do update set name_es=excluded.name_es, center=excluded.center;

insert into venues(id, slug, name, description_es, description_en, address, city_id, status, verified, location, accessibility)
values ('a62b8f73-b8fc-414f-b352-74fe3c154d14', 'live-room-palma', 'Live Room Palma', 'Top live music venue in the heart of Palma.', 'Top live music venue in the heart of Palma.', 'Centro de Palma', (select id from cities where slug='palma'), 'published', true, st_setsrid(st_makepoint(2.6512276849653857,39.57102050868452),4326)::geography, '{"step_free": true}'::jsonb);

insert into events(id, venue_id, category_id, slug, title_es, title_en, description_es, description_en, status, price_cents, currency, source)
values ('78aa390f-80d8-41a6-b99f-c6e5cf8e2bca', 'a62b8f73-b8fc-414f-b352-74fe3c154d14', (select id from categories where slug='music'), 'live-room-palma-event', 'Special Event at Live Room Palma', 'Special Event at Live Room Palma', 'Top live music venue in the heart of Palma.', 'Top live music venue in the heart of Palma.', 'published', 0, 'EUR', 'verified_venue');

insert into event_occurrences(id, event_id, starts_at, ends_at, status)
values 
  ('e51a9ae4-1061-4392-853d-c83e57276c96', '78aa390f-80d8-41a6-b99f-c6e5cf8e2bca', '2026-08-07T18:00:00.000Z', '2026-08-07T22:00:00.000Z', 'scheduled'),
  ('703f4d80-d620-4baf-8127-c150b86fed8a', '78aa390f-80d8-41a6-b99f-c6e5cf8e2bca', '2026-08-10T18:00:00.000Z', '2026-08-10T22:00:00.000Z', 'scheduled');

insert into venues(id, slug, name, description_es, description_en, address, city_id, status, verified, location, accessibility)
values ('1021b2b9-a9b8-4f97-8e6f-b759b30a4135', 'club-social-palma', 'Club Social Palma', 'A popular meeting point and nightlife spot in Palma.', 'A popular meeting point and nightlife spot in Palma.', 'Centro de Palma', (select id from cities where slug='palma'), 'published', true, st_setsrid(st_makepoint(2.6526538877610064,39.57102744940983),4326)::geography, '{"step_free": true}'::jsonb);

insert into events(id, venue_id, category_id, slug, title_es, title_en, description_es, description_en, status, price_cents, currency, source)
values ('4669cafa-9873-4b88-8341-08d83980f227', '1021b2b9-a9b8-4f97-8e6f-b759b30a4135', (select id from categories where slug='social'), 'club-social-palma-event', 'Special Event at Club Social Palma', 'Special Event at Club Social Palma', 'A popular meeting point and nightlife spot in Palma.', 'A popular meeting point and nightlife spot in Palma.', 'published', 0, 'EUR', 'verified_venue');

insert into event_occurrences(id, event_id, starts_at, ends_at, status)
values 
  ('cb3589a5-bc8f-448c-a852-8f619c24bbca', '4669cafa-9873-4b88-8341-08d83980f227', '2026-08-07T18:00:00.000Z', '2026-08-07T22:00:00.000Z', 'scheduled'),
  ('3bb17fa5-b472-49c0-9a4a-c10ee4161ab6', '4669cafa-9873-4b88-8341-08d83980f227', '2026-08-10T18:00:00.000Z', '2026-08-10T22:00:00.000Z', 'scheduled');

insert into venues(id, slug, name, description_es, description_en, address, city_id, status, verified, location, accessibility)
values ('da2722e5-c141-402e-a91f-dfc106b6bcdf', 'active-center-palma', 'Active Center Palma', 'Sports and fitness events happening all week.', 'Sports and fitness events happening all week.', 'Centro de Palma', (select id from cities where slug='palma'), 'published', true, st_setsrid(st_makepoint(2.648244145380525,39.56997378886617),4326)::geography, '{"step_free": true}'::jsonb);

insert into events(id, venue_id, category_id, slug, title_es, title_en, description_es, description_en, status, price_cents, currency, source)
values ('a9444894-4464-475f-9135-63451f72d93d', 'da2722e5-c141-402e-a91f-dfc106b6bcdf', (select id from categories where slug='sport'), 'active-center-palma-event', 'Special Event at Active Center Palma', 'Special Event at Active Center Palma', 'Sports and fitness events happening all week.', 'Sports and fitness events happening all week.', 'published', 0, 'EUR', 'verified_venue');

insert into event_occurrences(id, event_id, starts_at, ends_at, status)
values 
  ('e177c444-9115-4e98-b402-61f6be9fc7d1', 'a9444894-4464-475f-9135-63451f72d93d', '2026-08-07T18:00:00.000Z', '2026-08-07T22:00:00.000Z', 'scheduled'),
  ('3adfccd4-e036-4380-84b1-502b847f3855', 'a9444894-4464-475f-9135-63451f72d93d', '2026-08-10T18:00:00.000Z', '2026-08-10T22:00:00.000Z', 'scheduled');

-- Locality: Sevilla
insert into cities(id,slug,name_es,name_en,center,timezone)
values ('b0a15048-d6f4-4dfb-bbae-bea19403397d', 'sevilla', 'Sevilla', 'Sevilla', st_setsrid(st_makepoint(-5.9845,37.3891),4326)::geography, 'Europe/Madrid')
on conflict(slug) do update set name_es=excluded.name_es, center=excluded.center;

insert into venues(id, slug, name, description_es, description_en, address, city_id, status, verified, location, accessibility)
values ('97c45768-2425-4e57-863b-c4465c14c99b', 'live-room-sevilla', 'Live Room Sevilla', 'Top live music venue in the heart of Sevilla.', 'Top live music venue in the heart of Sevilla.', 'Centro de Sevilla', (select id from cities where slug='sevilla'), 'published', true, st_setsrid(st_makepoint(-5.983682257344178,37.387661255779726),4326)::geography, '{"step_free": true}'::jsonb);

insert into events(id, venue_id, category_id, slug, title_es, title_en, description_es, description_en, status, price_cents, currency, source)
values ('ddb1ac49-fa47-4ab8-bdae-da1796c6a40f', '97c45768-2425-4e57-863b-c4465c14c99b', (select id from categories where slug='music'), 'live-room-sevilla-event', 'Special Event at Live Room Sevilla', 'Special Event at Live Room Sevilla', 'Top live music venue in the heart of Sevilla.', 'Top live music venue in the heart of Sevilla.', 'published', 0, 'EUR', 'verified_venue');

insert into event_occurrences(id, event_id, starts_at, ends_at, status)
values 
  ('d49f49d9-92f5-479f-8040-46d09d07043a', 'ddb1ac49-fa47-4ab8-bdae-da1796c6a40f', '2026-08-07T18:00:00.000Z', '2026-08-07T22:00:00.000Z', 'scheduled'),
  ('07f3afac-e824-459a-b365-c006d8f99949', 'ddb1ac49-fa47-4ab8-bdae-da1796c6a40f', '2026-08-10T18:00:00.000Z', '2026-08-10T22:00:00.000Z', 'scheduled');

insert into venues(id, slug, name, description_es, description_en, address, city_id, status, verified, location, accessibility)
values ('d6075ff7-cb62-41da-b039-11966b66afc5', 'el-asador-de-sevilla', 'El Asador de Sevilla', 'The best local traditional food in Sevilla, highly rated on TripAdvisor.', 'The best local traditional food in Sevilla, highly rated on TripAdvisor.', 'Centro de Sevilla', (select id from cities where slug='sevilla'), 'published', true, st_setsrid(st_makepoint(-5.985845056979473,37.388021887183726),4326)::geography, '{"step_free": true}'::jsonb);

insert into events(id, venue_id, category_id, slug, title_es, title_en, description_es, description_en, status, price_cents, currency, source)
values ('ac3be7b9-3ab2-4fb1-9409-f3a25ee7685a', 'd6075ff7-cb62-41da-b039-11966b66afc5', (select id from categories where slug='food'), 'el-asador-de-sevilla-event', 'Special Event at El Asador de Sevilla', 'Special Event at El Asador de Sevilla', 'The best local traditional food in Sevilla, highly rated on TripAdvisor.', 'The best local traditional food in Sevilla, highly rated on TripAdvisor.', 'published', 0, 'EUR', 'verified_venue');

insert into event_occurrences(id, event_id, starts_at, ends_at, status)
values 
  ('c6744a55-f24d-4654-9e61-31077efd6001', 'ac3be7b9-3ab2-4fb1-9409-f3a25ee7685a', '2026-08-07T18:00:00.000Z', '2026-08-07T22:00:00.000Z', 'scheduled'),
  ('16708ef5-7373-47d4-97fc-b1c417773aa6', 'ac3be7b9-3ab2-4fb1-9409-f3a25ee7685a', '2026-08-10T18:00:00.000Z', '2026-08-10T22:00:00.000Z', 'scheduled');

insert into venues(id, slug, name, description_es, description_en, address, city_id, status, verified, location, accessibility)
values ('945b09b4-b159-46d2-99ba-6ca68eff096e', 'creative-space-sevilla', 'Creative Space Sevilla', 'Workshops and creative classes for all ages.', 'Workshops and creative classes for all ages.', 'Centro de Sevilla', (select id from cities where slug='sevilla'), 'published', true, st_setsrid(st_makepoint(-5.983215341789289,37.38751338119743),4326)::geography, '{"step_free": true}'::jsonb);

insert into events(id, venue_id, category_id, slug, title_es, title_en, description_es, description_en, status, price_cents, currency, source)
values ('20bc0e42-32b7-467e-83f7-e117aa886bde', '945b09b4-b159-46d2-99ba-6ca68eff096e', (select id from categories where slug='workshop'), 'creative-space-sevilla-event', 'Special Event at Creative Space Sevilla', 'Special Event at Creative Space Sevilla', 'Workshops and creative classes for all ages.', 'Workshops and creative classes for all ages.', 'published', 0, 'EUR', 'verified_venue');

insert into event_occurrences(id, event_id, starts_at, ends_at, status)
values 
  ('e6ed57e9-67d5-447b-b0f0-a54943d6acad', '20bc0e42-32b7-467e-83f7-e117aa886bde', '2026-08-07T18:00:00.000Z', '2026-08-07T22:00:00.000Z', 'scheduled'),
  ('c2891a6f-9190-417e-9a71-34e5a9080dec', '20bc0e42-32b7-467e-83f7-e117aa886bde', '2026-08-10T18:00:00.000Z', '2026-08-10T22:00:00.000Z', 'scheduled');

-- Locality: València
insert into cities(id,slug,name_es,name_en,center,timezone)
values ('1182a84c-54a1-4218-8ebf-50fe63fdcf4f', 'valencia', 'València', 'València', st_setsrid(st_makepoint(-0.3763,39.4699),4326)::geography, 'Europe/Madrid')
on conflict(slug) do update set name_es=excluded.name_es, center=excluded.center;

insert into venues(id, slug, name, description_es, description_en, address, city_id, status, verified, location, accessibility)
values ('2af399c4-824c-4b81-adbd-565a0f688a13', 'family-park-val-ncia', 'Family Park València', 'A great place for kids and families to spend the day in València.', 'A great place for kids and families to spend the day in València.', 'Centro de València', (select id from cities where slug='valencia'), 'published', true, st_setsrid(st_makepoint(-0.37858438273241457,39.469695670273126),4326)::geography, '{"step_free": true}'::jsonb);

insert into events(id, venue_id, category_id, slug, title_es, title_en, description_es, description_en, status, price_cents, currency, source)
values ('488d37e5-c08b-4793-b29d-82a4b6a25656', '2af399c4-824c-4b81-adbd-565a0f688a13', (select id from categories where slug='family'), 'family-park-val-ncia-event', 'Special Event at Family Park València', 'Special Event at Family Park València', 'A great place for kids and families to spend the day in València.', 'A great place for kids and families to spend the day in València.', 'published', 0, 'EUR', 'verified_venue');

insert into event_occurrences(id, event_id, starts_at, ends_at, status)
values 
  ('5e484a0c-4b15-4d46-b3fd-d02c1b60b01f', '488d37e5-c08b-4793-b29d-82a4b6a25656', '2026-08-07T18:00:00.000Z', '2026-08-07T22:00:00.000Z', 'scheduled'),
  ('9ecb694b-d05d-4f83-9bf3-b376f6a1efad', '488d37e5-c08b-4793-b29d-82a4b6a25656', '2026-08-10T18:00:00.000Z', '2026-08-10T22:00:00.000Z', 'scheduled');

insert into venues(id, slug, name, description_es, description_en, address, city_id, status, verified, location, accessibility)
values ('2f98cc8b-bffd-477e-b80c-2fb09f5aae89', 'el-asador-de-val-ncia', 'El Asador de València', 'The best local traditional food in València, highly rated on TripAdvisor.', 'The best local traditional food in València, highly rated on TripAdvisor.', 'Centro de València', (select id from cities where slug='valencia'), 'published', true, st_setsrid(st_makepoint(-0.3771691354729781,39.47232771298348),4326)::geography, '{"step_free": true}'::jsonb);

insert into events(id, venue_id, category_id, slug, title_es, title_en, description_es, description_en, status, price_cents, currency, source)
values ('e462d805-6d2f-471a-9fb0-5ddad0c94f19', '2f98cc8b-bffd-477e-b80c-2fb09f5aae89', (select id from categories where slug='food'), 'el-asador-de-val-ncia-event', 'Special Event at El Asador de València', 'Special Event at El Asador de València', 'The best local traditional food in València, highly rated on TripAdvisor.', 'The best local traditional food in València, highly rated on TripAdvisor.', 'published', 0, 'EUR', 'verified_venue');

insert into event_occurrences(id, event_id, starts_at, ends_at, status)
values 
  ('e5a1fc98-beba-453f-a6be-d32c309e517f', 'e462d805-6d2f-471a-9fb0-5ddad0c94f19', '2026-08-07T18:00:00.000Z', '2026-08-07T22:00:00.000Z', 'scheduled'),
  ('8aedd232-2b26-4f04-bb4b-d030bfe3f640', 'e462d805-6d2f-471a-9fb0-5ddad0c94f19', '2026-08-10T18:00:00.000Z', '2026-08-10T22:00:00.000Z', 'scheduled');

insert into venues(id, slug, name, description_es, description_en, address, city_id, status, verified, location, accessibility)
values ('57e6911b-5bd2-47ac-9bb5-39ce104ec584', 'club-social-val-ncia', 'Club Social València', 'A popular meeting point and nightlife spot in València.', 'A popular meeting point and nightlife spot in València.', 'Centro de València', (select id from cities where slug='valencia'), 'published', true, st_setsrid(st_makepoint(-0.37494728007142614,39.471924017741046),4326)::geography, '{"step_free": true}'::jsonb);

insert into events(id, venue_id, category_id, slug, title_es, title_en, description_es, description_en, status, price_cents, currency, source)
values ('0c560306-fa75-4faf-b1af-8e2d3b0e4e8a', '57e6911b-5bd2-47ac-9bb5-39ce104ec584', (select id from categories where slug='social'), 'club-social-val-ncia-event', 'Special Event at Club Social València', 'Special Event at Club Social València', 'A popular meeting point and nightlife spot in València.', 'A popular meeting point and nightlife spot in València.', 'published', 0, 'EUR', 'verified_venue');

insert into event_occurrences(id, event_id, starts_at, ends_at, status)
values 
  ('c842e87d-58ad-4758-8de3-fa757542e5df', '0c560306-fa75-4faf-b1af-8e2d3b0e4e8a', '2026-08-07T18:00:00.000Z', '2026-08-07T22:00:00.000Z', 'scheduled'),
  ('c6ab2e81-5361-4a96-b6fe-cdef4993517e', '0c560306-fa75-4faf-b1af-8e2d3b0e4e8a', '2026-08-10T18:00:00.000Z', '2026-08-10T22:00:00.000Z', 'scheduled');

commit;

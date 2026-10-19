begin;

alter table venues
  add column contact_phone text,
  add column whatsapp_phone text,
  add column website_url text,
  add constraint venues_contact_phone_e164
    check(contact_phone is null or contact_phone ~ '^\+[1-9][0-9]{7,14}$'),
  add constraint venues_whatsapp_phone_e164
    check(whatsapp_phone is null or whatsapp_phone ~ '^\+[1-9][0-9]{7,14}$'),
  add constraint venues_website_https
    check(website_url is null or website_url ~ '^https://');

create policy event_media_published_read
on storage.objects for select
to anon, authenticated
using (
  bucket_id='event-media'
  and exists (
    select 1
    from venue_media vm
    join venues v on v.id=vm.venue_id
    where vm.storage_path=storage.objects.name
      and v.status='published'
  )
);

commit;

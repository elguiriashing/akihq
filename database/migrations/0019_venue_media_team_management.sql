begin;

drop policy if exists venue_media_manage on venue_media;

create policy venue_media_member_insert
on venue_media
for insert
to authenticated
with check (
  is_venue_member(venue_id)
  and created_by = auth.uid()
);

create policy venue_media_member_update
on venue_media
for update
to authenticated
using (is_venue_member(venue_id))
with check (is_venue_member(venue_id));

create policy venue_media_member_delete
on venue_media
for delete
to authenticated
using (is_venue_member(venue_id));

create or replace function preserve_venue_media_creator()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.created_by := old.created_by;
  return new;
end;
$$;

drop trigger if exists preserve_venue_media_creator_on_update on venue_media;
create trigger preserve_venue_media_creator_on_update
before update on venue_media
for each row execute function preserve_venue_media_creator();

commit;

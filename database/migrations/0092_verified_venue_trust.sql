-- Verified venues are trusted publishers. Pending moderation is only for
-- unverified catalogue owners/community content.

create or replace function public.keep_verified_venue_content_live()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'venues' then
    if new.verified and new.status = 'pending'::public.content_status then
      new.status := 'published'::public.content_status;
    end if;
    return new;
  end if;

  if tg_table_name = 'events'
     and new.status = 'pending'::public.content_status
     and exists (
       select 1 from public.venues v
       where v.id = new.venue_id and v.verified = true
     )
  then
    new.status := 'published'::public.content_status;
  end if;

  return new;
end;
$$;

drop trigger if exists verified_venue_stays_published on public.venues;
create trigger verified_venue_stays_published
before insert or update of status, verified on public.venues
for each row execute function public.keep_verified_venue_content_live();

drop trigger if exists verified_venue_events_stay_published on public.events;
create trigger verified_venue_events_stay_published
before insert or update of status, venue_id on public.events
for each row execute function public.keep_verified_venue_content_live();

update public.venues
set status = 'published'::public.content_status
where verified = true
  and status = 'pending'::public.content_status;

update public.events e
set status = 'published'::public.content_status,
    updated_at = now()
where e.status = 'pending'::public.content_status
  and exists (
    select 1 from public.venues v
    where v.id = e.venue_id and v.verified = true
  );

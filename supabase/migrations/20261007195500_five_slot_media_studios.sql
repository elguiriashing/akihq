-- Expand reusable media into five explicit venue slots and five explicit event slots.

alter table public.venue_media_placements
  drop constraint if exists venue_media_placements_kind_check;

alter table public.venue_media_placements
  add constraint venue_media_placements_kind_check
  check (placement in (
    'venue_logo',
    'venue_profile',
    'venue_cover',
    'venue_menu',
    'venue_events',
    'venue_explore',
    'venue_gallery',
    'event_cover',
    'event_explore',
    'event_gallery',
    'event_gallery_1',
    'event_gallery_2',
    'event_gallery_3',
    'event_bin',
    'catalogue_item'
  ));

update public.venue_media_placements
set placement = 'venue_profile'
where placement = 'venue_logo';

-- Convert the first three legacy event gallery images into explicit slots.
with ranked as (
  select
    id,
    row_number() over (
      partition by venue_id, target_key
      order by sort_order, created_at, id
    ) as rn
  from public.venue_media_placements
  where placement = 'event_gallery'
)
update public.venue_media_placements p
set placement = case ranked.rn
  when 1 then 'event_gallery_1'
  when 2 then 'event_gallery_2'
  when 3 then 'event_gallery_3'
  else 'event_gallery'
end
from ranked
where p.id = ranked.id
  and ranked.rn <= 3;

drop index if exists public.venue_media_placements_single_slot;
create unique index venue_media_placements_single_slot
  on public.venue_media_placements(venue_id, placement, target_key)
  where placement in (
    'venue_profile',
    'venue_cover',
    'venue_menu',
    'venue_events',
    'venue_explore',
    'event_cover',
    'event_explore',
    'event_gallery_1',
    'event_gallery_2',
    'event_gallery_3',
    'catalogue_item'
  );

create unique index if not exists venue_media_placements_event_bin_unique
  on public.venue_media_placements(venue_id, target_key, media_id)
  where placement = 'event_bin';

-- Give the five event media slots explicit semantics and migrate existing assignments.
-- 1 banner, 2 explore, 3 profile, 4 background, 5 vertical map image.

alter table public.venue_media_placements
  drop constraint if exists venue_media_placements_kind_check;

update public.venue_media_placements
set placement = case placement
  when 'event_cover' then 'event_banner'
  when 'event_gallery_1' then 'event_profile'
  when 'event_gallery_2' then 'event_background'
  when 'event_gallery_3' then 'event_map_vertical'
  else placement
end
where placement in (
  'event_cover',
  'event_gallery_1',
  'event_gallery_2',
  'event_gallery_3'
);

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
    'event_banner',
    'event_explore',
    'event_profile',
    'event_background',
    'event_map_vertical',
    'event_gallery',
    'event_bin',
    'catalogue_item'
  ));

drop index if exists public.venue_media_placements_single_slot;
create unique index venue_media_placements_single_slot
  on public.venue_media_placements(venue_id, placement, target_key)
  where placement in (
    'venue_profile',
    'venue_cover',
    'venue_menu',
    'venue_events',
    'venue_explore',
    'event_banner',
    'event_explore',
    'event_profile',
    'event_background',
    'event_map_vertical',
    'catalogue_item'
  );

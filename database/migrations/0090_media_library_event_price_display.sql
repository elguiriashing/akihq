-- Media library placements + event price display controls.
-- A venue owns media once, then reuses it across venue, catalogue and event surfaces.

alter table public.events
  add column if not exists price_display_mode text not null default 'show';

alter table public.events
  drop constraint if exists events_price_display_mode_check;

alter table public.events
  add constraint events_price_display_mode_check
  check (price_display_mode in ('show','hide'));

create table if not exists public.venue_media_placements (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  media_id uuid not null references public.venue_media(id) on delete cascade,
  placement text not null,
  target_key text not null default '',
  sort_order integer not null default 0 check (sort_order between 0 and 10000),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  constraint venue_media_placements_kind_check
    check (placement in (
      'venue_logo',
      'venue_cover',
      'venue_gallery',
      'event_cover',
      'event_gallery',
      'catalogue_item'
    ))
);

create unique index if not exists venue_media_placements_single_slot
  on public.venue_media_placements(venue_id, placement, target_key)
  where placement in ('venue_logo','venue_cover','event_cover','catalogue_item');

create unique index if not exists venue_media_placements_gallery_order
  on public.venue_media_placements(venue_id, placement, target_key, sort_order)
  where placement in ('venue_gallery','event_gallery');

create index if not exists venue_media_placements_lookup
  on public.venue_media_placements(venue_id, placement, target_key, sort_order);

alter table public.venue_media_placements enable row level security;

drop policy if exists venue_media_placements_public_read on public.venue_media_placements;
create policy venue_media_placements_public_read
on public.venue_media_placements for select
to anon, authenticated
using (
  exists (
    select 1 from public.venues v
    where v.id = venue_id and v.status = 'published'
  )
  or public.is_venue_member(venue_id)
  or public.has_platform_role(array['moderator','administrator']::public.app_role[])
);

drop policy if exists venue_media_placements_member_insert on public.venue_media_placements;
create policy venue_media_placements_member_insert
on public.venue_media_placements for insert
to authenticated
with check (
  public.is_venue_member(venue_id)
  or public.has_platform_role(array['moderator','administrator']::public.app_role[])
);

drop policy if exists venue_media_placements_member_update on public.venue_media_placements;
create policy venue_media_placements_member_update
on public.venue_media_placements for update
to authenticated
using (
  public.is_venue_member(venue_id)
  or public.has_platform_role(array['moderator','administrator']::public.app_role[])
)
with check (
  public.is_venue_member(venue_id)
  or public.has_platform_role(array['moderator','administrator']::public.app_role[])
);

drop policy if exists venue_media_placements_member_delete on public.venue_media_placements;
create policy venue_media_placements_member_delete
on public.venue_media_placements for delete
to authenticated
using (
  public.is_venue_member(venue_id)
  or public.has_platform_role(array['moderator','administrator']::public.app_role[])
);

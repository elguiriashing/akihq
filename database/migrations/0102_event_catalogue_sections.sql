-- Optional per-event venue catalogue sections. Empty means no event menu.
-- Always resolve content from the venue's current published catalogue;
-- never copy prices or allergens onto an event.
alter table public.events
  add column if not exists catalogue_section_ids text[] not null default '{}'::text[];

comment on column public.events.catalogue_section_ids is
  'Ordered selected section IDs from the event venue published catalogue; empty = no event menu.';

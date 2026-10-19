-- Hotfix: keep editorial AkiPasa events valid after later schema changes.
alter table public.events drop constraint if exists events_source_check;

alter table public.events
  add constraint events_source_check
  check (
    source = any (
      array[
        'verified_venue'::text,
        'community'::text,
        'akipasa_selection'::text
      ]
    )
  );

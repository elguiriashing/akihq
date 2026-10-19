-- Cover personalisation foreign keys used by joins and cascading deletes.
create index if not exists behaviour_events_event_type_idx
  on public.behaviour_events(event_type);

create index if not exists experiment_assignments_preference_profile_idx
  on public.experiment_assignments(preference_profile_id);

create index if not exists recommendation_items_occurrence_idx
  on public.recommendation_items(occurrence_id)
  where occurrence_id is not null;

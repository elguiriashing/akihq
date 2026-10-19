begin;

create table recent_event_view_refs (
  profile_id uuid not null references profiles(id) on delete cascade,
  event_key text not null check (char_length(event_key) between 2 and 160),
  title text not null check (char_length(title) between 2 and 200),
  href text not null check (href ~ '^/(es|en)/events/'),
  viewed_at timestamptz not null default now(),
  primary key (profile_id, event_key)
);

alter table recent_event_view_refs enable row level security;

create policy recent_event_view_refs_own on recent_event_view_refs
for all
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create index recent_event_view_refs_profile_time_idx
on recent_event_view_refs(profile_id, viewed_at desc);

commit;

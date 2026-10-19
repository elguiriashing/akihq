begin;

create table if not exists public.venue_location_repairs (
  venue_id uuid primary key references public.venues(id) on delete cascade,
  status text not null check (status in ('resolved','unresolved','error')),
  provider text not null,
  attempted_query text not null,
  candidate_lat double precision,
  candidate_lng double precision,
  confidence numeric,
  precision text,
  formatted_address text,
  reason text,
  checked_at timestamptz not null default now()
);

alter table public.venue_location_repairs enable row level security;
revoke all on public.venue_location_repairs from anon, authenticated;
grant all on public.venue_location_repairs to service_role;

commit;

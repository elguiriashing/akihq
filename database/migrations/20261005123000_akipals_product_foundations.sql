-- AkiPals product foundations. Additive only; the restricted schema-1 preview remains compatible.
create table if not exists public.pals_brands (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9_-]{1,79}$'),
  name text not null,
  logo_asset_key text,
  website text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pals_campaigns (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9_-]{1,79}$'),
  title text not null,
  brand_id text references public.pals_brands(id) on delete set null,
  active_from timestamptz,
  active_until timestamptz,
  regions text[] not null default '{}',
  cities text[] not null default '{}',
  external_commerce_url text,
  analytics_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (active_until is null or active_from is null or active_until > active_from)
);

create table if not exists public.pals_collections (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9_-]{1,79}$'),
  title text not null,
  description text not null default '',
  artwork_key text,
  available_from timestamptz,
  available_until timestamptz,
  regions text[] not null default '{}',
  cities text[] not null default '{}',
  brand_id text references public.pals_brands(id) on delete set null,
  campaign_id text references public.pals_campaigns(id) on delete set null,
  unlock_method text not null default 'mixed'
    check (unlock_method in ('mixed','shop','earned','campaign','premium','promotional')),
  commerce jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (available_until is null or available_from is null or available_until > available_from)
);

create table if not exists public.pals_items (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9_-]{1,79}$'),
  name text not null,
  collection_id text not null references public.pals_collections(id) on delete restrict,
  slot text not null check (slot in ('head','body','back','held','effect')),
  rarity text not null check (rarity in ('common','rare','epic','legendary')),
  render jsonb not null,
  compatible_families text[] not null default array['all']::text[],
  source_type text not null check (source_type in (
    'starter','shop','achievement','passport','city','adventure','event','seasonal',
    'premium','sponsored','promotional','purchase'
  )),
  release_at timestamptz,
  retire_at timestamptz,
  price_currency text check (price_currency is null or price_currency in ('threads','scrap','real_money')),
  price_amount numeric check (price_amount is null or price_amount >= 0),
  city_id text,
  event_id text,
  venue_id uuid references public.venues(id) on delete set null,
  brand_id text references public.pals_brands(id) on delete set null,
  campaign_id text references public.pals_campaigns(id) on delete set null,
  prestigious boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (retire_at is null or release_at is null or retire_at > release_at),
  check (not prestigious or price_amount is null)
);

create table if not exists public.pals_reward_rules (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9_-]{1,119}$'),
  title text not null,
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  match_mode text not null default 'all' check (match_mode in ('all','any')),
  conditions jsonb not null default '[]'::jsonb,
  rewards jsonb not null default '[]'::jsonb,
  source_type text not null,
  source_id text,
  campaign_id text references public.pals_campaigns(id) on delete cascade,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(conditions) = 'array'),
  check (jsonb_typeof(rewards) = 'array'),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table if not exists public.pals_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entitlement_key text not null,
  item_id text not null references public.pals_items(id) on delete restrict,
  granted_at timestamptz not null default now(),
  obtained_via text not null,
  source_type text not null,
  source_id text,
  expires_at timestamptz,
  quantity integer not null default 1 check (quantity > 0),
  status text not null default 'active' check (status in ('active','revoked','expired')),
  metadata jsonb not null default '{}'::jsonb,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, entitlement_key)
);
create index if not exists pals_entitlements_user_item_idx
  on public.pals_entitlements(user_id,item_id,status);
create index if not exists pals_entitlements_source_idx
  on public.pals_entitlements(source_type,source_id);

create table if not exists public.pals_campaign_collections (
  campaign_id text not null references public.pals_campaigns(id) on delete cascade,
  collection_id text not null references public.pals_collections(id) on delete cascade,
  primary key (campaign_id, collection_id)
);

create table if not exists public.pals_analytics_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  event_name text not null check (event_name in (
    'collection_viewed','item_viewed','item_unlocked','item_equipped','item_unequipped',
    'shop_item_purchased','reward_claimed','adventure_reward_earned','campaign_reward_earned'
  )),
  item_id text,
  collection_id text,
  campaign_id text,
  adventure_id text,
  reward_rule_id text,
  currency text,
  amount numeric,
  context jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index if not exists pals_analytics_event_time_idx
  on public.pals_analytics_events(event_name, occurred_at desc);
create index if not exists pals_analytics_campaign_time_idx
  on public.pals_analytics_events(campaign_id, occurred_at desc)
  where campaign_id is not null;

alter table public.pals_brands enable row level security;
alter table public.pals_campaigns enable row level security;
alter table public.pals_collections enable row level security;
alter table public.pals_items enable row level security;
alter table public.pals_reward_rules enable row level security;
alter table public.pals_entitlements enable row level security;
alter table public.pals_campaign_collections enable row level security;
alter table public.pals_analytics_events enable row level security;

revoke all on public.pals_brands, public.pals_campaigns, public.pals_collections,
  public.pals_items, public.pals_reward_rules, public.pals_entitlements,
  public.pals_campaign_collections, public.pals_analytics_events
from anon, authenticated;

grant select on public.pals_entitlements to authenticated;
grant all on public.pals_brands, public.pals_campaigns, public.pals_collections,
  public.pals_items, public.pals_reward_rules, public.pals_entitlements,
  public.pals_campaign_collections, public.pals_analytics_events
to service_role;

create policy pals_entitlements_own_read on public.pals_entitlements
  for select to authenticated using ((select auth.uid()) = user_id);

comment on table public.pals_items is
  'Data-driven AkiPals cosmetic catalogue. Prestige items cannot carry a price.';
comment on table public.pals_entitlements is
  'Canonical ownership/provenance ledger answering why a user owns an AkiPals item.';
comment on table public.pals_reward_rules is
  'Universal data-driven AkiPals conditions and rewards for Passport, achievements, adventures, events and campaigns.';
comment on table public.pals_analytics_events is
  'Privacy-conscious AkiPals product events. Do not store coordinates, contact details or free-form personal data.';

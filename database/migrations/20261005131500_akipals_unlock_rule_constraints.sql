alter table public.pals_items
  add column if not exists unlock_rule_ids text[] not null default '{}';

alter table public.pals_campaigns
  add column if not exists unlock_rule_ids text[] not null default '{}';

alter table public.pals_collections
  add column if not exists unlock_rule_ids text[] not null default '{}';

alter table public.pals_items
  drop constraint if exists pals_items_earned_sources_not_for_sale;

alter table public.pals_items
  add constraint pals_items_earned_sources_not_for_sale
  check (
    source_type not in ('achievement','passport','city','adventure')
    or price_amount is null
  );

comment on column public.pals_items.unlock_rule_ids is
  'Reward-rule identifiers that can unlock this cosmetic.';
comment on column public.pals_campaigns.unlock_rule_ids is
  'Reward-rule identifiers defining campaign qualification.';
comment on column public.pals_collections.unlock_rule_ids is
  'Optional collection-level unlock rules; item-level rules remain authoritative.';

-- Conservative groundwork for future Explore dietary filters.
-- "compatible" deliberately does not mean medically guaranteed safe:
-- results require a reviewed item, the selected allergens marked not-in-recipe,
-- and cross-contact explicitly assessed by the business.

create or replace function public.venues_with_allergen_compatible_options(
  p_allergens text[]
)
returns table(
  venue_id uuid,
  compatible_item_count bigint
)
language sql
stable
security definer
set search_path=''
as $$
  select
    i.venue_id,
    count(*)::bigint
  from public.venue_catalogue_food_index i
  join public.venues v on v.id=i.venue_id
  where v.status='published'
    and i.reviewed_at is not null
    and i.cross_contact='assessed'
    and coalesce(array_length(p_allergens,1),0)>0
    and p_allergens <@ i.not_in_recipe_allergens
    and not (p_allergens && i.contains_allergens)
    and not (p_allergens && i.may_contain_allergens)
    and not (p_allergens && i.unknown_allergens)
  group by i.venue_id;
$$;

revoke all on function public.venues_with_allergen_compatible_options(text[]) from public;
grant execute on function public.venues_with_allergen_compatible_options(text[])
to anon,authenticated;

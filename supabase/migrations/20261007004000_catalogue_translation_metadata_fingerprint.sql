begin;

create or replace function public.catalogue_recipe_fingerprint(p_item jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select md5(
    jsonb_build_object(
      'name',
        (p_item->'name') - '_translation',
      'description',
        (p_item->'description') - '_translation',
      'kind',
        p_item->'kind',
      'containsFood',
        p_item->'containsFood',
      'allergens',
        (
          (p_item->'allergens')
          #- '{ingredients,_translation}'
          #- '{notes,_translation}'
        ) - 'reviewedAt' - 'reviewConfirmed',
      'variants',
        coalesce(
          (
            select jsonb_agg((v->'label') - '_translation')
            from jsonb_array_elements(p_item->'variants') v
          ),
          '[]'::jsonb
        )
    )::text
  );
$$;

revoke execute on function public.catalogue_recipe_fingerprint(jsonb)
from public, anon, authenticated;

commit;

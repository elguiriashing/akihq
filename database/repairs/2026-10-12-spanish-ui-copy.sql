-- Exact, idempotent correction of three verified historical encoding errors.
-- The original migration literals are already correct. Do not re-encode rows
-- broadly: valid multilingual text and newer operator edits must be retained.
-- IDs, slugs, enabled states, permissions and translations in English stay intact.
with category_repairs(slug, before_text, after_text) as (
  values
    ('literature', U&'Literatura y poes\00C3\00ADa', U&'Literatura y poes\00EDa'),
    ('tradition', U&'Tradici\00C3\00B3n', U&'Tradici\00F3n')
), repaired_categories as (
  update public.categories as category
  set name_es = repair.after_text
  from category_repairs as repair
  where category.slug = repair.slug
    and category.name_es = repair.before_text
  returning category.slug as item, repair.before_text, category.name_es as after_text
), repaired_flags as (
  update public.feature_flags
  set label_es = U&'Motivos de recomendaci\00F3n'
  where key = 'recommendation_reasons'
    and label_es = U&'Motivos de recomendaci\00C3\00B3n'
  returning key as item,
    U&'Motivos de recomendaci\00C3\00B3n' as before_text,
    label_es as after_text
)
select jsonb_build_object(
  'categories', (select coalesce(jsonb_agg(row), '[]'::jsonb) from repaired_categories as row),
  'feature_flags', (select coalesce(jsonb_agg(row), '[]'::jsonb) from repaired_flags as row)
) as repaired_labels;

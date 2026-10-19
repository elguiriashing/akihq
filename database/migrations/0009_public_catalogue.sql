begin;

-- Keep the business publisher's category choices aligned with public discovery.
insert into categories (id, slug, name_es, name_en)
values
  ('20000000-0000-4000-8000-000000000004', 'culture', 'Cultura', 'Culture'),
  ('20000000-0000-4000-8000-000000000005', 'market', 'Mercado', 'Market'),
  ('20000000-0000-4000-8000-000000000006', 'food', 'Gastronomía', 'Food')
on conflict (slug) do update
set name_es = excluded.name_es, name_en = excluded.name_en;

commit;

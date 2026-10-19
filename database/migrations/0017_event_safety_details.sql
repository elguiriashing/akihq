begin;

alter table events
  add column minimum_age integer,
  add column accessibility_notes_es text,
  add column accessibility_notes_en text,
  add constraint events_minimum_age_range
    check(minimum_age is null or minimum_age between 0 and 99),
  add constraint events_accessibility_notes_es_length
    check(accessibility_notes_es is null or char_length(accessibility_notes_es) <= 1000),
  add constraint events_accessibility_notes_en_length
    check(accessibility_notes_en is null or char_length(accessibility_notes_en) <= 1000);

commit;

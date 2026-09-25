-- Historical bootstrap retired: it granted every authenticated user shared snapshot access.
-- Provision with the ordered, reviewed supabase/migrations migrations and prerequisite AkiPasa schema.
-- Do not use this file to create or reset a production database.
do $$ begin raise exception 'Unsafe legacy bootstrap retired. Use the versioned migration deployment guide.'; end $$;

-- Recorded from applied migration 20261003220529.
create index if not exists pals_commands_user_created_idx
  on public.pals_commands(user_id, created_at desc);

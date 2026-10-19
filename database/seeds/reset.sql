-- Removes only the exact local-test records owned by database/seeds/seed.sql.
-- Run only through `npm run db:reset:local`; its URL guard refuses non-local hosts.
begin;

delete from event_occurrences
where id in (
  '31000000-0000-4000-8000-000000000001',
  '31000000-0000-4000-8000-000000000002'
);
delete from events
where id = '30000000-0000-4000-8000-000000000001';
delete from venues
where id = '11000000-0000-4000-8000-000000000001';

commit;

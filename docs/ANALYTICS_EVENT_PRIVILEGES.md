# Analytics table capability repair

The 20 October read-only hosted preflight found `anon` and `authenticated` holding
ALL privileges on `public.analytics_events`, including TRUNCATE. Its only policy,
`analytics_operator_read`, restricts SELECT to venue members/administrators. RLS
does not protect TRUNCATE, so table privileges must be reduced independently.

Migration `20261020173020_analytics_events_least_privilege` revokes all table
privileges from PUBLIC, anon and authenticated, then grants authenticated SELECT.
It changes no rows, policies, function definitions, sequences or service-role
privileges. RLS remains authoritative for signed-in tenant reads. Anonymous table
reads have no legitimate caller: public signals go through same-origin API and
service-only checked `record_analytics_limited`; behavior ingestion and the legacy
signed-in `record_analytics` function are SECURITY DEFINER. Their grants and checks
remain intact. Privileged platform reporting uses the server service client.

Four PGlite integration tests execute the actual existing table/policy and recording
functions under anon/authenticated/service roles. They reproduce local anonymous
TRUNCATE despite RLS before applying the fix, roll it back, then verify actual
SELECT/UPDATE/DELETE/TRUNCATE denial, all seven capability bits, owner/other-tenant/
administrator isolation, valid secured recording and invalid-source rejection.
These tests do not claim hosted acceptance or production application.

Release after exact-head hosted checks and source review. Apply only this targeted
migration, never replay reference migration history. Read back all seven capability
bits for anon/authenticated and the unchanged policy. Verify consented service
signal ingestion and RLS-scoped Pulse reporting. Record analytics row count before
and after; this change should preserve every row. No live migration was performed
while preparing this candidate.

Rollback must retain least privilege. If an overlooked legitimate caller needs a
capability, authorize its narrow RPC or add a reviewed minimal grant with RLS;
do not restore broad ALL or TRUNCATE to browser roles.

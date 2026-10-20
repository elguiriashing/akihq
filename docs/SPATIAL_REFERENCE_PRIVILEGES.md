# Read-only PostGIS reference privileges

Status: implemented and locally tested; production application not performed.

Read-only shared-project metadata confirms public.spatial_ref_sys belongs to the
PostGIS extension, is owned by supabase_admin and has RLS disabled. Both browser
roles currently have SELECT plus mutation/TRUNCATE privileges. Application
clients need coordinate-system lookups, not changes to the reference catalogue.

Migration 20261020184245 is mirrored in database/migrations and
supabase/migrations. It revokes all privileges only from PUBLIC, anon and
authenticated, then restores SELECT to both client roles. It does not change
extension ownership/membership, schemas, RLS, defaults, service-role grants,
reference rows, billing, tenant ownership or runtime configuration.

The migration checks effective table and column capabilities before committing,
including PostgreSQL17 MAINTAIN. A remaining inherited grant or an executor that
cannot revoke the original grantor's privileges raises42501 and rolls back.
Warnings alone are not acceptance. No CASCADE, membership change, extension move
or ownership escalation is attempted.

Important execution prerequisite: the current SQL connection reports postgres,
not a member of supabase_admin, with no INSERT grant option on this relation.
An authorised extension-owner/provider execution path may therefore be needed.
If the migration fails its postcondition, retain the failure and arrange that
path; do not remove the assertion or broaden another role to force success.

Six local PGlite tests use actual roles and the mirrored migration. They first
reproduce metadata modification and TRUNCATE in a disposable plain-table fixture;
then demonstrate denied INSERT/upsert/UPDATE/DELETE/TRUNCATE for both roles,
retained SRID4326 lookup, revoked column grants, unchanged service capabilities,
owner/RLS state, retained rows, and atomic failure for insufficient grantor
authority or unexpected inherited privileges. This fixture has no PostGIS binary;
it does not claim to validate real transforms or extension upgrade behavior.

After review/CI, apply only through an authorised execution path. Verify actual
effective grants for both roles and the absence of PUBLIC mutation grants;
confirm ownership, extension membership, RLS and reference-row count remain
unchanged; exercise ST_Transform plus the existing venue/city geography discovery
queries. No destructive production probe is needed. Recheck these permissions
after future managed PostGIS upgrades.

Rollback: source-only rollback before application. After application keep the
read-only security boundary; if a legitimate lookup fails, diagnose its actual
role and apply an explicitly reviewed SELECT repair. Do not restore browser
mutation/TRUNCATE privileges or reset extension data as an application rollback.

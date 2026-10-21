# Explicit native, fleet and organisation analytics

Implemented on top of HQ #74/current primary 4e57bf7d. Both new runtime flags stay
false pending schema, permission and deployment acceptance. Existing venue reports
and the verified read-only funnel reader remain available under their own flags.
Shared commercial collection is still disabled; this work never configures retention,
backfills observations, changes billing or grants operating tools.

## Authoritative relationships

- Native accommodation retains its own property UUID. Its actual
  `accommodation_property_reservations.property_id` and active units supply request
  cohorts. `can_manage_accommodation_inventory` must be true, including the existing
  foundation/inventory readiness and property/team/workspace intersection. Missing
  schema, readiness, membership or time index fails closed. Native discovery
  interactions are explicitly unavailable; venue traffic is never borrowed.
- An organisation includes only explicit `operating_organisation_locations`.
  Native properties additionally require their explicit `workspace_id`, live
  workspace manager access and property inventory management. A shared owner is
  never a mapping. At most 100 locations and 100 linked native properties are
  accepted per report; larger scopes must use individual reports.
- Independent rental companies retain their company/vehicle/booking IDs. New
  owner-confirmed `akipulse_rental_workspaces` links allow organisation cohorts and
  workspace commercial observations. The owner must own both resources and have
  active workspace owner membership. No links are created automatically. Link
  changes are serialized against the company and recorded in a private append-only
  management audit; identity deletion anonymises its actor through the FK cascade.
  Managers cannot configure links. Each report intersects current branch management
  and current workspace management again. Unlinking or membership removal immediately
  removes that access. At most 100 explicitly linked branches enter an org report.
- The old optional **current** company `venue_id` can still authorize a funnel only
  through branch, venue and uniquely linked workspace management. Archived detached
  rental venue links are never used. Explicit new workspace links take precedence
  and cannot fall back around a lost permission.

Counts cover requests created in adjacent half-open elapsed UTC windows (7/30/90
days), grouped by their **current** status. Current relationships and permissions
select the scope. They are not booking confirmation cohorts, historical occupancy,
paid revenue or profit. Units and vehicles are active **now**. Quoted amounts are
not counted as revenue. Native and legacy reservation sources stay separately
labelled. Unknown native coverage is identified, excluded resources are counted,
and partial organisation reports are never described as complete totals.

## Commercial facts

The organisation projection scans verified ledger facts once across its bounded
explicit authorized workspaces and venue claims. Existing unique `(stage,proof_key)`
records prevent duplicate claims when two workspaces share the same venue. Current
subject consent and age/account eligibility remain required. No unique customer,
causal attribution or conversion-rate claim is added. Organisation coverage states
included and excluded workspaces. Property/branch panels explicitly identify these
as their linked operating workspace's stages, not exclusive property conversions.
Missing collection still returns `not_activated`, without manufacturing zero totals.

## Deployment phases and gates

Supabase CLI generated eight additive transactional phases, identical in database/
and supabase/ migrations. Every file is under 5 KB:

1. `20261021141734_akipulse_native_scope_adapters.sql`: private-to-clients workspace
   management predicate and bounded v2 scope selector.
2. `20261021141744_akipulse_organisation_verified_funnel.sql`: deduplicated shared
   ledger projection, guarded by org and each active workspace manager permission.
3. `20261021141816_akipulse_native_property_report.sql`: native cohorts and required
   `(property_id,created_at)` index.
4. `20261021141823_akipulse_native_organisation_report.sql`: v2 report dispatcher and
   native organisation supplement.
5. `20261021141838_akipulse_explicit_funnel_dispatch.sql`: guarded native/org/fleet
   funnel dispatcher.
6. `20261021142517_akipulse_explicit_rental_workspace_links.sql`: initially empty
   mapping and private audit; no raw browser or service-role grants.
7. `20261021142549_akipulse_rental_workspace_owner_controls.sql`: bounded owner-only
   options and audited save/unlink RPCs.
8. `20261021142652_akipulse_organisation_rental_cohorts.sql`: private-to-clients rental
   supplement, intersecting explicit org/workspace/company management.

Apply all eight after existing scoped Pulse, shared funnel and native foundation /
inventory schemas. Function bodies reference later phases but no new runtime flag
may be enabled before the complete sequence is installed and ACL-tested. Creation
itself does not activate collection or native foundation gates. The release owner
now has native schemas installed with all native gates false and empty tables.
This implementation agent performs no live migration or configuration writes.

After exact CI and authenticated owner/manager/foreign acceptance, the release owner
may enable `AKIPULSE_EXPLICIT_SCOPE_ADAPTERS_READY` for v2 dispatch. The independent
property selector additionally requires `AKIPULSE_NATIVE_PROPERTIES_READY` and the
existing native inventory database readiness/permissions. Keep either flag false
until its real prerequisites pass. Never enable collection to make an empty report
look populated. The owned-workspace selector is paginated (50 plus sentinel,
offset at most 10000), validates all submitted IDs server-side, and preserves EN/ES.

Rollback: turn off the two new reader flags and revert the UI/dispatch code. Keep
customer reservations and explicit mapping/audit records; do not delete source data.
Only gated additive functions/tables/indexes are introduced. Existing legacy source
IDs, grants, paid records, current reporting and customer data remain unchanged.

## Verification

The PGlite suite executes the exact migrations. Tests cover foreign/native property
access, role removal, schema/index/readiness absence, UTC boundaries, >10000 facts,
org/property/location limits, no same-owner inference, deduplicated shared claims,
consent filtering, explicit rental link ownership, idempotent saves, private grants,
link removal, current membership changes and privacy-preserving audit anonymisation.
The actual server action is tested with readiness enabled, authentication, rejected
foreign permissions and provider failures; no failure confirms a saved link.
Responsive fixtures label synthetic data and stub only action transport/router;
SQL tests exercise real guards. Real production acceptance remains separate.

Local acceptance checkpoint: 350 application tests, 30 PostgreSQL fixtures and 23
shared navigation regressions pass. The responsive real-component harness passes
80 scope × EN/ES × light/dark × phone/tablet/desktop cases, including the explicit
rental link save flow with labelled synthetic action transport. Full lint/types/
format checks pass. Exact production packaging and hosted CI are required before
merge; no source state is described as production activated.

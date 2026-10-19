# Independent accommodation management candidate

`/[locale]/business/accommodations?property=<UUID>` preserves venue-backed
management and adds independent property administration. The property ID is the
canonical scope. Legacy properties retain their venue ID and link back to their
existing workspace. New properties are private, have an explicit authenticated
owner, and need no public AkiPasa listing or invented venue.

Readiness is server-gated with AKISUITE_ACCOMMODATION_READY (default false).
Enable only after reviewed migrations 20261016010000 and 20261016020000, RLS/concurrency acceptance,
provider configuration and exact-head application checks. All management APIs
return unavailable while the gate is closed. The flag does not publish properties
or enable charges. Source is copied from the coordinated AkiPasa API/module
without sibling imports; changes must remain synchronized until packaged.

The client lists manager-visible properties and submits bounded typed operations
for room types, units, nightly rates, date blocks, booking settings and reservation
status transitions. Server auth, same-origin validation, bounded body parsing,
strict schemas, can_manage_accommodation_property and property-scoped writes
remain authoritative. SQL validates cross-property relationships, overlapping
inventory, quotes, allowed transitions and tenant access. Partial section failures
block dependent controls and never imply empty/free inventory. UI displays the
100-record pages with bounded explicit navigation (see below).

Confirmation transitions use the existing database outbox. This extracted app owns
no scheduler and does not send mail directly. No live test reservation, customer
email, public fake listing, payment or data migration is created by these tests.
Legacy venue units/reservations/media remain usable through existing screens.

Local API/component regressions verify both locale create flows, no venue payload,
selected property scoping, untrusted origin/body/auth/tenant rejection, partial
read failures and retained inputs after rejected writes. These are synthetic
acceptance, not proof of authenticated production or visual layout. Real owner,
other-tenant, concurrent booking, confirmation/media and mobile/desktop acceptance
remain mandatory before enabling the flag.

Rollback disables the server flag or restores the prior Worker version. Preserve
new independent property data and applied additive schema; never reset/reseed,
reassign ownership, erase reservations or detach existing workspace associations.

Profile editing loads existing authoritative values and saves explicitly; optional
review submission is not publication. Only the reviewed staff RPC can publish.
The media API validates upload size/type/signature, uses property-scoped storage
paths, signs manager reads and supports explicit 0–11 public gallery placement or
private/unplaced state. Gallery placement alone never publishes a private property.

## Explicit property team and bounded pagination

The readiness gate also requires migration `20261016050000_accommodation_property_team`.
Canonical independent owners can grant or revoke the existing manager role by exact
verified profile UUID in the Team tab. The SQL RPC rejects owner changes, legacy
venue-backed properties, unverified accounts, and callers without canonical ownership.
Managers cannot administer the team; no organisation membership is inherited and no
invitation email is sent. Existing venue-backed team management remains available from
the property's legacy venue link.

Property lists and inventory now paginate in stable order, 100 records at a time with
one-row lookahead. Requests accept pages 0–100 only (10,100 records); larger datasets
need a separately reviewed pagination extension. Inventory pages fail closed, and
missing rows never establish availability. Room/unit selectors use the currently loaded
inventory page: load the relevant room/unit page before opening its dependent form.
Team lists use the same bounded pages and an authoritative total. Photographs remain
bounded by the separately managed media interface.

Validation distinguishes UI fixtures from real backend acceptance: API tests exercise
scope forwarding, owner RPC denials and pagination bounds, component tests exercise
exact UUID grants/revocation and manager-only views. Backend owner/self/legacy/revoked
membership guarantees require the coordinated migration's SQL tests and production
acceptance before enabling this gate.

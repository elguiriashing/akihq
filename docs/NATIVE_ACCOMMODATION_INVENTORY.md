# Native property inventory compatibility

This follow-on depends on the corrected, still-unapplied foundation from PR249,
not the unsafe original PR244 head. Migration002500 creates only the distinct
accommodation*property_room_types, units, nightly_rates, unit_blocks,
booking_settings and reservations tables. Existing accommodation*\* venue tables,
identifiers, quotes and bookings remain untouched. AkiHQ maps bounded known
sections explicitly to the native namespace; it never guesses or falls back to
venue rows when property tables are unavailable.

Database inventory_enabled defaults false and requires the native foundation.
Server AKISUITE_ACCOMMODATION_INVENTORY_READY also defaults off. Both complement
the existing accommodation readiness and account/CRM/property membership checks.
Property owners and individually delegated managers may manage this listing
inventory only within the current organisation/property scope. A CRM role alone
cannot confer property access. RLS and RPCs recheck current access; primary keys
and property scope are immutable. Native customer reservation profile references
use SET NULL on account deletion; retained booking/business history survives.

Nightly prices are entered explicitly by the owner, with nonnegative cents and
unambiguous non-overlapping date ranges. There are no default sale prices or
automatic charges. Room/type/unit composite FKs prevent cross-property references.
Rate writes touch the room type and occupancy writes touch the unit, serializing
competing writes and rejecting stale repeatable-read snapshots. Half-open dates
allow adjacent stays and blocks. Active reservations and maintenance blocks cannot
overlap. Unknown/missing inventory never establishes availability.

Authenticated clients cannot INSERT, UPDATE or DELETE raw reservation rows or
prices/contact details. A property manager's status RPC permits only the existing
requested→confirmed/declined/cancelled, confirmed→checked_in/cancelled and
checked_in→completed transitions, with immutable audit and idempotent same-state
retries. No customer booking or quote-creation RPC is introduced by this inventory
foundation; that remains a separate consumer integration contract. Setting a
request/external preference is explicit owner configuration, not proof of an
operational customer booking or payment journey. A request policy and valid HTTPS
external URL are required where applicable.

Local verification includes nine actual-role inventory cases plus the eleven
corrected foundation/privacy cases: gates, ownership/CRM/account revocation,
composite FKs and immutable identities, rates and occupancy conflicts, forged
booking denial, state transitions/audit, private contact isolation, customer
profile deletion and preserved legacy venue records. AkiHQ API/manager/media
regressions cover the explicit table map and disabled-native fallback rejection.
Real concurrent hosted PostgreSQL and provider/authenticated UI acceptance remain
release gates. No native booking, production schema application or flag activation
is claimed.

Apply only the reviewed corrected001000 foundation and this additive002500,
with flags false. Deploy the coherent AkiHQ consumer, inspect exact-source CI,
and run controlled owner/foreign/revoked-property and actual concurrent occupancy
acceptance. Keep customer discovery/booking gated until its separate integration
is complete. Rollback disables native flags before reverting consumer adapters;
retain all property IDs, inventory, grants, receipts, media and audit history.

## 2026-10-21 | Bounded native gallery controls

Premium250-photo media editing now shares one datalist for positions instead
of rendering250 options in each of250 rows. Numeric per-photo position forms
retain explicit Save and blank-private behavior, preserving the same backend
position/entitlement rules and retained media. A full250-photo regression checks
250 options total and the exact selected property's placement request.
18 focused media/API/service-adapter cases pass with TypeScript and zero-warning
lint. Native runtime/database activation remains gated; no live changes.

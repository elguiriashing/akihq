# Listing schema-reader runtime configuration

This source configuration enables only the two server schema readers:
AKISUITE_LISTING_LIMITS_READY=true and AKISUITE_LISTING_UPLOADS_READY=true.
It does not alter a database gate, customer, price, subscription, storage object,
Cloudflare deployment or the independent giant historical bundle. Existing
AKISUITE_FEATURES_READY and AKISUITE_SUBSCRIPTIONS_READY remain false. The new
library has its own separate readiness/DB flag and is not enabled here.

The canonical free-management owner UI is AkiHQ
/{en|es}/business/venue/{id}?section=profile for media and ?section=events for events.
AkiPasa retains compatible management source and its existing hub handoffs;
this configuration does not change cross-product routing. The server reads listing_limits_info
only after authenticated venue membership. With database enabled=false, the
reader reports staged limits without enabling the quota UX; existing media flows
continue. With uploads_enforced=false, the byte-upload helper explicitly retains
the existing authenticated upload path even when its server reader flag is true.
This compatibility behavior is covered by the existing upload adapter regression.

After both exact-source consumers are deployed, base limits may be activated only
after forward identity guard233905, retained-customer/media verification and actual
owner/API acceptance. Then the venue UI shows the authoritative8/250 photo limit,
contextual listing Premium and pending event restrictions; SQL enforces4 distinct
events/month,5 Europe/Madrid calendar days, recurrence and duplication. Historical
media/events remain. Large hosted rollback acceptance attempts returned no result;
those calls are not passing acceptance evidence and must not be repeated blindly.

Strict bytes remain independently disabled until actual Storage API metadata,
digest/readback, signed-token behavior and concurrent-session acceptance. Reader
readiness is not evidence that strict uploads were enabled or tested live.

The staged independent accommodation property uploader uses a separate namespace.
The inspected actual schema and checked-in SQL lack its property/media ownership
and listing entitlement foundation. It remains gated and is not represented as a
venue listing. Legacy venue-backed accommodation listing paths are covered by the
same venue limits above. No fake property/venue or new entitlement is created.

Rollback reverts these source vars only while the DB gates remain false. Once
strict uploads are active, disable the strict database flag before removing its
reader/deployment; an old client otherwise fails closed. Preserve all rows and
publication ledgers. Coordinate database activation with the main release report.

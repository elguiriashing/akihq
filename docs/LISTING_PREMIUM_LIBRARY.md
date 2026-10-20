# Standalone listing Premium library

The historical20261012201529 bundle contains template, folder and shared-media
interfaces, but requires the old unapplied suite billing schema. This candidate
reuses the canonical RPC/component names without replaying that bundle or
activating operating subscriptions. AkiPasa owns the shared migration; HQ applies no duplicate SQL. New migration233027 depends on standalone
listing limits170415 and byte-reserved uploads173552. Quota activation also requires
identity-hardening233905; the combined regression installs all three plus233027. It refuses an already
installed historical library so those records require explicit reconciliation.
No historical tables, media, events, customers, plans or Stripe identifiers change.

The default-false `library_enabled` setting requires listing limits enabled.
Server readiness `AKISUITE_LISTING_LIBRARY_READY` defaults off. Both are required
for the new interface. Existing legacy readiness remains supported. No production
SQL, Storage upload, runtime setting or activation was performed for this patch.

## Scope and permission contract

An organisation relationship is accepted only through current CRM workspace/venue
links backed by the workspace owner's actual venue ownership; the platform's
ws_akipasa workspace is excluded. An active organisation membership intersects
with current source and destination venue membership. Listing Premium is resolved
by the standalone authoritative entitlement function, preserving legitimate legacy
billing grants. Ordinary organisation membership cannot expose another venue's
assets or templates. Raw template/folder tables grant SELECT under deny-all RLS;
bounded authorized RPCs return only the needed fields. No browser writes directly.

Premium members can save a named snapshot of event text/category/price/booking
content and reuse it as a draft in a permitted same-workspace venue. Dates,
recurrence, publication, ownership and revenue are never inferred or copied. The
original event and old snapshots remain after downgrade. Source membership loss,
CRM suspension, target membership loss or another workspace deny reuse immediately.

Premium folders are venue scoped, with current entitlement checked on every write,
including direct media UPDATE. Existing folder names remain visible after downgrade
where the user retains access; new organization requires Premium. Stored identity,
MIME and byte size cannot be reassigned through folder editing.

The shared library reads own assets and authorized same-workspace assets, bounded
to1000 results. New cross-venue placements require target Premium and both source
and destination access. Each authorized placement records an exact retained grant
(venue, asset, placement and target) so downgrades retain existing uses and their
restoration without licensing new reuse in another event/slot. Loss of source or
organisation access still denies access. Retained grants survive removal but
never grant access outside the current memberships. Removal checks all actual
placements under the asset owner's scope before deleting a file.

Own uploads and distinct shared assets count together toward8/250. Placement and
media insert guards use the same venue lock as upload reservations. The existing
verified byte reservation engine is preserved behind a private function and an
explicitly granted public wrapper. The wrapper accounts for shared paths alongside
owned media, actual objects and pending reservations under that same lock; failure
rolls back its reservation. Legacy Storage policy accounting also includes shared
assets. Shared reuse creates no new Storage object or unlicensed upload path.

## Release and rollback

1. Verify exact-source hosted CI/build and SQL migration compatibility, ensuring
   no historical template/folder schema exists. Do not replay old billing bundles.
2. Apply233027 with library_enabled=false after170415/173552. Validate actual owner,
   foreign tenant, removed membership and anonymous RPC boundaries without enabling
   the feature; retain all previous files and records.
3. Deploy both AkiPasa and AkiHQ consumers. Validate actual authenticated EN/ES,
   mobile/tablet/keyboard/theme and owner draft/error journeys using controlled
   acceptance data, including free quota,250 Premium, concurrent upload/shared
   placement and downgrade retention. Prior hosted large rollback calls hung and
   returned no acceptance evidence; do not claim them as passed or repeat them.
4. Enable only after previous listing/count and actual Storage byte-path acceptance
   are complete. Library activation does not enable operating tools or paid checkout.
5. Roll back the private library flag before reverting consumers. Preserve tables,
   retained placement grants, folders, snapshots and the reservation wrapper. Do not
   erase customer data or remove their legitimate existing Premium entitlements.

Independent accommodation properties remain a separate namespace. Their staged HQ
API exists, but the inspected production schema and checked-in SQL lack the actual
property/media ownership schema. That uploader remains gated until its original
schema and authoritative property-level listing subscription mapping are supplied
or implemented as a separately reviewed foundation. No accommodation is mapped to
a fabricated venue to reuse this contract.

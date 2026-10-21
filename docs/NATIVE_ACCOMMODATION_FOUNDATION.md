# Independent property listing foundation

The shared-schema candidate `20261021001000` creates genuine independent property
UUIDs, explicit property owners and delegates, optional CRM organisation scope,
private audited property listing entitlements, media and verified upload receipts.
It never creates a venue, replaces a property ID or infers that an operating plan
buys a property listing. New properties are Free. Ambiguous pre-existing native
property tables or a public native bucket abort the migration for reconciliation;
existing paid access must be established from actual billing evidence before import.
No existing venue inventory, users, customers or subscription records are modified.

The canonical migration belongs to AkiPasa's shared-schema history. AkiHQ owns the
native management adapter. Its existing `AKISUITE_ACCOMMODATION_READY` remains off;
new `AKISUITE_ACCOMMODATION_MEDIA_READY` also defaults off. Database `enabled` and
`uploads_enforced` default false. No production application or activation is claimed.

## Access and media

A property owner can create private accommodation independently or within a CRM
organisation they own and actively belong to. Organisation status and active
membership intersect property ownership/delegation on every call. A CRM admin alone
cannot manage arbitrary properties. Only the property owner delegates individual
managers; suspended, removed and restricted accounts lose access immediately.
Direct property ownership/publication writes and raw private entitlement/audit reads
are denied. Profile revisions return to private/pending; only an administrator can
publish an exact pending revision with a reason. Audits reject UPDATE and DELETE.

The property-level listing namespace supports reviewed billing, legacy, trial,
promotion and administrative grant records, independently of operating subscriptions.
A narrow administrator RPC records manual approved overrides or their revocation
with immutable audit references. It creates no Stripe product, price or payment.
Native checkout must remain disabled until verified Stripe events can resolve the
actual property and reviewed existing identifiers; a user-wide paid flag is not
silently treated as a property grant. The contextual link opens the existing
AkiDuermo listing subscription information, not a promise that payment is complete.

Free/Premium media limits are 8/250 and 1920/3840 pixels per side. Owned files and
pending reservations are deduplicated under a per-property lock; a scope row write
also forces stale repeatable-read transactions to serialize. Higher-resolution
reservations are revalidated after a downgrade. Existing over-quota media are
retained and new uploads blocked. Basic gallery slots are limited to the current
allowance while retained old positions survive a downgrade.

The browser prepares files through the existing safe image control at approved
quality .8/.9. The server parses actual static PNG/JPEG/WebP bytes, hashes them,
reserves the computed dimensions, uploads identical bytes with service credentials,
downloads and checks the digest, then issues a service-only receipt. Authenticated and anonymous
Storage INSERT/UPDATE are always denied for the native bucket, including while
the feature is disabled. Native reads/deletes also fail closed while disabled;
restrictive policies intersect pre-existing broad grants and policies. The Storage trigger
requires an unconsumed approved reservation even for a service write; metadata
INSERT consumes a matching authenticated owner receipt. No authenticated upload
fallback exists for the new native feature. Committed-media cleanup is protected
against ambiguous responses. Read/delete policies intersect broad existing policies;
only actual public gallery placements on published properties can be read publicly.

## Verification and rollout

Local actual-role SQL tests exercise default-off gates, true property IDs, foreign
workspace/owner isolation, active CRM intersection and immediate delegation revoke,
8 and 250 pending reservations, direct Storage/RPC receipt bypass denial, actual
receipt consumption, resolution changes, account restrictions, audited manual grants,
admin revision review, private/public gallery access, and over-quota retention.
Adapter tests check actual-byte hashes/dimensions, service-only writes, digest
substitution, ambiguous cleanup and closed gates. EN/ES UI tests retain captions on
quota rejection and preserve access to removal when the quota is exceeded.
These fixtures do not constitute concurrent hosted Postgres or Storage acceptance.

Before rollout: review exact-source CI/build, schema absence and native bucket
privacy, apply the migration with both flags false, deploy AkiHQ, then test controlled
real owner/foreign/revoked accounts, concurrent reservations and actual Storage
bytes using provider authentication. Reconcile any historical native objects and
paid records explicitly. Enable the native flags only after those checks and the
remaining native inventory adapters pass. Rollback disables gates first and reverts
consumers; preserve property UUIDs, media, grants, receipts and audit history.

Existing accommodation inventory tables are venue-scoped and remain untouched.
The staged native inventory API currently expects property_id under those old names.
A separate native inventory namespace and adapter follow-on is required before the
whole independent accommodation manager can be advertised as available. No native
booking or production property journey is considered live in this foundation.

## 2026-10-21 | Pre-application privacy correction

The original candidate001000 has not been applied. This descendant corrects both
base SQL copies before first application; the immutable earlier PR244 head must
not be applied. No unsafe base-then-repair exposure window is required. Native
bucket access fails closed while disabled, browser INSERT/UPDATE is always
denied, and restrictive DELETE covers anonymous and authenticated roles even
when older permissive policies are broad. Other bucket behavior is unchanged.

Property owners become NULL on profile deletion. The property is retained, made
private and marked orphaned_at for ownership review; remaining delegates cannot
manage the orphan and ownership is never assigned automatically. Memberships
and actor-bound upload receipts cascade with profile deletion, while retained
business media/grants and immutable pseudonymous audit records remain. This
avoids adding a new block to the existing account-deletion path; it does not
invent a financial/business retention schedule.

Three new actual-role cases combine broad legacy anonymous ALL policies with
disabled native storage and prove read/delete/update/insert denial, enabled
foreign-owner isolation and public-gallery anonymous deletion denial, plus
profile deletion with owned properties, delegated properties, pending uploads
and committed retained media. All11 privacy/foundation cases pass; provider
authentication/Storage acceptance remains required before activation.

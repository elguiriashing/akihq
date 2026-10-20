# Reserved listing uploads

This follow-up depends on the standalone listing limits migration
20261020170415, not the historic broad Premium migration. Migration173552 is
owned by AkiPasa and mirrored into its database and supabase migration directories. HQ consumes the shared database contract. It defaults `uploads_enforced=false`
and does not alter existing objects, media rows, subscriptions, or prices.

The venue and event image actions share a server helper. With both the runtime
`AKISUITE_LISTING_UPLOADS_READY=true` and database strict flag enabled, the helper
reads the actual image bytes, parses a bounded static PNG/JPEG/WebP frame, and
calculates SHA-256. An authenticated membership-scoped reservation binds the
listing, event if applicable, actor, generated path, dimensions, MIME, byte count
and digest. The listing quota lock counts pending reservations as well as stored
objects and media rows without double counting a path. Free images may be at most
1920 pixels on either axis; Premium3840. Browser preparation uses JPEG quality
.8/.9 respectively. Animated and structurally ambiguous image containers are
rejected. The bounded parser validates dimensions, not full pixel decoding.

Only the server service client uploads the reserved bytes. It downloads the
stored object and recomputes digest and dimensions before calling the
service-only completion RPC. Metadata must match the reservation. The final
media insert uses the authenticated member session; a trigger checks current
membership, current dimensions entitlement, stored evidence and reservation
actor, then consumes the receipt once. Size and MIME come from the receipt.
Moving an existing media row to a different path/listing is prohibited. A
failed or ambiguous insert cleanup first asks the service-only cancellation RPC:
committed receipts are never deleted by that cleanup.

When strict enforcement is enabled, restrictive policies deny authenticated
INSERT and UPDATE to event-media even through direct Storage requests. Existing
SELECT and DELETE policies remain in effect. No database SQL writes Storage
metadata. Object writes and cleanup use the Storage API. Service credentials
remain server-only. Reservations expire after15minutes; abandoned objects remain
counted until Storage cleanup, so expiry cannot produce an extra quota slot for
stored bytes. An authenticated client can reserve its own slots without uploading;
this can only consume its own listing allowance, not bypass limits.

## Atomic rollout acceptance

1. Apply the count/event migration with its gate closed, then173552 with strict
   gate closed. Verify source/live schema parity and backup/rollback checkpoint.
2. Deploy both AkiPasa and AkiHQ upload actions with runtime ready set. While the
   DB strict flag remains false, existing authenticated uploads continue working.
   Confirm the independent accommodation uploader remains gated: its actual
   property tables are absent from the inspected production schema. Do not map
   independent properties to fake venue rows.
3. In an isolated Supabase project matching production Storage, enable both DB
   flags and test real owner free/Premium venue and event uploads, actual object
   metadata, unchanged digest after download, provider INSERT/UPDATE timing,
   8/250 boundaries, malicious direct Storage requests, unauthorized RPCs, and
   two independent concurrent sessions competing for the last slot. Test stale
   pre-issued signed upload URLs; no signed uploader exists in these repos, but
   provider-issued tokens require explicit acceptance before live cutover.
4. Verify both deployed products handle a strict-mode upload before atomically
   setting enabled=true, uploads_enforced=true. The constraint prevents strict
   mode without count enforcement. An old deployment fails closed after strict
   activation; never activate while old upload actions remain in service.
5. Smoke test retained media read/delete, event upload, downgrade refusal,
   membership revocation, and inline errors/draft retention. Inspect private
   reservations with administrator access only.

For rollback set uploads_enforced=false before rolling back either application.
Leave enabled=true to retain image/event quotas. Do not drop reservations or
remove existing media. Do not expose service keys to a browser or introduce a
signed upload URL around the server byte-validation path.

## Validation and limits

Scoped automated evidence includes real-role PGlite execution of both migrations,
owner/foreign actor/service boundaries, restrictive Storage policy writes,
reservation8th/9th limits, expiry, forged evidence, one-use receipt, immutable
identity, Premium downgrade and membership revocation. Adapter tests prove exact
bytes uploaded/read back, substitution failure, safe ambiguous cleanup and
closed-gate legacy compatibility. Image tests cover1920/3840 profiles, actual PNG,
JPEG framing, WebP canvas mismatch, animation and trailing/extra frames.

PGlite uses a serialized connection; it does not replace the independent-session
Storage acceptance above. No production activation or real Storage API upload
was performed by this patch. No independent property media namespace exists in
the inspected schema, so independent-property enforcement remains a gated
integration dependency rather than a claimed venue-table implementation.

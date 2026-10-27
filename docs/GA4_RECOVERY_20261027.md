# Independent GA4 recovery: AkiHQ

Status: staged source, not activated or verified production collection.

## Change impact and provenance

Port of the isolated consent repair in elguiriashing/AkiCoches PR 62, with canonical host akihq.app. Root ConsentAnalytics affects every route, EN/ES, both themes and anonymous/signed-in roles. Existing server trackingAllowed AND stored consent remain authoritative. No UI, route, tenant permission, schema, storage, billing, Android or Firebase configuration changes.

NEXT_PUBLIC_GA4_MEASUREMENT_ID must be the verified AkiHQ web-stream G- ID at build time. Missing/invalid/copied AkiPasa IDs disable collection. Only akihq.app and www.akihq.app can load the tag. Native Arguments replace the broken array-shaped queue. Advertising consent remains denied and Google Signals/personalization stay disabled. Defaults precede configuration; revocation disables measurement and removes only GA cookies on this domain; remounts do not duplicate configuration.

## Evidence and release gates

On 27 October, neither Worker akihq-management-preview nor its production build trigger 67bd2bf6-778e-4ecf-953d-1b08893d9c8b contained a GA4 measurement ID. Despite its historical name this Worker serves the canonical management product; do not deploy to a different project. The earlier Google property/link work was owner-confirmed, not independently verified here. This PR changes no property, link, DNS token, sitemap or indexing policy.

Twenty effect tests against the actual transpiled component passed locally on Node 22.16.0 with installed TypeScript. The new read-only CI job repeats them with locked dependencies. These mocks do not replace existing formatting/lint/typecheck/test/build/Cloudflare/browser gates, nor prove Google receipt. Reconcile the master/extraction/impact ledgers before release.

Before release, recover and verify the already-created AkiHQ web-stream measurement ID, set NEXT_PUBLIC_GA4_MEASUREMENT_ID in its production build trigger, rebuild the reviewed SHA and verify the live source stamp. Check one correct destination and GA4 Realtime/DebugView in a consented eligible session, and no collection for denied/withdrawn consent, restricted accounts or preview hosts. Verify EN/ES. Preserve existing Search Console links, and verify sitemaps and private-workspace noindex separately.

Rollback by removing the build variable and rebuilding; do not restore the copied AkiPasa destination. No data rollback. This source recovery does not replace uncommitted Alex-Laptop work.

# AkiPulse trusted commercial observations

This UI/projection is implemented, gated, and not production activated. It depends
on AkiPasa migration 20261020234414_trusted_business_funnel and its separately
reviewed collection/consent/retention decisions. HQ migration 20261020235637 is
additive; deploy after its existing scoped report and CRM workspace prerequisites.
The shared stage function may be absent: the adapter reports that explicitly.

Set AKISUITE_FUNNEL_READY only after both schemas and cross-product permissions are
validated; no production setting is changed here. The existing Pulse/scoped-report
flags remain required. DB collection stays disabled until an approved retention
period and review reference are configured. HQ never captures proof or changes
billing, consent, referral attribution or entitlement state.

The only supported mapping is a venue or listing-linked accommodation scope with
exactly one active/trial CRM workspace whose source_venue_id equals the selected
venue. Authorization intersects the original scoped-report management check and
active workspace owner/admin/manager membership plus crm_can_access_workspace.
The shared projection rechecks those permissions using the real auth.uid(). No
private independent property, rental branch, organisation sum or arbitrary client
workspace identifier is inferred. Missing/ambiguous mapping and insufficient
workspace management show specific unavailable messages, without private details.

Counts are approved claims, owner-created management workspaces, provider-created
checkout sessions, verified paid invoices, paid package upgrades and effective
cancellations. They are different facts subject to existing current analytics AND
marketing consent and age/onboarding eligibility. They are not unique prospects,
causal attribution, revenue, or a conversion rate. First HQ website visit is not
called activation. Sitewide Google traffic and consented GA4 clicks remain separate.

The panel independently shows a rolling period ending now, its collection start,
and the smaller of the selected period and approved retention. It does not claim
these are the adjacent historical booking comparison windows. No backfill occurs.
Missing stage observations are labelled as such rather than claiming zero total
business activity. Claims without authorized source linkage are explicitly absent.

Verification: PGlite applies the entire projection and checks scope authorization,
missing/ambiguous mappings, membership, unsupported scopes, absent shared function
and onboarding denial. EN/ES rendering and strict response scope/period validation
cover observed counts and missing data. Full repository CI/build and authenticated
preview/mobile/tablet acceptance remain release gates. No production data is used.
Rollback: disable only the HQ readiness flag/revert this panel and projection; keep
shared optional-data retention maintenance according to the approved policy. Never
delete financial or historical analytics data as a UI rollback.

Local acceptance checkpoint: 298 application tests, 16 PostgreSQL scope fixtures and
23 shared-navigation regressions pass. The real-component responsive harness passes
64 venue/property/fleet/organisation × EN/ES × light/dark × phone/tablet portrait/
tablet landscape/desktop combinations, including verified counts, unsupported
mapping text, 44px controls, keyboard focus, overflow and denied-state checks.
Evidence: test-results/akipulse-scoped/evidence.json (generated, not committed).
This uses labelled synthetic data and no provider calls; actual authenticated
production mapping/consent journeys still require release acceptance.

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

Reconciliation checkpoint (21 October 2026): this successor reuses PR #63 and
preserves main e2492a4f's Next 16 runtime, compact Pulse disclosure, resilient
management home and loyalty workspace. The shared canonical stage schema is now
installed by the release owner, with collection disabled, retention NULL and no
observations. The release owner has now installed this exact projection and verified authenticated
execution allowed, anonymous execution denied and collection still disabled with
zero observations. The checked-in AKISUITE_FUNNEL_READY flag now enables only the
reader; deployment and real-owner acceptance remain release gates.

Release sequence:

1. Review/apply the identical 2,589-byte HQ projection migration after its prerequisites.
   It is one transactional phase, without data writes or collection activation.
2. Verify authenticated owner access returns not_activated while foreign and
   anonymous access are denied; verify raw stage tables remain private.
3. Deploy this exact tested source and only then enable AKISUITE_FUNNEL_READY after
   the projection is installed and validated. AKIPULSE_ENABLED and
   AKIPULSE_SCOPED_BOOKINGS_READY remain required by the existing dashboard.
4. Keep shared collection disabled and retention NULL pending the separate policy
   approval. Reader readiness never enables collection or authorizes tracking.

The SQL fixtures additionally check nullable access-helper denial and preserve the
real caller through the shared projection. Application and responsive harness
results are recorded in the successor PR; synthetic observations are labelled in
fixtures. Actual production mapping and consent journeys remain release gates.

Local successor validation: 341 application cases (342 after the readiness guard),
18 PostgreSQL cases, 23 navigation cases, full lint/types/format and the supported
Next 16/OpenNext Cloudflare build plus Wrangler dry-run pass. The real-component
harness passes 64 scope × locale × theme × responsive viewport cases with labelled
synthetic observations, keyboard/overflow/44px target and denied-state checks.
Hosted CI must validate the final exact successor commit before merge.

# AkiPulse / commercial conversion mission checkpoint

2026-10-20. Implemented on the independent AkiHQ repository.

| Deliverable                                  | Status                                            | Evidence / remaining gate                                                                                                     |
| -------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Unified free activity workspace              | Implemented and unit tested                       | `AkiPulse.tsx`, `akipulse.ts`; server flag defaults off                                                                       |
| Location and 7/30/90-day filters             | Tested                                            | membership-scoped loader regression and exact UTC boundary tests                                                              |
| Previous period/action comparison            | Tested                                            | no partial aggregate on unknown data; counts detect truncation                                                                |
| Accurate listing readiness                   | Implemented and tested                            | Five content/publication checks,20 points each. Missing source field prevents a score; no growth prediction.                  |
| Correct free hub / paid operations handoff   | Implemented                                       | removed historic misleading €14.99 AkiBusiness listing upsell; neutral bilingual handoff                                      |
| Advanced operational reporting               | Blocked                                           | exact current tool entitlements, billing and operational data adapter acceptance required; data not fabricated                |
| Organisation/property/fleet analytics        | Not started                                       | separate ownership and source models require explicit scoped aggregate contract                                               |
| Booking confirmations and acquisition funnel | Not started                                       | no authenticated bounded aggregate/source attribution integration yet                                                         |
| Wider business health scoring                | Partial                                           | Listing completeness implemented; engagement, confirmed bookings and operational components require measured source adapters. |
| Cross-suite contextual CTAs/demos            | Implemented for discovery details and rental home | AkiPasa#211, AkiDuermo#23, AkiCoches#27; neutral paid handoff avoids unverified ownership/entitlement inference.              |
| Production release                           | Blocked                                           | exact-source CI/packaging, authenticated provider and responsive acceptance, then flag activation                             |

No database migration, production write, billing change, financial action or deployment
was performed by this workstream. The application can retain existing analytics
through the disabled flag. Existing venue RLS remains authoritative.

Category-specific workflow previews and current-consent GA4 CTA signals are implemented in the shared BusinessPathway presentation. No verified-payment or completed-claim event is inferred from clicks.

## Release evidence

- AkiHQ PR#50 remote source1b44e18a04481dd853ab849db00def5f1d5de0d7; local source-equivalent tree028f9db20697401a87c8aa1f42ebd51a738307f9. Local243 tests/29 files, lint, types, formatting and full Cloudflare package passed. No local browser binary; hosted/authenticated acceptance pending.
- AkiPasa PR#211 source39e240a33727926bf5685c05d3c7032215798e5e. Five pathway tests pass. Local broader typecheck was killed exit137 under shared memory pressure; exact-head hosted CI pending.
- AkiDuermo PR#23 source75de5f965a0deff416c604b9954ae8bcfc08cd1b.209 full tests, lint, typecheck and Next build pass.
- AkiCoches PR#27 source4f693e315c9394be785d7d58ea5fd2f6a2e3777e. Five pathway tests, lint and typecheck pass. Exact-head hosted full checks pending.
- No PR merged, flag activated or production deployment performed by this workstream.

## Integrated release checkpoint — 20 October 2026

PR50 now incorporates current main, listing compatibility52, shared eligibility53,
least-privilege security54 and strict upload consumer56. Source tests pass278 cases
plus23 navigation cases; the optimized product build passes. AkiPulse browser
fixtures pass16 viewport/language/theme combinations including unavailable data.
Hosted checks on the integrated commit remain required before merge.

Security PR54 merged as7139cd55e9ba0868ce11b857dbab9e693f609b61. The targeted
analytics_events privilege migration was applied to the verified shared project.
Post-application checks confirm anonymous capabilities absent, authenticated SELECT
only with tenant RLS enabled, service capabilities preserved and251 retained rows.
The other feature migrations and activation switches remain unapplied/off.

Discovery integrations are merged: Duermo25 asddbc2c4ccddc42380624bb258a86e2d306ef69b5
and Coches29 asb0828fe58a16bd5fa77207d71c49494453956af7. Exact production deployment
and authenticated acceptance remain distinct verification gates.

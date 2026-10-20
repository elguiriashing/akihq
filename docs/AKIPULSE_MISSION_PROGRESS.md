# AkiPulse / commercial conversion mission checkpoint

2026-10-20. Implemented on the independent AkiHQ repository.

| Deliverable                                  | Status                                                              | Evidence / remaining gate                                                                                                     |
| -------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Unified free activity workspace              | Implemented and unit tested                                         | `AkiPulse.tsx`, `akipulse.ts`; server flag defaults off                                                                       |
| Location and 7/30/90-day filters             | Tested                                                              | membership-scoped loader regression and exact UTC boundary tests                                                              |
| Previous period/action comparison            | Tested                                                              | no partial aggregate on unknown data; counts detect truncation                                                                |
| Accurate listing readiness                   | Implemented and tested                                              | Five content/publication checks,20 points each. Missing source field prevents a score; no growth prediction.                  |
| Correct free hub / paid operations handoff   | Implemented                                                         | removed historic misleading €14.99 AkiBusiness listing upsell; neutral bilingual handoff                                      |
| Advanced operational reporting               | Blocked                                                             | exact current tool entitlements, billing and operational data adapter acceptance required; data not fabricated                |
| Organisation/property/fleet analytics        | Scoped implementation and tests; incomplete mapping excluded        | 13 PGlite tests cover source ownership; independent property/org-fleet mapping still lacks a verified adapter                 |
| Booking confirmations and acquisition funnel | Booking-created cohorts implemented; commercial attribution blocked | bounded booking aggregates implemented; no verified scoped commercial attribution source                                      |
| Wider business health scoring                | Partial                                                             | Listing completeness implemented; engagement, confirmed bookings and operational components require measured source adapters. |
| Cross-suite contextual CTAs/demos            | Implemented for discovery details and rental home                   | AkiPasa#211, AkiDuermo#23, AkiCoches#27; neutral paid handoff avoids unverified ownership/entitlement inference.              |
| Production release                           | Blocked                                                             | exact-source CI/packaging, authenticated provider and responsive acceptance, then flag activation                             |

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

## 2026-10-20 | Scoped booking aggregate amendment

Implemented behind **both** `AKIPULSE_ENABLED` and the new default-off
`AKIPULSE_SCOPED_BOOKINGS_READY` server flag:

- Explicitly managed venue, listing-linked accommodation, rental branch and
  organisation selectors, with bounded 50-item pages. An independent rental branch
  does not need an invented venue attachment.
- Server-authorised aggregates compare requests **created** in the selected UTC
  7/30/90-day period with the preceding equal interval, grouped by current status.
  Confirmation timestamps, payments, revenue and historical occupancy are not
  inferred. The UI describes this cohort meaning and shows its exact boundaries.
- Current active units/vehicles are labelled as current inventory. No claim of
  historical availability/utilisation is made.
- Organisation reports require current organisation management **and** individual
  owner/manager access to each explicit `crm_workspaces.source_venue_id`. Imported
  CRM leads/catalogue records are not ownership. Unlinked/inaccessible locations
  are disclosed and excluded; reports never claim to be complete organisation
  totals when coverage is partial. Organisations above 100 attached locations
  fail explicitly instead of silently truncating.
- Rental/company-to-organisation and independent-property source adapters remain
  unavailable until their explicit authoritative mapping/schema is accepted.
  Existing records, ownership and management experiences remain intact.
- Scoped action counts use existing consent-dependent `analytics_events`. They
  are not unique visitors or attributable conversions. No new tracking is added.
- The commercial acquisition funnel/source panel explicitly reports unavailable:
  the existing approved GA4 CTA signal has no verified tenant-scoped linkage to
  completed claims, HQ activation and verified payment. No conversion rate,
  sitewide Google metric, fabricated acquisition source or causal funnel is shown.

Migration `20261020180504_akipulse_scoped_booking_aggregates.sql` was created with
Supabase CLI 2.121.0. It adds three scope/time indexes and two authenticated-only
read RPCs with fixed empty search paths and explicit management checks. It changes
no source RLS, table grants, subscriptions, rows or monetary configuration. Raw
customer contact fields and profile IDs are absent from the report output.

The route calls the new RPCs only when both rollout flags are enabled. Report
validation rejects a different resource/kind/period, malformed totals and invented
revenue availability. Errors withhold figures rather than using cached values or
substituting a zero. No browser cache stores report data.

Initial local verification: 13 real PGlite SQL tests and 6 new UI/schema contract
cases passed, with the existing 6 Pulse cases unchanged. Full product verification,
exact-head hosted CI, authenticated preview acceptance and realistic query plans
remain release gates. No migration was applied or feature flag activated.

Rollback: disable `AKIPULSE_SCOPED_BOOKINGS_READY`; the original Pulse view remains.
Revert source if needed. Retain compatible read-only indexes/RPCs, or remove execute
grants with a reviewed forward migration. Never remove bookings or ownership data.

Validation checkpoint: full product suite284 Vitest +13 PGlite +23 navigation tests;64 real-component browser combinations passed (all four scope kinds, EN/ES, light/dark, phone/tablet portrait/tablet landscape/desktop). Full lint/typecheck and independent Next production build passed. Screenshots are labelled synthetic fixtures, not live customer or authenticated production acceptance.

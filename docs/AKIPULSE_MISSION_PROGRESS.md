# AkiPulse / commercial conversion mission checkpoint

2026-10-20. Implemented on the independent AkiHQ repository.

| Deliverable                                  | Status                      | Evidence / remaining gate                                                                                      |
| -------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Unified free activity workspace              | Implemented and unit tested | `AkiPulse.tsx`, `akipulse.ts`; server flag defaults off                                                        |
| Location and 7/30/90-day filters             | Tested                      | membership-scoped loader regression and exact UTC boundary tests                                               |
| Previous period/action comparison            | Tested                      | no partial aggregate on unknown data; counts detect truncation                                                 |
| Accurate listing readiness                   | Implemented                 | publication state and saved event count only                                                                   |
| Correct free hub / paid operations handoff   | Implemented                 | removed historic misleading €14.99 AkiBusiness listing upsell; neutral bilingual handoff                       |
| Advanced operational reporting               | Blocked                     | exact current tool entitlements, billing and operational data adapter acceptance required; data not fabricated |
| Organisation/property/fleet analytics        | Not started                 | separate ownership and source models require explicit scoped aggregate contract                                |
| Booking confirmations and acquisition funnel | Not started                 | no authenticated bounded aggregate/source attribution integration yet                                          |
| Health scoring                               | Not started                 | agreed explainable component coverage and source measurements required                                         |
| Cross-suite contextual CTAs/demos            | Partial                     | AkiHQ handoff only; discovery apps still require role-aware CTA audit and category previews                    |
| Production release                           | Blocked                     | exact-source CI/packaging, authenticated provider and responsive acceptance, then flag activation              |

No database migration, production write, billing change, financial action or deployment
was performed by this workstream. The application can retain existing analytics
through the disabled flag. Existing venue RLS remains authoritative.

Category-specific workflow previews and current-consent GA4 CTA signals are implemented in the shared BusinessPathway presentation. No verified-payment or completed-claim event is inferred from clicks.

# Approved AkiSuite pricing · 24 October 2026

Alex's current instruction supersedes earlier sales catalogues and tier names.
Prices are monthly EUR. Existing subscriptions retain their recorded terms.

| Product              | Audience                      | Monthly price |
| -------------------- | ----------------------------- | ------------: |
| AkiBusiness Basic    | Operating location · 4 tools  |        €19.99 |
| AkiBusiness Standard | Operating location · 8 tools  |        €48.99 |
| AkiBusiness Pro      | Operating location · 12 tools |        €97.99 |
| AkiDuermo Premium    | Individuals                   |         €1.99 |
| AkiDuermo Premium    | Businesses · property         |        €24.99 |
| AkiCoches Premium    | Individuals                   |         €1.99 |
| AkiCoches Premium    | Businesses · rental branch    |        €19.99 |
| AkiPasa Premium      | Individuals                   |         €1.99 |
| AkiPasa Premium      | Businesses · location         |        €11.99 |

AkiHQ remains free for all three discovery products. Business Premium upgrades
that product's listing and management experience in AkiHQ. AkiBusiness paid
operations are separate. Its historical machine keys `basico` / `standard` / `pro`
remain stable while public names are Basic / Standard / Pro. Tool capacities,
monthly replacement limits (1 / 2 / unrestricted), staff rights and existing data
are unchanged.

`config/approved-pricing.json` is the synchronized current catalogue in all five
repositories. Stripe IDs and creation readbacks are in
`docs/receipts/APPROVED_PRICING_20261024.json`. Historical immutable migrations,
annual amounts, prices, subscriptions and schedules are not silently rewritten.
No new annual offer is inferred from this monthly approval.

The existing `akibusiness_premium` database code means **AkiPasa Premium for
businesses**; it does not grant AkiBusiness operating software. The existing
`akiduermo_premium` code is property/workspace Premium. New personal Duermo/Coches
and independent rental Premium records are staged catalogue records; displaying
the approved price does not activate new entitlements or payment flows.

## Dependency and release boundary

The current change covers discovery audience cards and canonical metadata, AkiHQ
upgrade comparison, Pasa account/growth screens and authoritative billing catalogue,
AkiBusiness landing/comparison/toolbox and service-worker cache, Stripe new price
records, and the database's exact-price checkout guard. Customer bookings, RLS,
consent, auth, scheduled jobs, existing subscription terms and readiness switches
remain authoritative. No customer is charged, repriced, migrated or emailed.

New checkout reserves only the revised price for the selected operating tier.
Already verified historical renewal schedules remain readable; no schedule is
created or changed. The additive migration changes two function definitions and
retains ownership checks, explicit role grants, locking and idempotency.

Marketing explains the real limitation of a basic listing and the value of
expanded presentation and management. Upgrade CTAs lead to review or an explicit
availability enquiry. There are no fake scarcity, guaranteed outcomes, invented
popularity, hidden fees, mandatory paid AkiHQ access or claimed live gated features.
Checkout still requires separate billing, tax, schema and feature acceptance.

Validation: the local SQL lifecycle and role suite passes 36/36. Full source,
rendered EN/ES, browser/CI, production source and provider readback evidence must
be appended before declaring the release verified. Roll back source/provider
configuration to the recorded predecessor; preserve customer records and legacy
billing history. Any SQL rollback must be a reviewed forward migration.

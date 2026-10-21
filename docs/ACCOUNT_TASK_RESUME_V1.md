# Account task resume contract v1

Implemented, tested locally; merge and production acceptance remain pending.

AkiPasa is the sole completion authority. The local account-resume endpoint first
requires identity and reads the caller-only onboarding state. Pending and underage
sessions return to completion. Complete and grandfathered accounts may resume an
allowlisted product/relative task at its fixed canonical origin. EN/ES is retained
using the suite-navigation format, including `locale` for static AkiBusiness.
No token, PKCE code, email, auth cookie or arbitrary external URL crosses domains.
Each destination still requires its host-local session and existing tenant checks.

Only explicit account/business/booking/discovery task paths and bounded task query
keys survive. Encoded controls, fragments, traversal, scheme-relative URLs,
unknown products, auth/onboarding loops and nested redirects are rejected or
replaced with the product's account landing. Completion envelopes remain local
`next` values through password and Google/email callbacks; they grant no access.

The existing readiness switches and central cohort remain disabled. Ship all five
consumers and central endpoint before enabling enrollment. Existing users, paid
features, data and identity are preserved. Rollback before enrollment is source
only; after enrollment retain compatible guards and stop new enrollment first.

Verification includes the five-product/both-language URL matrix, hostile paths,
duplicate/secret query removal, email/OAuth completion-envelope roundtrip, direct
pending/underage resume denial and complete/exempt resume. Real provider sessions
and five-domain deployment acceptance remain release requirements.

## Legacy management scope names — 21 October 2026

The canonical task envelope retains `property`, `company` and `organisation`, because existing destination routes consume those exact query names. The `...Id` keys remain available for their existing callers. Every value must be a unique bounded alphanumeric/underscore/hyphen string; repeated arrays, URL values, traversal characters and oversized values are dropped. Passing a scope is navigation context and grants no ownership or API permission.

EN/ES contract tests cover all five product origins, central envelope reconstruction and invalid values. HQ actual page tests additionally traverse pending/underage gating and completed destination consumption: requested accommodation initial selection, the second owned rental branch (including database filters), and organisation-scoped RPC/query selection. An unknown rental company still reaches notFound. No location is silently replaced by the first branch.

Feature/backend/billing flags, source pins and runtime configuration are unchanged. Existing data, ownership and RLS remain authoritative. This correction follows the Next16 release without changing dependencies. Exact source tests and release gates are tracked in the amendment PR.

HQ scoped callers also retain the required locale prefix in the local auth `next` path. Actual tests pass that anonymous redirect through the real native auth sanitizer before onboarding and destination consumption; business home’s existing correct prefix is retained.

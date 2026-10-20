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

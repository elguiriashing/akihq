# Shared account eligibility candidate

Source contract: AkiPasa PR #212, `my_account_onboarding()` and the private disabled
cohort migration owned only by AkiPasa. This repository applies no shared schema
and creates no independent identity, age ledger or acceptance version.

`AKISUITE_ONBOARDING_SCHEMA_READY` remains unset until the shared migration and
five-product rollout are accepted. When enabled, server member guards and auth
returns read the caller-only state: pending/underage deny account features;
complete/exempt retain existing permissions and RLS. Unknown/provider-failed
state fails closed. Existing users are not backfilled or classified as adults.

Restricted sessions hand off to AkiPasa's same-language completion route with no
auth token, credential or arbitrary external destination. A separate host-local
sign-in may be needed there. After completion users can switch back via AkiSuite;
seamless task resume is not yet implemented. Password recovery remains local.
Privacy notices, optional tracking withdrawal and sign-out remain available; the
central completion safety page provides data export and deletion requests.

Root Google tracking and supported server analytics/behaviour ingestion suppress
restricted sessions. A negative declaration never becomes an analytics attribute.
Nonessential tracking still requires existing consent for otherwise eligible
users. Consent APIs cannot opt restricted sessions back in.

Required before activation: exact-head full repository CI/build, authenticated
email/Google/canonical and preview acceptance, foreign-tenant/member denial,
all remaining direct RPC/read coverage, restricted privacy/export/deletion and
EN/ES/mobile/tablet/keyboard/theme acceptance. No production validation or legal
approval is claimed by local tests. Existing data and subscriptions remain intact.

Before activation rollback is source-only. After cohort enrolment, retain an
eligibility-compatible build and stop new enrolment under the shared runbook; do
not erase declarations, paid entitlements, bookings, progress or customer data.

## Local checkpoint

8 scoped eligibility tests passed, including direct member-page restrictions. Changed TypeScript/JS sources passed ESLint and TypeScript. These are bounded
local checks; full repository CI/build, native auth and canonical runtime
acceptance remain pending. No production schema/configuration was changed.

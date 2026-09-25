# Release validation, 23 September 2026

Automated checks run against the release candidate, with pinned PGlite 0.3.14 and jsdom 26.1.0. All dependency paths resolve from the repository's `cloudflare/node_modules` after `npm ci --prefix cloudflare`.

- JavaScript syntax and `git diff --check`.
- The existing Worker/support/company-import tests, plus new fiscal, privacy, inventory, access, checkout and interface tests.
- All five new SQL migrations applied together to a disposable representative prerequisite schema, with actual SQL permission and transaction assertions.
- Exact money, stable request replay, server catalogue checks, one stock deduction, default-location guards, stale counts, transfer/valuation history, unknown costs, immutable evidence and reconciliation/cancellation.
- Cross-tenant and role-template access; profile escalation; secret redaction; snapshot optimistic locking; unchanged-timestamp permission revocation; cost-free cashier data.
- Consent/suppression/idempotency, verified subject export, request deadlines, unsubscribe, signed provider callbacks and AI support disclosure.
- Real app IIFE execution in jsdom for uncertain checkout outcomes, nonqueued cross-tab locks, identity/workspace/permission changes while requests are outstanding and late response handling.
- Excel write/read roundtrips, text/formula safety, keyset pagination beyond server row caps, stable fiscal snapshots, timezone/DST boundaries, valuation metadata and incomplete-export failures.
- AEAT official SHA256 examples and generated F1/F2/R1/R5 XML validated against the official schemas fetched during this work. XML validity is not a complete fiscal-service acceptance test.
- Cloudflare Worker bundled successfully using Wrangler's deployment dry run. No upload/deployment occurred.

Final run: **276 tests, 275 passed, zero failed, one skipped** (approximately 44 seconds, including the accommodation changes merged from main). The same totals are recorded in the pull request. One optional 107,357-row private workbook fixture is skipped when `AKIPASA_IMPORT_FIXTURE` is unavailable; the normal generated parser/import fixtures run.

Not verified: an authenticated deployed browser session, actual PostgreSQL multi-session concurrency, live AEAT/provider delivery, production restore, full device/accessibility acceptance or operational/legal organizational procedures. No production records or schema were changed. Local tests cannot certify the full suite as legally compliant.

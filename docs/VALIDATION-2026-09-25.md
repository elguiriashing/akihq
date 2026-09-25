# Hospitality validation — 25 September 2026

The new migration is applied after all five earlier compliance migrations against the representative PostgreSQL/PGlite fixture. Tests run actual SQL and role grants, not a mocked database.

New coverage includes access, table occupancy, server pricing, stale revisions, exact idempotent replay, cancellation tombstones, partial transfers, preparation state conservation, rounding conservation, partial/final payments, single stock deduction, printer claims, print-attempt exclusion, immutable events/tickets, null layout rejection, live entitlement revocation, bounded accountant evidence exports and operation-level cash limits after splitting a bill.

The browser controller runs in jsdom with the real generated forms. Tests cover table selection, version-preserving form submission, exact retry after network loss, Web Lock/storage failures before submission, escaped ticket HTML, explicit non-fiscal/copy labels and preventing a second print without a copy request.

The cloud browser rejected the local fixture URL under its URL security policy. No workaround was attempted. Consequently, no rendered-browser visual or mobile-device acceptance is claimed. Desktop/phone-shaped synthetic HTML was generated locally only; it was not a production deployment.

**Previous hospitality gate: 291 tests, 290 passed, zero failed, one skipped (55.9 seconds).** JavaScript syntax and whitespace checks also passed. The existing private large-workbook fixture remains optional. No production schema/data, frontend or Worker deployment was changed in this task.

## Unattended printing, layout editing and atomic fiscal follow-up

Full gate: `npm run check --prefix cloudflare`: **309 tests, 308 passed, zero failed, one optional private-workbook fixture skipped (53.7 seconds)**. Syntax checks include the floor editor, print agent and Node AEAT transport.

- Table geometry clamps, pointer movement, cancelled resizing and keyboard controls run in jsdom. These do not replace rendered/touch-device acceptance.
- Print pairing, station scope, secret omission, duplicate-attempt rejection, idempotent spool reporting and immediate revocation execute in the database fixture. The agent tests validate configuration/control-byte handling and retain a recovery journal after acknowledgement loss. An actual local TCP loopback server verifies the transmitted bytes; it is a **printer emulator**, not real hardware.
- All eight migrations apply in sequence to the representative hospitality fixture. Atomic fiscal checkout tests establish sale/stock rollback on missing tax and exactly-once document/stock posting under fixture-only gate replacement. Production issuance remains hard-disabled.
- SQL XML/hash/QR matches the independent JavaScript serializer for initial registration, mixed IVA, cross-series chaining and negative correction. Tests cover cross-workspace issuer numbering, malformed XML rollback, replay and append-only evidence. Independent concurrent production PostgreSQL sessions remain untested.
- AEAT acknowledgement tests bind invoice identity, namespace and header issuer, retain CSV/raw evidence and throttle, and distinguish accepted-with-errors and duplicate reconciliation. A fake HTTPS transport checks fixed endpoints and TLS verification without tax submission. The successful synthetic acknowledgement was also validated locally using lxml against the official AEAT response/information schemas and W3C signature schema downloaded September 25. This is schema conformance, **not AEAT acceptance**.

No physical printer/phone, AEAT client certificate, actual responsible-producer declaration or Cloudflare deployment authentication was available. Read-only production inspection confirmed the new fiscal/hospitality/security tables are not installed. No production writes, customer invoices, tax submissions or deployments were performed. Outbox dispatch/reconciliation, customer fiscal invoice rendering and hospitality fiscal checkout wiring remain unfinished.

## Backend deployment and login recovery follow-up

- Full gate: 315 tests, 314 passed, no failures, one optional workbook fixture skipped. Added a schema-only fixture captured from production column types/defaults/constraints and relevant helper definitions; no customer rows are included. The fixture's business subscription predicate is explicitly simulated, so it is not a production billing acceptance test.
- Corrected the hospitality fixture's support-ticket field to `number`, matching production (the privacy implementation already used the correct field).
- Missing/failed workspace-access RPCs now display a backend error without signing the user out or incorrectly treating it as an authorization denial. Explicit 42501 denials still fail closed.
- Installed all nine migration files as one atomic deployment bundle; sale count and aggregate stock fingerprint were checked before commit. Added public release metadata containing no tenant data or secrets.
- Deployed `akihq-privacy` on Supabase. The packaged modules are byte-for-byte tested against the shared source. Tests cover origin restriction, missing-user rejection, live-session/membership validation and disabled marketing routes.
- Live read-only checks exercised workspace access, snapshot access and hospitality overview using an existing administrator's database authorization context. This is not a browser OAuth/password login test.
- Live SQL transaction-only test created a temporary product, received two units, recorded one operational sale/payment and retried it. Exactly one sale and one-unit stock deduction were verified. All test writes rolled back; no actual payment, fiscal invoice or tax submission was made. Two earlier test attempts rolled back before completion (no eligible existing HQ product, then the test attempted protected ID/stock insert columns); the final test used the same allowed catalogue fields as the app. No permissions were broadened to make tests pass.
- Public preflight passed against the deployed database/Edge Function and confirmed unauthenticated privacy requests return 401. Physical printer/mobile acceptance and fiscal/AEAT acceptance remain outstanding. The Cloudflare integration Worker is not part of this deployment; its hardening remains pending.

Security advisors were reviewed after deployment. The RLS-disabled finding is the existing PostGIS `public.spatial_ref_sys` system table, outside this change ([advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public)). The new anonymous printer definer RPCs are intentional paired-token endpoints; token, station, expiry, workspace and live authorizer checks are tested. Other legacy definer-function, extension and leaked-password-protection findings remain; this deployment is not a clean security certification.

# Hospitality validation — 25 September 2026

The new migration is applied after all five earlier compliance migrations against the representative PostgreSQL/PGlite fixture. Tests run actual SQL and role grants, not a mocked database.

New coverage includes access, table occupancy, server pricing, stale revisions, exact idempotent replay, cancellation tombstones, partial transfers, preparation state conservation, rounding conservation, partial/final payments, single stock deduction, printer claims, print-attempt exclusion, immutable events/tickets, null layout rejection, live entitlement revocation, bounded accountant evidence exports and operation-level cash limits after splitting a bill.

The browser controller runs in jsdom with the real generated forms. Tests cover table selection, version-preserving form submission, exact retry after network loss, Web Lock/storage failures before submission, escaped ticket HTML, explicit non-fiscal/copy labels and preventing a second print without a copy request.

The cloud browser rejected the local fixture URL under its URL security policy. No workaround was attempted. Consequently, no rendered-browser visual or mobile-device acceptance is claimed. Desktop/phone-shaped synthetic HTML was generated locally only; it was not a production deployment.

**Final gate: 291 tests, 290 passed, zero failed, one skipped (55.9 seconds).** JavaScript syntax and whitespace checks also passed. The existing private large-workbook fixture remains optional. No production schema/data, frontend or Worker deployment was changed in this task.

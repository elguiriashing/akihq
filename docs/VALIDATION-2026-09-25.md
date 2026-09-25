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

# Fiscal core implementation and release boundary

23 September 2026. This implementation is a tested accounting foundation and fiscal configuration workflow. It does **not** establish a legally compliant SIF release. Production fiscal issuance is deliberately disabled by an unconditional database gate. Changing the release registry to `approved` cannot bypass it.

## What is implemented

- Owner/admin issuer configuration: Spanish NIF/NIE/CIF checksum validation, address, country, tax jurisdiction, currency and tax regime. The narrow first-release scope is common-territory Spain, general IVA, EUR and businesses outside SII. Identifiers not handled by the checksum validator require future verified support; they are not silently accepted.
- Per-product effective-dated IVA treatment. Changes preserve audit events and all issued document snapshots. Zero-rated and exempt configuration requires a reason; actual issuance of those treatments remains unsupported until official exemption/operation codes are mapped and validated.
- Immutable document and line schema with preserved issuer/customer identity, product descriptions/SKUs/units, quantity, unit price, discount, IVA base/rate/amount, date, series and correction references. Restrictive foreign keys prevent tenant deletion from silently deleting fiscal records.
- Server calculation using PostgreSQL decimal arithmetic and integer cents. Product catalogue prices, rather than submitted line prices, are authoritative. Each line's gross value is rounded half up after quantity and discount; inclusive IVA base is rounded half up and IVA is the difference. Discounts require owner/admin permission. Maximum 200 lines, four decimal quantity places and €20m document gross.
- Workspace transaction advisory locking, atomic series increments, strict request idempotency and original-payload equality. Failed transactions do not consume a number. Business date comes from the workspace timezone; same-day operations only in this implementation.
- Difference-only partial/full returns against original document lines. Returned quantity cannot exceed the original quantity. Cumulative allocation preserves every original cent across partial returns. Original values are never overwritten. R5 is used for a simplified-invoice correction; the currently modelled full-invoice return uses R1. Other corrective cases need separate reviewed handling.
- Deferred database constraints reconcile header totals with line totals and enforce line direction at commit. Header/line/event/period-lock update or delete is blocked, even via ordinary service-role mutations.
- Append-only past-period locks. Corrections are created in the current open period; a closed historical original is preserved. Unlocking requires a future explicitly audited workflow, not deleting a lock.
- Paginated immutable issued-ledger export with fiscal identifiers, tax details, correction links and original lines. The server captures export time under the same workspace lock; subsequent pages use that timestamp. This is an accountant reconciliation ledger, **not** the official AEAT IVA/IRPF workbook, an a3/Sage adapter, a tax return, or proof of payment.
- Explicit RLS and privileges. Tenant membership is mandatory; platform administrator status alone grants no fiscal access. Fiscal read permission may survive subscription expiration for accounting continuity. Export is restricted to owner/admin/manager with matching financial-module access. Configuration is owner/admin only. Protected mutations live in a non-exposed private schema and independently check the authenticated actor.

## Browser / RPC interfaces

`assets/fiscal-core.js` exposes `window.AkiFiscalCore`:

- `calculateLine`, `calculate`: exact BigInt preview arithmetic; the server remains authoritative.
- `validSpanishTaxId`, `profileIssues`, `readiness`: onboarding and honest release state. `readiness` requires the atomic adapter flag; the current overview always reports it false.
- `refundAllocation`: original-value proportional return preview.
- `collectLedger(client, { workspace, from, through })`: all pages, captured server timestamp, workspace/duplicate checks and total reconciliation; errors prevent partial downloads.
- `ledgerWorkbook(XLSX, ledger)`: Excel readme, document ledger, lines and tax breakdown. Text cells explicitly preserve leading zeroes and cannot become spreadsheet formulas.

| RPC | Arguments | Result |
|---|---|---|
| `crm_fiscal_overview` | `p_workspace` | Access flags, profile, release, current taxes, series, latest 50 document summaries |
| `crm_fiscal_save_profile` | `p_workspace`, `p_profile` | Saved profile and audited change |
| `crm_fiscal_assign_tax` | `p_workspace`, `p_item`, `p_rate_bps`, `p_treatment`, `p_reason` | Today's product tax assignment |
| `crm_fiscal_lock_period` | `p_workspace`, `p_through` | Immutable past-period lock |
| `crm_fiscal_export_ledger` | `p_workspace`, `p_from`, `p_through`, `p_as_of`, `p_after`, `p_limit` | Documents with lines, captured timestamp, format and scope |
| `crm_fiscal_issue_document` | `p_workspace`, `p_request_id`, `p_document` | Disabled until release gates are implemented |
| `crm_fiscal_reverse_document` | `p_workspace`, `p_request_id`, `p_original`, `p_return` | Disabled until release gates are implemented |

First export request passes `p_as_of: null`; subsequent requests pass the exact returned timestamp. Cursor is the last returned UUID. Default browser page size is 250; database maximum is 500. The API intentionally keeps fiscal export separate from legacy operational exports, whose IVA was not recorded.

## What must precede activation

1. Integrate AEAT registration generation **atomically with issuance**, including required hash/chain inputs, the issuer/system-installation-wide chain across series, actual system version/installation metadata, XML, QR content and durable submission record. `cloudflare/verifactu.js` supplies independently tested serialization primitives; they are not yet connected to this issuance transaction. A later asynchronous outbox processor cannot retroactively supply missing simultaneous fiscal records.
2. Connect one atomic checkout transaction to fiscal document, stock ledger and payment ledger. Source operational sale linking is explicitly rejected now: historical IVA must not be inferred from today's product tax settings. Corrections currently model fiscal amounts only; they neither refund a payment terminal nor restock goods nor recreate historical COGS.
3. Implement certificate/representation setup, mTLS transport, acknowledgement/rejection processing, retries, duplicate response reconciliation and outage procedures. There is no transport credential in the browser and no simulated AEAT success.
4. Render and verify full/simplified/corrective documents with the required fields and working QR. Complete customer identity/invoice-request cases, supported 400/3,000-euro simplified eligibility, original document references and rounding review. The €3,000 flag requires documented eligible activity; it is not a universal simplified-invoice limit.
5. Add legal exemption/operation codes, special regimes and territory adapters before broadening the current scope. Add separate received-invoice books and deductibility decisions before claiming complete IVA accounting. Structured B2B exchange is a separate integration.
6. Run independent real PostgreSQL-session concurrency tests, backup/restore tests, accountant imports and AEAT test-environment acceptance cases. Review full-invoice returns and awkward sub-cent partial-return examples with the Spanish fiscal reviewer.
7. The actual responsible producer must issue a version-specific declaration reflecting the complete implemented system. This repository contains no fabricated producer declaration, third-party approval or certificate. Evidence pointers alone are insufficient: removing the hard database gate requires an additional reviewed migration after the functional integrations exist.

## Verification

Run `node --test cloudflare/fiscal-core.test.js cloudflare/fiscal-db.test.js` from the repository root.

Tests execute the migration in disposable PGlite PostgreSQL and cover issuer/tax validation, scope rejection, hard activation gate (including registry-approval bypass attempt), authoritative price/total calculation, tenant isolation, anon denial, discount permissions, immutability, idempotency mismatch, numbering without failed-transaction gaps, mixed IVA, fractional quantities, partial corrections/over-returns, period locks and ledger pagination. Browser-helper tests cover exact arithmetic and real XLSX write/read text safety.

**Test boundary:** To exercise the prepared accounting algorithms, a test fixture replaces `assert_release` only inside the disposable test database after proving the production gate rejects issuance. No production migration contains that replacement. PGlite queues concurrent requests; the numbering test is not proof of independent multi-session PostgreSQL races. No live customer record, real invoice, payment or tax submission is created by these tests.

This migration depends on the existing `crm_workspaces`, memberships/role templates, item catalogue, POS tables and `crm_has_tool` function. The suite security migration tightens that tool helper after this migration. Deployment must include the coordinated migration set and integration acceptance, not this file alone.

# Company imports, backups and publishing

The AkiPasa platform workspace uses `crm_company_records` for its company list.
Bulk company data is never added to `workspace_snapshots`, localStorage, lead
arrays or contact arrays. Other business workspaces retain their existing flow.

## Import

Use **Import Excel**, choose an XLSX/XLS/CSV file (50 MB maximum), explicitly
select a worksheet, check the field mapping, preview, then confirm. For the Spain
workbook select **Companies**; Coverage, Municipalities and Read me are excluded.
The first row must contain headers. A selected worksheet supports up to 250,000
data rows and 128 columns. The parser runs in a Web Worker with vendored SheetJS
0.20.3; it does not evaluate formulas. Formula rows and invalid fields are skipped.

New companies receive generated IDs, the current administrator as owner,
Prospect status and a server timestamp. Incoming IDs are provenance references.
Incoming owner/status/timestamp/catalogue IDs cannot replace database fields.
Names and addresses identify duplicates. A shared website, email or town alone
does not merge separate businesses. Existing rows are not updated by import.

The browser sends 250 rows per request; the database enforces a maximum of 500
rows and 2 MB per atomic batch. Each import is identified by file SHA-256 and
selected worksheet. The field mapping and row count must match when resuming.
Batch hashes and saved results make retries idempotent. Reopening and selecting
the same file, sheet and mapping resumes at the saved offset. Keep the tab open
while importing; closing it pauses progress after any in-flight request.

## Backups and undo

An automatic company backup is saved before an import begins. **Backups & import
history** can create/download company backups, download skipped-row reports,
restore missing/archived companies and undo an import. Backups cover CRM company
records, not authentication, the whole workspace, public venues or deployments.

Undo archives only records from that import with revision 1 and no map link,
including no authoritative catalogue link and no active publishing lease.
Edited/published records are protected. Undo is resumable in 500-record batches.
Restore is additive and idempotent: it restores missing/archived records and
preserves existing records and public map listings. Repeating a restore is safe.
Code deployment rollback uses the previous Git commit, independently of data.

## Publishing

**Publish valid companies to map** starts a separate, resumable publication loop.
The existing address-verification gateway remains responsible for producing
verified unclaimed venues. One leased company is sent at a time. Each outcome
is saved immediately; successful linking is confirmed against
`crm_catalogue_venues` in the database, never trusted from the browser response.
Errors pause the loop. Ambiguous addresses stay in **Publishing needs review**.
Saving corrected details makes an unpublished record eligible again. Interrupted
leases become eligible after ten minutes. Import and restore do not publish.

## Validation and deployment

`cd cloudflare && npm ci && npm run check` runs parser, UI, database and existing
regression tests. The scale test persists 100,000 synthetic records in an
isolated PGlite database; it never touches production. Set
`AKIPASA_IMPORT_FIXTURE` to the Spain workbook path for its read-only parser test.

Apply `supabase/migrations/20260917145343_bulk_company_import.sql` before the
static frontend deployment. This creates the indexed company store, imports,
batch ledger, issue reports and backups with RLS and checked functions, and
copies existing company/venue references. No Spain workbook records are seeded.
Publish the static repository root to the existing CRM hosting project. No
Cloudflare gateway deployment is required for the new importer. Keep the
previous frontend commit available for rollback; the migration is additive.

# Inventory operations and valuation

Implemented 23 September 2026. This is an operational stock subledger, **not a declaration of legal compliance, a supplier-invoice tax book, or accounting general-ledger postings**. Database migration and frontend must both be deployed before using these operations.

## Implemented workflows

| Workflow | Behaviour | Required evidence / authority |
|---|---|---|
| Receiving | Adds stock once and preserves the receipt unit cost, supplier, delivery/invoice reference and operator | Active inventory operator; supplier and reference; explicit cost excluding recoverable IVA |
| Locations | Creates named physical stock locations, with one implicit Main stock / PoS location | Inventory manager |
| Transfer | Atomically removes stock/value from one location and adds exactly the same quantity/value to another | Active inventory operator; reason; distinct destination |
| Physical count | Replaces a location's balance with an absolute counted quantity; rejects stale expected balances | Inventory manager, reason, counted quantity and previously observed balance |
| Waste | Removes stock and its recorded weighted-average carrying value | Inventory manager and reason |
| Checkout | Existing sale movement updates aggregate stock once; new hook updates its location and value once | Existing authorised checkout; stock must be available in Main stock / PoS |
| Historical valuation | Reads immutable per-location quantity/value snapshots at a cutoff | Inventory access; unknown legacy costs and pre-tracking quantities remain unknown |
| Retry recovery | Durable browser request key/payload; identical submissions return the existing operation | Same authenticated actor/workspace and unchanged request |
| Pending reconciliation | Confirms an existing operation or permanently cancels an absent request key, blocking late submissions | Same authenticated actor/workspace and original request |

The approving manager is the recording actor for counts/waste. This is manager authorisation, **not a separate two-person approval workflow**. A zero-variance count still records permanent approved count evidence.

## Stock and valuation model

The deployed legacy `crm_apply_inventory_movement` trigger remains the only mechanism updating `crm_inventory_items.on_hand`. A new `BEFORE INSERT` movement hook mirrors the same movement to `crm_inventory_location_balances` and `crm_inventory_value_events`. It never inserts a second sale movement or reduces aggregate stock itself.

At the first tracked movement for an item, its existing aggregate quantity is allocated to Main stock / PoS. If that quantity is positive, its carrying value is **NULL/unknown**. The mutable catalogue `cost_cents` is never used to invent opening cost. A zero opening balance has zero value. This preserves legacy quantities without claiming to reconstruct past costs.

Receipt costs are stored in cents with six fractional decimal places. Quantities allow at most three decimal places. Receiving uses explicit unit cost; outbound movements use perpetual weighted average within each item/location. Transfers preserve the exact value removed, including unknown values. The final depletion of a balance removes its exact remaining carrying value, avoiding rounding residue. A positive count adjustment to a known nonzero balance uses that balance's weighted average; a positive count from an empty or unknown-cost balance remains unvalued.

An unlinked legacy return cannot establish the original cost of goods sold. Its value remains unknown, even when the receiving location has a known current average. A future customer-return workflow must link the original movement and choose restock versus waste explicitly.

Once an unknown-cost balance is fully depleted, later known-cost receipts can establish a known value. No automated opening-cost backfill is supplied. Accountants must approve any future conversion of legacy cost evidence before it changes the valuation model.

Currency is preserved per operation/value event and cannot change on a workspace after tracking begins. Stock units cannot be relabelled after movements or while stock exists. Unit conversion must use separately identified stock and a future documented conversion workflow.

## API contract

`crm_inventory_operation(p_workspace text, p_key text, p_operation jsonb) -> uuid`

- `p_key`: stable 8–160 character request identity, generated once and retained across retries.
- Common payload: `type`, `reason` (3–1,000 characters), `lines` (1–100 distinct inventory items).
- Receiving: `type: "receive"`, `location_id` (null = Main stock), `supplier_name`, `reference`, and lines containing `item_id`, positive `quantity`, `unit_cost_cents`.
- Transfer: `type: "transfer"`, `from_location_id` (null = Main stock), required `to_location_id`, and lines containing `item_id`, positive `quantity`.
- Count: `type: "count"`, `location_id`, and lines containing `item_id`, absolute counted `quantity` (including zero), `expected_quantity`. A balance mismatch aborts the entire operation.
- Waste: `type: "waste"`, `location_id`, and lines containing `item_id`, positive `quantity`.

The same key with a changed payload or operator fails. Transfers, counts, receipt evidence, movement ledger, aggregate balance and value records commit or roll back together. Item locks follow UUID order and coordinate with checkout; currency is read under a workspace share lock.

`crm_inventory_location_create(p_workspace text, p_name text, p_code text) -> uuid`

The code allows uppercase letters, digits, `_` and `-` up to 32 characters. `MAIN` is reserved. Creates an active non-default location; archive/edit workflows are not implemented.

`crm_inventory_valuation(p_workspace text, p_at timestamptz = now()) -> rows`

Rows contain `item_id`, `location_id`, `sku`, `item_name`, `unit`, `quantity`, `carrying_value_cents`, `currency`, `cost_status`, `recorded_at`.

`cost_status` is `recorded_weighted_average`, `unknown_cost`, or `not_recorded`. An untracked historical quantity is NULL, not the current quantity. Callers must paginate the RPC results; supplied browser/export helpers do so. Do not sum different currencies or present a complete stock value while any row has unknown cost.

`crm_inventory_reconcile_operation(p_workspace text, p_key text, p_operation jsonb) -> jsonb`

Returns `{status: "committed", request_key, operation_id}` if the exact operation committed. Otherwise returns `{status: "cancelled", request_key, operation_id: null}` after recording a permanent cancellation. Reconciliation and submission use the same transaction advisory lock. A request still in flight is resolved before reconciliation; an old HTTP request arriving after cancellation cannot commit. Changed actor/payload requests fail. This supplies a safe recovery path for a definitively rejected stale count without guessing whether it committed.

## Browser integration

`assets/inventory-ops.js` exposes `window.AkiHQInventoryOps` and CommonJS exports:

- `validateOperation`, `fromForm`: validation and canonical payload construction.
- `submitOperation(client, workspace, key, payload)`.
- `createLocation`, `loadLocations`, `loadBalances`, `loadValuation`, `summarizeValuation`.
- `renderPanel`, `renderForm`: escaped UI fragments with action/form attributes.
- `readPending(storage, user, workspace)`.
- `stagePending(storage, user, workspace, key, operation)`: persists the immutable pending payload before submission, refusing a conflicting pending operation or unavailable storage.
- `reconcileOperation(client, workspace, key, operation)`.
- `resolvePending(storage, user, workspace, key)`: clear only after a successful submission or confirmed reconciliation with the matching key.

Cancellation is never inferred from a timeout or generic RPC error. Recovery state is isolated by user and workspace. Preserve it until the same request succeeds or reconciliation confirms its status.

## Exports

`assets/commerce-export.js` retains its existing public API and adds these inventory sheets:

| Sheet | Content |
|---|---|
| Current inventory | Current catalogue and aggregate quantity; catalogue cost explicitly unverified; no current-cost multiplied valuation |
| Stock movements | Period movement ledger, location/operation references and recorded receipt/value amounts |
| Locations | Location code, name, default flag and active state |
| Stock operations | Supplier/reference, reason, operator, approver and retry identity |
| Operation lines | Original requested quantities, count expectations and receiving costs, including zero-variance count evidence |
| Stock value ledger | Immutable event-time item identities, quantity/value deltas and carrying value |
| Recorded stock valuation | Latest snapshots at the selected period end or collection cutoff, with explicit unknown evidence |

Period-end cutoff is exclusive to PostgreSQL microsecond precision. All collections paginate rather than relying on screen limits. Any missing migration/query error aborts the entire export. Fractional-cent values are exported as exact text to preserve database precision; unknown amounts read `UNKNOWN`. The workbook does not invent missing IVA or journal entries.

These are live paginated reads, not a transactionally frozen audit snapshot. The current catalogue sheet can change while the report is collected. A transactionally consistent server export and a period-close/lock process remain accounting release requirements.

## Security and rollout

- New exposed tables have RLS and authenticated read-only grants. Inventory cost balances/value evidence require Inventory access; PoS may read safe location names only.
- Write entry points use private-schema security-definer functions with fixed empty search paths and explicit actor, workspace, tool, role and input checks. Public RPC wrappers are security invoker; anonymous/public execution is revoked.
- New operation, movement, valuation and cancellation evidence is append-only. Workspace/item deletion is restricted by retained evidence. Raw movement writes from authenticated clients are revoked.
- Item creation requires zero initial stock. Opening stock is received through the evidence-based RPC. Direct balance edits are rejected.
- Migration requires the existing live commerce schema and must follow the checkout-integrity migration in this release.
- Deploy the frontend with the migration and expire stale service-worker clients. Old clients trying direct movement insertion fail visibly instead of bypassing the new evidence/approval requirements.
- No production mutations were made during implementation. Database tests use a local production-shaped PostgreSQL/PGlite fixture, not customer data.

## Verified and still required

Local tests cover receiving evidence/costs; fractional quantity; identical retry/conflict; checkout integration with one deduction; transfers and exact value preservation; insufficient default location; full rollback; stale and zero-variance counts; manager controls; tenant isolation and grants; immutable evidence; unknown legacy cost and depletion; historical cutoff; unit/currency protection; malformed input; durable browser recovery; cancellation before a late request; reconciliation after commit; complete export pagination and spreadsheet safety.

PGlite validates SQL behaviour but does not replace multi-connection production/PostgreSQL contention tests, authenticated browser acceptance, deployment migration tests against a restored real schema, backup/restore testing or a signed accounting/compliance review.

Still absent: purchase orders/partial delivery matching, supplier invoice capture and deductible IVA decisions, supplier returns, original-cost-linked customer returns, lot/serial/batch/expiry and recalls, recipes/ingredient consumption, unit conversions, barcode/variant/device workflows, general-ledger COGS postings, period locks, stock valuation adjustments/write-downs, opening-cost evidence reconciliation, two-person pending approvals and sector-specific traceability. No claim is made that this subset satisfies every competitor feature or every industry's legal obligations.

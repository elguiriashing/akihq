# Operational checkout integrity

Status: implemented in migration `20260923001329_checkout_integrity.sql`, locally tested; not applied to production. This is an operational stock/sale recorder. It is **not** a fiscal invoice issuer, payment processor, IVA calculator, or declaration of Spanish billing-system compliance.

## Changes

- The server derives every new sale amount from the current workspace catalogue and rejects altered or stale quoted prices and totals.
- Quantities must be positive JSON numbers with at most three decimal places. Prices and totals use integer minor currency units. The RPC permits 1–500 submitted lines, quantities up to 999,999,999.999 per item, and a total up to 2,147,483,647 cents.
- Duplicate item entries are aggregated before rounding and stock deduction. Conflicting quoted prices for the same item fail.
- The authenticated user is always the recorded operator. The legacy employee parameter can contain that user's UUID or `null`; it cannot attribute a checkout to another employee, including through administrator access.
- Workspace access, an active PoS entitlement, active catalogue items, active workspace status and workspace currency are validated. New writes are restricted to the RPC.
- Sale lines snapshot the item name, SKU, unit and rounded line amount. Historical records remain explicitly unverified; no historical prices or IVA amounts are invented.
- The original canonical request is stored and compared structurally for retries. It is checked before reading mutable catalogue prices, stock, product availability or workspace currency. Repeating an acknowledged request therefore retrieves the original sale even if those values subsequently change.
- Item row locks, the existing stock movement trigger and the whole RPC run in one transaction. A failed inventory hook rolls back the header, lines, stock and idempotency record together.

## Browser contract

The RPC name and legacy argument types are unchanged:

```js
client.rpc('crm_record_pos_sale', {
  p_workspace: workspaceId,
  p_provider: tender,            // Nonempty string, up to 80 characters.
  p_external_id: requestKey,     // Stable nonempty reference, up to 200 characters.
  p_total_cents: totalCents,
  p_currency: workspaceCurrency,
  p_employee_profile: user.id,   // null also means authenticated user.
  p_lines: [{ item_id, quantity, unit_price_cents }]
});
```

The response remains a sale UUID. A provider/reference's surrounding whitespace is ignored. Its idempotency namespace remains `(workspace, provider, external_id)` to preserve existing integrations. Changing tender/provider changes that namespace and must never be used to retry an uncertain checkout.

Before first submission, persist the request key **and exact request payload** together in a user/workspace-scoped pending-checkout store. A lost HTTP response, page reload or later retry must reuse both. Do not reconstruct an uncertain request from a refreshed catalogue, generate a fresh request key, switch provider, or silently change prices. Keep the original request until acknowledgement or authoritative reconciliation establishes its outcome.

The canonical request contains authenticated operator, provider, currency, submitted total, and item UUID/aggregated quantity/quoted unit price sorted by UUID. Equivalent item ordering, decimal scales, split duplicate quantities and `null` versus own UUID employee parameters do not change its identity. Changes to price, quantity, currency, total or operator produce an explicit conflict. Unknown line properties are ignored and do not represent supported discounts or tax fields.

For each distinct item, calculate:

```
quantityMilli = quantity expressed exactly in thousandths
lineCents = (quantityMilli * priceCents + 500) / 1000, integer division
totalCents = sum(lineCents)
```

Use `BigInt` or equivalent exact decimal arithmetic for the intermediate multiplication; floating point multiplication can differ at rounding boundaries. The server uses PostgreSQL `numeric` and `round(..., 0)` (positive half-up). Do not round the whole basket once after summing fractional line amounts. The browser should obtain displayed prices from catalogue integer cents rather than an imprecise currency multiplication.

The database emits custom SQLSTATE `P0N01` only for an explicitly rejected **new** sale after acquiring the request lock and confirming that reference is absent. This code permits clearing the pending request. Refresh the catalogue, show the corrected amount or stock condition and obtain the operator's confirmation before a new request. Permission errors, malformed requests, conflicting keys, generic database errors and transport failures must retain it: rejection of the current attempt does not prove an earlier attempt did not commit. Downstream stock-location errors also retain the request; replenish/transfer the stock and retry it unchanged, or reconcile it before cancellation.

`assets/checkout-session.js` validates the full persisted payload, verifies durable readback and refuses corrupted, missing or conflicting storage. The submit flow must hold a browser Web Lock scoped to user/workspace across stage, submission and acknowledgement; `localStorage` read/write alone is not a cross-tab transaction. This RPC records a tender label; it does not confirm that a card terminal or payment provider actually settled funds.

## Inventory coordination

Checkout locks catalogue rows in UUID order, then inserts one legacy movement per distinct item. The existing `crm_inventory_movement_apply` trigger performs the single aggregate decrement. The inventory-operations migration's before-insert hook additionally records location balance and valuation evidence; checkout does not make a second aggregate deduction.

The legacy checkout signature selects the default location (`Main stock / PoS`). If another warehouse has stock but the default location does not, operators must transfer the stock before selling. The inventory hook rejects insufficient default-location stock and the entire checkout rolls back. New inventory RPCs must follow the same item-before-location lock ordering.

## Verification and deployment requirements

`node --test tests/checkout-integrity.test.mjs tests/checkout-session.test.mjs tests/app-controls.test.mjs` passes 58 tests. The SQL tests execute the migration and function in PGlite/PostgreSQL against a local commerce-schema fixture. They cover server pricing, cents/quantity validation, half-cent rounding, duplicate aggregation, stock rollback, tenant/operator restrictions, stale catalogue retries, conflicting keys, legacy replay, safe rejection codes and SQL privileges. Browser-helper tests cover exact rounding, storage corruption and failures, user/workspace isolation, durable pending payloads and acknowledgement matching. The real app IIFE executes in jsdom for tests of lost responses, original-payload recovery, cross-tab lock contention, safe rejection handling, logout/workspace switches, late directory and inventory results, role downgrades, durable-record and snapshot synchronization, bound gateway headers and pending accountant exports. Its boot call is replaced only in the test's in-memory source; no production test hook is exposed.

PGlite `0.3.14` and jsdom `26.1.0` were used. Install the repository's pinned test dependencies with `npm ci --prefix cloudflare`; the database test alternatively accepts an absolute ESM entrypoint path in `PGLITE_MODULE`. The fixture reproduces the relevant live table columns, stock trigger and access-helper semantics; the repository's old optional `schema.sql` alone does not recreate the live commerce database.

PGlite serializes its connection. A queued retry burst passes, but it does **not** establish true multi-session race behavior. Before production rollout, staging must exercise concurrent same-key requests, competing last-unit sales, price changes during checkout, checkout against location transfers, membership revocation and real browser/network recovery. Under PostgreSQL's normal READ COMMITTED isolation, a transaction-scoped advisory lock serializes matching keys and the existing unique constraint is a second guard. New checkouts explicitly reject other transaction isolation levels with SQLSTATE `25001`; a stale snapshot must never signal that an earlier sale is absent. Existing matching records may still be read idempotently.

The migration adds columns and replaces a function in a transaction, taking schema locks on busy commerce tables. Review lock timeouts and rollout timing, drain requests running the old checkout implementation, preserve a backup, validate the full existing production schema and run Supabase security advisors on staging after applying it. Older in-flight code does not use the new same-key advisory lock. No production database or real customer sale was changed during implementation.

The migration does not make legacy sales fiscal records. Proper tax snapshots, fiscal numbering, rectifications, regulated retention and the required SIF/VERI*FACTU delivery remain separate, gated work described by the fiscal module.

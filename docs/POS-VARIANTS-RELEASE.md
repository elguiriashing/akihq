# AkiBusiness POS: Inventory-backed sizes and variants

## Scope and boundary

This candidate builds on the service board, kitchen display and manual course controls in PRs #39–41. It is not a deployment or a statement of full fiscal/commercial readiness. Historical source repository: `elguiriashing/akihq`; the paid product is built with `NEXT_PUBLIC_AKISUITE_ROLE_SWAP=true`.

A product button can now open a touch-friendly size/variant chooser containing 2–12 actual Inventory products. For example, a coffee button can offer small, large and double; wine can offer glass and bottle. The selected option is a real SKU, not a browser-calculated surcharge or an unpriced kitchen note.

This implements **SKU-backed variants**, not paid add-ons, combinations of required/optional modifier groups, bundles, recipes, shared-ingredient depletion or arbitrary price overrides. Each SKU keeps its own stock balance. Glass and bottle SKUs do NOT automatically share bottle/liquid stock. Operators must configure genuinely separate sellable stock units or wait for recipe/conversion support; do not misrepresent independent balances as ingredient tracking.

## Operator and manager workflow

Managers create the actual sellable products and prices in Inventory first. In the POS menu designer, **Set up choices / Configurar opciones** opens the variant editor for a product button. Choose 2–12 products, name the chooser, reorder or remove choices, then save. The editor supports accent-insensitive search, EN/ES, both themes, keyboard focus management and reachable mobile save/close controls.

A configured button shows the range of available option prices instead of the base SKU price. On the till, tap it and then the desired option. The original base item is not automatically added. The chosen SKU uses the same durable tap queue and versioned `crm_hospitality_command` as ordinary items, retaining the entry course. Matching plain lines of the same SKU/course can consolidate; distinct SKUs remain separate. The bill, split/transfer, KDS, printer tickets, recorded sale and stock movement retain the chosen SKU's existing server-owned name and price.

Options can remain separate product buttons; managers may hide those buttons using the existing menu designer without hiding them from an explicitly configured chooser. No other buttons or Inventory records are automatically hidden, renamed, repriced or deleted.

## State, pricing and security

- Configuration lives in `layout.menu.variants[buttonItemId] = {version:1,title,items:[skuIds...]}` inside the existing protected, versioned workspace layout. Existing menu saves preserve it. It contains no price or tax fields and grants no permissions.
- Manager UI checks are supplementary. The existing database layout command remains administrator-only, authenticated and tenant-scoped. Selection uses the existing active-product/workspace checks, live POS permission checks, concurrency version, UUID journal and recovery/cancellation mechanism.
- The option price shown is the existing bill's recorded SKU price where present, otherwise the current catalogue price. The server remains authoritative. Catalogue changes still require manager repricing before payment under the existing POS policy.
- A changed bill, menu, available option, price, stock snapshot, course contract or selected table requires a reload/review rather than silently accepting the stale chooser. Pending/uncertain commands, a disconnected snapshot or revoked access block writes. Closing a chooser adds nothing; a duplicate click after selecting cannot enqueue twice.
- Missing or malformed configured options do not silently fall back to a different product. Missing SKUs can be removed from the manager editor. Displayed names and titles are escaped.
- Low-stock warnings describe recorded Main stock, not reservations. Opening orders does not reserve stock. The existing final-posting stock rejection remains authoritative. Externally collected money still needs real reconciliation if final posting fails; this release does not automate external refunds.
- No API, database migration, fiscal/tax logic, card integration, entitlement, external consumer-data sharing or AkiSuite discovery/booking flow changes.

## Validation

The focused tests execute both the new UI logic/controller path and the existing actual SQL against synthetic tenants in PGlite. Coverage includes manager-only configuration, stale layout writes, selected SKU identity, injected-price rejection, distinct-size totals, course/KDS identity, SKU-specific stock deduction, duplicate retry, preserved existing orders after configuration edits, repricing checks, tenant/inactive boundaries, partial payment restrictions and split/transfer behaviour.

The browser suite exercises both chooser and editor at eight viewport sizes, each in EN/ES and dark/light, plus focus, Escape, search preservation, course entry, stale review, manager saves and staff/revocation checks. Local inline browser execution substitutes browser storage/locks because navigation is restricted; hosted Chromium runs use native storage/locks. Treat these evidence types separately. Screenshots use synthetic data, not customers.

New read-only CI runs the variant tests, legacy till/ledger/printer/rapid-tap regressions, both browser surfaces and an exact-head paid-product release/cache check. Existing full repository, kitchen/course concurrency and browser gates remain enabled. A locally timed-out full suite is not recorded as passing; the final-head hosted run must pass before merge.

## Activation, compatibility and rollback

1. Integrate/retarget the parent PRs in dependency order and rerun checks on the final base and head. Do not deploy a child without its parents.
2. Validate the generated AkiBusiness release against a representative staging workspace. No new database migration is required for variants, but parent POS/KDS/course migrations and permissions remain prerequisites for those respective capabilities.
3. Refresh every active terminal before configuring choices. Older frontends ignore the chooser metadata and may drop it when saving their older menu shape. A button always remains a real, independently priced Inventory SKU, so this metadata is presentation, not a server-side requirement to choose a variation. Mixed frontend versions are not supported for manager editing.
4. Test with separate manager/staff accounts and two actual devices: concurrent menu changes, choosing different sizes, held course, split, payment, low stock and network-loss recovery. Verify real 58/80 mm tickets show the actual selected product. Do not use live customer orders as test fixtures.
5. Source service-worker cache is `akihq-v124`; the paid artifact uses `akihq-v125`. Both include `pos-variants.js/css?v=1`, `pos-v4.js?v=3` and `hospitality-pos.js?v=17`.
6. Roll back the frontend release if required, retain all pending command UUIDs and existing order/sale evidence, and avoid menu edits with older clients until compatibility has been reviewed. Never remove held-course protections while parent-release held dishes exist.

## Remaining product work

Paid extras/modifier groups, bundles, ingredient recipes/costing and shared stock conversions, offline order entry, fiscal issuance/corrections, integrated card capture/refunds, arbitrary preparation stations, delivery integrations, and physical venue acceptance remain separate milestones. This release is not full competitor parity.

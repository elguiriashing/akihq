# AkiHQ PoS v4 release handoff

This release adds a visual menu/category designer, dedicated payment/split/order-item dialogs and immersive full-screen register mode, while keeping the existing PostgreSQL hospitality RPC, idempotent commands, audit evidence, printer queue, permission checks and version constraints. It does not process card payments or issue fiscal invoices.

## Code
- assets/pos-v4.js: shared menu/category configuration and designer
- assets/pos-v4-dialogs.js: checkout, split/transfer, item notes, settings and manager correction panels
- assets/hospitality-pos.js: signed-in controller and versioned commands
- assets/pos-v4.css: touch, tablet and immersive layouts
- tests/pos-v4-smoke.cjs: dependency-free controller regression checks
- .github/workflows/pos-v4-smoke.yml: automated smoke gate

## Data model
Visual configuration is saved inside the existing versioned hospitality room layout, under its optional menu property. No new schema migration is needed. The layout continues to retain mode, pages and tables. Menu configuration includes categories (stable ID, name, colour), per-product presentation overrides (label, category, colour, hidden, rank), and text-only preparation note presets. The shared server-side layout action remains administrator-only and rejects stale versions.

Product IDs, prices, availability and inventory posting remain owned by the existing POS/Inventory catalogue. Creating stock items or changing sell prices is done from Inventory. Menu appearance settings cannot silently change transaction amounts.

## Operational flow
1. Open a table or walk-in, choose menu categories and items.
2. Tap a bill line for quantity, kitchen/bar routing, seat and text preparation notes. These are unpriced modifiers.
3. Send kitchen/bar revisions or queue a pre-bill.
4. Open Split / Move for equal-share payment suggestions or table transfers. The final share covers rounding remainder. Existing transfer validation remains authoritative.
5. Open Pay to record already-collected cash or already-completed external card/other payments; the server requires payment references for non-cash methods. This interface does not charge a card.
6. Order settings edits guests and notes. Manager corrections exposes audited cancellation/repricing/payment reversal only to managers.
7. Print queue is accessible in a separate panel, preserving queued/claimed/uncertain print states.
8. Full screen hides normal AkiHQ navigation only while the immersive terminal exists; leaving the route restores navigation automatically.

## Test evidence and limitations
The smoke script validates the controller render and mocked RPC calls for visual designer persistence, exact-cent payments, modifier editing, split interfaces, versioned quantity updates, immersive state and responsive CSS breakpoint presence. GitHub Actions runs this test for affected PRs.

Physical hardware, real Supabase integration, actual printed paper and real tablet browser geometry are NOT tested by the smoke script. Fiscal invoices, refunds, actual card captures, priced modifiers, course firing and offline order creation are NOT in this release.

## Physical tablet acceptance still required
- 1280x800 landscape: two-column product/ticket with separate scrolling; fixed checkout
- 1024x768 landscape: no masked item buttons or footer
- 800x1280 portrait and 768x1024 portrait: usable stacked register and modal scrolling
- 600-850px tablet split screen: no horizontal overflow or clipped controls
- 360x800 mobile portrait: bottom dialogs, visible payment confirmation
- 900x500 short landscape: scrollable dialogs and reachable close
For each, test staff and manager roles, table switching, category edits across two sessions, stale-version conflicts, split rounding, external card reference, printer paper-out/uncertain handling, keyboard Escape and full-screen exit. Use staging / safe test data and a real printer before commercial operation.

## Rollback
Revert the PoS v4 PR if the frontend causes a regression. The optional layout.menu configuration is backward-compatible; prior clients ignore it. Never delete pending order-command recovery records to bypass a failed request.

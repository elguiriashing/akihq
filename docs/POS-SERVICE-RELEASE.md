# AkiBusiness POS service workflow

Implementation slice for issue #38. Source baseline: `f5ba367a93ba6bf5ffcba6581dea0af271187f7e` on `release/akibusiness-operations-brand-v1` in the historical `elguiriashing/akihq` repository. This targets the paid AkiBusiness operations product, not the free AkiHQ management hub or legacy `main`.

## Included

- Service overview covers every open table and walk-in returned by the permission-checked hospitality overview, including walk-ins in restaurant mode. Search table/bill/floor/notes; filter by floor, walk-ins, unsent changes or part-payment; sort unsent-first, oldest or highest balance. Summary figures describe all open bills, not only the filtered subset.
- Preparation preview compares the immutable sent-line snapshot with current lines. Adds, removals, quantity, preparation note, seat and kitchen/bar changes show previous/current requirements. Unknown sent data never becomes a false "sent" status. Sending delegates to the existing versioned, recoverable `crm_hospitality_command` action. It does not claim that a printer printed, that staff read the ticket, or that food is ready. This is not a full KDS.
- Accent-insensitive catalogue search matches inventory name, display label and configured category name. Search combines with existing category/hidden settings and a new shared favourites filter. Managers maintain favourites in the existing versioned layout. These are presentation choices, not price or entitlement overrides.
- Recorded zero Main stock gets a warning, not a stock reservation or an alternative inventory enforcement path. Open-order stock limitations are unchanged.
- Compact Terminal / Service / Tools navigation retains designer, lookup/shifts, and immersive mode without a horizontally scrolling top nav. Fullscreen works across Terminal and Service, including short phones and landscape. Product and bill scroll areas remain separate; checkout stays visible.
- New service/search controls support EN/ES and light/dark themes. Existing legacy POS labels are not all translated by this change. Light-mode receipt-pane contrast is corrected. Search cursor, bill/catalogue/service scroll and preparation-dialog focus survive refresh. Escape closes the preparation dialog, Tab stays inside it, and focus returns to its opener.

## Preserved contracts

No new database migration, write RPC, tax calculation, subscription, integration credential, payment capture or fiscal issuance switch. Shared workspace identity, manager permission checks, table transfer, split/external-tender recording, rapid taps, pending-command recovery, printer lifecycle, inventory posting and shift history continue through their current APIs. AkiSuite branding, discovery/booking products and cross-site navigation are not replaced by a standalone POS clone.

## Verification

Run `node --test tests/pos-service.test.mjs`, the existing POS smoke/mobile/rapid-tap/printer/ledger tests, and `npm run check --prefix cloudflare`.

`tests/pos-service-browser.py` runs the actual renderer/controller in Chromium with explicit synthetic RPC data, not production credentials. It tests 1280x800, 1024x768, 800x1280, 768x1024, 650x900, 360x800, 320x640 and 900x500, each in EN/ES and dark/light (32 cases). Tests cover navigation bounds, service filtering, preparation dialog/focus after refresh, fullscreen checkout hit targets, product/favourite search, search focus, versioned send, rapid-tap aggregation and revoked-access clearing. The hosted job serves the fixture over localhost and uses browser storage/Web Locks. An optional `POS_BROWSER_INLINE=1` rendering-only fallback mocks those facilities for restricted local environments; it is not evidence of real-device concurrency.

The exact-head workflow also builds the flagged AkiBusiness release and checks identity, clean source, new assets and the release cache. The source service-worker cache is `akihq-v118`; the role-swap artifact is `akihq-v119`. Historical storage/cache namespaces remain unchanged intentionally. Updated assets are registered in both index and service worker.

## Release acceptance and rollback

Before production, pass all enabled exact-head checks and review the generated preview. Test real staff and manager accounts, two-device edits, stale versions, workspace changes, pending unknown commands, long menus/bills, Android/iOS keyboards, actual tablet split-screen and printers. Browser fixtures do not establish production authentication, live schema state, hardware printing or legal compliance. No production operation was performed for these fixtures.

Rollback: restore the preceding frontend artifact. Optional `layout.menu.products[ID].favourite` metadata is backward-compatible and may remain. Never erase unknown pending-command records or rewrite orders to roll back this UI.

## Still separate work

Priced modifiers/variants and bundles; course firing and arbitrary preparation stations/full KDS; fiscal issuance/corrections and statutory compliance; integrated card capture/refunds/reconciliation; genuinely offline ordering; recipe costing and delivery integrations. This PR is the service/navigation foundation, not complete Spanish POS competitor parity or commercial fiscal readiness.

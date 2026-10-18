# AkiBusiness persistent kitchen/bar display

18 October 2026. Competitive-parity milestone following the service-board work in PR #39, under #38. The paid operations product is AkiBusiness; this implementation remains in the historical `elguiriashing/akihq` repository. This is a release candidate, not a production-deployment or fiscal-compliance claim.

## Service workflow

Select **Kitchen / Bar** from the compact Tools selector. The same immersive fullscreen shell remains available, with Terminal and Service still directly accessible. The board supports kitchen/bar filtering, accent-insensitive table/dish/note search, active/review/ready/completed views, elapsed time since first send, seats, guest counts and preparation notes. It inherits the approved AkiBusiness theme and supports English/Spanish and dark/light screens.

Only sent order lines enter preparation. Each complete order line moves Waiting → Preparing → Ready → Served; quantities are shown, but this release does not track partial preparation of an individual line's quantity. Multiple lines at the same stage can advance together. Serving food does not settle its bill, and settling a bill does not remove unfinished food. Printer transport/spool/confirmation states are never modified or treated as preparation evidence.

Changed quantities, notes, routing, table transfers and cancellations require explicit comparison and acknowledgement where relevant. Unchanged dishes keep their existing progress. Changed lines do not silently inherit readiness. Repeated unreviewed revisions preserve the last acknowledged baseline. Rerouting an already-sent line between kitchen and bar marks it as relocation work at both stations. A newly sent additional line reopens an already completed card without un-serving the unchanged dishes. Staff reconcile actual physical progress for every current line, with a reason and checkbox. This is intentionally not an instruction to cook the entire revised order again.

Manager-only recall restores a served line to Waiting with an audit reason. It does not restore money or change stock. The board includes all active cards plus the most recent 50 completed cards; the history display limit does not delete retained evidence. Above 2,000 active cards, the API fails visibly rather than silently hiding orders. Dedicated station-scoped permissions and paging at that scale remain future work.

## Integrity and integration

The migration adds private `kds_settings` and `kds_cards` tables with RLS and no direct public/anonymous/authenticated/service-role grants. Guarded authenticated RPCs use the existing live workspace/POS permissions, workspace transaction lock, exact-version checks, immutable command journal and event evidence. Changed payloads cannot reuse an idempotency key. Permission is rechecked before replay. Existing browser Web Locks, durable pending-command UUIDs, retry and cancellation tombstones also cover kitchen writes.

The order trigger maintains preparation snapshots atomically with existing hospitality commands. Culinary snapshots exclude price fields, payments and customer records. Existing workspace identity, subscriptions, discovery integrations, CRM, menu favourites, stock posting, split/move, print queues and external tender recording remain unchanged.

Polling runs every 2.5 seconds while the kitchen view is active. Progress writes are disabled for pending commands or snapshots older than 10 seconds; requests time out after 8 seconds. Unavailable/missing backend support clears kitchen data and displays an explicit error rather than a simulated offline board. Existing Terminal and Service workflows remain accessible. This is **not offline ordering or offline preparation**.

## Migration and safe activation

The filename `20261018152924_pos_kitchen_display.sql` was generated with Supabase CLI 2.121.0. Apply it to a representative staging database after the existing September security, inventory, fiscal-core, hospitality and printing migrations, with the matching frontend release. Do not infer deployed-schema compatibility solely from repository history. It is additive and defaults OFF for every workspace. No hosted Supabase schema or business records were changed during this implementation.

Before enabling a staging workspace, finish already-paid orders in the previous kitchen workflow and reconcile the physical service. Manager activation requires this explicit handover confirmation. Existing open/sent orders are imported for manual progress review, not automatically fired. Already-closed orders predating activation are deliberately not imported. Therefore activation during unresolved paid service is not acceptable. Once enabled, bills paid before food is served remain on the kitchen board.

A guarded manager `kds_disable` command exists for controlled rollback; it refuses outstanding cards. There is no routine deactivation button in the service UI. Reconcile or finish pending work first. Prefer reverting frontend assets while retaining database evidence; never drop the kitchen tables, command journal or pending browser requests as a recovery shortcut. After a rollback or reactivation, perform another service handover. Account/permission or workspace changes dispose the controller and clear its in-memory view.

## Verification and release gates

- Embedded PostgreSQL/PGlite scenarios cover default-off activation, permissions, sent-only visibility, exact transitions, retry/conflict handling, paid-but-unserved orders, revisions, transfers, rerouting, cancellations, recall, tombstones, RLS, immutable evidence, malformed inputs and active/history limits.
- A captured production-schema fixture tests migration installation and default-off/activation contracts. This is schema-only historical metadata, not a new live production inspection.
- Focused UI tests cover escaping, search, station/status filters, ordering, progress counts, blocked controls, manager recall, language and release assets.
- Chromium tests use synthetic RPC responses in 32 viewport/language/theme cases. Hosted CI uses native HTTP storage and Web Locks; the restricted local fallback mocks those two APIs and does not establish their browser correctness by itself. Checks cover fullscreen navigation, reachable modal controls, search/refresh, actual-progress review, stale dialogs, unknown-response retry, recall and revocation.
- A separate disposable PostgreSQL 17 service tests independent-connection races: different commands at one version, simultaneous identical retries and a waiter revision racing kitchen progress.
- Existing POS/controller/mobile/rapid-tap/printer/ledger regressions and clean AkiBusiness release transformation remain required, alongside repository-wide checks.

Before a production rollout, additionally test two independently authenticated staff devices and a manager in staging, actual hospitality data, permission revocation, network loss after commit, paid-before-prepared service, transfers between occupied tables, kitchen/bar rerouting, cancellation, printer behaviour and app switching. Test the real tablet/phone hardware and supported browsers. CI is not that physical acceptance test. Merge and activation require a reviewed staging migration and an explicit rollout decision.

## Still outside this milestone

Priced modifiers/variants and bundles; course hold/fire; arbitrary preparation stations and station-specific access; recipe/ingredient costing; true offline operation; integrated card capture/refunds; completed fiscal issuance/corrections; delivery aggregation; and full real-venue operational acceptance. No billing, card-payment or fiscal safeguards are bypassed by this display.

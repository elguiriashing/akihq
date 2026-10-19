# WORK AGENT HANDOFF: AkiDuermo Booking Management

**Last updated:** 2026-10-09  
**Repository:** `elguiriashing/akipasa`  
**Active work:** [PR #82](https://github.com/elguiriashing/akipasa/pull/82), branch `feature/akiduermo-reservations-spec`  
**Production branch:** `master` (NOT `main`, which is the CRM source)  
**Status:** IN PROGRESS, **NOT DEPLOYED**, NOT SAFE TO ENABLE PUBLIC OVERNIGHT BOOKINGS.

## FIRST THING THE NEXT AGENT SHOULD DO

1. Open this handoff, `AGENTS.md`, **all** of `docs/AKIPASA_MASTER.md`, `docs/AKIDUERMO_BOOKING_DESIGN.md`, `docs/CHANGE_IMPACT_REGISTER.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md` and `docs/deployment-source.md`. Read the live source too; docs are not proof that code works.
2. Fetch latest `master` and PR #82. Check if its commits have drifted from master; reconcile without overwriting newer booking or tablet fixes. Run baseline `npm ci`, `npm run check`, booking-specific tests, and inspect GitHub Actions.
3. Carry the project to a **real, tested, fully functioning accommodation booking service** within AkiBusiness and AkiDuermo. Do not stop at mock screens. Investigate and address each item in the backlog below, commit in coherent groups, and add regression tests and documentation as you go.
4. Before merging, validate migrations with a disposable PostgreSQL database, full permissions/RLS and concurrency checks, E2E customer booking and business-management workflows, EN/ES and tablet/split-screen layouts, and a Cloudflare build. If blocked, state the exact blocker and do NOT claim live status.
5. User explicitly requested finishing the work and **merging to live when safe**. The instruction authorizes the release objective, but never overrides the required tests, external deployment requirements or security gates. Verify production routing and smoke checks after any approved deployment.

## Core product decision (do NOT change)

**One AkiBusiness login shows all the owner's AkiPasa venues and AkiDuermo accommodation properties.** Opening each must load DIFFERENT management tools:

- AkiPasa venue: profile/media, events, menu/catalogue, rewards, check-in, services/timed reservations, team.
- AkiDuermo: property profile/media, dedicated stays dashboard, room/unit inventory, room-night calendar, nightly rates/rules, guest reservations/check-ins/outs, team.
- Same Supabase auth and verified tenant ownership, not separate accounts.
- Internal shared venue table is permitted only as a storage abstraction. AkiDuermo must remain a distinct public accommodation listing at `akiduermo.akipasa.com/stays/[slug]`, not an ordinary AkiPasa venue.
- Bookings templates planned for restaurant tables, experiences, rental resources, appointments, events/tickets, classes and stays. Existing timed slots are NOT hotel room nights.

## Existing work on PR #82

**Portal separation / UI**

- `src/app/[locale]/business/page.tsx`: managed-property membership select includes `discovery_vertical`, shows AkiPasa vs AkiDuermo labels and appropriate management action.
- `src/components/VenueDashboard.tsx`: `product="accommodation"` selects Overview, Profile, Bookings and Team, hides venue-specific tools.
- `src/app/[locale]/business/venue/[id]/page.tsx`: chooses dedicated accommodation workbench instead of the old `BookingManager`; legacy venue engine stays intact.
- `src/components/AccommodationBookingWorkspace.tsx`: interactive but currently **non-functional for overnight booking** Reservations, Calendar, Rooms and Rates tabs. All UI copy explicitly says room-night booking isn't enabled.
- `src/app/tablet-responsive.css`: narrow-window split-screen rules; tests in `tests/akiduermo-manager.test.tsx`.

**Database candidate**

- `supabase/migrations/20261009220000_accommodation_inventory_foundation.sql`: room types, units, nightly-rate ranges, reservations, maintenance blocks; date-range exclusions and unit lock triggers; owner/manager RLS for inventory; no customer write access to reservations.
- `tests/accommodation-inventory-contract.test.ts`: static SQL text checks only. **NOT a substitute for running migration and concurrency/RLS SQL tests.**
- `package.json` default test script modified to include tests.
- No known applied production accommodation migration. No verified live booking flow.

**2026-10-09 continuation**

- `src/components/AccommodationBookingWorkspace.tsx`: now renders persisted room types, physical units, nightly rates, maintenance blocks and reservation rows. Owner actions can create/update/archive room types and units, add/delete rates and add/delete maintenance blocks. Public booking remains explicitly disabled.
- `src/app/[locale]/business/venue/[id]/actions.ts`: added Zod-validated accommodation owner actions, with `is_venue_member` and `venues.discovery_vertical='accommodation'` checks before every write.
- `src/app/[locale]/business/venue/[id]/page.tsx`: accommodation dashboard now loads inventory/reservation/block data and wires the new actions only for accommodation properties.
- `tests/akiduermo-manager.test.tsx`: updated to cover persisted inventory/rate/reservation display and no public checkout action.
- Verified locally: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:db-safety`, `npm run automation:check`, `npm run build`, `npm run build:cloudflare`.
- Still **NOT SAFE TO MERGE/DEPLOY AS LIVE OVERNIGHT BOOKINGS**: the SQL migration has not been executed against disposable PostgreSQL with RLS/concurrency tests, and the customer availability/quote/atomic booking path is still missing.

**Related previously merged foundations**

- PR #74 resource-backed timed-slot booking.
- PR #75 customer booking wizard, business inbox, mail queue, account booking history.
- PR #78 accommodation claiming and AkiDuermo HQ test property.
- PR #79 tablet/split-screen and PWA work.

## CRITICAL blockers to production

1. **Run/review the candidate SQL migration in an isolated PostgreSQL environment.** Check compatibility with current migrations; verify btree_gist, `venues.discovery_vertical` and `is_venue_member` signatures. Confirm that adding blocks and reservations concurrently cannot bypass the exclusion checks. Check that security-invoker trigger RLS cannot cause unsafe read behavior or silently miss conflicts. Test cancellation/rebooking, status changes, overlapping units, inclusive start/exclusive checkout and DST.
2. **Complete owner-managed inventory:** create/edit/archive room types and physical units plus add/delete rates and maintenance blocks are implemented in the owner UI. Remaining work: run against real PostgreSQL/RLS, add edit flows for existing rate/block rows if needed, and validate empty/error/loading behavior in authenticated browser sessions.
3. **Implement secure availability and quote calculations:** check-in/check-out night ranges, max guests, minimum stays, unit/rate coverage over all nights, inactive units, block/hold overlap, total in EUR with taxes/fees and policy snapshots. Never trust client-submitted totals.
4. **Implement an atomic booking transaction/RPC:** concurrency-safe last-room booking, idempotency key, quote revalidation, explicit pending/confirmed state machine, audit trail, permissions, safe cancellation. Only enable public booking when it passes real SQL integration.
5. **Build customer AkiDuermo booking UI:** range calendar, verified availability, guest selectors, room choice, totals and policies, confirmation/cancellation with status visibility, mobile/tablet/split-screen responsive. Preserve accommodation listing identity and avoid leaking full private inventory.
6. **Connect business inbox, calendar and guest operations:** search, pagination, date/status filters, room assignment, check-in/out, management actions and audit; keep URL-filter persistence and controls usable in split-screen. Reuse Resend durable outbox correctly without duplicate notifications.
7. **Complete security and data rights:** cross-tenant/anonymous RLS, safe server actions, admin boundaries, GDPR export/deletion, audit retention and email security. Don't fabricate reservations, availability, reviews, or payment success. AkiDuermo HQ remains non-discoverable/non-bookable unless deliberately enabled in testing.
8. **Integration tests:** disposable PostgreSQL with multiple concurrent connections, browser E2E end-to-end, EN/ES, light/dark, owner/other owner, empty/loading/error, 360/390/600/768/820/1024/1280 widths and orientations, Chrome installed PWA and split-screen. Run `npm run check`, `npm run test:e2e`, `npm run build:cloudflare`. Do not deploy with failing or unexecuted critical acceptance cases.
9. **Merge and release only after passing checks**, verifying current `master`, production migration order, Cloudflare deployment and actual live smoke; watch Worker errors and have a rollback path.

## Known uncertainties and issues to inspect immediately

- The preceding assistant used the GitHub connector only. It did **not** run Node/Playwright/PostgreSQL/Cloudflare builds; earlier claims of implementation mean _committed_, not verified or deployed.
- PR #82 may be behind a rapidly changing master. Preserve improvements to booking service edits, filters, tablet UI, mail and SSR.
- The SQL migration was authored without execution; review every constraint and RLS privilege, including the `accommodation_guard_occupancy` trigger, before deploying.
- The management tabs are currently placeholders with functional navigation, not room/rate CRUD.
- AkiDuermo HQ fixture/playtest availability is documented by PR #78; verify actual DB account association and visibility instead of assuming current production state.
- No online deposit/payment collection, OTA/channel manager sync or commission system has been implemented. Those are explicitly deferred unless separately requested.

## Definition of done

An authenticated property owner can see every managed venue/stay on AkiBusiness, open an accommodation, create rooms and rates, view actual nightly availability, block nights, review and manage real stay requests and arrivals, while an actual customer can book an available stay from AkiDuermo without double bookings or cross-tenant data exposure. Email confirmations, export/cancellation, both languages and responsive browser QA work. Critical builds/migrations pass. Only then merge `master` and verify the live Cloudflare deployment.

**Follow-on agent:** continue engineering immediately; do not ask the user to repeat this specification or start another design-only cycle.

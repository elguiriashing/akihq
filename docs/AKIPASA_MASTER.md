# AKIPASA MASTER SYSTEM CONTRACT

## 2026-10-15 | Rental company in Business home

The independent Business home includes rental companies owned by the signed-in
profile as AkiCoches cards alongside venues and stays. A company linked to a
venue opens that venue's Fleet tool; an existing unlinked company opens its
legacy full-screen fleet workspace. This avoids assigning a rental company to
an unrelated venue or creating a public AkiPasa listing. No rental ownership,
visibility or RLS rule changes. Authenticated owner acceptance remains to be
verified on the canonical domain.

## 2026-10-15 | AkiCoches venue fleet integration

The independent AkiBusiness application places AkiCoches within each ordinary
venue dashboard, reusing its team, location and shared media library. Linked
fleet records remain in `car_rental_*` and require the AkiPasa-owned mirrored
venue workspace migration before these tools can operate. Existing unlinked
operator companies remain valid through the legacy route. Public rental search
and requests stay in the independent AkiCoches product. Company review, RLS,
request confirmation, storage placement and billing boundaries remain distinct.
The migration and both independent Worker versions must be verified before
claiming a live integrated release.

## 2026-10-15 | Nested credential isolation at product handoffs

Cross-origin navigation now drops opaque next/return/redirect/callback wrappers
and credential-bearing query values, including encoded nested URLs, bracket/dotted
keys, JSON Unicode escapes and URL userinfo. The bounded reviewed query helper is
copied from AkiCoches content SHA256
`644097c9aad37b7149f1753e184d1be272afd8af717451c4cae3d31c41c67c9a`;
there are no sibling-checkout imports. Safe search, locale, dates and UTM context
remain. Local OAuth/PKCE callbacks retain their code/state for the existing exchange.
No session, account, legal gate, provider, record or routing configuration is changed.

## 2026-10-15 | Business session isolation

Normal Business logout explicitly uses Supabase's local session scope, preserving
other AkiSuite product refresh sessions sharing the same user identity. Successful
password recovery deliberately uses explicit global scope to preserve account-wide
security revocation after a password change. Existing localized redirects, recovery
task continuity and password update checks remain unchanged. Action regressions
cover both locales, invalid locale fallback and successful/failed recovery without
using or signing out a real account; current-deployment acceptance remains required.

## 2026-10-15 | Independent Business claim deep links

The extracted AkiBusiness claim picker reads its initial venue through the narrow
`/api/business/claim-venue/[id]` endpoint. The consumer map API is outside this
application's boundary. Published catalogue fields and the privacy-safe
`public_venue_is_claimed` RPC supply the initial name and activities/accommodation
vertical; unavailable ownership fails closed. No owner identity is exposed.
The existing authenticated claim submission guard remains authoritative. No
schema, records, billing or legacy routing change is required. Seven focused endpoint
regressions and all 107 scoped tests pass; provider-backed authentication,
preview/TLS and production acceptance remain release gates.

## 2026-10-14 | AkiConduzco mobility product (live release)

AkiConduzco is a car-rental discovery and booking-request product on
`akiconduzco.akipasa.com`, integrated with AkiPasa trip discovery and the
AkiBusiness operator portal. It is an independent rental vertical, not a new
`venues.discovery_vertical`: rental companies, individual vehicles, availability
and booking requests must not leak into ordinary venue/event or AkiDuermo
catalogues. Operators create their own rental company profile for review; do not
reuse venue claiming or grant access to a venue. Public rates and availability
must be explicit, time-bounded, and distinguish requests from confirmed rentals.
The first release is request-based and does not imply payment, instant booking,
or live OTA/partner inventory. Public location records must have a lawful,
traceable source; no open-data import is included until source coverage,
licence, attribution and update process are verified.

Cross-surface release checks: EN/ES discovery and map, host-scoped login and safe
return, renter account and own booking history, AkiBusiness operator setup and
fleet/rates/availability, pending vs published visibility, owner isolation/RLS,
date overlap behavior, empty/error states, mobile/tablet/desktop, per-host logo,
manifest, robots/canonical and sitemap behavior, Cloudflare hostname routing.
The public application and rental schema are live, and exact-source public-route
smoke passed. Authenticated login, fleet mutation and booking request acceptance
were not exercised in that anonymous smoke. See `docs/CHANGE_IMPACT_REGISTER.md`
for the release evidence and remaining acceptance scope.

## 2026-10-14 | Per-venue event browsing

The AkiBusiness individual venue Events workspace offers localized search by title/status, current/past/archived filter counts and nine-event pagination in responsive 3/2/1-column layouts. Existing event management, publication, media, occurrence and deletion forms remain available within expandable event details. Deep links from the main business event catalogue select the correct page and expand the requested event. No database, permission or event-action contract changes.

> Entry point for every human or AI modifying AkiPasa. Established 2026-10-09. **Living engineering contract, not a claim that every production behavior is verified.**
> Source priority: running code + database schema + production evidence > current tests > these docs > historical handoff notes > chat discussions. If they disagree, investigate; never silently choose the older description.

## 2026-10-14 | Mobile More dialog focus containment

Opening the public mobile More sheet moves focus to its close control, makes every
background shell sibling inert, locks document scrolling and contains forward and
reverse Tab navigation within the dialog. Escape, the close control, backdrop and
route-driven closure all run the same cleanup: previous inert/scroll state is
restored and focus returns to the specific More opener when it remains mounted.
Existing authorized workspace links, EN/ES labels, responsive geometry, theme and
navigation destinations remain unchanged.

## 2026-10-14 | Event occurrence continuity and honest actions

Discovery and Map event cards include the displayed occurrence ID in their detail
destination. Detail selects that exact event-owned occurrence, with a bounded safe
fallback to the next active occurrence for invalid input. The selected identity is
retained in authentication, saved/preference return paths, internal booking, booking
outcomes, premium calendar downloads, sharing through the current URL and stay
planning. Calendar files use the selected dates and custom event location when set.

Scheduled occurrences whose end time has passed are explicitly marked ended and no
longer expose booking, stay-planning or calendar actions. Cancelled, postponed and
sold-out states retain their explicit status; booking is offered only for a future
scheduled occurrence, while sold-out future events may retain stay planning for
people who already have access.

Stay planning uses custom event coordinates when present and falls back to the host
venue. Copy reflects the current request workflow: participating properties accept
requests, confirm them directly, and AkiDuermo provides neither automatic confirmation
nor online payment. Booking/RLS, availability slots, external providers, pricing and
stored engagement remain unchanged.

## 2026-10-14 | Discover and Map filter continuity

The primary desktop and mobile Discover/Map navigation preserves only the shared
discovery filter contract: selected locality/name/coordinates, radius, time,
category, price range, dates and accessibility. View-only list and pagination
parameters are cleared on a switch. Other product routes never inherit discovery
query state. The no-results Map handoff uses the same helper and contract.

Initial event pins on Map now come from the same personalized, location-bounded and
filtered recommendation result set as the Map list. Category, time, price, date and
accessibility selections therefore describe both pins and results. Existing map
viewport venue-tile loading, selected centre, official event metadata, clustering,
popup behavior and geolocation controls remain unchanged. No ranking, repository,
location permission or stored-data change is included.

## 2026-10-14 | Community contribution recovery and target search

Event suggestions and reports retain their current tab's text, selections and
validated CartoCiudad address coordinates before submission. A failed validation,
RPC or rate-limit return restores that draft; opening a clean form clears stale
draft data. Drafts remain browser-tab local and are never copied into URLs or a
shared server record.

Report target discovery is an explicit bounded event/venue search with escaped
PostgREST literals. A safe linked event or venue ID is loaded exactly even when it
falls outside the current 50-result search window. Authentication, retry and action
failure returns preserve the bounded search and validated selected target.

Feature availability, categories, report targets, suggestion history and report
history each expose localized unavailable states and suppress controls that depend
on unknown data. Successful empty results retain their normal empty states. Existing
authenticated RPCs, automatic moderation, RLS, validation and rate limits remain
authoritative; no schema, policy or submitted record changes.

## 2026-10-14 | Accommodation and Passport read recovery

The AkiDuermo property workspace treats settings, room types, units, rates,
blocks and reservations as separate read dependencies. A failed active-section
dependency produces a localized retry and withholds only that section's controls;
other tabs remain usable. Unknown inventory counts render as unknown, and a failed
settings read never appears as a confirmed paused booking mode. Existing tenant
authorization, actions, inventory validation and booking transitions are unchanged.

The member Passport separates public passport and stamp-card catalogue reads from
XP, stamp ledger, route progress, enrollment and reward-claim reads. Failed totals
render as unknown instead of zero. Dependent start/claim controls, route completion,
badges and claim codes remain hidden until their source read succeeds, while healthy
catalogues and sections remain available. Successful empty ledgers still render zero.
No reward math, enrollment action, RLS policy, schema or stored record changes.

## 2026-10-14 | Independent read recovery for operations

Admin user search clears prior results as soon as a new query begins, ignores
superseded responses even when a transport does not honor abort, and offers an
explicit retry after failure. Staff moderation treats a failed or missing mode
record as unknown, keeps the independently loaded queue visible, and withholds
the mode mutation until the current value is confirmed.

Personalisation renders confirmed zero metrics as zero, but a failed or malformed
aggregate response hides all metrics and removes the previous guessed migration
diagnosis. Missing active-ranking configuration is distinguished from malformed
ranking data. AkiBusiness handles each venue analytics RPC independently and
never presents a failed venue read as “no activity.” Admin Passport campaign and
published-venue reads are also independent: campaign history remains usable when
venues fail, while creation stays hidden until its required first-step venue list
is known.

Public creator directory/profile read failures are separate from successful empty
or missing results. Directory retry preserves bounded literal name/area/category
filters; a successful missing profile still returns not-found. Creator review
outcomes are visible on the profile and authenticated submission returns to that
profile. Failed review draft retention remains separately tracked and is not
claimed by this batch.

Saved, followed and recent Account collections refresh names and slugs from the
currently readable event/venue catalogue by UUID. Current localized titles and
routes replace stale stored display snapshots; inaccessible, deleted, legacy-key
or temporarily unavailable catalogue rows retain the member's stored label/link
fallback. The existing locale-safe link renderer still rewrites canonical fallback
routes. Collection storage, export, paging limits and engagement mutations are
unchanged.

Existing server authorization, tenant/RLS checks, moderation mutations, analytics
RPC ownership, reward creation action and stored records remain unchanged. No
schema, role, data, provider, billing or checkout change is included. Retry links
reload the same bounded view. Source revert is sufficient for rollback.

## 2026-10-14 | GUI workflow continuity, exact prices and unavailable reads

The user approved implementation and live merging of the complete GUI inventory.
This follow-up preserves exact event cents and hidden-price choices across cards,
map popups and details using one currency formatter. Saved/followed/recent links
rewrite only canonical local event/venue destinations to the current locale,
preserving query and fragment. Workspace accessible names match EN/ES. Staff uses one
page-specific heading with scoped safe padding, and accommodation reservation
cards have explicit responsive rows without altering inventory actions. Narrow
auth portal cards retain complete brand words and touch targets.

Support failures restore an editable question and require explicit retry, with
one transcript entry per successful submission and no automatic provider calls.
Replies follow the transcript only when already near its end; older reading
positions are retained with a localized jump control. Existing modal focus,
scroll, same-origin payload, provider authorization and email fallback remain.

Admin catalogue/configuration/privacy/audit/application read failures show a
localized Retry and suppress unknown-data editors or decisions; successful empty
reads retain their controls. Taxonomy/configuration saves display outcomes.
AI section failures remain visible independently of loaded agents, affected
lists and budget controls stay unavailable, and real zero budgets stay zero.
Counts and monthly costs disclose their loaded sample; server budget enforcement
is unchanged. Failed operator chat drafts remain editable. Existing conversation
audience and actor references are displayed without changing provider history
isolation or task/tool execution permissions.

Passport start acknowledgement refers to the enrolled route deadline rather
than inventing a 30-day window; returned expiry dates render in Europe/Madrid.

No schema, authorization, RLS, price amount, booking transition, reward, consent,
provider-send contract, checkout flag or production-data changes. Rollback is a
source revert. Regression and responsive/current-head release evidence belong in
the impact register; fixtures do not establish authenticated production behavior.

## 2026-10-14 | GUI and workflow upgrades (approved release candidate)

The user approved implementation, commits, merges and live release on 14 October.
This first release batch preserves the complete 147-item upgrade inventory;
remaining work is tracked separately and is not represented as shipped.
The audit covers public discovery/community, identity and support, Account and
rewards, AkiBusiness/AkiDuermo, Staff/Admin, the separate AkiHQ repository, the
historical CRM branch, Android and the independent automation dashboard.
Source findings, design proposals, existing PRs and unperformed acceptance are
separate categories in the review artifacts; planned upgrades are not shipped
capabilities. The public baseline is `8613edbd962a978dc3d85f9f7b9aafcc4da54a56`.

- Map date filters use the same Europe/Madrid civil-time validation as discovery;
  inclusive end dates remain inclusive. Homepage venue badges reflect the
  existing claim state without changing it.
- Contribution success/errors return to the matching history/form. Auth and
  Terms returns preserve a validated contribution view and event/venue target.
  Auth error/notices retain the existing safe destination and the relevant form
  mode. Full failed-form draft retention and post-reset task continuity remain
  separate planned upgrades.
- Support dialogs contain/restore keyboard focus, lock/restore document scroll,
  have unique labels and retain a reachable scrollable composer in short windows.
  Existing help payloads, transcript, anonymous email fallback and provider
  boundaries remain authoritative.
- AkiDuermo history uses actual `completed`/`declined` reservation states. Valid
  trip intent supplies editable initial dates/guests without requesting availability
  automatically; per-property/user edits are retained. Customer and manager status
  text is localized while raw action/status values remain unchanged. Filtered
  accommodation inboxes explain no matches.
- Staff queues distinguish read failure from true empty results; creator decision
  failures remain visible. Catalogue retries retain filters, event search covers
  both title languages using escaped PostgREST literals, and Manage event opens
  only the selected event already present in the authorized venue result.
- Admin overview never treats a failed required read as stable/zero activity and
  directs the priority action to a known pending or unavailable work area. City
  editing retains actual coordinates; `saveCity` requires explicit finite,
  Spain-bounded values rather than silently substituting Madrid. Center decoding
  must support the database geography representations as well as GeoJSON.

No schema migration, new permission, RLS/Storage rule, reward calculation,
booking transition, price, payment activation, consent or outbound-message
contract changes. Existing server-side role/tenant checks and audited mutations
remain in place. Verification and limitations are recorded in the impact register;
local component/browser fixtures do not establish production authentication,
database acceptance, provider delivery or physical-device behavior. Cloudflare's
clean-source packaging gate remains intact; packaging follows a clean source commit.
The batch is reconciled with master `6fb9fae27d56f44b62dcf79bf50f293e5454c1c3`,
including selected-media and hidden-catalogue-starter recoveries.

## 2026-10-13 | Responsive AkiSuite membership catalogue and AkiHQ sectors

The shared seven-plan membership catalogue keeps every plan visible regardless of payment activation. It uses the original AkiPasa, AkiBusiness, AkiDuermo and AkiHQ icons; Enterprise shows all four and the conditional AkiHQ Pro business add-on shows the paired business/HQ marks. The legacy business-sector taxonomy from `src/lib/business-packages.ts` powers an informational Standard/Pro tool comparison, not separate checkout packages or sector-specific entitlements. Plans remain VAT-inclusive and checkout remains gated.

Desktop cards use four columns, tablet two, and narrow mobile a single column with accessible, expandable benefit panels to reduce initial scrolling. The selector, recurring prices, plan inheritance, current-access indicators, server-side authorization and Stripe overlap guards must remain intact. EN/ES, light/dark, touch targets and responsive browser acceptance are release requirements. This change does not update billing, tax registration, database schema, grants or storage.

## Mandatory change protocol

Database application revision conflicts use SQLSTATE `PT409` (HTTP 409), never
`40001`: PostgREST 14 retries the latter indefinitely. See
`docs/database-conflict-incident.md` for the October 10 incident and recovery.

1. Read `AGENTS.md`, **this entire document**, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/deployment-source.md`, and the relevant domain files. Also inspect current source, tests, migrations, deployment config, and the full import/call graph of touched code.
2. Record the requested behavior, current observed behavior, locale/portal/role/device matrix, exact source paths, data ownership, upstream/downstream consumers, failure/rollback modes, and potential regressions **before** editing.
3. Search for ALL instances of the affected function, copy, action, routes, translations, tables, permissions, caches, events, background jobs, telemetry, callbacks, mobile integrations, and tests. No isolated UI patch without tracing server and storage effects.
4. Implement the smallest coherent cross-layer change. Preserve all existing visible behaviors unless explicitly superseded. Avoid deleting code or features merely to satisfy compilation.
5. Add or update contract tests, UI interaction tests, and affected end-to-end tests. Verify BOTH /en and /es, desktop/mobile, light/dark, anonymous/authenticated, role gates, empty/error/loading/success, keyboard and accessibility.
6. Run `npm run check`, affected integration suites, and `npm run test:e2e` where usable. Where blocked, log exact failed/skipped commands and why. Green tests do **not** prove live traffic is healthy.
7. Update this file's inventory and dependency matrix, `docs/CHANGE_IMPACT_REGISTER.md`, affected architecture/decisions/runbook docs and changelog; include evidence and unresolved risks in the PR.
8. Before a production release: determine source branch, inspect branch diff, validate Cloudflare/worker build, required migrations/backward compatibility, permission/consent behavior, Google/Stripe/Supabase integrations, cache and SEO. Deploy only with approval. Confirm public and authenticated smoke checks, logs, 5xx/1102 rates and rollback path. Never claim production verification without production evidence.
9. Stop deployment if a critical acceptance case fails or coverage cannot be demonstrated for a changed sensitive workflow.

## Repository and topology (verified from repository files 2026-10-09)

- **Public deploy source: `master`.** `main` is a separate CRM source. See `docs/deployment-source.md`. Historic stale-branch deployment overwrote redesigned public UI.
- On the AkiDuermo host, localized auth and terms pages use an AkiDuermo header and controls without the AkiPasa consumer sidebar; shared Supabase identity and locale routes remain intact.
- AkiDuermo Explore, Saved, Map, property and member pages share the same five-link navigation order and fixed placement. Saved uses a compact local search instead of the Explore booking search; the map opens its search and type filters from one disclosure button.
- `src/app`: Next.js 15.5.21 App Router, locale routes, actions, endpoints. `src/components`: UI. `src/lib`: logic/adapters. React 19 / TypeScript / Tailwind.
- Public runtime: OpenNext + Cloudflare Workers, `wrangler.jsonc` entry `custom-worker.ts`; Cloudflare routes include `akipasa.com`, `www.akipasa.com`, `business.akipasa.com`, `akiduermo.akipasa.com`, and AkiConduzco `akiconduzco.akipasa.com`. **Verify host routing/redirects and whether all hosts use same worker on every release.**
- Public data: Supabase Auth, PostgreSQL/PostGIS with RLS, RPCs, Storage, Cron. Fixture/Hybrid repository modes are for deterministic testing and hybrid reads; do not leak fixtures into claims of validated public venues.
- Map: MapLibre, OpenFreeMap style, viewport/pagination/snapshot caching; Cloudflare Durable Object `MAP_SNAPSHOTS` appears in worker config.
- AkiHQ gateway: Cloudflare service binding `AKIHQ_GATEWAY` to `akihq-integration-gateway`. Business suite is separate from the general discovery user journey.
- `automation/`: independently deployed Hono Worker, D1/KV, voice and Telegram command routes, separately gated.
- `Android/`: native host with web-backed product, Google OAuth/billing handoffs, App Links, location and upload support. Capacitor/iOS direction discussed; do not assert iOS production availability without code/store evidence.
- Core commands `npm run check` = format, lint, typecheck, tests, DB safety, automation checks, production build; `npm run test:e2e` builds and runs browser acceptance; `npm run build:cloudflare` tests Cloudflare packaging. Read current `package.json` to confirm scripts before use.
- Schema: ordered `database/migrations/`; database safety tool refuses remote URLs. Run rollback-only `database/tests/acceptance.sql` on approved DB migrations.
- **Existing docs are not uniformly current.** `docs/AI_HANDOFF.md` dated July, `docs/ARCHITECTURE.md` July, `docs/PROJECT_STATUS.md` August, while repo changes and user requirements continue through October. Historic prices/version/status claims there are not current authority.

## Product surfaces and their cross-surface contracts

Each item must be validated against source route discovery before claiming exhaustive coverage. User-described behavior is tagged **INTENT**, existing architecture **CODE-DOC**, or observed production **LIVE**. These tags must not be conflated.

### Discovery and public site

- `/en` and `/es`: localized landing/discovery, venue and event discovery, searches by name/city/full address, category/time filters, pagination, map/list, saved/followed, suggestions, SEO titles/canonicals/sitemap/robots, privacy.
- Shared top-right search should avoid duplicated in-page search. Filter state should persist across Discover/Map/Saved. Explore/map lists should paginate without throwing SSR Worker errors.
- Venue/event detail: photos/gallery, descriptions, contact/navigation, event timing/recurrence, saved/going and privacy-respecting analytics. Do not expose the entire editable business gallery by default (**INTENT**).
- Map contract (**INTENT**, verify current code): sanitized venue rows only, accurate per-venue coordinates/directions, no stacked duplicates, cluster count consistent with visible hits, official events never disappear beneath nearby markers, legend opening does not recenter/zoom, list origin computed on open, viewport cache invalidated on data refresh. Quarantined count 7,782 was a dated discussion number, not a live query result.
- Locales: every label, error, button, URL and SEO attribute in EN/ES; translations never overwrite canonical business-entered text.

### Consumer identity and billing

- Signup via password and Google OAuth, login portal selection, callback/redirect paths, session cookies, role resolution and profile editing. Both auth paths must produce correct registration analytics ONLY after actual signup, deduped, and only with lawful consent.
- User Account Overview shows consumer plan Free/Premium only (**INTENT**); business/venue privileges belong to separate portals, not a consumer package badge.
- Premium/subscriptions: checkout/portal, webhook, account entitlements, cancellations/refunds, staff grants, audit and Stripe reconciliation. Success redirects MUST NOT grant entitlement or count a conversion; require signed, durable, deduped payment/webhook confirmation. Pricing in historic handoff may be outdated; read current Stripe config and approved price table.
- Consent: GDPR consent default, versioning, opt-outs, export/deletion, analytics and ad pixels. Verify no Google Ads or GA4 events fire without applicable consent; check revocation across sessions.

### Passport, achievements, AkiPals

- Passport immersive responsive page, dark/light themes, holographic card/tilt, motion permission and privacy, scroll handling, city cards, rank tiers and city-specific category stamps (**INTENT**). Keep desktop and mobile navigation parity.
- Check-ins/XP/stamps/rewards MUST be transactional, authorized, rate-limited, idempotent with audit; regrant/revoke other tiers atomically where applicable.
- AkiPals (**INTENT**): character families, layered wardrobe/inventory, rarity/ownership, item grants, shop, daily rewards, adventures, sponsored cosmetics and future monetization. Source foundations are exercised by `tests/pals*.test.ts`; do not assume planned features are released.
- October 12 AkiPals playground (**CODE-DOC**): `/pals` remains an English-language,
  account-authorized, noindex/private preview. A responsive dark/light hideout,
  distinct vector family expressions and ten curated outfit recipes retain all
  61 existing design IDs. Schema-1 saves gain optional journey progression:
  care actions, permanent XP-based bond ranks, real-activity daily goals and a
  three-distinct-story weekly goal. Completed bonuses bank without expiring.
  Interactive arcade challenges join the same server-validated action and
  atomic command ledger; browser scores/balances are never authoritative.
  No migration, real-money commerce, public navigation or new map/location
  integration is added. Current source/dependency and release evidence lives
  in `docs/AKIPALS_RELEASE_20261012.md`; local fixtures are not live login proof.

### AkiBusiness and event management

- `business.akipasa.com`: claim/find venue using search + real map pins, venue ownership verification, business applications, dashboard, profile editor, image uploads, menus/allergens, events, offers, team access, analytics and publishing.
- English UI edits should persist entered source and generate the opposite-language projection for consumer display; errors must not silently fall back to stale source text. Translation endpoint name present in `wrangler.jsonc`; verify API availability, backoff, failure/retry, provenance and missing translation state.
- Photo uploads: multi-select, safe extension/MIME/size checks, acceptable short filenames, compression/variants, selection UI 3×3 paginated picker, storage transactions, deletion and event/venue display permissions (**INTENT** based on latest bug report).
- Venue media studio sends each selected image/PDF-converted JPEG as same-origin multipart POST to `/api/business/venue-media`, outside the Next Server Action body transport. The endpoint requires exact origin, bounded multipart size and reuses the authenticated `uploadVenueImage` validation, Business entitlement, Supabase Storage and `venue_media` RLS path. Responses are private/no-store and distinguish invalid file, translation, storage, database and unavailable server errors. This applies to both ordinary venues and accommodation properties; images stay in the private management bin until placed.
- Menu category accordions independently open/close, global expand/collapse, all allergen badges legible, layout intact at small widths (**INTENT**).
- Staff-created official town events hosted by an official AkiPasa venue, privileged creation and publishing, dedicated map marker, audit and visibility under density (**INTENT**). Never let an ordinary claimed business impersonate the official organizer.
- Claim, save, publish and event editing must preserve all fields and error recovery; full-screen compact editor must not crop header/details.

### Booking engine: resource-backed recurring availability (branch candidate, not deployed)

- Venues retain External / Via AkiPasa / Disabled modes. External remains
  a single URL, disabled hides public booking actions, and native booking
  requests use the existing capacity-locked `request_booking` function.
- Resource pools (`booking_resources`) have a venue owner, name, kind, seat
  capacity, active state, and owner/manager-only RLS. Assigning a resource
  to `venue_availability_slots.resource_id` is optional, preserving all
  historical unassigned slots and booking requests.
- Resource-backed slots cannot overlap in active time ranges for one resource.
  The database validates resource ownership, active state and per-slot
  capacity; cross-venue assignments must fail.
- The new `create_recurring_booking_slots` RPC expands weekday selections
  into bounded (maximum 90-day span) slots in Europe/Madrid civil time.
  It applies authorization, active native-mode checks, duplicate suppression,
  DST round-trip validation and an atomic SQL transaction.
- The AkiBusiness manager exposes resources, individual slots and recurring
  rules; seven presets remain suggested UI defaults, not complete specialist
  hotel/restaurant/ticketing engines.
- Regression surfaces: public venue and event booking availability, external
  redirects, existing request confirmation, Supabase RLS, EN/ES, small screens,
  venue membership permissions and future AkiDuermo integrations.
- **Not yet verified:** recurring SQL on an upgraded test database, live
  booking via a resource, browser acceptance, Cloudflare production status.
  Never merge/deploy before required validation and migrations.

### Multiple independent booking offerings (draft extension)

- `booking_offerings` models a venue-owned service or activity, with type, duration, capacity and active state, protected by RLS. The customer booking page shows the offering name for each assigned slot.
- `venue_availability_slots.offering_id` is optional and references an offering at the _same venue_; existing general booking slots remain valid and are not moved.
- Single and recurring slot creation can assign both an offering and a physical resource. Database triggers reject exceeding the offering or resource capacity. Historical request_booking capacity locking is retained.
- No payment entitlement, ticket fulfilment, automatic staff assignment or hotel room-night pricing is implied by this model.
- Acceptance required: additive migrations applied in order, disposable Postgres suite, EN/ES responsive UI, direct customer reservation, cross-tenant and duplicate-capacity checks. **Not deployed to production.**

### Consumer booking UX and confirmations (October 2026 release candidate)

- Customer venue booking uses `BookingWizard`: date/time buttons, remaining-capacity party controls, minimal contact details, retained error inputs, and a per-form idempotency key. `request_booking_v2` serializes capacity and validates published/native settings, active offerings/resources and submitted identities. The legacy event RPC delegates to the same engine.
- `booking_available_slots` returns aggregate remaining inventory only. Pending and confirmed reservations both consume capacity; zero remaining never becomes one place in the UI.
- Account `/[locale]/account/bookings` provides Upcoming/Active/Past, 20-row paging, totals, status badges, service/address details, and explicit future cancellation. `my_booking_history` enforces `auth.uid()` inside SQL and includes historical slot dates even where public slot policies hide past rows. Visible pages refresh every 30 seconds. Booking requests and customer confirmation snapshots are included in the account export; deletions cascade to queued mail.
- AkiBusiness has Bookings, Calendar, Services and Settings in a bounded workspace. Saves retain `section=bookings&bookingTab=...`; service selection belongs to each new offering. All booking mutations require actual venue owner/manager or inherited administrator access. Ordinary editors cannot approve. Direct customer field rewrites and self-approval are denied in PostgreSQL, not merely by hidden buttons.
- Approval is a one-way `requested` to `confirmed` transition. A trigger produces one durable row per customer/venue audience with an immutable localized content snapshot. Venue notification settings are in a separate private RLS table; fallback is an actual verified owner email, never a fabricated address. Missing recipients are shown as blocked. Cancellation suppresses unsent confirmations.
- Resend sends from `AkiPasa <contact@akipasa.com>` unless a runtime sender override is configured. HTML is escaped, audience content differs, and provider idempotency is stable. `sent` means accepted by Resend, not proven inbox delivery. Secrets missing means queued without consuming attempts.
- `custom-worker.ts` runs a five-minute scheduled outbox dispatcher with the existing Supabase service role and the new runtime `RESEND_API_KEY`. Lease claims prevent concurrent senders; stale leases recover; exponential retries are bounded. Ambiguous delivery older than 23 hours is held for review rather than resent beyond Resend's 24-hour idempotency window.
- Required new migrations: `20261009160000_booking_notification_email.sql`, then `20261009170000_booking_release_integrity.sql`. Existing advanced booking tables and all historical booking data remain intact. Do not apply the superseded draft notification schema from an earlier PR revision.
- Release runbook: `docs/BOOKING_RELEASE.md`. SQL acceptance uses real PostgreSQL roles/RLS and concurrent connections; browser acceptance exercises actual components in eight locale/theme/viewport combinations. The broad site browser suite also runs. Record actual CI and edge evidence in the PR; no statement here asserts unperformed production login or real email delivery.
- Scope: configurable service/resource slot reservations. Automatic table combinations, full hotel room-night pricing, ticket fulfilment and online deposits remain outside this release. An optional deposit is only a manual arrangement with the venue, not a charge.

### AkiHQ / management / operations

- AkiHQ Pro plan, POS/till/table service, staff devices/roles, order movement/splitting, inventory and printers are **planned/partially built** until code and live evidence prove otherwise. Never represent an untested action as live.
- Staff/admin: searchable catalogue and users, moderation, venue verification, CRM/support reports, business applications, abuse controls, audited role changes, privileged grants, Field Atlas pin research.
- **Staff operations count contract (Oct 10):** /es/staff and /en/staff summarize pending venues, events, offers, community submissions, and venue ownership claims. Claim counts come from the staff-authorized `staff_pending_venue_claim_count()` RPC, which mirrors the joins and pending-status predicate in the paginated `staff_pending_venue_claims()` queue; it does not expose claimant contact details. The overview has a direct ownership-claims shortcut. Failure to load a count must not be represented as zero or “all caught up”. The four metrics keep venue-publication count distinct from the ownership-claim count. Affected: `src/app/[locale]/staff/page.tsx`, `src/lib/staff-moderation-summary.ts`, `src/app/[locale]/staff/staff-overview.css`, `database/migrations/20261010231800_staff_pending_claim_count.sql`, PGlite and moderation tests. No claim status transitions, business membership, emails or customer-facing map/search have changed. Authorization lives server-side and in database policies, never only hidden navigation.
- Field Atlas pin creation (**INTENT**): tap empty map enters temporary center-marker placement, drag map beneath fixed marker, explicit confirm only; do not create pins accidentally. Retain CSV/Excel, saved pins and settings.

### AkiDuermo / accommodations

- Accommodation media contract (October 10 candidate): the AkiBusiness media studio keeps five explicit listing selections and a separate ordered public header gallery. Header membership uses existing `venue_media_placements` rows with `placement='venue_gallery'` and `target_key='stay_header'`, capped at 12. The AkiDuermo detail loader must never read the first images from `venue_media` directly: the bin is private until placement. An empty gallery renders the existing placeholder.
- JPEG/PNG/WebP originals up to 50 MB are decoded and downscaled to at most 2560 pixels per side, exported as JPEG below the existing 10 MB server and 11 MB multipart limits, then uploaded one by one. PDFs retain the sanitized JPEG conversion. The server still validates MIME, bounds, auth and RLS; client compression is convenience, not authorization.

- `akiduermo.akipasa.com`: mobile-first accommodation discovery, listing filters, locale, map redirect and eventual booking pages. Approx. 21k accommodation records is a dated conversation estimate, not a verified current count. Review availability/booking claims against implemented backend.
- `akiconduzco.akipasa.com`: standalone rental car search, map, operator listings and request-only bookings; fleet tools live in AkiBusiness `/[locale]/business/mobility`. Rental companies are independent records with staff review and owner RLS, never claimed venues. No payments or instant confirmations; validate against current migration and release evidence.
- Candidate PR #82 adds explicit disabled/external/request settings, property-owned room/unit/rate/block inventory, aggregate public availability, authenticated expiring quotes, atomic idempotent room assignment, owner/customer status transitions, audit/outbox, account history/export and bilingual customer/manager UI. Migration `20261009220000_accommodation_inventory_foundation.sql` must run before application rollout. No online payment, OTA sync or automatic confirmation is implied.
- Release gate: run `scripts/test-accommodation-sql.mjs` on disposable PostgreSQL 16, the full repository and browser suites, Cloudflare packaging, then authenticated EN/ES owner/customer production smoke. A passing static SQL test or merged PR alone is not evidence of live booking.
- The AkiBusiness accommodation manager is a compact tabbed WebApp rather than a continuous settings document: a summary strip reports active types/units, occupied units, pending requests and booking mode; one bounded work panel is visible at a time; create/edit inventory controls are disclosure panels; and request mode is visually unavailable until an active type, physical unit and rate exist. Preserve every manager action and EN/ES keyboard access at mobile, tablet/split-screen and desktop widths.
- Consumer AkiDuermo has dedicated same-host `/map`, `/saved`, `/account`, `/bookings`, `/settings`, and `/stays/[slug]` routes. The `/[locale]/auth` and callback pages are permitted on the stay host; they use the **same Supabase user identity** but a host-scoped session. AkiDuermo sign-in returns only to an allowlisted local member or stay route, never an arbitrary external redirect. Session refresh must survive middleware rewrites, and POST access remains restricted to auth, terms acceptance, stay booking and member actions.
- Stay map uses the accommodation-only `ProductionMap` full-screen mode (`cooperativeGestures: false`), with dedicated viewport and overlay filters; route content, not an embedded box. Customer bookings read only their own reservation rows under RLS and cancellation rechecks ownership server-side before calling the status RPC. Saved stays remain device-local, not synchronized account data. Email/password, OAuth, magic-link and recovery redirects require exact AkiDuermo Auth URL allowlisting in the Supabase project and authenticated production smoke before release.
- Map filter changes must refresh accommodation markers in the current bounds without recreating MapLibre or resetting camera/zoom. Its full-screen layout hides the general-purpose map legend beneath the filter control. Explore listing searches use the indexed, unaccented `venues.search_document` prefix search rather than an unindexed `ILIKE` count scan; when dates and guest count are supplied, each candidate page is checked against the public aggregate room availability RPC and only available stays on that page are shown. The candidate pagination total is not a nationwide availability count. Property detail still rechecks availability and quotes before booking. A signed-in owner/manager may see their hidden accommodation as a marked private search preview on the first page; it must not be included in anonymous discovery, public caching or device saved stays. AkiDuermo HQ remains intentionally non-discoverable to ordinary visitors unless its owner explicitly enables discovery.

### Marketing, attribution and integrations

- Search Console, sitemap indexing, Google Analytics / GA4, BigQuery, Google Ads conversion tracking, paid campaign: **do not modify spending or campaign settings as a side effect of source changes**. Campaign 24330369989 was requested to remain €8/day with its existing end date.
- Google Ads tag ID `AW-18500420718` discussed; verify current code and account before assuming binding. Registration and subscription events are distinct, consent-controlled and deduped; server confirmation required for payments.
- Stripe webhook, Supabase login/storage/RPC, Google OAuth, Cloudflare Worker logging and release, translation backend, AkiHQ service binding, email provider, QR/NFC, Android link association: trace each upstream and downstream before edits.
- Customer-facing copy, translations, design/theme tokens, package descriptions, finance claims, SEO structure and legal/GDPR documents must stay consistent across all portals.

## Dependency impact matrix

| Change domain                | Review together                                                                                                                | Minimum regression checks                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Venue schema/location/status | migrations/RLS/RPC, repository adapter, search/SEO, map, clusters, list, directions, claim, business editor, cache, admin, CSV | duplicate/quarantine filters, pagination, accurate lat/lng, EN/ES, mobile, map/list parity |
| Events/official events       | ownership, auth, event recurrence, editor, pin priority, schema, search, SEO, calendar and moderation                          | staff vs consumer auth, publish, localized detail, map priority                            |
| Auth/session/roles           | password+OAuth callbacks, cookies, portals, account/business/staff/admin, Android, CRM, metrics                                | login/logout and redirect each portal, privilege denial, consent                           |
| Billing/plans                | Stripe config, webhook and RLS, entitlement projection, pricing copy, account, business tools, premium XP                      | signed webhook, duplicate/stale/reordered events, cancel/refund, no redirect-only grants   |
| Media/upload                 | storage policies, filename parsing, sizes, transforms, multi-select, event+venue galleries, CDN/cache                          | 1-char name, large images, multi-images, upload/delete, published/private boundaries       |
| Translation/i18n             | writer UI locale, backend translation, storage fields, consumer read paths, legal/SEO                                          | source EN→ES and ES→EN, fallback/error/retry, preserve source                              |
| Search/discovery             | query parser, locality, pagination, DB indexes, time zone, map/list, SEO                                                       | full address, venue+city, nights across midnight, deep pages, no Worker 5xx                |
| Map/Field Atlas              | map styles, viewport/legend, clusters, coordinate integrity, quarantine, directions, research pins                             | no camera jump, stacked pin handling, accurate directions, no accidental writes            |
| Passport/rewards/Pals        | grants, ledgers, inventory, entitlements, client UI, admin tools, privacy                                                      | idempotent grant/revoke, localization, 360px, durable ownership                            |
| Ads/analytics                | consent, signup flows, payment verification, event idempotency, dashboards                                                     | opt-out=no event, OAuth+password once, payment once, no PII                                |
| Theme/responsive navigation  | design tokens, 3 portals, nested shell, dialogs, scroll, focus, dark/light                                                     | EN/ES 360px/desktop light/dark, back/escape/touch                                          |
| Deploy/config                | master HEAD, bindings, secrets names, Cloudflare builds, SEO, migrations, Android links                                        | build, smoke apex/www/hosts, rollback, logs, 5xx                                           |

## Minimum release smoke matrix

A passing build is only the start. Test routes on `/en` and `/es` for homepage, Explore, map, venue/event detail, login, membership, account and privacy. Check business claim, event edit/publish, official event map marker, translation, media picker, AkiDuermo accommodation, AkiHQ auth and protected access, Passport/Pals, staff/admin gating, Stripe signed test events and analytics consent. Use browser at 360 px and desktop with both themes. Check console/network and Cloudflare traces for 5xx/1102. Mark paths `pass`, `fail`, `not run`, `blocked`; never quietly omit.

## Coverage gaps, not achievements

**Not yet established by this master-document PR:** automated exhaustive enumeration of every current route/button/text/action; actual full current Supabase schema and RLS snapshot; live Cloudflare rollout/production diagnostics; completion status of newest user-requested fixes; current asset storage policy; exact Google Ads state. Future agents must inventory these from current source and live approved systems and replace each gap with file paths, tests and evidence. Historic chats capture requests, not proof of deployment.

## Automated inventory and pull-request gates (added 2026-10-09)

- Run `node scripts/generate-system-inventory.mjs > /tmp/akipasa-inventory.json` for a deterministic, reviewable inventory of source files, Next routes, route-handler HTTP exports, visible-control JSX tag sites, event-handler references, aria labels, migrations, tests and integration-keyword references. `--summary` produces a smaller routing summary. GitHub Actions uploads this summary as `akipasa-source-inventory` for every PR to `master`.
- The inventory is **static heuristic discovery**, not a verified button-by-button semantic map: dynamic component factories, runtime copy from dictionaries, imported callbacks, SQL permissions and browser behavior require separate analysis.
- `.github/workflows/master-system-contract.yml` invokes `scripts/check-change-contract.mjs`. For source, migrations, automation, Android, worker config, build configuration, package or CI workflow changes, the PR must also modify both `docs/AKIPASA_MASTER.md` and `docs/CHANGE_IMPACT_REGISTER.md`. Documentation-only changes do not trip this gate.
- This mechanism **cannot enforce agent reading** or verify that changes are correctly documented; require the check as a branch-protection rule and review the impact register. It does not replace `npm run check` or browser/production smoke tests.
- Workflow and scripts were committed through the GitHub connector; execution and PR CI results still need independent verification. No claim of passing CI is made.

## Documentation map

- `AGENTS.md`: mandatory start/stop instructions.
- `docs/CHANGE_IMPACT_REGISTER.md`: per-change before/after evidence ledger.
- `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`: deeper architecture/ADRs.
- `docs/deployment-source.md`, `docs/RUNBOOK.md`: source and release/rollback.
- `docs/AI_HANDOFF.md`, `docs/PROJECT_STATUS.md`, `docs/TODO.md`, `docs/ACCEPTANCE.md`, `docs/CHANGELOG.md`: check freshness and reconcile, never blindly trust.

### Event-first venue pages and linked event menus (2026-10-09, pending verification)

- Venue detail prioritizes upcoming (non-cancelled, unfinished) events above public catalogue, with responsive artwork/date cards; old event paragraph links removed.
- Business event editor optionally selects venue catalogue section IDs, submitted in `catalogueSectionIds`, validated against the venue's own catalogue and stored in `events.catalogue_section_ids` (migration `0102_event_catalogue_sections.sql`).
- Public event detail reads the current published venue catalogue and renders selected matching sections, never copied prices/allergens. No selection gives no menu. Menu deletion/unpublish removes it from event display.
- Cross-surface release prerequisites: migration before Workers deploy, full check/e2e, EN/ES mobile/desktop, role ownership, published/unpublished catalogue, bookings and media regression. Never claim deployed before verification.

### AkiDuermo accommodation claim discovery (2026-10-09)

- AkiBusiness claim picker now has Activities / Accommodation tabs, using validated `vertical` on `/api/business/claim-search` and `/api/business/claim-map`.
- Existing activity RPCs remain unchanged. Accommodation uses `search_claimable_accommodations` and `claimable_accommodation_cards_in_bounds`, restricting results to genuinely unclaimed, published, enabled, located, non-suspect accommodation.
- All claims still use the existing `venue_claims` and member grant process, with no automatic ownership on claim submission.
- `AkiDuermo HQ` demo property is a manually seeded, non-discoverable, non-bookable published accommodation with a verified owner association. Never use test listing to infer real inventory, prices, licensing or service availability.
- Room-night inventory, property amenities and hotel-specific booking/editor tools are future work, not completed by this change.

### Tablet, multi-window and PWA identity (2026-10-09 candidate)

- Each public hostname must expose its own manifest name, stable app ID, correct start URL and branded icon. AkiBusiness is **not** an AkiPasa installation, even though all three share the worker and original global metadata.
- Treat viewport width, not hardware type, as the layout signal: split-screen on a landscape tablet can be narrower than a phone landscape window. Test roughly 390, 600, 768, 820, 1024 and 1280 CSS pixels in both orientations and browser/PWA modes.
- AkiBusiness venue rows must keep name/role/status and both Manage/Delete actions available, wrapped without clipping, plus safe delete confirmation at narrow widths. Preserve the two-language account and business login flows.
- Files: src/app/manifest.ts, src/app/pwa-icon.svg/route.ts, src/lib/akiduermo-routing.ts, src/app/tablet-responsive.css, src/app/layout.tsx. This is a **candidate partial fix**, not certification that every AkiPasa, AkiBusiness, or AkiDuermo page has been visually audited.
- Still require chromium/Android installation checks (including SVG icon support and installed-name refresh), auth and workspace browser screenshots, scrolling/no-overflow matrix, light/dark EN/ES and Cloudflare build evidence. Not deployed.

### Tablet acceptance continuation (PR #79)

- Raster PWA icons in `public/pwa/` include independent orange/yellow/green identities at 192/512px plus maskable safe-area variants; regenerate with `node scripts/generate-pwa-icons.mjs`. Root metadata resolves hostname-specific application names and favicon/touch icons. Keep AkiPasa ID `/es`, matching its former implicit start-URL identity.
- The shared service worker registers separately on all three origins; allow its `/sw.js` and `/offline.html` routes on business/stay hosts. Never cache the manifest, authenticated responses or API data. Existing install labels may need Android Chrome refresh/reinstall after release.
- `scripts/test-tablet-browser.mjs` exercises real VenueDashboard, BookingManager and VenueDeleteControl with disposable actions across 28 EN/ES, light/dark, portrait/landscape/short split-screen combinations. It checks visible venue action bounds, all dashboard tabs and delete confirmation/cancel without deleting records. This is component acceptance, not production authenticated acceptance.
- `tests/e2e/tablet-suite.spec.ts` covers public route widths, business virtual-host auth modes and host-specific manifests. Physical Android WebAPK installation, rotation/keyboard behavior and authenticated full editor content require device/staging acceptance before production.
- Detailed candidate coverage and production hold: `docs/TABLET_ACCEPTANCE.md`. Browser route matrices use existing consent-version cookies with optional choices disabled, fixture discovery and no real auth mutations; backend availability and physical Android installation remain separate gates.

### Tablet booking inbox follow-up (2026-10-09)

- AkiBusiness bookings use `src/lib/business-booking-inbox.ts`: 20-row server paging, exact filtered count, guest name/email/phone or exact UUID reference search, status filter, deterministic received-date ordering. The request remains scoped to venue ID through the existing signed-in Supabase client/RLS; no service-role client or schema changes. Pending dashboard totals use a separate count rather than the current page.
- Search/filter/page state is URL-backed (`bookingSearch`, `bookingStatus`, `bookingSort`, `bookingPage`) with GET search, reset and accessible previous/next controls. Booking approval/cancel/retry redirects preserve Zod-validated filters; out-of-range pages clamp after mutations. Contact punctuation is preserved inside escaped PostgREST quoted values; SQL LIKE literal characters are escaped. Failed reads are not presented as an empty inbox.
- Only visible booking email statuses are fetched. Joined historical slot dates remain available independently of the Calendar array; compact status pills, expandable reference/contact/notes, and existing approval/cancellation/mail actions remain intact.
- Booking manager uses document scrolling rather than a capped nested scrolling box, preserving Services/Resources/Calendar/Settings form boundaries at short split-window heights. Test tablet portrait/landscape including 960×1536 and 1536×960, EN/ES and both themes. Component fixtures do not establish authenticated live acceptance.
- VenueDashboard observes the actual AkiBusiness header height and offsets its sticky horizontal/vertical venue navigation accordingly, including wrapped split-screen headers; observer/listener clean up on unmount. Without a business header, the normal standalone offsets remain. Booking search anchors account for that header height.

### Booking service editing and persistent inbox filters (2026-10-09)

- AkiBusiness Services must support editing existing `booking_offerings`, not only creating them. Managers can update name, type, duration, capacity and active state through the same booking manager, using owner/manager authorization and existing RLS; no schema migration is required.
- Booking inbox filters remain URL-backed for share/reload persistence, but the search form submits through the client router so applying search/status/sort does not trigger a full document reload. Booking action redirects still preserve validated filters.
- Booking request cards use a responsive grid on tablet/desktop to use horizontal space; narrow screens collapse to one card per row. Keep approval/decline/complete/cancel/retry controls visible inside each card.

### Business vs accommodation tool selection (2026-10-09, unverified candidate)

- AkiBusiness managed list now resolves `venues.discovery_vertical`: regular AkiPasa venues and AkiDuermo accommodations are visible within one authorized account, labelled separately, with their existing verified membership/role gates.
- VenueDashboard receives an explicit product type. Accommodation exposes Overview, Profile, Bookings, Team only; venue-specific events/catalogue/rewards/check-in remain available unchanged on regular venues. AkiDuermo booking area is separate from timed-slot BookingManager, and remains intentionally NON-BOOKABLE until room-night inventory and rates ship.
- See `docs/AKIDUERMO_BOOKING_DESIGN.md` for complete seven-template booking system, room-night transaction model, UI contract and rollout phases. This branch does not implement accommodation inventory, actual nightly-rate quotes or booking transactions; no deployment claims.

### Portal home unity (2026-10-10 candidate)

- AkiPasa consumer components, brand, homepage and navigation remain unchanged. New `portal-unity.css` tokens apply only to `body[data-product="akibusiness"|"akiduermo"]`; root layout assigns the existing middleware product identity. AkiBusiness uses yellow/navy; AkiDuermo green/teal. Uploaded icon masters live in `public/brand/{business,duermo,hq}-icon.png`; `PortalLogo` uses these in headers and product links. AkiHQ's purple AE is a link identity, not a change to the separate CRM repository.
- `BusinessHeader` keeps language/theme visible and groups product links plus authenticated logout inside a native disclosure. `StayHeader` is shared by Explore/Saved, property detail and map/member shells, with identical home, theme, language and settings controls. Auth/terms use the same mark. Existing cookie/locale, Auth and booking routes are preserved.
- AkiBusiness Home (`BusinessHome`) receives only server-authorized membership rows plus the pre-existing staff editorial row. It renders eight cards per page, name search (accent-insensitive), venue/stay filters, status filtering and name/status sort. Each opens the same product-aware venue editor. Owner-only deletion remains the existing reason + DELETE dialog behind an Options disclosure; editorial deletion remains excluded. Membership read errors are explicit rather than empty states.
- Analytics RPC fan-out now runs only for the Analytics view, avoiding per-property RPCs on Home. Membership/RLS, claim/create forms, event/reward/growth sections, booking APIs, storage, payments and analytics collection stay unchanged. No schema or production records change.
- AkiDuermo's welcome is compact and green, with the existing search/availability flow immediately below it. Five-link fixed navigation stays intact. Raster PWA icons for Business/Duermo are derived from uploaded masters, including maskable safe-area variants; their manifest omits the competing generic SVG. AkiPasa assets/manifest identity remain unchanged.
- Regression evidence: `tests/portal-home.test.tsx` and `scripts/test-portal-home-browser.mjs` (real components, disposable data/actions) cover EN/ES, light/dark and phone/tablet/short split-screen. CI tablet workflow runs the new 64-combination harness and saves screenshots. Full check, Cloudflare and live verification must be recorded before release; this section does not assert deployment.
- Published as draft PR #92 after user approval. CI installed Chrome; its first portal harness attempt exposed a missing browser `process.env` stub before component rendering. The harness now supplies disposable build-time defaults and logs page errors; browser acceptance is still pending a successful rerun.
- The corrected harness passed all 64 combinations on commit `22be0bd`. A final compact-hero override clears the inherited mobile 300px minimum; the harness now requires the search CTA above fixed bottom navigation on full-height screens. Final CI rerun and screenshot review remain pending.
- Final production code (`421a965`) passed local full check/Cloudflare packaging and all 64 tightened portal browser cases. Existing tablet routes passed; guest-route tests required their legacy logo-text selector to follow the new explicit auth-brand accessible name. Playwright suites now use separate output subdirectories to retain portal screenshots. Remaining CI results and artifacts are tracked in PR #92; production/physical install acceptance is unperformed.
- All five workflows passed on `b1a91ba`; screenshot review identified oversized default Business shortcut SVGs. Business Home now sets explicit icon dimensions; portal browser acceptance guards compact quick actions and uploads its evidence before the wider route suite. Final statuses/artifacts are tracked in PR #92.

### Shared portal header controls (2026-10-10 follow-up)

- `PortalHeaderTools` owns language, theme and Aki Apps disclosure for Business, Duermo discovery/property/member shells and Duermo localized auth/terms. Order, 44px controls, branded app cards and keyboard/outside-tap dismissal are shared. Business retains localized pathname/query switching; Duermo retains its locale cookie and `lang` callback. Each menu omits the current product.
- AkiPasa's menu entry uses its existing orange raster icon with the same `PortalLogo` wordmark/card treatment as the other products. Consumer AkiPasa header, routes and assets are unchanged. Business logout remains authenticated-only; Duermo Settings moves into the dropdown. Product URLs retain existing canonical hosts and locale parameters; no session transfer, roles, API, database, payments, media or consent changes.
- Verification: focused header/catalogue suite passes (10 cases); full checks, 64-combination browser acceptance and production smoke are tracked in the follow-up PR. Authenticated live owner and physical installation acceptance are not claimed.

### Staff ownership claim review (2026-10-10 candidate)

- Staff moderation Claims uses `staff_pending_venue_claims`: 20 pending claims per page, stable received-date/ID ordering and total count. SQL independently checks the current profile's moderator/administrator role before reading Auth email. PUBLIC/anon execution is revoked; no service-role client or public identity projection is added. Both regular venues and accommodation claims use this queue.
- Cards distinguish the applicant's account email/profile phone from the venue's existing phone/website; show name, account creation, claim receipt in venue city timezone, full escaped evidence, address, public listing link and reference IDs. Missing contacts are explicit, not fabricated. Current contact/profile details are live reads, not historical submission snapshots. The claim form stores evidence and claimant ID only; no separate application phone or IP/source-location tracking exists.
- Page-level authorization precedes loading contact data. Read failures show an error rather than an empty queue. Review mutations retain the audited `moderate_item` RPC and required decision reason, and preserve Claims/page on success/failure. No ownership, billing, automatic review, consent or email-send behavior changes.
- Apply `database/migrations/20261010105857_staff_claim_review_details.sql` (mirrored in Supabase migrations) before deploying. Rollback: revert application code, then drop only the new read function; claim/member records are untouched. Verification and release status are in the impact register.

- Claim review validation: local full check and Cloudflare packaging PASS; SQL enforces staff-only contact access in executable tests. PR #94 carries a 16-case real-component responsive browser harness. Local Chrome download and route-server environment block browser acceptance; CI and authenticated production status must be checked before release.

### Claim decision email notifications (2026-10-10 candidate)

- Every future staff/admin pending-to-approved/rejected claim transition queues one private `claim_decision_emails` row in the same transaction as the existing ownership grant and moderation audit. Historical decisions are not backfilled. Verified current Auth account email and profile locale select the recipient and EN/ES copy; missing/unverified email is blocked, never invented. Decision, reason, venue and applicant details are snapshotted.
- `claim-decision-email.ts` renders accessible branded HTML and plain text from `Alex at AkiPasa <alex@akipasa.com>` with the same reply address. Approval welcomes the owner and links to their existing management page. Denial includes the actual reviewer reason, identity/contact and official-business-evidence checklist, safe-data advice, and the existing claims form preselected to that venue. A new submission is reviewed again, with no approval guarantee or paid-plan claim.
- The successful claim action attempts immediate delivery; provider failure never reverses the committed decision. Worker cron dispatches due rows every five minutes using existing runtime secrets. Service-only leases, bounded batches, stable provider keys, capped exponential retries and persistent ambiguity tracking prevent concurrent/duplicate sends. Uncertain delivery older than 23 hours is held for operator review. Permanent provider errors or changed/deleted recipient accounts are blocked. `sent` means provider acceptance, not inbox delivery.
- Claimant/staff-only read RLS and explicit grants protect recipient/payload data; only the service role can lease/acknowledge. Claim/profile deletion cascades the outbox and account export includes only the claimant's rows. Booking, accommodation confirmation senders, public discovery, analytics, consent and billing are unchanged. New mirrored migration `20261010114606_claim_decision_emails.sql` must precede code rollout. Rollback: revert code and disable `claim_decision_queue`; preserve queued/audit history. Release evidence is recorded in the impact register; no deployment is implied here.

- Claims can use an isolated runtime `CLAIM_RESEND_API_KEY` (preferred), falling back to the existing RESEND_API_KEY when already configured. This separates claim activation from previously queued booking notifications. The existing release endpoint exposes only a claim-mail release marker and configuration boolean, never credentials or recipients; key presence alone is not provider/inbox acceptance.

### Venue and accommodation team access (2026-10-10)

- Basic AkiBusiness access accepts an existing editor, manager or owner row for the signed-in profile before the personal Business entitlement fallback. Home must not require a global organiser role for team members. Assignments on pending/unverified properties remain visible through existing tenant RLS. This applies to venues and AkiDuermo accommodation in the same managed list, workspace and protected actions.
- Team membership grants no paid Business Pro/consumer entitlement and changes no platform role. Server RPC/RLS retains editor content, manager operations and owner team/deletion boundaries; individual property access still checks `is_venue_member`. Removed members lose the membership access route on the next request. Failed membership reads never grant access. No schema/data migration is needed for current production policies.
- Successful team additions invalidate both localized Home routes. Home refreshes current membership on focus/visibility return and every 30 seconds while visible, retaining filters. This addresses stale open sessions; database acceptance alone does not prove the user’s browser symptom is resolved.
- Acceptance: `business-team-access.test.ts` checks guard/subscriber/Pro/error/revocation behavior; `business-team-home.test.tsx` invokes the actual Home loader with consumer membership in both property types/locales. Production and full validation status is recorded in the impact register.

### New claim notifications for staff (2026-10-11)

- A new pending `venue_claims` INSERT creates exactly one private `claim_submission_alerts` row in the same transaction. The insert trigger covers any venue-claim entry path (activity or accommodation), not just AkiBusiness's web form. Historical claims are not silently emailed retroactively.
- `submitVenueClaim` attempts immediate delivery **after** the claim is committed; the Cloudflare scheduled worker retries every five minutes using `dispatchClaimSubmissionAlerts`. SMTP/Gmail is not a prerequisite for Google Workspace to **receive** mail.
- Alert sender is the existing verified claim sender `Alex at AkiPasa <alex@akipasa.com>` via the existing Resend-backed `CLAIM_RESEND_API_KEY` (fallback `RESEND_API_KEY`) and service-key Supabase connection. One provider request goes to both `alex@akipasa.com` and `andrew@akipasa.com`. Never claim delivery without a provider acceptance ID and operational monitoring. If Resend sending is blocked by billing/configuration, the pending alert remains queued; Google Workspace sending requires separate OAuth/relay credentials.
- The alert contains only venue name, timestamp, claim reference and protected review URL. It does not copy claimant email, private phone, evidence or unverified documents into mail. Fixed recipients, provider idempotency key based on immutable claim ID, service-role-only leases and acknowledgments, bounded retry and ambiguous-delivery review preserve staff privacy and prevent storms.
- `public.staff_pending_venue_claim_count()` powers Staff summary and matches the staff-authorized paginated claim queue; zero is never inferred from a failed query. Existing moderation approval, rejection, ownership grants and claimant decision notifications are unchanged.
- Additive migrations mirrored under `database/migrations` and `supabase/migrations`: `20261010231800_staff_pending_claim_count.sql`, `20261011010000_claim_submission_alerts.sql`. Apply before the app release. No backfill of historical email sends or automatic ownership decision. The private outbox follows claimant account export/deletion as with decision notifications.

### Claim-specific applicant verification fields (2026-10-11)

Claim picker search results stay in normal flow beneath the search input,
including wrapped EN/ES headings and activity/accommodation controls. A bounded
results list scrolls without obscuring the input or displacing content over the
map. `scripts/test-claim-picker-browser.mjs` exercises the real component with
disposable search responses across locales, themes and responsive widths,
including selecting a result and clearing the selected venue. It validates map
container geometry, not MapLibre rendering or authenticated live claiming.

- The EN/ES AkiBusiness claim form `/[locale]/business?view=claims` uses the existing ClaimVenuePicker and now separately collects applicant full name and relationship to the business (required), optional applicant phone, business email, official venue URL and venue phone, plus the existing required evidence text. Mobile and light/dark forms must display these input controls.
- `submitVenueClaim` performs server-side Zod validation and inserts private `venue_claims.claim_details` (including `submission_locale`) alongside the immutable claim ID, claimant ID and evidence. It must retain the existing transactional staff alert outbox and immediate `dispatchClaimSubmissionAlerts` call. No canonical venue/profile fields may be modified by an unapproved claim.
- Staff moderation `staff_pending_venue_claims(integer)` includes `claimant.submission` from `claim_details` behind its existing moderator/administrator role check. Submitted applicant/venue contacts are labelled unverified and kept distinct from profile details and public listing. Historical claim rows default to an empty object and still render safely.
- Mirrored migration `20261010231500_venue_claim_details.sql` adds bounded private JSONB and preserves the staff RPC signature and pending-claims count. Apply before publishing this form. Relevant tests: `tests/claim-submission-details.test.ts`, `tests/staff-claims.test.tsx`, `tests/staff-claims-sql.test.ts`. Owner claim status, notifications and ownership decisions are unaffected.

### Staff claim-review workspace UX (2026-10-11)

- Staff moderation `/[locale]/staff/moderation?queue=claims` renders one selected claim at a time instead of duplicated large request cards. The page has a compact pageable claim selector (`&claim=<id>`), request summary, applicant-submitted unverified evidence, existing canonical venue/profile contact details, evidence text, references and a dedicated decision panel. Claims selection stays confined to the privileged 20-row staff RPC result; it does not create a new public read or bypass authorization.
- `src/app/[locale]/staff/ClaimReview.tsx` provides the claim-only layout and **preserves** the server `moderateItem` action/form parameters (`locale`, `targetType=venue_claim`, `targetId`, `claimPage`, `reason`, `decision=approved/rejected`), so existing audited ownership moderation and claimant notifications remain intact. Other queues continue using their existing `StaffQueue` cards. Only the claims tab hides automatic moderation settings, which apply to different publication queues.
- The optional Request More Information control opens the signed-in staff member's mail composer with an editable message to the authenticated claimant email. It does **not** change claim status or claim an automated support email. Checklist boxes are explicitly not persisted/audited; do not treat them as verified applicant claims. Unverified metadata is never promoted automatically to `venues` or `profiles`.
- Visual CSS lives in `src/app/[locale]/staff/claim-review.css`, imported only for the moderation route. Container queries stack two-column applicant/existing-record layout into one column for narrow tablets, phones and split windows. EN/ES, dark/light, venue vs accommodation links, long evidence and long addresses/phones must render without horizontal overflow.
- Browser harness `scripts/test-staff-claims-browser.mjs` checks 360/600/1536/640x400 across both locales and themes, layout columns, reviewer actions and DOM safety; `tests/staff-claims.test.tsx` guards focus selection, uniqueness and decision preservation. No database schema, new secret, email trigger, subscription or public catalogue behavior change. Rollback: revert UI files only.

### AkiSuite unified lifecycle emails (2026-10-11 release candidate)

- `suite_email_outbox` is the durable transactional source for claim receipts, one welcome per verified user/product (AkiPasa, AkiDuermo, AkiBusiness, AkiHQ), booking requests, cancellations, opted-in saved-event and saved-stay reminders. Unique `dedupe_key` and service-only leases/ACK prevent concurrent duplicate sends. Existing confirmed booking, staff claim-alert and decision queues remain separate and authoritative.
- `src/lib/suite-email-templates.ts` renders accessible branded EN/ES HTML/plain text, sender `AkiPasa Support <support@akipasa.com>`. Staff claim submissions remain English-only to Alex and Andrew, linked to authenticated moderation. Claimant receives a submission receipt in `venue_claims.claim_locale`, a separate column from private claimant details. All customer-facing booking confirmations now come from Support. Provider acceptance isn't proof of inbox receipt; Cloudflare's RESEND/CLAIM_RESEND secret must be verified.
- First-login welcome email calls `queue_suite_portal_welcome` only with authenticated verified sessions, with unique account+product keys. AkiPasa established accounts preceding release are excluded; AkiHQ separately queues via `elguiriashing/akihq` after workspace permission verification. User identity and existing product roles remain unchanged.
- Saved-event reminders require a valid published event occurrence approximately 48h away, account saved-event reference, and explicit opt-in. Saved-stay follow-ups require a persisted `suite_saved_stays` account-backed save at least five days old, no subsequent reservation and opt-in. AkiDuermo's anonymous browser saved list still works, but cannot cause unsolicited email. Prefs available in Account Saved and AkiDuermo Settings, default OFF.
- Account Saved and Following collections read stable 24-item pages with exact
  totals and localized stored-name search. Their cards provide explicit
  pending-aware unsave/unfollow actions with localized outcomes, then refresh the
  existing account-layout counts. Current catalogue names/slugs, reminder opt-in,
  exports, reference-table RLS and trusted behavior signals remain authoritative;
  no collection schema or permission change is introduced.
- An Account personalization withdrawal applies locally before the account sync,
  so optional behavior stops even if that POST fails. The control stays visibly
  Off and exposes an account-sync retry that preserves the other local consent
  choices; an error never restores optional consent.
- Passport reward-claim and enrollment cards translate stored workflow states in
  EN/ES and show a localized unknown-state fallback instead of raw backend values.
  Claim codes and state identifiers stay unchanged; all displayed claim and route
  deadlines use the shared Europe/Madrid civil-date formatter.
- Disabled membership actions identify the controlling access-read, included-plan,
  overlap, catalogue-readiness, workspace or add-on requirement in EN/ES. Links
  lead to the existing account retry, access, billing, workspace setup or required
  AkiHQ Pro section; entitlement and checkout gates remain unchanged.
- Booking request received and cancellation messages clearly distinguish pending from confirmed; existing booking confirmation email outboxes only activate on confirmed statuses. Cancellation never claims an unsupported refund. The 5-minute Cloudflare cron `dispatchSuiteEmails` revalidates current email verification, save/booking state, and consent before delivery, with bounded retry and no historical backfill.
- Mirrored `20261011013000_suite_emails.sql` migration must be applied before release. No live old decisions/customer notifications must be resent without verifying delivery and authorisation. Review Cloudflare runtime credentials before claiming production mail delivery.

### Claim-decision email 403 visibility and recovery (2026-10-11)

- Live evidence: five claim decisions, three staff submission alerts and one suite notice returned Resend HTTP 403 despite saved status/audited moderation. The production Cloudflare sending credential or its permissions must be repaired; direct Resend sample sends do not validate the worker secret. Gmail is not the current application sending transport.
- Staff moderation now redirects with a private, non-identifying `mail=sent|not_sent` flag after the immediate dispatch. An EN/ES notice warns when provider acceptance was not obtained; ownership decisions are never rolled back by email errors. The sender still needs the existing service-only queue and approved runtime secrets.
- A permanent/permission-related 403 is blocked rather than silently retried, so older rows require carefully selected manual requeue only after a new live test succeeds. Avoid replaying stale new-claim alerts or claim-received receipts after the claim is already decided. Operational SQL and verification: `docs/CLAIM_EMAIL_403_RECOVERY.md`.
- Scope: AkiPasa EN/ES authenticated Staff claim-review only; no consumer/business/duermo public data, roles, payments, email body, locale, account ownership, queue schema or cron cadence change. Cloudflare secrets and live replay are out-of-band production steps, not accomplished by merging UI code.

### Enforced Resend sender for business and booking notifications (2026-10-11)

- All app-owned Resend mail modules use `AkiPasa Support <support@akipasa.com>` as their From identity, and `support@akipasa.com` as Reply-To where applicable. This includes EN/ES claim decisions, internal claim alerts, suite welcome/request/cancellation/reminder mail, and confirmed event/stay bookings.
- The legacy `BOOKING_EMAIL_FROM` / per-call From override is removed from the booking confirmation sender, so a mismatched production environment variable cannot silently impersonate a different sender. Booking semantics, recipients, locale, keys, DB outboxes and retry behavior are unchanged.
- Live delivery still depends on a valid Cloudflare Resend sending API key for verified `akipasa.com`; a recorded provider 403 remains blocked. Supabase Auth's separate SMTP configuration must be checked independently before asserting that Auth templates use this sender.

### Canonical Resend credential selection (2026-10-11 follow-up)

- Live rejected claim email outbox records reported `provider_403` while a direct test with the connected Resend account and `support@akipasa.com` was delivered. The application previously prioritized an old `CLAIM_RESEND_API_KEY` over `RESEND_API_KEY`, potentially silently shadowing a newly corrected main key.
- Central `resendSendingKey` now selects trimmed `RESEND_API_KEY` first with `CLAIM_RESEND_API_KEY` retained as legacy fallback; all claim decision, claim staff alert, booking, accommodation and suite outbox dispatchers share this selector. Both Worker cron and server actions use the same preference; no change to sender identity or delivery queue permissions.
- Selection precedence alone cannot validate a production secret or confirm email delivery. Cloudflare must have a valid sending-enabled Resend key from the intended verified-domain account. Existing blocked outbox items are never automatically replayed. See `docs/CLAIM_EMAIL_403_RECOVERY.md`.

## 2026-10-13 | Canonical Resend recovery instruction

The claim-email recovery runbook inspects production `RESEND_API_KEY` first, matching `resendSendingKey` in `booking-mail-delivery.ts`. Only absent or blank primary keys use legacy `CLAIM_RESEND_API_KEY`; rotating that fallback cannot repair an invalid nonblank primary. No keys, runtime configuration, queue status or messages are changed. Existing key-precedence regression coverage remains authoritative; live credential repair and individually authorized requeues are operational dependencies, not accomplished by this documentation change.

Canonical-key recovery validation: the existing `tests/claim-decision-email.test.ts` suite passed 10/10 cases on 2026-10-13, including trimmed primary-key selection, absent/blank-primary legacy fallback and dispatcher selection. The isolated command retained the existing timeout limits; no credentials or real messages were used. Required exact-head CI remains the merge gate.

### Sticky mobile workspace menu overlay (2026-10-11 candidate)

- EN/ES Account, Staff, and Admin route layouts all mount the shared `WorkspaceShell`. Its mobile trigger was sticky but its drawer was explicitly styled as an in-flow block, leaving the expanded menu near the document's top after scrolling.
- The compact trigger remains sticky. A new mobile-only sticky navigation wrapper anchors the open drawer directly below the trigger, and the bounded drawer scrolls independently above page content without moving the document. The wrapper is hidden on desktop, preserving the desktop grid and horizontal sidebar navigation.
- Escape closes the menu and returns focus to the trigger; outside pointer-down and route-link activation close it; breakpoint changes to desktop still dismiss it. The shared role-gated menu items and localized labels are unchanged.
- This is presentation/navigation only. There is no change to routes, session, role authorization, Supabase, RLS, API, storage, booking, payment, translation, consent, email, analytics, or customer data. Revert the WorkspaceShell and CSS edits to roll back.
- Regression coverage in `tests/workspace-shell.test.tsx` checks Account/Staff/Admin mobile menus, anchored DOM/overlay CSS, outside click, Escape/focus, route selection and desktop grid exclusion. Full `npm run check`, real mobile browser assertions in EN/ES/light/dark, and Cloudflare production smoke are **pending** until CI/preview evidence is available; no deployment is implied.

### Staff operations dashboard and administrator-only audit (2026-10-11 candidate)

- Request: Staff workspace is a practical full-width operations surface, without the side audit feed or Staff audit navigation. The Admin dashboard, including its current activity feed and full audit, remains unchanged.
- Shared `WorkspaceShell` still enforces moderator-or-administrator access to Staff and administrator access to Admin; `src/app/[locale]/staff/page.tsx` renders bilingual EN/ES task-led priority cards (publishing, ownership claims, support), compact linked counts, and secondary creator/catalogue/promotion tools. Removed the staff `moderation_actions` homepage read, saving one round-trip and eliminating privileged log copy. Counts from failing sources display `—` rather than pretending zero. The Staff dashboard CSS is scoped to `.staff-dashboard` and can use full available width at 360–1536px, landscape and split-screen without altering Admin.
- Access boundary: legacy `/[locale]/staff/audit` checks `isAdministrator` server-side and redirects admins to `/[locale]/admin/audit`, but returns 404 for ordinary Staff. The legacy `/moderation?view=audit` route targets the Admin URL, itself guarded both by its layout and page. Staff menu and homepage no longer link to the full audit.
- Database: additive `20261011204631_staff_audit_admin_only_20261011.sql` in both migration directories tightens the existing `moderation_actions_operator_read` SELECT policy from moderator+administrator to authenticated administrators only. An authenticated Staff member is still allowed to carry out existing authorized moderation actions, while SQL SECURITY DEFINER writes and immutable audit history remain intact. No table/column or record is removed. The role boundary depends on correct `profiles.app_role` assignments: `administrator` must be reserved for approved operators.
- Dependencies: Staff home counters, claim queues, support cases, user/creator operations and existing role checks are unchanged; Admin can still review all audited activity. No CRM, AkiBusiness/AkiDuermo, booking, email, auth session, analytics, payments, map or consumer surface is changed. Rollback: revert UI files and, only when authorized, restore the previous policy expression; audit records are never deleted.
- Verification: `tests/staff-audit-access.test.ts` uses PGlite role simulation to deny consumer/organiser/moderator direct table reads and allow administrator. Also checks mirrored SQL, UI non-disclosure and responsive stylesheet. Full `npm run check`, Cloudflare package and browser evidence are required; do not claim deployment until the database policy is applied and the Staff/Admin live access split is verified.

### Staff promotions read-only inbox polish (2026-10-11 release candidate)

- Reported: Staff /[locale]/staff/promotions showed an oversized generic Operations header and a wall of the latest 50 promotion request messages and internal notes. It lacked filtering, useful service labels and concise date/status display.
- Source: `src/app/[locale]/staff/promotions/page.tsx` continues to use the authenticated moderator/administrator Staff layout, and explicitly checks `canModerate` before querying only the most recent 50 `promotion_requests` rows. Data flow is unchanged: Supabase `promotion_requests` and joined venue names -> server normalization -> bounded client `StaffPromotionsInbox` with local-only search/status filters and native `details` disclosure. The existing Admin promotion page remains responsible for state changes, scheduling and internal notes.
- EN/ES: localized dashboard labels, service/state names, Madrid-calendar dates, responsive cards at small/large widths, native keyboard-operable summaries, and open/working/closed filter groups. Unrecognized services/statuses display their original safe text instead of being discarded. Messages/notes are rendered as text and expanded on request. An unreadable Supabase response produces an explicit error rather than a false empty inbox. Counts and filters are **only for the latest 50 fetched requests**, not full database totals.
- CSS `staff-promotions.css` is scoped to this Staff route and hides only the redundant inherited Operations heading when this page is present. Main Staff dashboard, Admin, AkiBusiness/Other AkiSuite portals, global navigation, mobile drawer, roles and permissions do not change.
- No mutation/API/schema/RLS/cron/email/analytics/booking/payment changes or data backfill. The read-only Staff view does not enable editing promotion state; reversible by restoring the route and removing the dedicated component/CSS. Existing administrator accounts and audit policy stay untouched.
- Verification planned: `tests/staff-promotions-inbox.test.tsx` interactive search/status/expand/locales/empty and read-only coverage, plus full `npm run check`, Cloudflare build, CI tablet/browser and logged-in EN/ES live smoke where credentials permit. GitHub merge does not itself prove Cloudflare production promotion.

### Unified Admin suite: shared Rewards Centre, searchable workflows, visual safety (2026-10-12 candidate)

- User-reported: each Admin subroute repeats a giant generic "Administración" banner above its own page title, and gradient cards can clip labels behind the rounded/cropped border; some tools lack search/visible controls. Passports, Award Grants and Achievements should be one discoverable workflow, rather than three entries in horizontal Admin navigation.
- Navigation: `src/app/[locale]/admin/layout.tsx` continues to enforce administrator role using the existing Supabase profile check and `WorkspaceShell`. The shared shell has an opt-in `hidePageHeading` prop used **only** in Admin, leaving Staff/Account untouched. Admin's top nav keeps one Rewards item (`/admin/passports`) and marks it active on both the `/admin/passports/*` and `/admin/achievements/*` routes using `WorkspaceItem.matchPaths`. Existing deep links and authorized server actions remain valid.
- `RewardsTabs` provides one visually consistent Rewards Centre with three clear tabs (Passports campaigns, Grant Stamps & Awards, Achievements). Rendered on all three legacy route pages and venue-category editor. No reward migration, XP/grant math change, RPC contract, role elevation, idempotency change or reward history rewrite; just consolidated navigation and safer layout. Creation, member search/grant, achievement editing and venue categorization remain separate, guarded workflows.
- `AdminSearchList` is an EN/ES client-side accessible search/status/Show more control. It receives **only pre-authorized, already-loaded rows** as child JSX content, so original Next Server Action forms and role checks still operate on the server. Used for business applications (100 loaded), audit (150), commercial requests and feature slots (existing query bounds), privacy requests, passport campaigns, categories, city sample (100), and feature flags. Search is explicitly scoped to loaded data; it does NOT promise full-database coverage. Existing `UserSearch`, `VenueRelevanceReview`, `AchievementManager`, `AwardManager` keep their specialized server search, pagination, approval and grant workflows; `AITeamDashboard` adds local filtering to loaded tasks, schedules, approvals and activity.
- `admin-suite.css` is scoped under `.admin-workspace`, fixes section padding, minimum widths, line wrapping, header clipping and responsive control layout; it also styles compact rewards tabs and searchable cards. Other portals and consumer styling do not change. The generic Admin banner disappears from subpages rather than consuming an entire scroll. Existing Admin home operations hero remains its own section.
- Impact: UI and bounded local search only. No SQL migrations, permission/RLS modifications, audit access changes, funding/Stripe action changes, email send, booking, map, accommodation, content or personal data writes. No automated migrations to production. Forms preserve server action names, hidden input values and audit reasons; old URL links remain routable for backward compatibility. Roll back entire branch via application revert; no data rollback needed.
- Verification: added `tests/admin-suite.test.tsx` for search filtering, rewards route accessibility, preserved decision and grant links. Run `npm run check`, Cloudflare packaging, tablet/browser EN/ES light/dark (portrait/landscape/split view) before merge, plus authenticated production Admin smoke after connected deployment. Repo/CI evidence is distinct from actual Cloudflare active version and signed-in Admin access.

### Admin two-page layout regression and single disclosure chevron (2026-10-12 candidate)

- After the Admin-wide redesign, `/admin/users` still showed overlapping search label/input/help text at split-screen tablet widths and `/admin/promotions` displayed overly dense expanded commercial request editors. Follow-up PR #113 scopes layout repairs to Admin: explicit non-overlapping search rows, compact request summaries, grouped business message/form content, clear spacing and one-column date controls on narrow screens.
- `/admin/business-applications` also showed two rotating glyphs overlaid: global `details.settings-disclosure > summary::after` draws a chevron using borders, and the Admin suite adds `+`/`−` content to the same pseudo-element. The CSS fix targets only `details.settings-disclosure.full-width-disclosure`, suppresses native markers and the generic plus/minus, and renders a single border-based chevron rotating from 45° to 225° on disclosure. No new interactive element, JS state, action, or icon asset needed.
- All authorized Next Server Action forms, original record IDs, payment/claim/promotions decisions, audit reasons and Admin role protection are untouched. No SQL/RLS, API, storage, email, booking, payments or consumer/staff/business changes. Old links and reversible data remain.
- Regression: `tests/admin-suite.test.tsx` verifies the selected disclosure variant retains a single closed/open CSS chevron. Full `npm run check`, Cloudflare package, browser acceptance and authenticated production smoke are still required before claiming live completeness. UI-only rollback via reverting PR #113.

### Compact Admin Catalogue, Relevance and Configuration master-detail UI (2026-10-12 candidate)

- **Requested:** eliminate horizontally wasted space and tall repeated forms from Admin Catalogue (categories/cities), Catalogue Relevance review, and Platform Configuration, with **distinct desktop, tablet and phone experiences**, one-screen task focus and no loss of workflows. Screenshots showed expanded category/feature forms across the full width and identical repeated relevance decision forms for ~1,505 proposals.
- **Structure:** new `src/app/[locale]/admin/AdminWorkbench.tsx` renders a two-column record directory + exactly one selected editor for both catalogue taxonomies and feature flags. Desktop >=1450px uses a roughly 30/70 split, mid-width/tablet 701–1080px uses 38/62, and phone <=700px uses explicit Records/Editor controls with one pane visible at a time. Sidebar search is in-memory **only among the existing server-loaded rows**; categories retain their existing query, city list remains limited to first 100 and flag list is unchanged. Creating new category/city is a dedicated button/pane, not an always expanded form. A single form is in the DOM at a time for each selected record, avoiding repeated controls and making wide space useful.
- **Relevance:** `src/components/VenueRelevanceReview.tsx` preserves its existing authorized `/api/admin/venue-relevance` GET (search/action/offset, server-side 40-row pagination) and POST (`venueId`, fingerprint, decision action KEEP/DOWNRANK/HIDE, weight, reason). New side-by-side proposal list and selected evidence/decision editor reduce form clutter. Phone has Proposals/Review pane switching. Existing stale-proposal denial, manual override notice, API authorization, auditing and decision schema remain unchanged. A reloaded page retains current query/filter/offset but no unsupported client persistence is claimed. Loading/errors/pagination are still explicit.
- **Configuration:** one selected flag editor is shown alongside compact status-filterable flag list. Existing `set_feature_flag` action and required 10-character audit reason remain intact. Toggles do not automatically save or mutate production data; submit remains explicit. Admin-specific CSS `admin-compact.css` is only imported from the authenticated administrator layout and handles desktop/tablet/short-split-screen/phone with bounded scrolling in columns and vertical phone panes.
- **Safety scope:** no SQL migration, RLS/security scope change, role elevation, index/sitemap/map/SEO, billing, email, accommodation/venue data, rewards or feature-flag values changed. All three existing routes and EN/ES action redirects remain stable. Roll back through code revert without data restoration. Keep Admin access to the user's existing five authorized administrator accounts.
- **Regression:** new `tests/admin-compact-workbenches.test.tsx` verifies one active editor, list/editor phone controls, search/status selection, API POST decision payload and presence of endpoint security/unchanged RPCs. Update `tests/admin-suite.test.tsx` for new `AdminWorkbench` instead of previous search list. CI must pass `npm run check`, booking and tablet browser, Cloudflare packaging. Authenticated production UI plus exact deployed Worker commit still require separate verification; do not claim live deployment from merge alone.

### Compact Account workspace and Passport ownership (2026-10-12)

- Account uses the existing guarded WorkspaceShell with hidePageHeading and a scoped AccountPageHeader (one h1 per screen). Shared Account CSS explicitly resets inherited grid placements, supplies real header padding, wraps long copy and exposes every desktop navigation destination. Staff/Admin/Business shells retain their own layout. Profile, preferences, privacy, membership, collections and bookings remain existing server-authorized routes/actions.
- Progress is removed from Account navigation; the legacy /[locale]/account/rewards route checks locale/session and redirects to /[locale]/passports. Overview and Premium shortcuts link directly to Passport. No XP, stamps, achievements or reward data is removed. Account overview no longer reads the duplicate XP ledger and represents failed collection counts as unavailable.
- Responsive coverage must include EN/ES, both themes, phone/tablet/desktop and short windows, with text containment (not just document overflow), complete navigation, active edit disclosures, booking actions and long labels. The real-component browser harness uses disposable data/actions; production authentication remains a separate verification step. See the impact register for exact test and rollout results.
- Account failed reads must remain unavailable rather than becoming empty editable values, disabled consent or an apparent absence of billing/deletion records. Profile edit/media forms, the affected Privacy controls and new membership checkout wait for a successful read; localized retry keeps the original authorized workflows available after recovery. Successful missing-row defaults, independent data export and billing management for a successfully loaded customer remain intact.
- The companion public acceptance follow-up restores Passport motion-status feedback to the visible/accessibility tree and raises phone controls, the map legend summary and compact attribution toggle to 44px. Attribution and its expanded text have reserved space beside Privacy, Support and the short-window map controls; the status caption wraps within its own available width. Native attribution and privacy interactions are checked in both languages across phone, tablet, desktop and short windows. CSS-only changes preserve motion permission, reduced-motion handling, consent, map and reward behavior; browser tests open the current mobile drawers before exercising their controls.

### Aki Spotlight public venue and event layouts (2026-10-12)

- Alex selected **01 / Aki Spotlight** and explicitly authorized implementation and a live merge. Public routes remain `/[locale]/venues/[slug]` and `/[locale]/events/[slug]`, from public `master`; this is a presentation change with distinct venue/event hierarchy and responsive desktop, landscape tablet, portrait tablet, phone and short split-screen arrangements in EN/ES and light/dark.
- Venue source pairs its selected public image with identity/location and directions/booking/follow/share, then uses `VenueSpotlightSections` for actual published menu section previews, upcoming events, information and conditional perks. Preserve the full published catalogue/allergens, contact/claim/report, loyalty/progress and RLS-controlled premium offers. Categories derive from available catalogue sections; no mock opening-hours/status or concept imagery is inserted into production. Logo-only artwork is contained on a matte surface.
- Event source pairs intact artwork and a date ribbon with the existing selected occurrence, full Europe/Madrid start/end dates, price/accessibility, booking/social actions and linked host. Preserve official custom locations, occurrence booking URL precedence, request mode, cancelled/sold-out restrictions, authenticated saved/going/not-interested forms, premium calendar export, event-linked catalogue and stay handoff. Metadata, canonical/hreflang, JSON-LD and consent-controlled analytics remain connected to the same records.
- Shared `spotlight-detail.css` and route-specific CSS are scoped to public detail variants. `ShareButton` gains an optional accessible icon presentation and handles native-share cancellation/clipboard errors without changing existing text callers. No schema/RLS migration, production data mutation, storage upload, role/payment/email boundary or other AkiSuite portal layout change. Rollback is a source revert.
- Focused route/component/sharing coverage lives in `vitest.spotlight.config.ts` and `npm test`. Mandatory `npm run test:spotlight:browser` uses disposable read-only Supabase-shaped records with the real Next routes and CSP for EN/ES/light/dark responsive acceptance; default fixtures contain no venues/events and cannot establish detail-route acceptance. Full `npm run check`, Cloudflare package, CI and live CityDiscovery/venue/event smoke must be recorded before declaring release complete. See `docs/SPOTLIGHT_DETAIL_REDESIGN.md` and `docs/CHANGE_IMPACT_REGISTER.md` for dependency and acceptance evidence.

### AkiBusiness shared venue media (2026-10-12)

The canonical media asset store is `venue_media`, scoped by `venue_id`, with public surface selection in `venue_media_placements`. Venue Profile and all event editors should receive the same signed venue-scoped inventory, regardless of its original upload path. Event-specific associations (`event_bin`) are independent of owning or viewing the asset. Virtual folders are presentation filters; no files are copied or migrated to organise them. Uploading media alone must not publish it. Validate permissions on the server for every mutation.

### 2026-10-13 | Recovered shared-media public placement resolution

Public venue detail and event host lookup resolve explicit venue placements independently of the legacy first-60 ordinary-image gallery. A selected asset can originate from an event upload, lie beyond that gallery window or be legitimately shared from another venue. Only missing IDs from the target venue's explicit public placements are fetched under the existing public-client RLS and signed; unplaced event-bin files remain excluded. Discovery's existing placement resolution and ordinary fallback order remain unchanged. No storage policy, migration, billing flag or customer records change. Regression coverage exercises both slug and ID loaders, no ordinary media, cross-venue exclusion, missing signing and no unnecessary selected reads. Production acceptance remains separate from local validation.

Integration with the merged Health #150 source resolves the selected/fallback union before its existing one-batch signer. Path deduplication, 3600-second expiry, response-path validation, per-row signing denials and no retry fan-out remain intact. Installed-SDK HTTP regressions retain the Health batching suite and exercise selected event/shared assets, the gallery boundary, empty ordinary media, denied reads/signatures and avoiding redundant reads. Fresh combined CI/Cloudflare and authenticated live acceptance remain release gates.

### 2026-10-12 AkiBusiness catalogue save regression (candidate)

- New catalogue items must have non-empty localized names immediately, because `save_venue_catalogue` validates the entire JSON document on both draft and publish. Empty names used to make all subsequent edits to that document fail with PostgreSQL `Invalid item`, misleadingly shown as a permission error.
- `blankCatalogueItem` supplies safe bilingual starter labels; editors can replace either label. New item tests cover non-empty names and valid starter price/variants. No database schema, RLS, memberships, public catalogue rendering or existing records are changed.
- Business save errors now separate invalid items/sections/prices, stale revisions (`PT409`) and lack of access (`42501`) in EN/ES. Allergen publishing checks remain strict.
- Production read-only evidence: on October 12 multiple `save_venue_catalogue` calls returned HTTP 400; Postgres logs included `Invalid item`; live RPCs existed and revision-conflict SQL used `PT409`. This does not prove every unsuccessful save had the same root cause.
- Verification pending: full `npm run check`, authenticated end-to-end edit flows and deployment smoke. Not live until confirmed CI and merge.

### Catalogue starter publication recovery (2026-10-13)

New catalogue items retain nonempty bilingual starter names for immediate draft saves but default to hidden. Editors use the existing Visible publicly / Visible al público toggle after preparing the item; editing a name alone does not silently opt into publication. Existing documents, visibility choices, prices including legitimate zero-price items, translations and allergen publishing checks remain unchanged. Public venue and event catalogue consumers already omit hidden items. No database migration or existing-item rewrite is required.

### Venue profile media selector (2026-10-12)

The five venue surface cards use the same full-size event gallery picker styling and pagination rather than inline thumbnail strips. Selection persists via the existing `setVenueMediaPlacement` action; Auto clears the explicit placement via `clearVenueMediaPlacement`. The venue-wide library remains the sole media inventory.

## 2026-10-12 AkiSuite membership and Premium rollout

`docs/AKISUITE_PRICING_ROLLOUT.md` is the current commercial, workspace, retention, deployment and validation contract. Seven plans are always visible through the shared EN/ES public/account catalogue, independent of payment activation. Enterprise is featured first. Cross-host aliases preserve locale and originating app; AkiHQ points to the same account hub.

The approved Stripe account and fourteen existing live price IDs are verified and recorded; no duplicate products were created. New payments require all five readiness flags, actual tax/product validation, workspace ownership, durable reservation and ledger/Stripe overlap checks. Existing legacy prices, subscriptions, free venue access and staff grants remain valid; superseded new-checkout forms redirect to the catalogue. Do not enable payment until legal invoicing/tax details and isolated checkout/lifecycle tests are complete.

New migrations are pending, mirrored in both migration locations and exercised through disposable PGlite SQL/RLS tests. Business/Duermo/HQ paid access belongs to an authorised workspace, preserving active employee membership and role templates. Personal Enterprise Premium belongs only to the payer. Workspace-scoped recurrence, templates, scheduled approved publication, media quotas/folders/sharing, historical growth and accommodation reports are gated. Published content and media are retained after downgrade; future automation/uploads are restricted. Service cron is bounded and respects approval fingerprints and conditional add-on renewal. Full-schema compatibility, live advisors, sandbox tests and authenticated production acceptance remain separate release requirements.

Release marker `membershipCatalogue: 2026-10-12-akisuite-catalogue-v2` is added to the existing read-only release endpoint. Record merge/deployment/live smoke evidence before declaring success. A release with checkout disabled is independently permissible only after its relevant checks pass; it does not complete paid rollout.

Membership browser acceptance uses seven catalogue cards and the global annual toggle, preserving card visibility during partial billing failure. Shared-media mutation permissions are independent of read retention: downgrade preserves media/placements while restricting new reuse, and owner deletion checks cross-venue references. Legacy scheduled publication preserves both Business tiers and staff grants.

The authenticated account export includes the new payer ledger only once the schema-ready flag is enabled; existing exports remain available before migration. SQL acceptance separately verifies AkiDuermo comparisons, media retention/reference protection, conditional add-on renewal and employee role templates.

Premium media enforcement includes restrictive Storage policies for direct API writes and referenced-file deletion, plus gated private-bin reads that preserve selected/fallback public artwork. Discount eligibility requires a paid, active, non-ending Pro subscription; staff grants and trials continue to grant their authorised tools without qualifying for that purchase.

Shared media/template reuse additionally requires active workspace membership; venue-only editors retain their venue and assigned-content rights. Verified-venue drafts can be scheduled directly with SHA-256 approval fingerprints. After any new paid subscription exists, billing adapters/reconciliation must survive presentation rollback. HQ's companion merge `21843db608932eea46d1e83d82b8481ee19b5767` serves the refreshed membership navigation in production; authenticated acceptance remains separate.

Live migration preflight must include managed Storage ownership/DDL permissions: current migration role is non-superuser `postgres` and is not a member of `supabase_storage_admin`. Do not infer hosted policy-management permission from disposable PGlite ownership.

HQ setup can create a named self-owned workspace before venue ownership, preserving separate venue authorisation. Auth redirects from membership retain the originating app. New-plan webhook customer mapping cannot overwrite a profile's existing Stripe customer.

Responsive catalogue screenshot review also corrected Spanish add-on wording and preserved whole words in compact disabled purchase buttons.

Live membership smoke verification found that the parent account layout replaced the subscription destination with the account root before page authentication. A server-derived, same-locale membership return header now preserves subscription/from through sign-in and terms acceptance; middleware removes caller-supplied headers, and unrelated account routes keep their previous return behavior. Regression coverage includes the actual layout guard, spoofed headers, and signed-out EN/ES browser aliases.

2026-10-13 membership presentation refinement (PR #129): Public AkiSuite pricing retains all seven plans and the existing checkout eligibility, amounts, intervals and entitlements. Compact two-column mobile cards and wider responsive desktop comparison reduce vertical card height; the billing-period switch and sector-specific AkiHQ tool exploration now follow the plan catalogue. Business categories only change displayed tools, never granted access. Billing/migration readiness flags remain unchanged. Validate responsive overflow, screen-reader disclosure state and locale-aware prices before production promotion.

2026-10-13 AkiSuite membership width/overlap follow-up: The membership-only shell now uses available desktop/tablet viewport width up to a 1720px bound while keeping responsive gutters. Catalogue cards reflow across wider screens, and the Enterprise card brand/header badge can wrap without label collision. No subscription billing, entitlement, feature flag, migration or checkout change. Validate EN/ES membership layouts on mobile, tablet and desktop.

## 2026-10-13 | Recovered Stripe tax-audit follow-up (#127)

Read-only live revalidation confirms the same approved account `acct_1SVLH2GfzDhsgsQZ` now displays AkiPasa Marketing S.L., all fourteen AkiSuite prices use inclusive tax behaviour, and all seven products have tax codes (AkiPasa Premium `txcd_10103000`, others `txcd_10103001`). Stripe Tax registrations remain absent. Technical classification and account display name do not establish legal identity or VAT approval. `docs/AKISUITE_PRICING_ROLLOUT.md` and the checked-in price audit must describe the same observed state; the obsolete unspecified-tax update instruction is removed.

The linked Supabase project's read-only schema probe found neither `public.akisuite_billing_subscriptions` nor `akisuite_private.launch_settings`. The two new migrations, hosted Storage DDL compatibility, legal registration, isolated payment lifecycle acceptance and authenticated portal validation remain release blockers. No flags, prices, products, registrations, subscriptions, permissions, schema or production data changed. Historic release-test claims remain dated evidence, not new validation. Documentation rollback is a source revert.

## Exact source release evidence (2026-10-13)

Cloudflare packaging stamps `.open-next/assets/release-source.json` with the clean tracked Git HEAD before deployment. Packaging refuses tracked changes; commit source before running `build:cloudflare`. The existing `/api/bookings/release` returns `sourceCommit` from this internal ASSETS binding, preserving feature markers and returning null for legacy/missing/malformed artifacts. The post-push smoke must observe the exact triggering commit on apex/www/Business/Duermo before claiming deployment; a constant feature marker alone is insufficient. This adds no database, billing, permission, locale or secret dependency. Rollback restores older code/assets and accurately loses current-source readiness. Browser/authenticated workflow acceptance remains separate.

Exact-source release verification runs for every master push, including asset, dependency, configuration and documentation changes; there is no deployment-input path filter.

### 2026-10-13 | Recovered venue media picker review defects

Unmerged PRs #121/#122 contained review findings still present after #123: search/folder controls consumed the gallery scroll row, and the modal lacked keyboard focus containment, Escape dismissal, restoration and slot-specific trigger names. VenueMediaStudio now groups controls into one intrinsic row and empty/results into the scroll row, with dedicated CSS preserving the event editor modal. EN/ES triggers identify the image surface; opening resets filters, focuses search, traps keyboard/programmatic focus and closing restores the opener. Existing upload/placement/Auto actions, permission checks, media inventory, accommodation header, event editor, billing and SQL remain unchanged. Rollback is code-only. Component regression tests exercise actual focus wrapping, Escape/close restoration, filter reset and variable-content DOM rows in both locales. Full check, responsive browser/Cloudflare CI and authenticated live owner acceptance remain required before deployment; no live storage/data mutation or deployment is claimed.

The recovered claim and venue-media browser harnesses run in tablet CI with disposable actions; their real-browser results remain separate from component tests and live authenticated acceptance.

## 2026-10-13 | Historical backlog documentation authority

The README entry point now directs engineers to `AGENTS.md` and this contract.
The July/August AI handoff, project status and TODO files carry explicit
historical-snapshot notices linking current change evidence and the gated
AkiSuite billing contract. Their historical content remains intact for backlog
recovery; an unchecked task is not proof of a current omission, and an old
acceptance checkbox is not proof of the present deployment. No application,
workflow, database, entitlement or payment-activation behavior changes.

### 2026-10-13 | Venue picker short-window visual acceptance repair

Actual CI screenshot review of PR #138 at 640×400 caught gallery cards collapsing into thin, unreadable strips even though modal/footer geometry checks passed. Dedicated venue-picker gallery rows now retain a nine-rem minimum and scroll instead of compressing; short-window controls share one row and the footer stays horizontal to reserve a readable first card. Shared event-picker geometry and existing placement/Auto actions remain unchanged. Browser acceptance now requires actual thumbnail and label dimensions, the first label inside the gallery, overflowing short-window results, scrolling to the last selectable thumbnail and successful selection/focus restoration with disposable actions. This repairs a visual acceptance failure; required browser CI and screenshot reinspection remain pending on the amended head. No production data, permissions, SQL or billing changes.

## 2026-10-13 | Count actual media and customer-support request bytes

Both /api/business/venue-media and /api/support-agent/chat trusted Content-Length before parsing. Four isolated streamed-request cases reproduced oversized bodies reaching mocked authenticated adapters. Media now counts binary bytes before forwarding to the multipart parser, with an 11 MiB framing budget and cancellation on overflow; support reuses readBoundedText for its 8000-byte UTF-8 contract. Missing or understated length cannot bypass the limits. Origin checks, existing upload action authorization/file validation/RLS, authenticated support identity and provider/tool boundaries remain unchanged. No schema, data, email, prices, entitlements or consent behavior changes.

Eleven focused cases, TypeScript, scoped lint and formatting passed, including cancellation failures, multibyte chunks, valid binary forms, legitimate support, malformed inputs and authorization/origin denials. The existing AkiSuite test glob includes the new file. Full integrated check, Cloudflare packaging, CI and approved authenticated acceptance remain release gates. Rollback is a source revert; no production writes or provider requests were made.

## 2026-10-13 | AkiDuermo Saved avoids unused catalogue requests

The device-local Saved view filtered only its own inventory but issued /api/stays requests on mount and each filter/search change. The discovery effect now skips the Saved view, preserving the separate authenticated /api/stays/saved preference read and save/unsave synchronization. EN/ES component reproduction measured four catalogue requests before and zero after; Explore still fetches and displays its existing private owner preview. Focused 4/4 and broader AkiDuermo 31/31 tests, scoped lint and formatting passed. No stopwatch/CWV or production speed improvement is claimed. No routes, roles, RLS, persistent save format, booking, paid access or data changed. Full check, browser/CI and live version verification remain release gates; rollback is a source revert. Homepage concurrency overlaps existing PR #103 and was not duplicated.

## 2026-10-13 | Locale navigation and membership control acceptance

The health audit reproduces stale Spanish privacy copy after switching to an English localized route, a membership Manage/Search collision at 1363px, and auth language switching that retains the previous locale in a single local return destination. PersonalisationConsent derives copy from the exact current locale segment, then a valid reactive AkiDuermo lang query, with the existing server fallback; LanguageLink translates one well-formed localized next destination while preserving its suffix/query and the existing server destination sanitizer. Membership imports a narrow stylesheet reserving Search space at the existing 800px breakpoint. Consent choices, auth/session/roles, pricing, checkout gates, API/RLS, media, storage, analytics and production data are unchanged.

Focused privacy 14/14 and language-return/auth 30/30 tests passed; 62 browser cases cover seven widths, both locales/themes, collision geometry, target size, overflow, normal Manage clicks and privacy draft preservation. Browser execution, combined check, Cloudflare packaging, CI and deployed-version/live smoke remain release gates. Source reverts roll back presentation; no data migration or restoration is required.

### Stay privacy controls and property CTA protection (health follow-up)

Production and CI reproduce the AkiDuermo Privacy trigger beneath fixed StayNavigation. Scoped StayAppShell rules place the trigger and bounded, scrollable panel above the dock/safe area. A property-only <=800px offset also preserves its separate planning CTA; wider screens and route departure reset the CSS variable automatically. Membership Manage uses a 46px minimum target while retaining the strict >=44px acceptance assertion. No consent defaults/submission, booking actions, property data, auth/roles, prices or shared global/root/picker styling changes. Sixty-two real-route cases include both locales/themes, seven catalogue widths, stay-host short windows and twelve synthetic property-renderer layouts. Property fixture shapes are layout evidence, not live inventory/RLS proof. Source reverts are sufficient; no migration. Final execution, integrated checks and deployment proof remain release gates.

### In-place stay language acceptance (final Health follow-up)

Actual browser acceptance caught Next retaining the old reactive query because the stay screens preserve history state markers. AkiDuermo and StayProperty now emit a bounded locale notification after their existing in-place language change. Consent validates EN/ES, keeps an exact localized pathname authoritative and clears scoped notifications on navigation, including return to an old route. Existing draft choices, motion, cookie and submission behavior remain. Seventeen component cases pass; the 62-case browser matrix now includes bidirectional property language switches with zero consent POST and no document reload. Current-head browser, CI, clean Cloudflare package and exact live source/smoke remain release gates. The branch includes reviewed #145/#144 prerequisites for ordered integration; no duplicate security migration.

### First-visit privacy panel dismissal (Health CI repair)

Current-head browser CI reproduced four EN/ES × light/dark 390px AkiDuermo guest journeys failing to click Hotels because the initially visible privacy panel intercepted the map filter. The shared nonmodal panel now has an EN/ES Close control (46px minimum height), scoped header styling and Escape dismissal from its controls, restoring focus to the existing Privacy trigger without scrolling the page. Closing changes visibility only: it writes no consent/version cookie, sends no POST, requests no motion permission and does not apply optional choices. Existing saved permissions remain authoritative and the draft remains available when reopened. The prompt still appears on a fresh document until an explicit consent choice is saved. Auth, account settings, consent API/RLS, telemetry permission checks, pricing, booking and production data are unchanged.

Four additional component cases verify denied first visits in both locales, preserved drafts/saved permissions, keyboard focus and pending-save behavior. The existing eight locale/theme/mobile/desktop guest journeys now assert the real initially open panel, denied defaults, normal dismissal, focus restoration and zero consent writes before their ordinary discovery/filter interactions. Focused tests, complete browser/check/Cloudflare CI and exact live-source smoke remain release gates. Rollback is an application source revert; no migration or customer-data restoration.

## 2026-10-14 | Claim picker browser phase sampling

The inherited PR #143 geometry failure mixed two renders: a transient empty results bottom of 383.703125px and a subsequent loading map top of 381.515625px produced the exact -2.1875px report. Actual same-frame snapshots retain a 17px map gap and 13.59375px input gap. The harness now waits for the exact query/vertical response and completed loading state, then reads all bounds in one browser task. Every original strict assertion and 24 EN/ES, light/dark and responsive combinations, both verticals, scrolling and normal last-result selection/clear remain. Held requests additionally verify loading and settled-empty geometry and actual input bounds. No application CSS, API, role, SQL, data, billing, consent, map renderer or claim mutation changes.

Local Chromium 153 acceptance passed 24/24 combinations, 144 atomic snapshots and 48 natural selections/clears; representative screenshots, scoped lint/format and whitespace checks passed. Integrated full checks, Cloudflare/current-head CI and live/authenticated acceptance remain separate gates. Rollback reverts the harness only. Cleanup retains PR #143/#136 ownership; this focused Health repair does not take over those changes.

## 2026-10-14 | Customer AI prompt and tool boundaries

Actual gateway and installed-client fixtures reproduced two boundaries: same-account operator messages entered later customer prompts, including after role demotion, and an unsolicited provider call executed an agent-permitted tool despite the request advertising no tools. History now filters audience before ordering/limiting while retaining actor, agent and user/assistant filters. Untagged legacy history remains operator-only. Customer history additionally requires context version 1 because earlier customer replies could already contain echoed operator context; fresh customer messages and replies carry that version. Historical customer context restarts without rewriting or deleting records. Operator legacy behavior stays compatible. Execution also requires the effective advertised tool set before existing permission, validation, approval and audit checks.

Thirty-two focused cases, TypeScript, scoped ESLint/Prettier and whitespace checks passed. Inert base-to-persisted-state-to-patched replay confirms old customer replies cannot re-enter; fresh multi-turn context, JSON audience/version negatives, latest-message filtering, budgets and allowed-tool approvals remain covered. No real provider request, database migration, role grant, mail, paid activation or production write occurred. Existing admin-authorized dashboard mixed-history display is a separate presentation gap. Full integrated/Cloudflare/browser/current-head CI and exact deployed-source verification remain release gates. Rollback is a source revert; existing stored rows remain intact.

## 2026-10-14 | Batch public venue media signing

Both public venue loaders signed photos one request at a time. A shared signer now deduplicates requested paths and uses one createSignedUrls batch, retaining the 3600-second TTL, original media order/IDs/localized alt text, existing cover selection/fallback and published/venue-only selectors. Only requested, successful batch entries are used; denied, missing and unknown paths cannot become images. Empty media performs no signing request. A failed batch returns the existing missing-media fallback rather than retrying every asset. There is no shared signed-URL cache or permission/bucket change.

Installed-SDK HTTP fixtures pass 44/44 repository cases, including 14 new boundary cases. Each direct loader changes signing calls from 60 to 1 and 12 to 1; empty remains 0. This measures request counts, not field latency or CWV. Historical Storage 400s were signed-object GET downloads, not signing POSTs, so this optimization is not claimed to remediate those errors. Public browser fixtures already support the batch endpoint. Scoped lint/format/diff checks pass; full current-head checks, Spotlight browser acceptance, Cloudflare package and exact deployed-source verification remain required. Rollback is a source revert with no data rollback. Cleanup #136 shares repository.ts selected-media code; reconcile that reviewed change after the serialized Health release, retaining both behaviors.

## 2026-10-14 | Runtime dependency security and MapLibre v5 backport

The runtime audit identified six affected packages. Next and its ESLint configuration are pinned to 15.5.27, PostCSS to 8.5.23 with nanoid 3.3.18/source-map-js 1.2.2, and Sharp to 0.35.5. MapLibre remains exactly 5.12.0 because the fixed major release changes worker/ESM/WebGL contracts; its upstream PR #8189 attribute-removal fix is applied narrowly to DOM source and all four distributed map bundles. Snapshotting attributes prevents adjacent unsafe attributes from being skipped. Existing worker, CSS, license, map API and WebGL behavior remain byte-identical. Patched bundles stop advertising their stale upstream source maps; remaining map files are not valid patched-source debugging evidence.

Postinstall validates exact package version/license/runtime entry and all pristine/patched SHA256 fingerprints before writing, rejects unknown/missing/mixed installs, and is idempotent. Build, Cloudflare build, development and check refuse unpatched artifacts. Twenty-nine inert native AttributionControl/metadata/failure tests pass, covering each bundle, consecutive/nested attributes, safe OSM credits, source metadata updates and package-entry overrides. A clean lifecycle-enabled install applies the backport and full repository checks/build pass; final integrated checks and native browser/Cloudflare/current-head CI remain gates. The runtime audit falls from six package flags to one version-based critical MapLibre flag; npm does not understand the verified local backport. This flag is explicitly retained, not waived or claimed absent. Dev-tool findings are outside this focused runtime repair.

The unchanged upstream sanitizer still permits iframe srcdoc in inert tests. No ordinary user-controlled style/attribution input was found; external configured tile/style providers remain a separate trust/hardening risk, with no production exploit or script execution demonstrated. Independent one-cycle review found no adjacency blocker and identified the runtime-entry guard, which is incorporated and directly regression-tested. No production data, SQL, role, payment, email, analytics or service configuration changes. Source/lockfile revert followed by a clean reinstall is rollback; restoring vulnerable versions requires security review. Physical Android/iOS/WebGL1 acceptance is unperformed.

## 2026-10-14 | Native geolocation naming and static browser transport

The shared native MapLibre geolocate button receives an EN/ES name synchronously while its permission-support check is pending. Native supported/unavailable labels subsequently replace that initial label. ProductionMap (AkiPasa and AkiDuermo) and the separate business claim picker use the same boundary; geolocation requests, disabled states, tracking options, camera, filters and teardown remain native. No vendor artifacts, CSS, API, role, session, database, storage, consent or production state change.

Three virtual-host browser fixtures let compiled /\_next/static/ assets use the browser's ordinary transport instead of redundantly fetching them through Playwright's Node proxy. Actual page/auth/manifest/branding requests retain host forwarding, and stay/map synthetic responses and all acceptance assertions remain. A recorded CSS socket reset is a local test-transport failure; its original server/socket cause is unestablished and no production outage is inferred. No retry, increased timeout or failed-response substitution is added.

Installed native lifecycle cases, actual built-asset byte/header comparisons and focused review are recorded in docs/HEALTH_SHARED_CONTROLS_20261014.md. Full current-head check, hosted public and complete tablet/Spotlight acceptance, clean Cloudflare packaging and exact live-source verification are separate gates. Source reverts suffice; no data rollback. Health #132 owns these new shared fixes; Cleanup #136/#143 retain their original PR ownership.

## 2026-10-14 | Recovered commercial request localization (#112)

Current Admin promotions still displayed raw service/state keys and English
status options on Spanish pages after #113 replaced #112's layout. Staff also
labelled `featured_listing` as a venue listing and omitted three accepted
services. `src/lib/promotion-labels.ts` now supplies display-only EN/ES names
for the four existing service values and five states. `featured_listing` means
Featured event / Evento destacado, matching the existing business request
selector and event-backed scheduling migration `0044`.

Admin summaries, editable status options, localized search terms and its
status filter use these names. `AdminSearchList` accepts an optional label map
only for this caller; other queues retain their existing display. The business
request selector and read-only Staff inbox share the same names. Original
machine IDs, form values, server actions, role/RLS checks, state groups, query
limits, message/evidence text and per-caller unknown-value fallbacks remain
intact. No CSS, route, API, SQL, storage, email, billing, consent, analytics or
production data changes. Other portals are unaffected. Rollback is a source
revert with no data restoration.

Ten focused rendered regressions cover EN/ES: real business selectors,
Admin route summaries and FormData, status filters/localized search, Staff
search and accepted labels, legacy read-only aliases, plus unknown/prototype-name
safety. Existing Staff aliases remain display-only; request validation/options
still admit exactly four service IDs. Business previous-request history retains
its existing raw service/state presentation outside this focused #112 recovery. Existing
Admin/Staff suites and full check/Cloudflare/browser CI remain release gates;
no production deployment or authenticated acceptance is claimed.

## 2026-10-14 | Combined safe historical recovery integration

The recovery candidate starts from merged Health #152 master
`7311ae9f6550f9dabf96a39c7782287bbacb303c` and incorporates the reviewed
#143 catalogue starter visibility, #136 explicit public media selection and
#153 promotion localization/checkpoint scopes. All sixteen scoped application/test/fixture
blobs are byte-identical to their original candidate heads. Master
Health control/transport source remains intact; independent shared-document
entries are preserved. Original heads remain in the candidate ancestry.

Focused combined regressions pass: repository/Admin/Staff 71/71, catalogue
foundation/rendering 13/13, Spotlight 20/20 and promotion EN/ES 10/10. Full
check, independent review, fresh complete hosted CI/Cloudflare/browser gates
and exact deployed-source verification remain required. This candidate does
not claim a live release or authenticated editing/placement acceptance.

All existing role/RLS, storage signing, machine IDs, explicit visibility,
pricing, consent and action boundaries remain as documented in the three
original recovery entries. No SQL, authorization/payment rollout, customer
records or email replay is included; drafts #133/#140 stay excluded. Source
revert rolls back these repairs without rewriting catalogue/media/history.

## 2026-10-14 | AkiBusiness event workspace and ownership signal (PR #167)

Business event listings use a nine-card paginated responsive catalogue, text search, and localized current/past/archived filters. Event creation stays collapsed until requested and uses a media-library dialog with keyboard focus containment, Escape close, and return to its opener. The public claim CTA and claim submission guard depend on the privacy-safe `public_venue_is_claimed` RPC, which checks approved claims and venue membership independently of edited venue content and fails closed. The migration is mirrored in `database/migrations/` and `supabase/migrations/`, and is recorded as `20261014143947_public_venue_claim_ownership` on Supabase ref `vhpbvcfkcteswlsdjrfl`. Read-only verification confirmed the function definition and execution grants for `anon` and `authenticated`, with no `PUBLIC` execute grant. The repository runbook identifies this ref as production, while the connected Supabase listing labels it `AkiPasa Development`; confirm the project’s deployment role before treating this connection as production. This change keeps server authorization and event reuse actions unchanged. Local checks, hosted CI, Cloudflare build, and live-release smoke passed before merge. Rollback requires restoring old UI with compatible ownership RPC policy and preserving legitimate claim records.

## 2026-10-14 | Discovery filter recovery

GlobalSearch validates price and date ranges before its existing automatic URL
replacement. Invalid ranges receive localized visible errors and do not navigate.
The panel exposes its active discovery filters as named removal controls plus a
clear-all action, clears stale result pagination after individual changes and
returns focus to the panel after the routed query update. The public no-results
state expands only up to 100 km; at that limit it now links to the locale home to
choose a new area from a clean filter state.

This is PUB-17. Existing filter keys/defaults, list and Map routing, recommendation
queries, native input constraints and ranking remain unchanged. No API, database,
authorization, consent, payment or persistent customer data changes. Focused
validation and empty-state tests pass; current-head checks, CI, Cloudflare release
and exact live-source verification remain required before this entry is live.

## 2026-10-14 | Recovered demand-driven Passport foil from #103

The retained Passport-only scheduler from draft #103 now stops animation frames and style writes after interpolation settles, pauses while hidden, and wakes on pointer/sensor input, recentering and surface changes. Current theme/layout, motion permission and on-device preference, reduced-motion behavior, rank/stamp data and existing interpolation/sensitivity remain unchanged. No broader navigation/auth/cache/toolbox changes from the old branch are incorporated.

The mandatory subscription test configuration includes scheduler and real PassportBook regressions for EN/ES sensor input, hidden/resumed documents, recentering, unmount, reduced motion, preference revocation, pointer fallback, foil toggling and chapter changes. The unchanged original component fails the new idle-frame regression. Full checks, existing public Passport browser acceptance, current-head CI and deployed-source verification remain release gates. Physical gyro feel, device power consumption and production frame-rate improvements are not established. Rollback is a source revert; no data or migration rollback.

## 2026-10-14 | Public membership account handoff

The public catalogue has no authenticated owned-workspace or entitlement context. Its ready plan CTAs now navigate to the existing same-locale account subscription hub with the allowlisted originating app, rather than posting a workspace checkout without a workspace. Authentication and terms use the existing middleware/account return path; the account still loads authorised workspaces, exposes existing setup and requires a separate final purchase. Public closed gates retain seven disabled Coming soon buttons. Account workspace purchases are disabled until a workspace exists, with EN/ES setup guidance; personal purchases, included/access-error guards and selected-workspace add-on eligibility remain intact.

Dependencies: public/Business/Duermo aliases and HQ origin, shared catalogue, account layout/auth/terms, gated owned-workspace RPC/setup, existing checkout server authorisation and Stripe safeguards. No server billing action, entitlement, readiness flag, price, migration, live service call, analytics or customer-data change. Five new rendered regressions fail against the original grid; all 18 focused rendered/UI/checkout cases pass after the patch. Full check, current-head CI/browser/Cloudflare and authenticated acceptance remain pending. Rollback is a source revert; paid rollout remains blocked by the separate legal/tax/schema/lifecycle gates.

Validation follow-up: full check passed formatting, lint, TypeScript, all application suites (855 tests including AkiSuite 114), database safety and two conflict tests, then stopped because the isolated automation workspace lacked Hono dependencies. After installing that subproject from its lockfile, automation checks/dry-run passed; the production build is being checked separately. The existing account browser workflow now includes eight ready/closed public-handoff cases (EN/ES, both themes, 360/1536px), actual anchor target/text geometry, account navigation with zero checkout actions and disabled closed gates. Its disposable bundle compiles. Local Chrome cannot launch because ProcessSingleton socket() is prohibited; geometry assertions and screenshots must pass hosted CI before acceptance. Scoped anchor CSS shares the existing button dimensions. Independent source review found no functional/security blocker; neither hosted browser execution nor payment acceptance is claimed.

Hosted handoff follow-up: run 38500939403/account job 115647472508 passed the pre-existing matrix but stopped before the new geometry assertions. Expanding a card changed its accessible button name, shrinking the live name-filtered nth locator set and making nth(4) disappear. The harness now iterates stable article containers and explicitly verifies false-to-true aria-expanded per card. All eight cases, CTA geometry and zero-checkout assertions remain unchanged; no production source or timeout change. Fresh hosted execution remains required.

## 2026-10-14 | Recovered lazy owner toolbox (#103)

The owner-only launcher previously imported the full toolbox, achievement scopes and Pals engine before activation. The bounded recovery extracts the current panel intact and dynamically imports it only after a click or Ctrl/Meta+Shift+O. Saved appearance still applies immediately. Concurrent activations share the pending load; an EN/ES busy/retry trigger retains the existing responsive class and accessible name; late completion after unmount is ignored. Once loaded, the panel remains mounted so Escape, outside-close and reopen preserve its existing state. The locale layout's server has_owner_console gate and every owner/award action remain unchanged; lazy delivery grants no authorization.

Eight focused cases cover import deferral, immediate appearance, mouse/keyboard activation, pending deduplication, failed-load retry, unmount and actual panel state across close/reopen in EN/ES. These are component/module-boundary evidence, not live bandwidth or authenticated acceptance. No CSS, auth cache, route, SQL, data, rewards, billing, email or consent changes. Current-head full checks, production/Cloudflare packaging and required CI remain release gates. Rollback restores the original eager component; no data restoration.

## 2026-10-14 | Creator review draft recovery

PUB-09 now retains a creator-review rating and body in tab-local session storage
before invoking the existing server action. Validation, unavailable-service and
authentication returns reopen the review disclosure and restore those fields; the
authentication return carries only a bounded `review=draft` marker. Normal and
successful profile loads clear stale drafts. Existing Zod limits, requireUser and
Terms routing, creator_reviews RLS/moderation, pending state and EN/ES outcome copy
remain unchanged. No automatic resubmission, new endpoint, schema or persistent
cross-tab storage is added. Focused action/profile/draft tests pass; full CI and
exact deployed-source verification remain release gates.

## 2026-10-14 | Password recovery task continuity

AUTH-02 carries the sanitized originating task through password-reset request,
the PKCE callback, the authenticated recovery page, password update, mandatory
sign-out and the following sign-in. Public paths use the locale allowlist and
AkiDuermo paths use its host-specific member/stay allowlist. Expired or reused
callbacks, missing recovery sessions, password-policy failures and provider save
failures keep that safe destination available for recovery. Nested task parsing
never serializes a password, recovery code or provider token. Existing password
rules, callback exchange, Terms enforcement and sign-out behavior remain
authoritative. Focused action/security tests pass; both host browser journeys,
current-head CI and exact live-source verification remain release gates.

## 2026-10-14 | Actionable authentication feedback

AUTH-03 maps the existing authentication error categories to localized alerts and
associates invalid email, password/confirmation and Terms controls with the active
summary. Credential failures keep the same account-private wording for unknown and
incorrect accounts. A client boundary stores only the typed email in host-scoped,
tab-local session storage; it never receives or stores password fields. Submit
buttons use native React form status to disable repeat submission and announce the
pending action. Server validation, provider calls, rate limits, Terms enforcement,
redirects and account-existence privacy remain authoritative. Rendered controls and
existing inert action tests pass; full CI and live-source verification remain gates.

## 2026-10-14 | Faster tablet acceptance workflow (PR #169)

Tablet browser acceptance retains its existing route, portal-smoke and layout/Spotlight commands while running them in three independent GitHub Actions jobs. Route suites use two Playwright workers; superseded runs for the same PR are cancelled, and each job uploads distinct evidence artifacts. The existing `tablet-ui` required-check name remains available. This changes CI orchestration only; application behavior and test assertions are unchanged. Full exact-head CI and branch-protection verification remain required before merge. If parallel browser resource pressure causes instability, return route workers to one while retaining job parallelism.

## 2026-10-14 | Connected Cloudflare release evidence

The connected production release smoke published and verified AkiPasa master commit `31c643a6ecf8bd618b5e7f86ebb178da9102ab3e`. Its `booking-live-evidence.json` confirms HTTP 200 and the exact source commit on `akipasa.com`, `www`, `business`, `akiduermo`, and `akiconduzco`; the AkiConduzco home, map, robots file and sitemap also returned 200. The smoke is anonymous/read-only and did not test authenticated operator actions. The available GitHub environment has no Wrangler API token, so the unsupported redundant deployment workflow was removed. Continue using the connected Cloudflare release and require exact-commit live smoke evidence.

## Independent AkiBusiness extraction candidate

This repository is an isolated AkiBusiness application copied from the recorded
upstream master. Source AkiPasa remains intact. Independent middleware, host-local
auth return validation, canonical product links, noindex metadata, management API
allowlist, locked dependencies and preview-only deployment are owned here. The
original scheduler and billing webhook remain solely with AkiPasa. See
`docs/EXTRACTION.md`; no statement here establishes deployment or authenticated
production acceptance.

## 2026-10-15 | Fullscreen rental company apps

The independent AkiCoches company page prioritizes company identity, paginated
fleet discovery, a selected-car photo/specification view, blocked-date calendar
and a separate authenticated request step. The date-filtered catalogue no longer
removes company identity or the rest of its fleet. Public calendar reads select
only vehicle/date fields under existing anonymous RLS; failed/truncated reads
never imply known free dates. Final range availability and request pricing remain
authoritative server contracts; requests are not confirmations or payments.

The independent AkiBusiness uses a shared fullscreen rental desk for linked venue
fleets and existing unlinked companies: fleet search/selection, add/rate/cover/
visibility editing, availability, pending/confirmed/history requests and a
dedicated existing venue media studio. Native mutations retain server validation
and RLS. Read errors disable dependent management. Mobile uses bounded panels;
short viewports and media retain internal overflow for reachability.

The new link_owned_rental_company_venue RPC is an explicit one-time attachment:
authenticated company owner AND venue owner/manager are required. It locks both
records, rejects accommodation/occupied venues and reassignment, permits an
idempotent same-venue retry, preserves company/fleet/booking rows and does not
grant direct venue_id updates. Migration 20261015163602 is applied on shared
project vhpbvcfkcteswlsdjrfl; anon execution and direct venue reassignment remain
denied. The SQL regression covers absent identity, unrelated venue member, wrong
company owner, success/retry and reassignment. Authenticated owner/media/booking
production UI acceptance remains separate. No customer records were edited.

Validation: both independent Next builds, lint/types and the first full product
suites passed (Coches 102 plus 65 redirect cases; Business 170). Follow-up UI/error
changes require final checks. The local Chromium download is truncated by the
environment, so no responsive browser/screenshot acceptance is claimed. Hosted
CI, clean Cloudflare packaging and authenticated preview acceptance are required
before release. Rollback: revert app code; keep the compatible additive RPC, or
revoke/drop that function in a reviewed forward migration. Never unlink records
or drop customer data as rollback.

## 2026-10-15 | Coordinated management role build

The build-time NEXT_PUBLIC_AKISUITE_ROLE_SWAP switch prepares this management
application for AkiHQ while retaining legacy defaults, business capability keys,
permissions and routes. Public navigation, auth origin validation, PWA/metadata,
management email links and operations handoffs share the role map. Exact preview
origins remain separate from canonical destinations. See MANAGEMENT_ROLE_CUTOVER.md
for deployment order, existing entitlement limitations and rollback. No provider
setting, database, customer mail, charge or live domain is changed by this source.
Both flag modes have regression coverage; production/authenticated acceptance
remains unverified and required before activation.

## 2026-10-15 | Independent property management candidate

The dedicated /[locale]/business/accommodations workspace uses canonical property
IDs without dummy venues. Its bounded API/module are copied from the coordinated
AkiPasa independent-property migration slice; no sibling runtime imports exist.
Private create, profile/save/review submission, room/unit/rate/block/settings and
reservation transitions retain server auth, property authorization and SQL/RLS.
Media uses a private property bucket with bounded upload, signed reads and explicit
gallery placement. Legacy venue-backed tools remain reachable. The server
AKISUITE_ACCOMMODATION_READY flag defaults false until coordinated schema and
release acceptance. Source tests do not establish live auth, booking or delivery.
See INDEPENDENT_ACCOMMODATION_MANAGEMENT.md for verification and rollback.

## 2026-10-15 | Explicit company grouping candidate

The free management hub adds company creation and explicit existing-location
attachment through reviewed authenticated RPCs. Creating a company does not
create public listings, assign customer subscriptions or inherit operational
permissions. Company location metadata with a null membership role has no
operations link. Standalone private location creation remains available; only
canonical workspace owners can request attachment, and SQL also checks company
owner/admin authority. Existing workspace/venue relationships are never detached
or regrouped automatically. A legacy workspace may aggregate multiple venues;
this UI does not establish a new physical-location mapping. The server
AKISUITE_ORGANISATIONS_READY gate remains false pending migration20261016030000
and live acceptance. Paginated lists have explicit bounds. Name/request identity
is retained on conflicts and unavailable retries. Source revert/closedgate rolls
back presentation without deleting legitimate companies or mappings.

## 2026-10-20 | AkiHQ auth-mode destination sanitization

AkiHQ auth forms and OAuth/recovery callbacks already submitted only the bounded,
same-locale management destination. The auth-mode links (sign in, signup, magic
link and recovery) incorrectly copied the raw incoming `next` query into their
own internal URLs. An external destination could not pass the server action or
callback sanitizer, but its text and nested credential-looking parameters could
remain visible while changing auth mode. Mode links now serialize the same
sanitized destination used by the forms. Valid AkiHQ business tasks remain intact;
external, protocol-relative, encoded-path and backslash destinations resolve to
the locale business home. No session, Supabase identity, provider configuration,
database row, role, subscription or cross-product cookie changes. Rollback is a
source revert. Production OAuth initiation and exact callback destinations require
post-deploy EN/ES verification; completing a real provider login remains separate.

## 2026-10-20 | Listing allowance owner compatibility

AkiHQ mirrors the bounded event/media owner changes from AkiPasa PR215. Database
ownership stays in AkiPasa's standalone migration20261020170415, with its own
private default-closed gate, not the old Premium migration. Owner quota UI uses
AKISUITE_LISTING_LIMITS_READY and confirms listing_limits_info before showing8/250.
Inline event errors preserve controlled drafts. Listing Premium handoffs target
AkiPasa's actual subscription hub with current EN/ES; paid AkiBusiness operations
remain separate. Resolution groundwork stays independently gated/off pending
trusted processing and direct-Storage closure. No scheduler/migration is added here.

# Architecture

## AkiConduzco rental marketplace and operator desk (2026-10-14)

AkiConduzco is a dedicated Cloudflare custom-domain application at
`akiconduzco.akipasa.com`, with independent `car_rental_companies`, vehicles,
calendar blocks, booking requests and review-audit records. The public root,
map, company pages, account, manifest, robots and sitemap use the product host
and brand. Operator tools are a full-screen AkiBusiness workspace at
`/[locale]/business/mobility`, with fleet, prices, date blocks and request
management; it does not enter the venue-claim flow.

RLS scopes listings and fleet data to owners, keeps renter contact fields in
authenticated booking reads, and exposes only availability dates publicly.
Bounded RPCs calculate quotes from stored prices, make request submission
idempotent, reject conflicting dates, and require operators to confirm requests.
Staff review is explicit and audited. No payment, instant booking, supplier
import or public display of pending companies is implemented. A `TEST ONLY`
company under Alex's account is marked pending review, has no customer-facing
address, and remains hidden from public search while Alex tests the fleet tools.

The connected Supabase project `vhpbvcfkcteswlsdjrfl` contains the rental schema
and Alex's test company; Alex confirmed this is the sole connected project to use
for release. The post-merge live smoke verified the AkiConduzco release marker
and exact deployed source commit `8b28cca5685d1bdeed5012ddbe77b4ca48c55515` on
the product host. Its root, map, robots file and sitemap returned HTTP 200.
That smoke was anonymous/read-only; authenticated login, fleet edits, rental
requests and the Supabase Auth redirect flow still need an account-session test.

## GUI continuity and read-failure states (2026-10-14 approved release candidate)

Workflow return URLs reuse the existing authentication/host allowlists. A small
community URL helper validates only the existing report target contract and
selects an existing form/history; it does not grant access or submit a report.
Stay trip intent is an editable client default, while availability/quotes and
reservation outcomes remain server-owned. Localized reservation labels never
change the values submitted to the existing actions.

Staff/Admin pages retain independently failed reads as unavailable and preserve
authorized query/action boundaries. The city form submits the loaded center's
coordinates explicitly; missing coordinates cannot become a new Madrid center.
Support modal focus/scroll behavior stays in its client presentation component,
with existing same-origin API, authenticated provider gateway and email fallback.
The user approved release; source checks and actual deployment evidence remain
separate from authenticated production acceptance.

Last updated: 2026-10-14.

## Overall system architecture

AkiPasa has two independently deployed Cloudflare Workers:

```text
Browser
  -> Cloudflare custom domain
  -> OpenNext/Next.js Worker
  -> Supabase Auth + PostgreSQL/PostGIS + Storage

Android app
  -> native secure WebView host
  -> same Cloudflare custom domain and Next.js application
  -> same Supabase Auth session, database, storage, and server rules
  -> system browser for Google OAuth, Stripe, and external destinations

Android voice trigger
  -> Tasker/Termux signing bridge
  -> Hono automation Worker
  -> HMAC/device/time/replay security
  -> generated command router
  -> D1 business data + execution audit
  -> Telegram Bot API

Telegram group
  -> secret-token POST /telegram/webhook
  -> configured-group validation + D1/KV update reservation
  -> shared generated command router
  -> Telegram reply + D1 execution audit
```

The public application and automation Worker share repository standards but do
not share routes, secrets, databases, or deployment lifecycles.

### Public Worker request-cost boundary

The public Worker uses OpenNext's generated `.open-next/worker.js` entry point
directly. A custom Cache API wrapper was removed after production
version-override tests reproduced a Next.js `workUnitAsyncStorage` invariant
in the Windows-built candidate. Connected Cloudflare Linux builds are the
release path; a candidate must pass a 0%-traffic version-override smoke test
before promotion.

Middleware detects whether a Supabase Auth cookie exists before constructing a
Supabase SSR client or calling `auth.getUser()`. Public catalogue reads use a
separate non-persistent client with Auth refresh disabled. Event, venue, and
passport pages switch to the cookie-backed client only for signed-in visitors.
MapLibre and QR generation are client-only and are excluded from server chunks.

## Folder structure

```text
src/
  app/                 Next.js routes, layouts, server actions, API endpoints
  components/          UI-only reusable components
  lib/                 Domain, providers, permissions, validation, services
database/
  migrations/          Ordered Supabase/PostgreSQL migrations
  tests/               Rollback-only database acceptance
automation/
  clients/tasker/      Android trigger instructions
  migrations/          D1 schema and safe initial shell
  scripts/             Command registry and signed request client
  src/commands/        One module per automation command
  src/dashboard/       Dashboard authentication, queries, and HTML
  src/security/        Canonical signing, HMAC, and replay protection
  src/services/        Finance and Telegram adapters
  tests/               Automation unit tests
tests/
  e2e/                 Mobile Chromium and opt-in production acceptance
Android/               Native Play Store client for the production web app
docs/                  Product and operational contracts
.github/workflows/     Automation CI/manual deployment
```

## Backend

### Public application

Next.js App Router server components and server actions perform authenticated
reads and mutations. External input is validated with Zod or narrow typed
parsers. Authorization is checked server-side and reinforced by Supabase RLS,
database constraints, triggers, and audited RPCs.

`src/lib/repository.ts` exposes a discovery interface with three adapters:

- `FixtureRepository`: deterministic local records for credential-free tests.
- `SupabaseDiscoveryRepository`: published production catalogue.
- `HybridDiscoveryRepository`: live data plus non-conflicting labelled
  fixtures, deduplicated by slug.

The public browser runner can select the existing Supabase adapter against its
disposable venue HTTP fixture. This requires the fixture provider, an exact
private flag set only on the Next server child, and an independently validated
uncredentialed loopback URL matching the compiled public client configuration.
Ordinary provider selection stays unchanged. The fixture supplies synthetic
discovery and matching detail reads, rejects unsupported requests and writes,
and does not authenticate users or forward traffic to a real backend.

Authentication, maps, storage, analytics, email, and future ticketing remain
behind provider boundaries.

### Automation Worker

`automation/src/index.ts` exposes:

- `POST /voice`: authenticated command execution.
- `POST /telegram/webhook`: secret-token authenticated, group-restricted slash
  commands with update replay protection.
- `GET /health`: minimal D1/service health.
- `/dashboard/login`, `/dashboard`, `/dashboard/logout`: separate operator
  session.
- `/dashboard/commands` and command detail/run routes: generated command
  catalogue and audited operator execution.
- `/dashboard/activity`: recent execution audit.
- A scheduled handler for retention cleanup.

Valid command modules implement `AutomationCommand` in
`automation/src/commands/types.ts`. A generated registry discovers command
files before development, tests, type checks, and deployment.

## Frontend

The public UI is mobile-first and localized under `/es` and `/en`. Public
discovery, membership, event, venue, map, auth, privacy, and legal routes are
server-rendered where appropriate. The compact mobile site menu becomes a
regular primary navigation bar on desktop. Membership remains visible in the
header and homepage before authentication; checkout still requires an account
and returns to `/{locale}/account/subscription`.

Account, business, community, passports, moderation, and administration use
icon-led `WorkspaceShell` navigation and focused sub-pages:

- Desktop: a collapsible, sticky sidebar with route-aware links.
- Mobile: a burger trigger and bounded in-flow panel with initial focus,
  Escape, explicit close behavior, and no viewport-covering overlay.
- Account: ten focused workflows under `/{locale}/account`, with one compact
  page title, wrapping desktop navigation, responsive cards and explicit edit
  disclosures. The old `account/rewards` route redirects to the localized
  Passport after the existing session guard. Account-specific styles do not
  change the Staff, Admin or Business layouts.
- Staff: six operational routes under `/{locale}/staff`; legacy
  `/{locale}/moderation` requests redirect to the matching staff workflow.
- Administrator: eight routes under `/{locale}/admin`; overview pages query
  summaries while detailed datasets load only on their selected route.

Reports are the current database-backed support case model. There is no support
conversation, participant, assignment, or message schema, so the UI does not
claim to provide threaded inboxes.

The automation Command Centre is intentionally dependency-light server-rendered
HTML/CSS from the Hono Worker. Overview, Command Hub, and Activity pages display
health, execution success, latency, pending jobs, the latest report, Telegram
configuration state, typed command cards, and recent executions. It does not
expose secrets. Authenticated operator commands share command implementations
and audit logging with voice calls; external actions require a same-origin POST
from an explicit confirmation screen. A generated operation ID is reserved
through the same D1/KV nonce layer to prevent duplicate form submissions.

### Android client

`Android/` is a dependency-light native Android application targeting API 36.
Its primary view hosts the production AkiPasa web application, so it shares the
same database, authentication cookies, server actions, RLS, storage, billing,
roles, and release behavior instead of duplicating them in a mobile-only data
layer. The native boundary handles exact-host navigation, App Links, system-
browser OAuth/billing handoff, location permission, document picking,
downloads, back/rotation state, and offline retry UI.

Only `https://akipasa.com` and its canonical `www` redirect host render inside
the WebView. Other supported destinations open through Android; cleartext,
file, JavaScript, intent, and unknown schemes are rejected. Google OAuth and
Stripe return links require the Play app-signing fingerprint to be published
at `/.well-known/assetlinks.json` before release. This client is a native
package with a web-delivered product UI, not a screen-by-screen native UI
rewrite. Such a rewrite would first require a versioned mobile API because the
current mutations are Next.js server actions.

## Database

### Supabase PostgreSQL/PostGIS

The authoritative product database covers identities, roles, cities,
categories, venues, ownership/team membership, events and occurrences, media,
offers, loyalty, passports, check-ins, redemptions, community submissions,
reports, claims, promotions, analytics, privacy requests, feature flags, and
audit records.

Migrations are ordered in `database/migrations` and production currently runs
through `0030`. Production migrations
are forward-only; rollback uses a compensating migration or Supabase backup
restore. Reward operations are transactional and idempotent. UTC instants are
stored and rendered in the venue IANA time zone, defaulting to
`Europe/Madrid`.

### Automation D1

`automation/migrations` defines:

- `company_metrics`
- `revenue_entries`
- `expense_entries`
- `request_nonces`
- `execution_logs`
- `generated_reports`
- `automation_jobs`

Money uses integer minor units. The seed inserts only an intentionally stale,
zero-valued company shell. Reporting fails until current real metrics exist.
D1's `(device_id, nonce)` primary key is authoritative replay protection.
Telegram update IDs use the same table under a separate `telegram-group` actor
and a two-day replay window.

## APIs

### Public application API

- Next.js server actions implement authenticated product mutations.
- `update_own_profile` changes only the caller's display name and locale.
- `submit_business_application` creates one bounded active application per
  user; staff review is role-gated and audited.
- Staff catalogue mutations use `operator_update_venue`,
  `operator_update_event`, and `operator_delete_catalogue_item` with required
  reasons and explicit deletion confirmation.
- `/api/analytics` accepts a strict same-origin, privacy-minimised event
  contract.
- `/api/stripe/webhook` verifies Stripe HMAC signatures within a five-minute
  tolerance, deduplicates event IDs, and uses a server-only Supabase service
  client to update subscription entitlements.
- Hosted Checkout carries profile, plan, and interval metadata into the Stripe
  subscription. Redirect success is informational; only a verified webhook
  activates paid access.
- Supabase REST/RPC and Storage calls are made through server/browser clients
  according to RLS policy.

### Voice API

`POST /voice` accepts a Zod-validated command, device ID, ISO timestamp, unique
nonce, versioned HMAC signature, and optional payload. The canonical signature
includes method, path, normalized command, device, timestamp, nonce, and a
stable payload hash. Bodies are capped at 16 KiB.

The request sequence is:

1. Parse and validate shape.
2. Verify allowed device, timestamp window, and HMAC.
3. Create the execution audit.
4. Reject replay via KV cache and D1 unique insert.
5. Resolve and execute the command.
6. Persist success/failure duration and bounded result/error details.
7. Return a non-sensitive JSON response.

### Telegram webhook API

`POST /telegram/webhook` accepts Telegram Bot API message updates. It verifies
the `X-Telegram-Bot-Api-Secret-Token` header before parsing, ignores any chat
other than the configured group, parses supported slash commands including
bot-addressed forms, and reserves the Telegram `update_id` before execution.

`/numbers`, `/revenue`, `/expenses`, `/status`, and `/test` resolve through the
same generated command router as voice and dashboard operations. `/help` and
`/commands` return the group command menu. Executions and failures are written
to the same D1 audit table with a transport-specific caller.

## External services

- Cloudflare: Workers runtime, custom domains, assets, D1, KV, observability.
- Supabase: Auth, PostgreSQL/PostGIS, Storage, Cron, backups.
- Telegram Bot API: automation message delivery.
- Android Tasker and Termux: voice trigger and local request signing.
- Google: configured public-app OAuth and device Assistant trigger.
- Resend: production authentication email through Supabase SMTP.
- Stripe Billing: hosted subscription Checkout, customer portal, and signed
  webhooks.
- GitHub Actions: automation checks and manually gated deployment.

No external service credential belongs in source or documentation.

## Authentication

### Public application

Supabase Auth is the only password processor. Public signup starts as User.
Business capability follows venue ownership/team membership. Staff and
Administrator are privileged platform roles; privileged role changes require
Administrator authorization, a reason, and an audit row. Administrator venue
access is inherited without synthetic membership.

Migration `0027` adds `admin_search_users` and `admin_user_record` as narrowly
granted security-definer RPCs. They inspect `auth.users` and Google
`auth.identities` only after an administrator check, cap search results, and
return a bounded record. The browser uses a debounced same-origin API and never
receives a service-role credential. `set_platform_role` serializes role
changes, rejects self/no-op changes, protects the final active administrator,
and appends the reason plus old/new role to the audit system.

Billing service-role access exists only in the server webhook route. It is
never exposed to browser code. Customers can read only their own billing rows;
staff can read grants/subscriptions and create grants only through an audited
security-definer RPC. New venue creation requires an active Business
subscription/grant, except for Administrators.

### Voice execution

Anonymous execution is impossible by contract. Requests require a shared
HMAC-SHA256 signing secret, allowed device ID, fresh timestamp, and unused
nonce. Web Crypto performs verification. D1 prevents replay across edge
locations, with KV serving only as an optimization.

### Telegram execution

Telegram authenticates webhook delivery with an independent secret-token
header. The Worker additionally requires the configured numeric group ID and
deduplicates update IDs in D1/KV. Telegram credentials are not reused for
dashboard or voice authentication.

### Automation dashboard

The dashboard uses a separate password and a signed short-lived cookie with
`HttpOnly`, `Secure`, and `SameSite=Strict`. Login/logout POSTs require a
same-origin request.

## Deployment

### Public Worker

OpenNext builds `.open-next/worker.js` and static assets. `wrangler.jsonc`
attaches the apex and `www` custom domains; middleware canonicalizes `www` to
the apex. Release requires migrations, rollback-only database acceptance,
`npm run check`, `npm run test:e2e`, Worker preview/dry-run, approved deploy,
and post-deploy smoke tests.

The connected Cloudflare build runs `npm run build:cloudflare` on Linux and
deploys with `npx wrangler deploy --keep-vars`. This is the production build
path when the managed Windows environment blocks OpenNext's parent-directory
scan. The stale local `.open-next` directory must never be deployed.

For release verification in the managed Windows environment, source can be
copied to an isolated temporary snapshot and mounted as a temporary drive root.
This prevents esbuild from traversing denied parent directories. Dependencies
must be complete and local to that snapshot; generated or ignored repository
artifacts are never copied. The resulting bundle must pass Wrangler dry-run
before deployment, and production deployment must use `--keep-vars`.

Billing uses encrypted `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and
`SUPABASE_SERVICE_ROLE_KEY` Worker secrets. Stripe price IDs are non-secret
deployment variables. All three secrets and the four-event production webhook
are configured.

Production currently runs Worker version
`1f6e4d66-de50-4580-863c-411627c4c875`. The optimized artifact uploads
7,128.55 KiB (1,390.16 KiB gzip) and reports a 24 ms startup. A controlled
40-request production probe returned only `200` responses and no Worker error.

The Workers Paid plan removes the free plan's 10 ms request ceiling. The public
Worker nevertheless sets a defensive 1,000 ms CPU limit and 100-subrequest
limit per invocation. These bounds provide ample Next.js SSR headroom while
containing runaway execution and downstream request amplification.

### Automation Worker

`automation/wrangler.jsonc` defines the D1/KV bindings, configuration, and
observability. The dedicated resources are provisioned and the Worker is
deployed. The scheduled maintenance handler exists in code, but no production
Cron trigger is currently attached. The GitHub workflow always runs checks;
deployment is available only through a manual boolean input and protected
production environment.

Detailed procedures are in `docs/RUNBOOK.md` and `automation/README.md`.

## Infrastructure

- Public Cloudflare Worker plus static assets and two custom-domain routes.
- Hosted Supabase project with PostgreSQL/PostGIS, Auth, Storage, and hourly
  event-expiry Cron.
- Separate deployed automation Cloudflare Worker with dedicated EU D1 and KV.
- Cloudflare structured observability enabled for both Worker configurations.
- GitHub Actions uses short-scope Cloudflare account/token secret names.

## Data flow

### Discovery

```text
Localized request
  -> validated query
  -> selected repository adapter
  -> published Supabase rows and/or labelled fixtures
  -> occurrence/time/distance filters
  -> localized server-rendered result
```

### Authenticated mutation

```text
Form/server action
  -> Zod validation
  -> Supabase session
  -> server permission check
  -> RLS/constraint/trigger/RPC enforcement
  -> transaction and audit/ledger
  -> revalidated UI
```

### Subscription fulfillment

```text
Authenticated plan selection
  -> server creates Stripe-hosted Checkout Session
  -> Stripe collects payment
  -> signed POST /api/stripe/webhook
  -> event ID reservation
  -> Supabase subscription entitlement
  -> Business application activation where applicable
```

### Voice investor update

```text
Spoken phrase
  -> Tasker/Termux generates timestamp + nonce + HMAC
  -> POST /voice
  -> authentication and D1/KV replay reservation
  -> finance service reads current D1 rows
  -> report formatter
  -> Telegram adapter
  -> generated report + execution audit
  -> dashboard metrics
```

### Telegram group command

```text
Slash command in configured group
  -> Telegram webhook with secret-token header
  -> chat allow-list + D1/KV update reservation
  -> shared command module
  -> reply or external command delivery
  -> execution audit + dashboard metrics
```

# Personalisation and recommendations (2026-08-13)

The central recommendation boundary is `src/lib/personalisation/server.ts`; ranking components are in `src/lib/personalisation/ranking.ts`. Versioned ingestion is `/api/v1/behaviour/events` and versioned internal recommendations are `/api/v1/recommendations`. The existing discovery repository remains candidate infrastructure, so homepage, maps, AI tools and future partner gateways can converge on one engine. See `docs/RECOMMENDATIONS.md`.

## AkiPals isolated playground (2026-10-12)

The `/pals` document stays outside the public React/analytics bundle. Its
nonce-protected client composes the shared vector catalogue and authoritative
payload from `/pals/api`. Optional schema-1 journey and arcade extensions use
the existing `pals_states` JSONB row and `pals_commit` version/command transaction.
Care/checklist progression and validated arcade completion never accept a
client balance or reward. Games animate locally and submit bounded transcripts
for server replay; missing historical extension fields are upgraded lazily.
The style guide contains editorial recipes referencing stable cosmetic IDs,
not ownership grants. See `docs/AKIPALS_RELEASE_20261012.md` for release evidence.

## Portal home composition (2026-10-10 candidate)

Host identity from middleware is exposed on the body for Business/Duermo-only design tokens. `PortalLogo` uses the uploaded product icon masters; `BusinessHeader` and `StayHeader` keep each product's controls consistent. Business Home receives membership rows explicitly scoped to the current profile, adds the existing staff editorial access, and filters/paginates that authorized result in a client component. Mutations remain existing server actions; no browser filter grants access. Analytics RPC reads run only in the Analytics view. AkiPasa consumer components and brand remain unchanged. See the master contract and impact register for validation/release status.

Business and Duermo headers compose the same `PortalHeaderTools` client component. It owns ordered locale/theme/app controls and excludes the current app from shared branded destinations. Host-specific language behavior and authenticated logout/settings are passed through existing adapters/slots; no authentication or data logic moves into the shared control.

Pending venue claim review uses a narrowly scoped `staff_pending_venue_claims` RPC
with current database role authorization, bounded pagination and private Auth email
lookup. It returns contact details only for pending claimants to staff/admin;
no service key or public profile projection is involved. The existing audited
claim decision RPC remains authoritative for ownership grants.

## Claim decision notification boundary

The existing audited claim decision RPC remains authoritative. A future pending
claim decision atomically appends a private localized recipient/content snapshot
through a trigger, without backfilling historical claims. A separate service-key
adapter delivers from alex@akipasa.com through Resend immediately after review or
on the existing Worker cron. Leased batches, frozen content, provider idempotency,
bounded retries and cumulative ambiguity holds preserve decision integrity.
Claimant/staff read RLS, service-only mutation, account export and cascade deletion
apply to the new outbox. Existing booking senders and ownership rules are unchanged.

Basic AkiBusiness workspace admission also accepts existing caller-scoped venue
team membership, independent of the member's personal subscription/platform role.
The Home loader relies on this admission guard and lists only the caller's
membership rows. Tenant and operation authorization stays in existing RLS/RPCs;
Business Pro retains a separate paid-entitlement check.

### Staff-owned claim submission alerts

The staff homepage counts pending `venue_claims` through the staff-gated `staff_pending_venue_claim_count()` aggregate, in sync with the paginated moderation read RPC. A new claim INSERT creates one `claim_submission_alerts` outbox row without modifying ownership or claimant-facing decision emails. The Cloudflare scheduled worker dispatches notifications to both cofounder Workspace inboxes through the existing provider, with an immediate best-effort dispatch after the server action. The outbox uses service-only leases, stable message keys, confirmed ACK, bounded retries and ambiguity review. No unverified claimant contact data is emailed.

### Structured venue claim metadata

AkiBusiness collects claim-specific applicant name, relationship, optional phone, business email, website and venue phone in the ownership claim form. The server validates the inputs, writes them to the private `venue_claims.claim_details` JSONB object with the original evidence, and preserves the existing staff alert dispatch. The existing staff-gated `staff_pending_venue_claims(integer)` RPC returns this metadata under `claimant.submission` for review, explicitly labelled as unverified. The official venue catalogue and profile contact information are never overwritten by unapproved requests. Legacy claims retain empty metadata. Additive migration `20261010231500_venue_claim_details.sql` must be applied before frontend deployment.

### Lifecycle notification integration (2026-10-11)

The shared transactional email catalogue is defined in `src/lib/suite-email-templates.ts`; the Cloudflare 5-minute scheduled worker executes `src/lib/suite-mail-delivery.ts`. `public.suite_email_outbox` stores locale and recipient snapshots, unique per user/product or entity status transition, with service-only leases and delivery ACK. The existing confirmed-booking, claim moderation and staff-alert outboxes remain intact. Claim submitted locale is frozen in `venue_claims.claim_locale`. Verified first visits queue deduplicated product welcomes. Account-based saved stays and saved-event refs supply only explicitly opted-in reminders, with revalidation before sending. The AkiHQ frontend in its own GitHub repository calls the shared authenticated welcome RPC after workspace authorisation. Do not use public client calls or page visits to send directly through Resend.

### Public Spotlight detail presentation (2026-10-12)

The venue and event Server Components retain their existing repository, authenticated personal state, published catalogue and booking boundaries. Venue presentation sends only published catalogue-referenced media into a small client section navigator; event presentation remains server-rendered, including the shared booking eligibility used by both responsive action placements. `spotlight-detail.css` supplies scoped theme/actions chrome, and route-specific CSS gives venues and events distinct responsive hierarchies. The optional ShareButton icon variant retains consent-controlled analytics and adds localized clipboard/native-share status. No data model or service boundary changes. A disposable read-only Supabase-shaped HTTP server provides real-route browser acceptance without introducing production fixture records; its mandatory CI command is `npm run test:spotlight:browser`.

### Release source identity (2026-10-13)

Cloudflare packaging writes the clean source Git SHA into an ignored generated asset. The Worker reads it directly through ASSETS for the existing read-only release endpoint; no request-supplied or runtime mutable source variable is trusted. Missing source evidence is null. Post-push release smoke verifies the triggering SHA across all public portal hosts, separately from database readiness and authenticated workflow tests.

## Health audit boundary — Count actual media and customer-support request bytes (2026-10-13)

Both /api/business/venue-media and /api/support-agent/chat trusted Content-Length before parsing. Four isolated streamed-request cases reproduced oversized bodies reaching mocked authenticated adapters. Media now counts binary bytes before forwarding to the multipart parser, with an 11 MiB framing budget and cancellation on overflow; support reuses readBoundedText for its 8000-byte UTF-8 contract. Missing or understated length cannot bypass the limits. Origin checks, existing upload action authorization/file validation/RLS, authenticated support identity and provider/tool boundaries remain unchanged. No schema, data, email, prices, entitlements or consent behavior changes.

## Health audit boundary — AkiDuermo Saved avoids unused catalogue requests (2026-10-13)

The device-local Saved view filtered only its own inventory but issued /api/stays requests on mount and each filter/search change. The discovery effect now skips the Saved view, preserving the separate authenticated /api/stays/saved preference read and save/unsave synchronization. EN/ES component reproduction measured four catalogue requests before and zero after; Explore still fetches and displays its existing private owner preview. Focused 4/4 and broader AkiDuermo 31/31 tests, scoped lint and formatting passed. No stopwatch/CWV or production speed improvement is claimed. No routes, roles, RLS, persistent save format, booking, paid access or data changed. Full check, browser/CI and live version verification remain release gates; rollback is a source revert. Homepage concurrency overlaps existing PR #103 and was not duplicated.

## Health audit boundary — Locale navigation and membership control acceptance (2026-10-13)

The health audit reproduces stale Spanish privacy copy after switching to an English localized route, a membership Manage/Search collision at 1363px, and auth language switching that retains the previous locale in a single local return destination. PersonalisationConsent derives copy from the exact current locale segment, then a valid reactive AkiDuermo lang query, with the existing server fallback; LanguageLink translates one well-formed localized next destination while preserving its suffix/query and the existing server destination sanitizer. Membership imports a narrow stylesheet reserving Search space at the existing 800px breakpoint. Consent choices, auth/session/roles, pricing, checkout gates, API/RLS, media, storage, analytics and production data are unchanged.

### Stay privacy controls and property CTA protection (health follow-up)

Production and CI reproduce the AkiDuermo Privacy trigger beneath fixed StayNavigation. Scoped StayAppShell rules place the trigger and bounded, scrollable panel above the dock/safe area. A property-only <=800px offset also preserves its separate planning CTA; wider screens and route departure reset the CSS variable automatically. Membership Manage uses a 46px minimum target while retaining the strict >=44px acceptance assertion. No consent defaults/submission, booking actions, property data, auth/roles, prices or shared global/root/picker styling changes. Sixty-two real-route cases include both locales/themes, seven catalogue widths, stay-host short windows and twelve synthetic property-renderer layouts. Property fixture shapes are layout evidence, not live inventory/RLS proof. Source reverts are sufficient; no migration. Final execution, integrated checks and deployment proof remain release gates.

### In-place stay language acceptance (final Health follow-up)

Actual browser acceptance caught Next retaining the old reactive query because the stay screens preserve history state markers. AkiDuermo and StayProperty now emit a bounded locale notification after their existing in-place language change. Consent validates EN/ES, keeps an exact localized pathname authoritative and clears scoped notifications on navigation, including return to an old route. Existing draft choices, motion, cookie and submission behavior remain. Seventeen component cases pass; the 62-case browser matrix now includes bidirectional property language switches with zero consent POST and no document reload. Current-head browser, CI, clean Cloudflare package and exact live source/smoke remain release gates. The branch includes reviewed #145/#144 prerequisites for ordered integration; no duplicate security migration.

### First-visit privacy panel dismissal (Health CI repair)

Current-head browser CI reproduced four EN/ES × light/dark 390px AkiDuermo guest journeys failing to click Hotels because the initially visible privacy panel intercepted the map filter. The shared nonmodal panel now has an EN/ES Close control (46px minimum height), scoped header styling and Escape dismissal from its controls, restoring focus to the existing Privacy trigger without scrolling the page. Closing changes visibility only: it writes no consent/version cookie, sends no POST, requests no motion permission and does not apply optional choices. Existing saved permissions remain authoritative and the draft remains available when reopened. The prompt still appears on a fresh document until an explicit consent choice is saved. Auth, account settings, consent API/RLS, telemetry permission checks, pricing, booking and production data are unchanged.

Four additional component cases verify denied first visits in both locales, preserved drafts/saved permissions, keyboard focus and pending-save behavior. The existing eight locale/theme/mobile/desktop guest journeys now assert the real initially open panel, denied defaults, normal dismissal, focus restoration and zero consent writes before their ordinary discovery/filter interactions. Focused tests, complete browser/check/Cloudflare CI and exact live-source smoke remain release gates. Rollback is an application source revert; no migration or customer-data restoration.

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

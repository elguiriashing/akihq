# Engineering Decisions

Last reviewed: 2026-07-31.

## ADR-001: Next.js App Router and TypeScript

**Decision:** Build the public product with Next.js App Router, React, and
strict TypeScript.

**Reasoning:** The product needs localized SSR/SEO, server actions, shared
types, and one full-stack deployment unit.

**Alternatives considered:** Separate SPA/API services; static-only site;
another server framework.

**Trade-offs:** Next/OpenNext compatibility must be tested, builds are heavier,
and framework upgrades can affect the Cloudflare adapter.

## ADR-002: PostgreSQL/PostGIS is authoritative

**Decision:** Store production product data in Supabase PostgreSQL/PostGIS and
use isolated test factories for credential-free automated checks.

**Reasoning:** Relational integrity, geospatial data, transactions, RLS, and
auditable operations are central requirements.

**Alternatives considered:** Fixture-only application; document database;
Cloudflare D1 for the entire product.

**Trade-offs:** Supabase is an operational dependency. Test factories remain
isolated from customer-facing catalogue data.

## ADR-003: Provider boundaries

**Decision:** Keep authentication, maps, storage, analytics, email, Telegram,
and ticketing behind interfaces/services.

**Reasoning:** Domain rules must remain testable and portable.

**Alternatives considered:** Call each SDK directly from routes/components.

**Trade-offs:** More adapter code and explicit mapping are required.

## ADR-004: Localized route and time contracts

**Decision:** Use `/es` and `/en`; default to Spanish; store UTC instants and
render in the venue IANA zone, defaulting to `Europe/Madrid`. "Tonight" spans
18:00 to 04:00 and preserves the prior evening before 04:00.

**Reasoning:** URLs need indexable language identity, while event discovery must
respect local civil time and overnight activity.

**Alternatives considered:** Browser-only localization; fixed UTC offsets;
calendar-day-only "tonight".

**Trade-offs:** Route duplication and daylight-saving tests are required.

## ADR-005: Database-enforced authorization

**Decision:** Validate and authorize every mutation server-side, then reinforce
it with RLS, constraints, triggers, narrowly granted RPCs, and audits.

**Reasoning:** Hidden controls and client checks are not security boundaries.

**Alternatives considered:** Application-only role checks; broad service-role
access.

**Trade-offs:** Policies and migrations are more complex and require
rollback-only production acceptance.

## ADR-006: Roles and venue membership remain separate

**Decision:** Use User, Business, Staff, and Administrator as platform roles;
represent owner/manager/editor access through venue membership. Administrators
inherit venue-management access without synthetic memberships.

**Reasoning:** Platform authority and business-team authority have different
lifecycles and audit needs.

**Alternatives considered:** One role column for all permissions; adding every
Administrator to every venue.

**Trade-offs:** Permission resolution is more involved but avoids stale,
exploding membership rows.

## ADR-007: Moderation is a separate workflow

**Decision:** Community suggestions remain outside canonical events until
reviewed. Decisions require an operator role and reason and append audit data
transactionally.

**Reasoning:** User submissions must not silently become trusted catalogue
content.

**Alternatives considered:** Immediate publication; edit canonical events in
place without a review record.

**Trade-offs:** More queues and operator work, but clear provenance and safer
scaling.

## ADR-008: Rewards are transactional and idempotent

**Decision:** Check-ins, XP/stamps, passports, cooldowns, and redemption use
database transactions, idempotency keys, ledgers, and server authorization.

**Reasoning:** Retried requests and concurrency must not duplicate value.

**Alternatives considered:** Client-side counters; eventual batch correction.

**Trade-offs:** More database logic and acceptance coverage.

## ADR-009: Label sponsorship clearly

**Decision:** Sponsorship uses explicit labelled slots, never hidden ranking
boosts.

**Reasoning:** User trust and advertising transparency are product constraints.

**Alternatives considered:** Paid ranking adjustments; undisclosed commercial
placement.

**Trade-offs:** Commercial placement options are narrower.

## ADR-010: Cloudflare/OpenNext public deployment

**Decision:** Package the public Next application as a Cloudflare Worker with
OpenNext. Use the apex as canonical and redirect `www`.

**Reasoning:** One edge runtime serves SSR and static assets with existing
Cloudflare operations.

**Alternatives considered:** Vercel; Node server/container; static export.

**Trade-offs:** OpenNext is an extra compatibility layer and deployment must be
dry-run and smoke-tested.

## ADR-011: Isolate voice automation

**Decision:** Build voice automation as a separate Hono Worker with dedicated
D1/KV resources and deployment workflow.

**Reasoning:** Command execution has a different trust boundary, data model,
latency target, and release cadence from public discovery.

**Alternatives considered:** Add `/voice` to the Next Worker; hardcode a
Telegram webhook; use a third-party automation platform.

**Trade-offs:** A second service requires separate provisioning, secrets,
observability, migrations, and operational ownership.

## ADR-012: HMAC, freshness, and authoritative replay protection

**Decision:** Sign a canonical request with HMAC-SHA256, require an allowed
device and bounded timestamp, and reserve `(device_id, nonce)` in D1. Use KV
only as a fast replay cache.

**Reasoning:** Anonymous calls, tampering, and captured-request replay must be
rejected across edge locations.

**Alternatives considered:** Static bearer token; IP allow-list; KV-only nonce
storage; OAuth device flow.

**Trade-offs:** Devices need secure shared-secret handling and clock accuracy.
D1 adds a write before each execution.

## ADR-013: Generated command registry

**Decision:** Generate the automation command registry from
`src/commands/*.ts` before checks, development, and deployment.

**Reasoning:** Adding a command should require one module without editing a
central switch.

**Alternatives considered:** Manual imports; runtime dynamic loading; one large
router.

**Trade-offs:** Generated output must remain deterministic and CI must run the
generator.

## ADR-014: Never fabricate financial data

**Decision:** Store money as integer minor units and refuse investor reporting
until current company metrics exist. Seed only an obviously stale zero shell.

**Reasoning:** A convincing presentation must not be mistaken for real performance or
silently send invented investor numbers.

**Alternatives considered:** Hardcoded presentation metrics; floating-point amounts;
fallback sample report.

**Trade-offs:** Initial production acceptance requires explicit data loading.

## ADR-015: Separate dashboard authentication

**Decision:** Protect the automation dashboard with an independent password and
signed short-lived secure cookie.

**Reasoning:** Voice credentials should not become browser sessions, and the
automation Worker does not depend on Supabase Auth.

**Alternatives considered:** Public dashboard; reuse the signing secret; embed
Supabase Auth; Cloudflare Access.

**Trade-offs:** This creates another credential and currently lacks login rate
limiting. Cloudflare Access remains a reasonable future replacement.

## ADR-016: Operator commands reuse command modules

**Decision:** Let authenticated dashboard operators execute the same command
modules as voice calls, with separate caller identity, D1 audit logging,
same-origin POST enforcement, a D1/KV-reserved operation ID, and explicit
confirmation for external effects.

**Reasoning:** One implementation prevents voice and dashboard behavior from
drifting while preserving distinct authentication boundaries.

**Alternatives considered:** Display-only command catalogue; duplicate operator
handlers; make operators generate voice HMAC requests in the browser.

**Trade-offs:** Dashboard compromise can trigger configured external actions,
so session hardening, confirmation, audit, and future login rate limiting are
important.

## ADR-017: Explicit production gates

**Decision:** Never create paid resources, mutate production data, deploy, or
contact external users without current explicit approval. CI deployment is
manual and environment-gated.

**Reasoning:** Infrastructure and external side effects are irreversible or
cost-bearing and require operator intent.

**Alternatives considered:** Deploy automatically on every main-branch push.

**Trade-offs:** Releases require manual coordination but have a smaller blast
radius.

## ADR-018: Telegram is a separate authenticated command transport

**Decision:** Receive Telegram slash commands through a Bot API webhook secured
by Telegram's secret-token header, restrict execution to the configured group,
reserve each update ID in D1/KV, and route supported commands through the
existing command modules.

**Reasoning:** Group commands need a usable operator surface without weakening
voice HMAC authentication or duplicating finance and status business logic.
Telegram retries webhook deliveries, so update-level idempotency is mandatory.

**Alternatives considered:** Poll `getUpdates`; accept all group messages;
reuse the voice signing secret; implement separate Telegram-only business
handlers.

**Trade-offs:** Webhook registration and another secret must be operated
carefully. Group membership grants access to read commands and approved
external commands, so the configured group remains a security boundary.

## ADR-019: Route-based progressive disclosure

**Decision:** Account, staff, and administrator workspaces use stable dedicated
routes inside one responsive navigation shell. Overviews contain summaries and
next actions; detailed controls load only for the selected workflow.

**Reasoning:** Restyling long pages would not reduce cognitive load, query cost,
scrolling, or linkability.

**Alternatives considered:** Query-string tabs; one page of collapsed details;
smaller typography and denser cards.

**Trade-offs:** More route files and shared layout code are required, while
direct links, back paths, permissions, and per-page loading become clearer.

## ADR-020: Auth identity search stays inside administrator RPCs

**Decision:** Search `auth.users` and Google `auth.identities` through bounded,
administrator-gated security-definer RPCs using the caller's Supabase session.
Do not add a service-role key to the web application.

**Reasoning:** Administrators need identity-aware lookup, but Auth email data is
personal and must not be exposed through public tables or broad client reads.

**Alternatives considered:** Load all profiles in the browser; duplicate emails
into public profiles; use a service-role API route.

**Trade-offs:** The database RPC is Supabase-specific and needs migration
acceptance, but authorization remains centralized and leaked-data scope is
bounded.

## ADR-021: Do not fake support conversations

**Decision:** Treat existing reports as support cases. Defer inbox threads and
conversations until message, participant, assignment, status, retention, and
audit contracts exist.

**Reasoning:** A polished control without durable backend behavior is misleading
and unsafe for operations.

**Alternatives considered:** Static inbox mockups; storing messages in report
notes; browser-only conversation state.

**Trade-offs:** The staff workspace has a useful report queue now but not a
full omnichannel support inbox.

## ADR-022: Keep anonymous traffic off authenticated and repeated SSR paths

**Decision:** Validate Supabase sessions only when a Supabase Auth cookie is
present, use a sessionless client for public catalogue reads, exclude
browser-only MapLibre/QR code from server bundles, and use OpenNext's generated
Worker entry point directly.

**Reasoning:** The rejected release reported a 29 ms startup but produced error
1102 under the free 10 ms request CPU allowance. Anonymous requests were paying
for Auth validation and repeated Next SSR, while browser-only libraries added
more than 1 MB to server chunks.

**Alternatives considered:** Upgrade immediately without profiling; cache all
public routes; cache authenticated RSC responses; remove maps or QR features;
move the whole application to static hosting.

**Trade-offs:** Public pages still execute Next SSR, and Workers Paid may be
required for a guaranteed CPU envelope on dynamic authenticated routes. Edge
caching can be reconsidered only with a Linux-built candidate and 0%-traffic
runtime acceptance.

**Production evidence:** The optimized release reduced upload size from
8,738.70 KiB to 7,128.55 KiB. Its startup is 35 ms, and 40 controlled dynamic
requests completed without 1102 or another 5xx response. This supports
optimizing request CPU before purchasing a larger runtime allowance.

## ADR-023: Bound paid Worker execution

**Decision:** Run the public application on Workers Paid, but cap each
invocation at 1,000 ms CPU and 100 subrequests.

**Reasoning:** Paid removes the unsafe 10 ms free-plan ceiling for Next.js SSR.
Explicit limits still contain pathological requests, accidental loops, and
downstream request amplification instead of exposing the full 30-second and
10,000-subrequest defaults.

**Alternatives considered:** Keep the free plan; accept paid defaults; use the
full five-minute maximum; set the historical 50-subrequest limit.

**Trade-offs:** A genuinely expensive future route can terminate at the
defensive ceiling and will require profiling plus an intentional limit change.
The limits do not replace endpoint-specific authorization, rate limiting, WAF
controls, caching, or usage alerts.

## ADR-024: Separate business approval from payment fulfillment

**Decision:** Persist business applications and staff review before enabling
venue creation. Represent payment state explicitly, but do not render or accept
a payment until Stripe pricing and signed webhook fulfillment are configured.

**Reasoning:** Ordinary users need a real onboarding route, while a checkout
button without a durable application, agreed price, webhook verification, and
idempotent entitlement fulfillment would be misleading and unsafe.

**Alternatives considered:** Allow every user to create venues; add a fake
checkout; grant Business on client-side payment return; hardcode a price.

**Trade-offs:** Users can apply and staff can review or explicitly waive
payment, but paid self-service activation remains incomplete until commercial
terms and Stripe infrastructure are approved.

## ADR-025: Stripe-hosted recurring billing with webhook-only fulfillment

**Decision:** Sell Premium for EUR 5 monthly or EUR 48 yearly and Business for
EUR 20 monthly or EUR 190 yearly through Stripe-hosted Checkout. Treat signed,
idempotent webhooks as the only paid-entitlement authority. Permit audited
staff grants for one month, three months, or indefinitely.

**Reasoning:** Hosted Checkout reduces payment-data scope. Webhook-only
activation prevents forged success redirects, while explicit grant records
support trials and waivers without pretending a payment occurred.

**Alternatives considered:** Payment Links without application metadata;
client-side activation after redirect; storing card details; manually changing
roles to represent trials.

**Trade-offs:** The Worker needs three encrypted server secrets and a
service-role client restricted to the webhook. Subscription state is
eventually consistent, and Stripe/customer-portal availability is an external
dependency.

## ADR-026: Use the connected Linux build for OpenNext releases

**Decision:** Build the public Worker with `npm run build:cloudflare` in
Cloudflare's connected Linux build environment and deploy with
`npx wrangler deploy --keep-vars` when the managed Windows environment blocks
OpenNext. Never deploy the stale local `.open-next` artifact.

**Reasoning:** OpenNext's esbuild configuration loader scans above the
repository on Windows. The managed filesystem denies that scan even though the
application, tests, and regular Next production build pass. Cloudflare's
connected Linux builder provides the intended filesystem model and preserves
encrypted runtime secrets.

**Alternatives considered:** Deploy the stale artifact; weaken filesystem
isolation; patch installed OpenNext dependencies; omit the OpenNext build and
run only `next build`.

**Trade-offs:** Production deployment now depends on the connected Git branch
and Cloudflare build service. Source must be committed and pushed before the
build, and the resulting logs/artifact must be inspected before acceptance.

## ADR-027: Verify releases from a clean isolated snapshot

**Decision:** Treat a clean temporary source snapshot as the local release
verification boundary. Mount it as a temporary drive root on managed Windows,
install dependencies locally, build OpenNext, and require Wrangler dry-run
before production upload.

**Reasoning:** The repository's ignored generated type files can mask
clean-build defects, while OpenNext/esbuild parent traversal is incompatible
with the managed Windows filesystem. A drive-root snapshot both reproduces the
tracked release contents and keeps parent traversal inside an allowed boundary.

**Alternatives considered:** Trust the regular Next build; deploy an existing
`.open-next` directory; patch installed OpenNext code; skip local verification
and rely only on the connected build.

**Trade-offs:** Preparing the isolated dependency tree is slower on Windows and
requires validating that no dependency was truncated. It provides stronger
clean-build evidence but does not replace Linux connected-build logs or live
post-deployment acceptance.

## ADR-028: Ship Android through a native host before a UI rewrite

**Decision:** Release the first Android client as a dependency-light native
host for the production AkiPasa web application. Keep Supabase, server actions,
authorization, billing, storage, and product UI authoritative in the existing
application; implement only device integration and security boundaries in the
Android layer.

**Reasoning:** The current product has dozens of public, account, business,
staff, and administrator routes whose mutations are Next.js server actions.
Hosting that application provides immediate behavioral and database parity
without exposing a service credential or creating a second set of business
rules. Native handling is still required for App Links, external OAuth and
billing, location consent, uploads, downloads, navigation, and offline errors.

**Alternatives considered:** Rewrite every screen in Compose against direct
Supabase calls; introduce and version a complete mobile API first; publish only
the existing PWA; use a Trusted Web Activity with no native integration.

**Trade-offs:** The Play package is native but its product interface remains
web-delivered and requires connectivity for server-rendered features. Web
releases affect Android immediately. Google OAuth and Stripe callbacks require
Digital Asset Links. A future native UI rewrite remains possible, but should
consume a reviewed mobile API rather than bypass server-side product rules.

## ADR-029: Derive paid product access from billing events

**Decision:** Keep Stripe subscription and audited staff-grant rows
authoritative. Reconcile denormalized Premium and Business profile flags in
PostgreSQL triggers, ignore out-of-order Stripe events, and enforce paid access
again in RLS/RPCs and protected routes.

Premium includes member-only venue offers, 2x non-cash XP on accepted
check-ins, and calendar exports for events and saved plans. Business activates
the Business profile and gates venue, event, loyalty, promotion, and analytics
tools.

**Reasoning:** A Checkout success redirect is forgeable and can arrive before
or without final subscription state. Central reconciliation gives the web,
database, Stripe webhook, and staff grants one access contract. The selected
Premium benefits build on existing discovery and loyalty behavior without
introducing delivery-heavy discounts or cash-equivalent rewards.

**Alternatives considered:** Client-side role changes after Checkout; one
generic paid flag; Premium-only content without enforceable benefits; doubling
stamps as well as XP.

**Trade-offs:** Entitlement changes are eventually consistent with Stripe,
profile flags must never be user-editable, and calendar exports perform bounded
catalogue reads. Business cancellation removes paid tools even when catalogue
ownership records must be retained.

# 2026-08-13: Central, explainable recommendation platform

Recommendation logic lives behind one service boundary and begins with an explainable weighted ranker. Raw exposure is distinct from preference; skips are weak, explicit rejection is strong, repeated signals diminish, recent and long-term interests decay separately, and sponsored placement requires organic relevance. Behavioural collection is consented, pseudonymous where possible, bounded and non-blocking. Commercial partner access will call the same service through a separately authenticated/metered gateway.

## ADR-030: Extend the private AkiPals save for companion play

**Decision:** Add optional versioned journey and arcade fields to the existing
schema-1 save. Keep all reward decisions behind strict domain actions and the
existing account-scoped atomic command ledger. Play arcade moves locally and
submit a bounded transcript for server validation only when the puzzle ends.

**Reasoning:** Existing preview accounts retain their equipment, cosmetics,
entitlements and story progress without a migration or reset. Local puzzle
interaction feels immediate while the server still owns completion, scoring,
daily reward limits and replay protection. Non-decaying bond XP and banked
completed goals support returning players without removing earned progress.

**Alternatives considered:** Introduce separate game tables and a save-schema
upgrade now; accept a client-reported win/score; make each cell move a network
mutation; add a decaying care meter or missed-day penalty.

**Trade-offs:** Saved state and the command ledger remain the persistence
boundary for this private preview. Only one arcade puzzle can be active at a
time. In-progress moves survive a refresh in the same browser tab through
session storage; another device resumes the saved board without those local
moves. A future public
competitive mode would need a separately reviewed challenge/competition model;
the current fixed-reward solo games do not claim anti-cheat competition.

## ADR-031: Keep car rentals independent from claimed venues

**Decision:** Add AkiConduzco as a standalone rental marketplace backed by
company, vehicle, calendar, request and review records. Let rental operators
create their own pending company profile in a full-screen AkiBusiness mobility
workspace. Use explicit staff review and request/confirm booking semantics.

**Reasoning:** Rental companies own vehicle fleets, price schedules and pickup
availability that do not fit venue ownership or the existing claim model.
Separating records and access rules avoids treating an address match as proof
of rental-company ownership and gives the fleet manager a clean permission
boundary.

**Alternatives considered:** Add car rentals as an AkiPasa venue vertical and
allow claims; ingest an unverified provider directory; send customers directly
to an OTA; add dealer sales inventory.

**Trade-offs:** Operators must be reviewed, and booking requests require a
company response. The first iteration does not take payments, guarantee
availability across external channels, import provider records or include
dealership listings. Production schema, custom-domain routing and release still
require separate verification.

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

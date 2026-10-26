# AkiBusiness extraction acceptance

## 2026-10-25 AkiHQ Android OAuth callback

The management product uses its own akihq Android callback scheme and
AkiHQAndroid user-agent marker. A browser handoff returns the unconsumed
authorization code to the original WebView for PKCE exchange; it never carries
access or refresh tokens. Shared database authorization, cookies, eligibility
and public root-domain session separation remain intact. AkiPasa master is the
protocol provenance, not a runtime checkout dependency. Deployment and signed
device acceptance must be recorded separately from unit tests.

## 2026-10-24 | Owner-approved monthly pricing and upgrade paths

The current commercial catalogue is `APPROVED_PRICING_20261024.md` and
`config/approved-pricing.json`. It supersedes older public tier/price descriptions:
AkiBusiness Basic/Standard/Pro €19.99/€48.99/€97.99; individuals €1.99 for each
AkiPasa/AkiDuermo/AkiCoches Premium; businesses €11.99/€24.99/€19.99 respectively.
Free AkiHQ access, historical machine identifiers and existing subscriber terms
are retained. EN/ES marketing and CTAs explain product-specific Premium upgrades
without activating billing or inventing benefits. Shared audience source remains
identical in the three discovery apps. Source, account, Stripe, SQL guard, service
worker and release dependencies are traced in that pricing contract and receipts.
The 36-case local pricing/lifecycle SQL suite passes; full checks, hosted CI and
exact-source live readback remain required before release acceptance.

## 2026-10-22 | Free AkiHQ membership and three independent listings

AkiHQ now owns a local `/{locale}/membership` catalogue (with the
business/memberships alias) displaying the three €14.99 staged Business
Premium listing upgrades for AkiPasa, AkiDuermo and AkiCoches, each linking
to the discovery product for current purchase/readiness details. AkiHQ
management remains free. A separately labelled AkiBusiness CTA leads to
paid operations software, which listing Premium does not include.
This is bilingual presentation/navigation only. No schema, checkout,
customer, permissions or worker bindings changed. Browser, role/auth,
responsive, source SHA, CI and live Worker verification remain release gates.

Source: `080ea0ffb2dd6612436acd04c25b4daf8ff71129` from AkiPasa master.
`EXTRACTION_SOURCE_GRAPH.json` records static source imports; this is dependency
evidence, not proof of production runtime acceptance. All selected paths were
copied from Git-tracked blobs; no `.env.local`, credentials, build output or Git
history was imported. Native source migrations are immutable reference history.

Management graph: business home -> memberships/tenant guards -> venue workspace
-> profile/media/catalogue/event/booking/team server actions -> Supabase RPC/RLS
and storage; mobility -> company/fleet/availability/rate/request actions -> shared
rental tables/RLS. Claim picker uses claim-search, claim-map and map-tile; media
uses same-origin multipart venue-media. Shared support uses the tenant-scoped
AkiHQ gateway. Auth callback exchange, password/recovery and Terms run locally.
Consumer account/subscription pages remain central at AkiPasa.

Static extraction removes unrelated route pages and unused shared modules. Shared
server modules required by support retain their authorization and provider-boundary
checks. This deployment owns no scheduler, Stripe webhook or schema rollout.
UI links use canonical suite domains; database IDs remain unchanged.

Required hosted acceptance remains pending: Supabase configuration/redirect allowlist,
authenticated EN/ES roles and mutations, business/HQ service permission boundaries,
media uploads, room-night/fleet concurrent booking behavior, sandbox subscription
access, mobile/desktop screenshots, actual preview and canonical TLS, canonical
redirects, exact deployed commit and monitoring. Local tests cannot stand in for
these gates. No production routing change is safe until they pass.

Local verification: `npm ci` passed with checksum/TLS protections; MapLibre patch
verified. Formatting, ESLint and TypeScript passed. 99 scoped tests passed across
14 files, including real business home/team permissions, 33 venue workspace cases,
booking manager, accommodation management, structured claims, auth recovery,
origin rejection and product boundaries. Production Next build passed. Chromium
local smoke passed 8 combinations (EN/ES, 390/1440 px, light/dark), checking anonymous
business-to-auth, brand/language/no overflow, recovery task retention, manifest,
health and rejected webhook mutation. Screenshots remain ignored test artifacts.
These cases use build-only public placeholders and perform no live customer writes.
Initial OpenNext skip-build attempt failed because ordinary Next build omitted
standalone output; full supported OpenNext build is required and tracked separately.

The full supported OpenNext Cloudflare build subsequently passed for implementation
commit `5686c900d1a7b939ce6435e2c7fe47bfb95ad9db`, with verified standalone output.
Remote main's concurrent groundwork/auth allowlist document is retained through a
merge, without replacing its history. Final follow-up changes only contributor,
environment documentation, browser harness and independent CI; runtime sources
remain identical to that compiled implementation. Final adapter repackaging uses
that valid standalone build and stamps the final source commit.

The final candidate permits HTTPS media/connect and WSS only for the two exact
known Supabase hosts (`akipasa.supabase.co` and the retained project reference).
Their provider alias equivalence remains a live verification gate. Next config
changed for this boundary, so the earlier standalone artifact is invalidated and
a full clean-commit OpenNext rebuild is required before final packaging.

## Preview release workflow (2026-10-15)

`preview-release.yml` is manually dispatched, build-only by default. It requires
successful product CI for an exact source SHA, validates the confirmed public
Supabase key/project, builds the actual app and retains compiled artifacts plus
checksums. Optional deployment requires the preview environment's scoped
Cloudflare token. It targets only `akibusiness-preview` in the confirmed account,
rejects custom domains and cron bindings, and verifies the deployed source over
HTTPS. Closed billing flags remain enforced. This workflow does not constitute
authenticated or production acceptance; deployment secrets are still unavailable
in the terminal.

Release packaging clears generated `.open-next` state before each build while
retaining the Next compilation cache; this prevents duplicate adapter exports and
stale assets across repeated packaging. Preview workflows mask the public provider
key and restrict Wrangler logs before inspecting deployment bindings.

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

## 2026-10-20 | Gated shared account eligibility

The server member guard reads AkiPasa's caller-only onboarding contract after
`AKISUITE_ONBOARDING_SCHEMA_READY` activation. Pending/negative declarations
redirect to the canonical same-language AkiPasa completion page. Separate domains
retain host-only sessions; that destination may request sign-in with the same
identity. No JWT, password, PKCE code or arbitrary return URL crosses products.
The shared database state takes effect on the next guarded request without client
cache authority. Existing accounts remain exempt. No schema, cohort activation,
terms version, subscription, ownership or routing setting changes here.

Native customer booking/saved API routes deny restricted accounts after identity
validation where present. The shared AkiPasa migration owns covered legacy mutation
guards. All remaining privileged endpoints and safety flows require joint
acceptance before enrolment activation. Completion currently returns to AkiPasa;
the user can switch products afterwards. This explicit central handoff avoids a
local completion redirect loop, but seamless authenticated cross-product resume
remains a separately gated enhancement. Legal, export, deletion and sign-out
remain reachable on AkiPasa's separate safety route.

## 2026-10-20 | Explicit cross-product language contract

AkiSuite selectors and management/operations handoffs now retain EN/ES using
canonical product-specific route formats. AkiHQ remains free management;
AkiBusiness remains paid operations. The synchronized suite-navigation v1
contract rejects external/query/fragment/path-traversal destinations and can
carry only bounded explicit workspace identity and a validated public referral
code. No auth token or account identity crosses domains in links. Existing
server membership checks remain authoritative. Focused tests pass; complete
CI/build and canonical authenticated acceptance remain release gates. See
`docs/SUITE_NAVIGATION_V1.md`. No schema, billing or customer data changes.

## 2026-10-20 | PostGIS reference-table client privileges

The shared PostGIS spatial_ref_sys table is extension-owned and retained without
RLS changes. A narrow mirrored migration revokes PUBLIC/anon/authenticated table
capabilities and restores only client SELECT, preserving other explicit role
grants, extension ownership and existing reference rows. Effective table/column
postconditions reject silent no-op/inherited-grant repairs transactionally.
See SPATIAL_REFERENCE_PRIVILEGES.md for role tests, executor prerequisites, live
geography acceptance and safe rollback. No live application is claimed by CI.

## 2026-10-20 | Validated referral task completion

Account completion preserves a single public referral code matching the existing
uppercase alphanumeric 8–24 character navigation bound. The canonical public
`/{locale}/referrals?ref=CODE` task returns to AkiPasa's explicit confirmation page;
other allowed product tasks retain their validated code and EN/ES choice through
the same fixed-origin resume envelope. Duplicate, URL-shaped, lowercase and
out-of-range codes are discarded. Direct unprefixed AkiPasa referral completion
uses this same sanitizer rather than falling back to Account.

This changes navigation only: pending/underage restrictions, legal and tracking
choices, first-attribution immutability and the explicit confirmation action remain
authoritative. No automatic attribution, referral cookie, identity transfer, schema,
financial incentive or production write is introduced. Shared contract copies and
role-controller regressions cover all five products and both languages. Hosted CI
and exact-source release checks remain required; unit fixtures do not establish
authenticated production browser acceptance.

Actual management Home and Claims entry now preserve the validated referral alongside bounded view/location keys before requireManagementHomeAccess or requireUser. Server authorization, claim ownership and consent remain unchanged. Pending and underage requests still reach completion in the same language.

Completion-resume scope correction retains the actual legacy property/company/organisation query names using the shared bounded allowlist; no scope authorisation or runtime pin change. See ACCOUNT_TASK_RESUME_V1.md.

## 21 October 2026 — reconciled scoped commercial observations

Reuses the reviewed HQ #63 read-only funnel projection on current main e2492a4f.
The compact dashboard, loyalty and current Next 16 features remain intact. Exact
listing scope plus unique active workspace mapping and current management access
are required; unavailable/unsupported scopes never show fabricated counts or
conversion rates. See TRUSTED_BUSINESS_FUNNEL.md for rollout and rollback.
The shared stage schema is installed but collection remains disabled and retention
NULL. This source does not change readiness flags, collection or billing state.
The HQ projection must be installed and real-caller ACL checks accepted before
reader readiness can be enabled.

Release-owner follow-up: the exact read-only HQ projection is now installed and
ACL-verified; AKISUITE_FUNNEL_READY=true is enabled for the reader only. Shared
collection remains disabled with retention NULL and no observations. Financial
checkout/tax gates remain false. Full current-source tests/build and 64 responsive
component cases pass; final hosted CI and deployment acceptance remain required.

## Explicit resource scope adapters

Native property reporting reads the native inventory namespace, not venue tables.
Independent rental workspace mapping is owner-confirmed and never creates a public
venue, subscription or organisation attachment. Organisation reporting uses explicit
operating_organisation_locations with current workspace/resource permission
intersections and bounded fanout. Original legacy reports remain the fallback while
the new adapter gates are false. See AKIPULSE_EXPLICIT_SCOPES.md.

## 2026-10-24 | Native shared account journey

AkiHQ now serves its own shared profile/settings forms and retains local
account and membership navigation. All editable fields use one atomic UPDATE
to the authenticated identity's existing public.profiles row; explicit column
validation excludes IDs, roles, entitlements and billing. Email changes and
password recovery use trusted same-product callbacks and the existing identity.
Name, username, bio, contact, locality/province, language and visibility therefore
follow the account across products without syncing copies or sharing cookies.
The form is withheld after a failed profile read; no blank overwrite is offered.
EN/ES, existing product shells, tenant permissions, saved/booking records and
separate identity/privacy safety gates remain authoritative. No SQL, provider
config, purchase activation or customer data is changed by the source release.
Shared source v1 mirrors have no sibling repository imports. Regression tests
cover both locales, field bounds, role/foreign-ID stripping and failed reads.
Full check/build, hosted CI and exact live-source acceptance remain required.
Rollback is a source revert; profiles and sessions are retained.

## 2026-10-25 | Shared icon family v3

Owner-requested burgundy Coches (#3B101B) and space-grey HQ (#252830) tiles
are synchronized across all five product selectors, favicons, Apple/PWA and
mobile icon sources. Coches uses the current car-free mark; black artwork has
a fine brand-colour edge for legibility. Pasa, Duermo and the purple AB geometry
are preserved. Default dark canvases match the tiles; light and selected owner
themes remain available. Versioned URLs and the static operating suite cache
refresh remove stale selector artwork. Stable PWA IDs and app identifiers remain.
No roles, links, data, billing, analytics, storage or provider configuration change.
See AKISUITE_ICON_FAMILY.md for dependencies, checks, native rebuild limitations
and source-only rollback. Local visual/asset validation and required CI are
separate from exact-source production and signed native-device acceptance.

## 2026-10-25 | AkiSuite navigation and surface continuity

Owner-authorized tightening preserves identity, tenant permissions, booking and
billing authority. Discovery membership audience now survives explicit Business
handoffs, reload and browser history without enabling checkout. Duermo/Coches
share one desktop rail/mobile dock component where available; Coches membership
retains its product header. Pasa's auth selector uses all five canonical brands
and origins. Duermo auth stays teal; HQ marketing and login use one request
language, keep readable dark-surface text, and expose header controls. Business
login gains local home/language/appearance controls retaining input only in memory.
Each repository carries only its affected subset. No schema, feature activation,
provider setting, customer record or native signing change. Source revert is the
rollback. Full source, browser/CI and exact production checks remain required;
device/authenticated acceptance must not be inferred from fixtures.

## 2026-10-25 | AkiSelector workspace login integration

Alex explicitly selected the existing private lab's AkiSelector for the public
login workspace chooser. All five apps appear: Pasa orange, Duermo teal,
Coches red/burgundy, HQ yellow/space grey and Business purple. Reuse the
engine's card scene, swipe, keyboard navigation and reduced-motion behavior
in a compact sign-in adapter. Previewing an app never submits, navigates or
replaces a login form; opening another app is an explicit localized action
with only the bounded referral code passed across origins. Current product
is selected initially. Mobile keeps the chooser after the sign-in fields.
The static operating app uses a DOM adapter and the same scene styles, with
no framework runtime or third-party dependency added. The private lab keeps
its administrator-only route. No pricing, session, tenant, permissions or
provider setting changes. Source revert is rollback. Source, responsive
browser, exact live source and physical device acceptance remain distinct.

## 2026-10-26 | Direct workspace icon navigation

Owner-requested sign-in refinement: the five icon cards are the navigation
links themselves. Remove the visible previous/next controls, caption/count and
separate Open/current-workspace row from every public login chooser. Swiping
and Arrow/Home/End browse the carousel without navigation or draft changes;
an explicit tap/click or Enter on an icon follows its canonical localized link.
Suppress the compatibility click after a horizontal swipe so it cannot open an
app accidentally. Current app identity uses aria-current; browsing is distinct
from authorization and never submits the sign-in form. The private lab keeps
its original radio-selection controls by default through an opt-in link mode.

Dependencies: identical React engine/adapter/CSS copies in Pasa, Duermo, Coches
and HQ; equivalent static Business adapter at both guest sign-in entries.
Business selector assets advance to v2 and production offline cache to 155,
with release assertions retained. Existing bounded referral-only href helper,
EN/ES, product icons/palettes, reduced motion, roving focus, 44px active targets
and phone placement after the form remain. No session, permission, identity,
price, tenant, API/provider, database, analytics or customer-data changes.

Validation: destination/keyboard/private-lab regressions plus responsive browser
checks for first-click icon navigation, swipe click suppression, retained draft,
no footer/actions, localized/referral-safe URLs and zero scene scroll. Complete
hosted source/browser/Cloudflare checks and exact live-source verification are
required before release; installed native/device acceptance remains separate.
Rollback is a source revert and renewed Business asset/cache versions.

### 2026-10-26 | HQ membership Pasa artwork

Use the v3 Pasa app icon beside the existing Duermo/Coches app icons in both
languages; the stacked wordmark is inappropriate in the square package badge.
No package, price, entitlement or destination changes. Rendered membership
regressions cover the selected icon; required CI/live verification remains.

## 2026-10-26 | Cinematic AkiSelector energy and transitions

The login selector now uses five distinct vector-mask materials: Pasa flame
tongues/cinders, Duermo tidal ribbons, Coches diagonal velocity trails, HQ
precision orbital tracks and Business spectral curtains. The existing generic
effect IDs remain compatible with the private lab. Every activation has a
brief lens flare, dissipating wave and glass reflection. Outgoing artwork stays
mounted for a 650ms opacity decay; incoming energy ramps over 280ms while card
travel eases over 680ms. Interrupted changes converge via CSS transitions,
without JavaScript animation frames or timeouts. Inactive material loops pause.

Mouse hover previews only energy and retains selection, roving focus, current
app and href geometry; pointer exit restores selected energy. Touch/pen retain
swipe browsing and direct icon navigation with the compatibility-click guard.
Keyboard input clears hover preview. EN/ES, referral-only links, preserved
login drafts, mobile placement and administrator-only lab boundaries remain.
Both explicit motion-off and OS reduced motion remove loops/transitions/flare.

Dependencies: shared React engine/CSS in Pasa, Duermo, Coches and HQ; equivalent
DOM adapter and identical CSS in Business. Business engine CSS, adapter CSS and JS URLs advance to
v2/v3/v3 and its effective paid release cache to v156, including release assertions.
No authentication exchange, session, API, tenant/role, database, storage,
analytics, payment, provider configuration or Android binary change. This is
web-delivered presentation. Rollback restores source and advances static asset
versions/cache again. Source and real-browser evidence is recorded in the PR;
full CI, production deployment and physical-device acceptance are separate gates.

## 2026-10-26 | Product-specific AkiSelector opening stories

The five login choices opt into an optional product arrival independently from
the reusable ember/breeze/bloom/solar/aurora idle effect. Pasa drops a discovery
pin and sparks; Duermo rolls and softly lands a suitcase; Coches sends a red
coupe with spinning wheels and a light wake across the foreground; free AkiHQ
gathers locations into a management hub; operations AkiBusiness wakes a till
and prints a receipt. Each decorative vector story plays once over 1.25–1.7s,
then disappears as its material rises into the sustained hovering/orbit phase.
The Coches idle is slower and includes a red orbital arc. Returning to an app
restarts its story; uninterrupted idle does not replay it. Generic lab effects
remain compatible without product stories unless the caller opts in.

Dependencies: AkiSelector option arrival, WorkspaceSelector adapter, shared CSS
and the equivalent static Business DOM adapter. All artwork is inline SVG masks
and CSS; no image/provider calls, animation timers or new packages. Decorative
actors ignore pointer events and are hidden from assistive technology. Direct
links are immediate, with no animation wait; browsing, safe referral/locale
URLs, drafts, keyboard focus, swipe suppression and auth/session/permissions
remain intact. Reduced motion and motion-off hide opening stories and keep
static idle artwork. Business engine CSS v3 / adapter CSS v3 / JS v4 and the
effective release cache v157 advance together with release assertions.

Validation includes all five actual actor animations becoming visible, finishing
once and handing off to full idle opacity, plus source/component/browser parity.
The current report records completed checks and separate broader map acceptance.
No production data, SQL, storage, billing, analytics, provider configuration or
Android binary changes. Source revert plus fresh static versions is rollback.
GitHub publication is still awaiting the explicit authorization requested earlier;
no push, PR, merge or deployment is implied by this design refinement.

## 2026-10-26 | Mouse dragging, corner arrows and branded login names

The public login AkiSelector supports primary-button mouse dragging alongside
touch/pen swipes. Cards follow a bounded horizontal pointer offset; capture
starts only after 10px of horizontal intent, leaving ordinary clicks and
vertical touch scrolling intact. Release outside the scene is supported. A
45px horizontal release browses one enabled option, with wraparound; shorter
drags snap back and suppress their compatibility click. Pointer cancellation
and capture loss clear temporary offsets. Modified/right/middle clicks retain
ordinary link behavior, and starting a later pointer/keyboard action clears the
click guard. Native HTML link/image dragging is prevented within the scene.

Two localized, keyboard-accessible 44px circular arrows sit in the lower scene
corners. They browse in place without submitting, navigating or replacing the
login form; the separate footer/caption stays hidden. Generic lab callers opt
in via showBrowseArrows. Names use the individual product accent and self-hosted
Poppins Semibold 600, with a dark label backing for legibility over effects.
The Latin WOFF2 is vendored from @fontsource/poppins 5.3.0 with its SIL OFL;
requests stay on the app's own origin. Existing startup/idle artwork, motion-off,
reduced motion, EN/ES/referral-safe hrefs, current-product semantics, drafts and
auth/session/role behavior remain. No API, database, billing, analytics, provider
or native Android binary change.

Shared React engine, adapter, CSS and font assets are copied across four Next
apps; Business has an equivalent DOM adapter and matching assets. Business
engine/adapter CSS v4, JS v5 and paid release cache v158 include the font and
retain production assertions. Acceptance covers real mouse capture/release
outside the scene, follow-pointer geometry, short-drag suppression, immediate
subsequent clicks, arrows/wraparound/keyboard, touch and cancelled gestures,
loaded font/brand colours and responsive label bounds. Regression evidence is
recorded in the PR; exact-head CI and production verification gate release.
Rollback restores source with fresh static cache/asset versions; no data rollback.

Capture-transfer follow-up: descendant lostpointercapture events are ignored;
only loss on the scene cancels its gesture. Mouse movement with no primary
button held clears a pending gesture after an uncaptured outside release.
Acceptance now uses real Chromium touch input originating on a card descendant,
and covers outside vertical release followed by ordinary mouse hover.

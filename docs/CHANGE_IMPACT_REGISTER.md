# Change Impact Register

## 2026-10-21 | Supported Next/OpenNext runtime

- Replaces unsupported Next 15.5.28 with stable Next 16.4.2 and pins the
  matching ESLint, OpenNext Cloudflare 1.20.12 and Wrangler 4.151.3 toolchain.
- Preserves the existing Webpack/map alias, explicit server-action limit,
  signed-image cache behavior and React Compiler-off hydration behavior.
- No route, auth, role, RLS, schema, billing, customer data, Worker name/domain
  or feature-gate change. Full tests, optimized build, clean OpenNext package,
  dry-run, hosted CI and exact-SHA live acceptance are required before release.

## 2026-10-17 | AkiHQ management cross-site launcher

- Scope: AkiHQ management portal's shared header menu and local suite assets.
- Before: menu omitted AkiCoches and role-swapped names/URLs were ambiguous.
- After: all five canonical AkiSuite origins with correctly mapped free AkiHQ
  and paid AkiBusiness roles, true logo identity, localized current-product state.
- Dependencies: deployment role-swap environment remains authoritative.
  Existing business/property/fleet ownership, permissions, bookings, claims,
  authentication and SQL are untouched.
- Verification: formatting/lint/type/test, preview build and browser menu
  interaction pending hosted CI; release-branch deployment not assumed live.
- Rollback: revert header logo/menu/CSS-only changes.

## 2026-10-15 | Venue-scoped AkiCoches management

The AkiCoches entry moves from the top-level Business navigation into each
non-accommodation venue dashboard. A venue owner/manager can activate one linked
rental company, add/edit vehicle rates, cover and visibility, block dates and
decide rental requests. The same venue media library is available within the
fleet screen for upload, selection and removal; the legacy mobility route stays
reachable for existing unlinked companies. The fleet screen uses a wider canvas,
scarlet accent and shared light/dark venue tokens.

This depends on the mirrored AkiPasa migration
`20261015135805_akicoches_venue_workspace`: venue/cover FKs, scoped RLS,
legacy owner compatibility, protected cover/venue association and manager
authorization in the booking status RPC. The independent AkiCoches catalogue
uses the same shared records and signs only permitted published venue covers.
No confirmed booking or payment is fabricated; AkiPasa retains shared jobs.
Roll back the application versions independently; the additive schema and
owner index change require a reviewed forward migration, not deleting records.
Provider-backed owner/other-tenant media, availability and booking acceptance
must still be checked on the actual canonical hosts.

## 2026-10-15 | Bounded cross-origin query inspection

An actual canonical subscription handoff with a dummy nested callback code
forwarded that code inside next. The Business external-only adapter now uses the
same reviewed bounded query helper as AkiCoches, copied without runtime imports
from sibling repositories. It removes opaque navigation wrappers and detects
encoded/nested credential assignments, JSON escapes, wrapped keys and URL userinfo;
excessive or malformed values fail closed. Safe filters and attribution remain.
Shared helper regressions plus real Business middleware EN/ES tests verify external
removal and unchanged local PKCE code/state. Browser smoke includes the nested URL
and JSON cases. No real credentials, password reset, account/logout mutation,
database, legal-gate or custom-domain changes are made by these checks. Rebuild,
current-head CI and actual provider HTTP checks remain release requirements.

## 2026-10-15 | Host session logout isolation

Before: both copied Business auth actions called `signOut()` without a scope,
which defaults to invalidating all refresh sessions for the shared account.
After: normal logout passes `{ scope: "local" }`, leaving other product sessions
outside this action's scope. Successful password recovery passes explicit
`{ scope: "global" }` to retain account-wide revocation after a password change.
Existing locale-safe redirects and recovery failure paths remain. Regression
coverage invokes the real server actions against an inert auth client and checks
the requested scope for EN/ES and invalid-locale fallback; failed recovery does not
call logout. No real account, cookie, database, entitlement, credential or provider
setting is changed by verification. Redeployment at the final validated SHA is
required; authenticated acceptance remains pending. Preserve any user-configured
domain bindings during deployment. Source/Worker version revert is rollback, with
no data restoration.

## 2026-10-15 | Independent Business claim and credential handoff repair

The extracted claim picker referenced an absent consumer map route. Its new
management-only public catalogue lookup restores the initial venue name and
activities/accommodation vertical through the existing privacy-safe ownership RPC;
unknown ownership fails closed. Initial claims now work without reintroducing the
consumer map API. Cross-product redirects also strip credential query names
case-insensitively, including duplicates, client secrets and provider state; safe
locale/product context remains. The hash is still replaced before handoff.
Existing authenticated claim submissions, RLS and tenant authorization are unchanged.
No schema, data, billing, scheduler or production route change is included. Scoped
endpoint/query regressions, full checks and actual Cloudflare packaging are required;
provider-backed auth acceptance remains a release gate. Revert source/Worker to
roll back; existing shared records require no restoration.

## 2026-10-14 | AkiConduzco mobility foundation (implementation candidate)

- **Request / before:** AkiPasa has no car-rental discovery or fleet tools. Its
  general venue vertical only models activities/accommodation, and the existing
  AkiBusiness venue claim flow is not appropriate for a rental marketplace.
- **Implemented:** add an independent AkiConduzco brand and host, rental
  company/vehicle/availability/request records, public list/map/search, account
  booking view and a separate AkiBusiness mobility workspace. Rental operators
  create a pending listing directly; no venue claim is used. Booking requests
  require owner confirmation; no payment or automatic confirmation is implied.
- **Dependencies / impact:** middleware host/path/method routing, SSR auth
  callbacks and safe destinations, localized EN/ES copy and metadata, PWA
  branding, public API bounds, Supabase RLS and tenant ownership, availability
  conflict checks, sitemap/robots policy, business navigation and deployment
  host routing. Existing AkiPasa/AkiDuermo discovery, venue ownership and claims
  remain unchanged. No external business data is imported by this change.
- **Acceptance matrix:** anonymous/authenticated visitor and operator; EN/ES;
  mobile/desktop; empty/error/loading/populated states; public vs pending
  company visibility; owner vs unrelated user; unavailable dates; booking
  request/owner decision; safe login return; map route; host branding.
- **Evidence:** schema and account-owned `TEST ONLY` company are present in
  development Supabase project `vhpbvcfkcteswlsdjrfl`; the test company is
  pending review and cannot appear in public search. Product route, API,
  operator tools, staff queue, account surface, sitemap and host routing are
  implemented. Formatting, lint, TypeScript, production build, database safety
  and conflict tests, automation checks, and all secondary product suites pass;
  23 focused AkiConduzco/PWA/staff cases pass. The full root suite passed 626
  cases but hit its existing 5-second timeout in the unrelated PGlite Spanish
  text test; that test passes in isolation. Production schema, production
  DNS/Worker route, Auth redirect allowlist, deployment and live booking are
  not established.
- **Rollback:** remove the new routes/components/migration and product branding;
  if the additive schema migration has been applied, use a separately reviewed
  forward migration rather than dropping customer records.

## 2026-10-14 | Individual venue event search and pagination (PR #172)

- **Scope:** AkiBusiness per-venue Events workspace and new client-side browser.
- **Before:** every event and its potentially large editing form appeared in an unbounded accordion list.
- **After:** EN/ES title/status search, current/past/archived filters, counts, nine-per-page pagination, and responsive 3/2/1-column event grid. Expanded editor spans full width; existing deep links reveal the correct event.
- **Dependencies:** existing Supabase event reads, publish/edit/delete/occurrence actions, venue access, and main events catalogue remain unchanged.
- **Validation:** focused UI and formatting checks plus contract gate required before merge; production verification required after merge.
- **Rollback:** revert component and workspace rendering changes; no data or schema rollback.

## 2026-10-14 | Membership blocked-action guidance

- **Inventory:** MEMBER-01.
- **Before:** some disabled cards retained “Choose plan” or add-on language even
  when access was unreadable, another plan overlapped, no workspace existed or
  AkiHQ Pro was missing.
- **After:** every blocked card states the applicable EN/ES reason and uses a
  matching disabled label. Recoverable states link to the existing account access,
  billing, retry, workspace setup or AkiHQ Pro section.
- **Dependencies:** seven-plan visibility, effective/overlapping-plan resolution,
  checkout readiness, workspace selection, add-on eligibility and Stripe actions
  remain authoritative and unchanged.
- **Evidence:** AkiSuite rendering covers included plans, closed checkout, missing
  workspace, add-on eligibility and failed access reads with their recovery links.
- **Rollback:** revert component/style/page/tests/docs; no billing or data rollback.

## 2026-10-14 | Passport status localization

- **Inventory:** PASS-03.
- **Before:** reward and enrollment cards exposed backend state values, and several
  Spanish notices omitted accents.
- **After:** ready/redeemed/expired claims and active/completed/redeemed/expired
  enrollments use explicit EN/ES labels; unexpected values use a localized safe
  fallback. Spanish Passport copy is corrected throughout the affected page.
- **Dependencies:** state identifiers, reward/enrollment actions, claim codes and
  Europe/Madrid deadline formatting remain unchanged.
- **Evidence:** focused status-map cases cover every stored value and unknown/null
  fallbacks; Spanish text integrity, Spotlight, TypeScript and lint remain gates.
- **Rollback:** revert helper/page/tests/docs; no schema or record changes.

## 2026-10-14 | Privacy withdrawal recovery

- **Inventory:** PRIVACY-01.
- **Before:** a failed account POST left the personalization checkbox visibly On
  even though local consent and queued optional behavior had already been removed.
- **After:** withdrawal immediately renders Off locally. A failed account sync says
  exactly what happened and offers a retry that posts the current local analytics,
  personalization and marketing choices without re-enabling consent.
- **Dependencies:** existing consent cookies/version, behavior-queue removal,
  consent API, account setting and global consent-change event remain unchanged.
- **Evidence:** component coverage exercises a failed withdrawal, preserved
  analytics choice, explicit retry and successful recovery.
- **Rollback:** revert component/test/docs; server and local formats do not change.

## 2026-10-14 | Account collection management

- **Inventory:** ACCOUNT-02.
- **Before:** saved and followed pages read every reference into one static card
  grid; people had to open an item detail to remove it.
- **After:** both collections use exact counts, stable created-at/key ordering,
  24-item server pages and localized name search. Each card exposes an authorized,
  pending-aware remove action with localized success/failure feedback; stale page
  numbers recover to the last available page.
- **Dependencies:** existing per-profile reference tables/RLS, current catalogue
  label refresh, reminder opt-in, account overview counts and export reads remain
  authoritative. Removal records the existing trusted unsave/unfollow behavior.
- **Evidence:** Account collection rendering covers search, totals, paging and form
  return state; all 65 Account cases, TypeScript, lint and formatting are release
  gates on the final stacked head.
- **Rollback:** revert application/tests/docs; no schema or stored-data migration.

## 2026-10-14 | Actionable authentication feedback

- **Inventory:** AUTH-03.
- **Before:** every authentication category displayed the same generic notice;
  affected fields were not associated with it, safe email entry was lost, and
  submit buttons gave no pending state.
- **After:** EN/ES alerts explain email format, password policy/mismatch, terms,
  credential retry and expired-link recovery while retaining account-existence
  privacy. Email alone is restored from same-tab storage; passwords are never
  stored. Form-status buttons disable and announce their pending action.
- **Dependencies:** existing server error taxonomy, Zod/password validation,
  provider rate limits, Terms controls and redirect allowlists remain unchanged.
- **Evidence:** rendered auth/control tests cover safe restoration, pending state,
  error roles and field associations; existing action suites remain green.
- **Rollback:** revert component/page/tests/docs and clear optional tab storage; no
  account, provider or database rollback.

## 2026-10-14 | Password recovery task continuity

- **Inventory:** AUTH-02.
- **Before:** Forgot-password discarded the original membership, claim or stay
  destination; the reset callback targeted only the recovery form and a completed
  reset returned to generic sign-in.
- **After:** one origin-aware allowlist carries the task through the recovery email,
  callback, update form and required fresh sign-in. Validation, provider, missing
  session and expired/reused callback paths retain the same safe task.
- **Dependencies:** public/AkiDuermo host routing, Supabase PKCE callback/session,
  existing password policy, sign-out-after-reset and Terms guard remain unchanged.
  Passwords and provider codes are never copied into the task query.
- **Evidence:** 18 focused auth-action/recovery cases plus public and AkiDuermo
  nested-destination security cases pass; TypeScript and scoped lint pass.
- **Rollback:** revert source/tests/docs; no session or database migration rollback.

## 2026-10-14 | Creator review draft recovery

- **Inventory:** completes PUB-09.
- **Before:** review outcomes and the creator return path were visible, but a failed
  insert, validation redirect or sign-in handoff discarded the typed review.
- **After:** the review form records its rating/body in session storage before the
  server action, returns from sign-in with a bounded recovery marker, reopens the
  disclosure and restores the draft. A normal or submitted page clears stale data.
- **Dependencies:** existing review validation, requireUser/Terms handoff,
  creator_reviews moderation/RLS and result notices remain authoritative. No review
  is auto-submitted and no persistent cross-tab storage is introduced.
- **Evidence:** 17 focused action, profile and draft cases pass, including all three
  failure/auth returns and clearing outside recovery.
- **Rollback:** revert source/tests/docs; session drafts expire with the tab and no
  database rollback is needed.

## 2026-10-14 | Discovery filter recovery

- **Inventory:** PUB-17.
- **Before:** inverted price/date ranges silently produced empty discovery results,
  selected filters had no direct removal controls, and the 100 km empty-state
  action linked back to the same ineffective radius.
- **After:** EN/ES range errors remain beside the filters and block navigation;
  active filters can be removed individually or together with focus returned to
  the search panel. At the maximum radius, the empty state offers a clean area
  and filter reset.
- **Dependencies:** existing URL filter names, discovery defaults, native field
  constraints, recommendation queries and list/Map routes remain authoritative.
  No API, schema, permission, ranking or stored-data change is included.
- **Evidence:** 59 focused validation, active-filter and public empty-state cases
  pass. TypeScript, lint, formatting and the full Spotlight suite are final gates.
- **Rollback:** revert application/helper/tests/docs; no data rollback is needed.

## 2026-10-14 | Mobile More focus containment

- **Inventory:** PUB-16.
- **Before:** the aria-modal More sheet moved focus only on open; keyboard focus
  could leave the dialog, the background stayed interactive and closing did not
  restore the opener.
- **After:** background shell siblings are inert, forward/reverse Tab cycle through
  the sheet, and Escape/backdrop/button/route cleanup restores scroll, prior inert
  state and the mounted opener.
- **Dependencies:** AppShell destinations, capability gates, localized labels,
  GlobalSearch, theme and layout CSS remain unchanged.
- **Evidence:** WorkspaceShell/AppShell passes 15/15 including focus endpoints,
  background inert state, Escape cleanup and opener restoration; TypeScript passes.
- **Rollback:** revert source/test/docs; no persisted state or data rollback.

## 2026-10-14 | Event occurrence and stay handoff

- **Inventory:** PUB-11, PUB-12, PUB-13 and PUB-14.
- **Before:** a card displayed one occurrence but detail independently chose another;
  downstream booking/calendar/return routes dropped occurrence identity. Ended
  scheduled events could still offer booking. Stay search always used the organizer
  venue coordinates, and copy still described AkiDuermo as a non-booking preview.
- **After:** a selected event-owned occurrence survives the full public journey;
  invalid IDs fall back safely. Ended/cancelled/postponed/sold-out states govern
  actions truthfully. Custom event coordinates drive stays, and request-only,
  property-confirmed, no-online-payment behavior is explicit.
- **Dependencies:** existing event/occurrence repository rows, booking settings and
  slots, booking RPC, entitlement check, calendar builder, engagement actions and
  AkiDuermo query contract remain authoritative. No schema, RLS, provider, payment
  or stored-record changes.
- **Evidence:** 34 focused occurrence, detail, card and booking-action cases pass,
  including exact/fallback selection, ended actions, custom coordinates and preserved
  success/error returns. TypeScript passes; full Spotlight, lint, formatting and
  production build remain final stacked-head gates.
- **Rollback:** revert application/helper/tests/docs; no data rollback is needed.

## 2026-10-14 | Discover and Map filter continuity

- **Inventory:** PUB-05 and PUB-15.
- **Before:** primary navigation and the no-results Map action discarded some or
  all active discovery filters. Map's visible list honored selected filters while
  initial event pins came from a separate nationwide, unfiltered query.
- **After:** desktop/mobile switches share one bounded allowlist for location,
  radius, time, category, price, dates and accessibility; list/pagination state is
  deliberately reset. Initial pins and list cards use the same filtered result set.
- **Dependencies:** recommendation ranking and request IDs, map venue tiles,
  clustering, popups, selected centre, geolocation and ResultPagination remain
  unchanged. No query is broadened, no permission prompt is added and no stored
  data changes.
- **Evidence:** 57 focused discovery cases cover filter URL allowlisting, exact
  no-results handoff and filtered pin inputs; WorkspaceShell passes 14/14 including
  desktop/mobile link continuity. TypeScript, scoped lint, formatting and diff
  checks remain required on the stacked head.
- **Rollback:** revert application/helper/tests/docs; no data rollback is needed.

## 2026-10-14 | Community contribution recovery

- **Inventory:** PUB-06, PUB-07 and PUB-08.
- **Before:** form errors discarded suggestion/report fields; report target selects
  loaded an unbounded catalogue and could omit a directly linked item; catalogue,
  history and feature-flag failures appeared paused or empty.
- **After:** tab-local drafts restore after validation, RPC and rate-limit returns,
  including the selected precise address. Target search is capped at 50 per type,
  treats punctuation as literal text and separately loads a valid selected UUID.
  Search/auth/retry context remains intact. Independent unavailable reads show retry
  and withhold only forms or histories that require the failed data.
- **Dependencies:** existing `submit_community_event`/`submit_report` RPCs,
  Zod/Madrid-time validation, automatic moderation, authenticated access and RLS
  remain unchanged. Draft data is session storage only; no schema or stored-data
  change is included.
- **Evidence:** full Spotlight suite passes 191/191; 55 focused public/draft cases
  cover all read failures, bounded/escaped exact target search, clean zero/empty
  paths and precise-address restoration. Feature-flag state tests pass 3/3;
  TypeScript, scoped lint, formatting and diff checks pass.
- **Rollback:** revert source/tests/docs. Browser session drafts expire with the tab;
  no database rollback or provider replay is required.

## 2026-10-14 | Accommodation and member Passport read recovery

- **Inventory:** BS-05 and PASS-01.
- **Before:** six property-workspace reads discarded errors, so failed inventory
  and reservation reads appeared as zero/empty and failed settings appeared as a
  paused booking mode. Seven Passport reads discarded errors, turning outages into
  zero XP/stamps, empty routes/claims and unsafe start or reward decisions.
- **After:** the active property tab checks its precise dependencies, shows retry
  and withholds its forms when unknown; unaffected tabs stay usable. Passport
  catalogue and personal reads fail independently, unknown totals render as dashes,
  and actions/badges/progress/claim codes remain hidden until required reads succeed.
  Successful empty results remain truthful empty or zero states.
- **Dependencies:** existing server actions, ownership/RLS, inventory overlap and
  capacity rules, booking transitions, reward calculations and enrollment/claim
  validation remain authoritative. There are no schema, grant, data or provider
  changes.
- **Evidence:** accommodation manager cases pass 7/7 and the Account/Passport suite
  passes 64/64, including eight seven-read recovery cases. TypeScript and scoped
  lint pass. Integrated CI, browser suites and exact deployed-source verification
  remain release gates for the final rebased head.
- **Rollback:** revert application/tests/docs; no stored-data rollback is needed.

## 2026-10-14 | Independent operational read recovery

- **Inventory:** AS-17, AS-19, AS-29, AS-30, BS-06, PUB-18, the remainder of
  ACCOUNT-01, and the visible
  outcome/auth-return portion of PUB-09. Review draft retention remains open.
- **Before:** Admin search retained stale accounts and accepted late responses;
  failed moderation mode appeared manual; personalisation RPC failure appeared as
  zero activity plus an unproven migration diagnosis and invented ranking defaults;
  failed venue analytics appeared empty; Passport campaign and venue failures both
  silently became empty arrays, leaving creation decisions based on unknown data.
  Public creator outages appeared as empty directories or missing profiles, and
  review redirects had no rendered outcome or task-specific auth return.
- **After:** search clears on each query, rejects superseded responses and exposes
  explicit retry. Mode, personalisation, per-venue analytics, campaigns and venue
  choices each expose localized unavailable states and retain independently healthy
  content. Confirmed zero metrics remain zero. Missing ranking configuration has a
  distinct truthful state. Passport creation is withheld only when its venue
  dependency is unavailable. Creator directory/profile outages have retryable
  states; literal bounded filters survive retry, true missing profiles retain
  not-found, and review outcome/auth return point to the selected profile.
  Account collections refresh currently readable localized event titles, venue
  names and slugs by UUID while retaining stored fallbacks for unavailable or
  legacy records.
- **Dependencies:** existing administrator/staff/business access guards, tenant
  queries, moderation action, `personalisation_admin_metrics`, `venue_analytics`,
  Passport creation action and server/RLS enforcement remain authoritative. No
  query scope, action payload, mutation, schema, grant, pricing, payment flag or
  customer record changes.
- **Evidence:** focused Admin failure/empty tests pass 24/24, Staff failure and
  moderation tests 40/40, user-search race/retry tests 4/4, and business-loader
  analytics tests 6/6. Creator read/outcome tests pass 7/7 and review action
  return/validation tests 3/3. TypeScript, formatting, the integrated repository check,
  browser CI, Cloudflare packaging and exact live-source verification remain
  release gates for the final rebased head.
- **Rollback:** revert application/tests/docs. No data rollback, replay, provider
  call or migration is required. Authenticated production-role acceptance remains
  separate from fixture evidence.

## 2026-10-14 | Approved workflow continuity batch

- **Inventory:** PUB-10, NAV-01, SUPPORT-03/04, AUTH-04, AS08/09/10/11/13/14/15/33/34,
  BS-26, PASS-02 and the locale-link part of ACCOUNT-01. Current-title lookup is
  completed by the next recovery batch; complete paging/actions remain separately
  tracked.
- **Before:** cards rounded monetary cents; hidden prices leaked into map popups;
  stored locale links ignored current language; failed questions required retyping;
  new replies could be below view; Staff headings clipped/repeated; narrow brand
  words split; stay reservation spans concatenated; several Admin failures appeared
  empty and saves had no acknowledgement; AI failures were hidden when agents
  loaded, zero budget became EUR4, and mixed-author/audience chats were unlabeled.
- **Trace:** shared event formatter -> card/map/detail; existing collection refs ->
  canonical local URL rewrite; shared role-gated WorkspaceShell -> localized labels;
  Staff layout/scoped styles and stay manager styles -> existing controls/actions;
  Support state -> same-origin chat endpoint/provider; authorized Admin loaders ->
  independent read outcomes and guarded existing editors; AI metadata/usage reads ->
  loaded-sample presentation, with authoritative server budget/tool checks retained.
- **Evidence:** 163 focused cases pass, including 36 new failure/retry, exact-price,
  locale-link/navigation, zero-budget and independent-read cases. TypeScript passes.
  Staff/Admin 80, stay-manager 48 and Support 24 real-browser cases pass in EN/ES,
  both themes and responsive/short windows. Strengthened Staff geometry checks
  initially found omitted imported route CSS in the harness; the corrected harness
  uses bundled production styles and preserves the strict padding assertions.
  Full checks, responsive browser/hosted CI and actual deployed-source verification
  remain required before release. No timeouts or assertions are relaxed.
- **Safety/rollback:** code-only; no migrations, RLS/roles, paid activation,
  automatic provider retries or customer-data changes. Revert source to roll back;
  preserve existing stored records and provider outcomes. Authenticated/device
  acceptance remains distinct from component/fixture evidence.

## 2026-10-14 | Approved GUI and workflow release batch

The user approved all upgrades, implementation and live merging on 14 October.
This batch reconciles prepared code onto master `6fb9fae`; it preserves upstream
public-media, catalogue visibility and localized commercial labels. Historical
no-commit limits below describe the preparation stage, not current authorization.
No schema changes or payment activation are included. Fresh current-head checks,
CI and exact deployed source must pass before reporting the batch as live.

- **Request:** audit GUIs, user experience and workflows, list concrete upgrades,
  prepare reviewable improvements, and notify the user before committing anything.
  Public baseline `8613edbd962a978dc3d85f9f7b9aafcc4da54a56`; separate current
  AkiHQ and the older CRM branch are identified independently in the audit artifacts.
- **Before editing:** read mandatory guidance and dependency contracts, inventory
  routes and controls, inspect existing PRs, and record per-domain before/after
  traces. The review distinguishes confirmed defects, proposals, validation gates
  and existing work rather than treating historic release notes as current proof.
- **Public:** map/discovery date parsing disagreed in winter/DST; homepage claimed
  venues showed Unclaimed; contribution actions/auth returns landed in creators
  and lost visible feedback/target. Reuse Madrid validation, render existing
  claim state and preserve validated workflow URLs. Original RPCs, permissions,
  automatic review, map rendering and record selection remain intact.
- **Identity/support:** authentication failures lost safe next/mode. Support's
  modal lacked keyboard containment/restoration and could crop its composer.
  Reuse existing host-specific return allowlists; preserve signup/provider/Terms
  behavior. Add dialog focus/scroll lifecycle and bounded responsive content;
  provider request payload, transcripts and anonymous email fallback remain intact.
- **Accommodation:** Past omitted real completed/declined states; room booking
  discarded validated trip intent; manager/customer statuses exposed raw enums and
  filtered lists lacked feedback. Correct read predicates, editable per-property
  defaults and display labels without altering booking status transitions,
  authorization, capacity, quotes, idempotency, inventory or notification actions.
- **Staff/Admin:** failed reads masqueraded as empty queues/stable operations;
  event search omitted English titles and Manage event opened the venue rather
  than the selected editor. Add explicit localized recovery, safe bilingual
  search and authorized-record selection. City form omitted coordinate fields
  while saveCity substituted Madrid, making name/timezone saves destructive.
  Retain loaded geography coordinates and require explicit validated values;
  preserve the existing administrator check, RPC, audit reason and timezone.
- **Matrix/dependencies:** EN/ES, light/dark, phone/tablet/desktop and short
  windows, authenticated/anonymous/role gates, success/empty/loading/error,
  keyboard, query punctuation, DST, geography response shapes and real action
  payloads. AkiHQ modal/form fixes are in its separate local repository; Android,
  automation and remaining upgrade items have acceptance/dependency plans.
- **Scope/rollback:** no commit, push, PR, deploy, paid activation, provider send,
  live customer-data mutation or database migration. Source changes are
  reversible; stored data and existing server/RLS authorization are preserved.
  Open PRs #103/#133/#136/#140/#143/#151/#152 and legal #8 retain their ownership.
- **Verification at preparation:** focused route/action/component regressions,
  isolated baseline reproductions, peer review and synthetic real-browser
  matrices run locally. Final integrated results and browser limits are recorded
  in the generated review artifacts. Required current-head CI, clean Cloudflare
  packaging, authenticated staging/live acceptance, actual PostgreSQL geography
  readback and physical devices remain separate gates. No production success is
  inferred from a fixture, source change or passing local test.

Final local source checks pass: formatting, zero-warning lint, TypeScript,
1,011 application tests, two database-conflict cases, database safety, 41
automation tests and the ordinary Next production build. The full command
initially stopped at Wrangler's unwritable global configuration directory;
the same automation check (including dry-run) passes with task-local XDG
configuration/log paths, followed by a successful production build. No timeout
or assertion was weakened. A stale fixed-CTA source assertion was updated and
actual EN/ES business-priority behavior is regression-tested.

Focused real-browser matrices pass: Support 24, stay/manager 48, Staff/Admin 80,
HQ dialogs 16 and portal Home 64 combinations. Independent city geography
reproduction passes 27 cases. Separate HQ full checks pass 350 cases with one
existing actual-workbook fixture skip. The broad Account run stopped on a
navigation timeout; its isolated subscription follow-up passes 34 cases and
does not establish the complete Account matrix. Exploratory local development
routes completed 54 of 56 snapshots, with two membership hydration/theme
failures retained for production-run investigation. Final production E2E,
current-head CI, actual protected sessions/device behavior and clean Cloudflare
packaging remain separate evidence. Packaging correctly rejects the uncommitted
candidate under the user's no-commit instruction.

During final review, upstream PR #152 merged at
`7311ae9f6550f9dabf96a39c7782287bbacb303c`. The local candidate reconciles onto
that existing commit without creating a new commit, preserving the map naming
and normal static-asset transport repairs. Original full checks/browser builds
are identified by their `8613edbd` baseline in the review evidence; targeted map
and type checks establish reconciliation compatibility, while current-head CI
and release acceptance remain required after the user's commit approval.

Final nested-dialog review reproduced Support Escape reaching an outer menu's
earlier document/window handlers. Its keyboard listener now owns the capture
phase while open, preventing both menus closing together and preserving the
outer scroll lock. The failing-before/passing-after regression also proves outer
Escape handlers resume after Support closes. All 23 auth/support cases and the
fresh 24-case Support browser matrix pass; payloads and provider calls are unchanged.

Broad production-server acceptance records 143 passed, two local Google-enabled
fixture-setting failures and 29 intentional separate-suite/credential skips.
Both auth contract cases pass after rebuilding the reconciled source with the
intended Google flag. The separate venue/event suite is recorded independently
in the review artifacts, and protected production acceptance remains unrun.

The separate Spotlight venue/event suite passes 28/28 on the reconciled source,
including EN/ES, both themes, responsive layouts, real action/menu/SEO contracts
and strict synthetic-read fixture boundaries. The two corrected auth cases plus
those 28 cases cover the first broad run's setup failures and separate-suite
skips; the single credential-gated authenticated production case remains unrun.

## 2026-10-13 | Recovered claim-picker overlap from PR #97

- Before: `.claim-search-results` used absolute `top: 7.8rem`; additional business-type controls and wrapped headings can place results over the search input. Current master retained the defect despite later claim form releases.
- After: results follow the actual input in normal flex flow, with the existing bounded scrolling and selection/clear behavior preserved. Applies to EN/ES, activity and accommodation searches, both themes and phone/tablet/desktop.
- Dependency trace: `ClaimVenuePicker` -> existing `/api/business/claim-search` and `/api/business/claim-map` -> authorised claim submission. Only results geometry changes; no component/API/RPC/role/SQL/storage/email/billing/analytics/consent changes. Map network and selection semantics are unchanged.
- Regression: real-component browser harness uses disposable search responses, verifies wrapped headings, populated/empty results, input/result/map geometry, list scrolling and selection/clear at six widths in both locales/themes. Map rendering and authenticated production claiming are not covered. Added to existing tablet CI, which retains all its previous steps and artifact upload.
- Validation: pending execution; no merge or deployment claimed. Rollback: revert results CSS and harness/workflow addition, with no data migration.

## 2026-10-13 | Compact memberships with official app brands and sector tools

- **Request:** Reduce excessive desktop/tablet/mobile scrolling and wasted horizontal space; restore the useful sector selector and make packages identifiable by original app marks.
- **Change:** Shared seven-plan catalogue uses a four/two/one-column responsive grid, compact collapsed mobile details, original PWA/brand icons for each product, paired HQ/Business add-on icons and four-icon Enterprise grouping. The six existing business categories highlight tools from the existing `business-packages.ts` Standard/Pro allowlist, with the complete tool list available by disclosure.
- **Dependencies:** `AkiSuiteMembershipGrid.tsx`, module CSS, `business-packages.ts`, existing public logo assets, shared account/public membership entry points, EN/ES and light/dark display.
- **Security and billing:** No checkout enablement, new plans, grants, workspace authorization, Stripe price or database modifications. Business sectors only change marketing previews, never entitlement checks.
- **Regression:** Membership source tests and rendered subscription test updated to expect the six-option business selector; require format, lint, TypeScript, full checks, Cloudflare packaging and responsive account/public and tablet browser acceptance before merging.

## 2026-10-13 | Backlog #119 public shared-media placement recovery

- **Evidence:** merged PR #119 exposed event-uploaded assets in VenueMediaStudio, but its unresolved review identified `venueBySlug`/`venueById` excluding every `/events/` path before resolving explicit placements. Current master still contained both filters; the UI could save a placement which the public reader replaced with another photo.
- **Repair:** retain the ordinary gallery query/filter/window and fetch missing explicitly selected venue-slot IDs separately, constrained to IDs from the target venue's public placements. Both public loaders resolve placements from the union. Existing public-client RLS, storage signing and fallback behavior remain authoritative. Discovery already reads selected placements independently; its private event-bin filter is retained.
- **Matrix:** public venue details EN/ES, event host lookup, legacy ordinary uploads, selected event uploads, media beyond the 60-row fallback window, no own images, missing/deleted/un-signable media, same/cross-venue records. Manager mutation authorization, accommodation media gallery, premium media limits, email, payments and database schema are unchanged.
- **Tests:** actual public repository loader tests exercise both slug and ID paths, explicit event asset display, unplaced event-bin exclusion, authorized cross-venue sharing and inaccessible-asset fallback, signing failure and avoiding unnecessary extra reads. Full CI/production build and authenticated owner placement/live detail smoke remain required for release. No database operations performed.
- **Rollback:** revert application/test change; keep stored placement records and files intact. No migration reversal needed.

- **Health integration:** preserve the merged #150 one-batch signer and all installed-SDK HTTP boundary tests; resolve explicit selected IDs first, then sign the union once. Existing TTL, valid response paths, ordering, fallbacks, public clients and RLS remain. Reconcile the reviewed sparse Spotlight fixture without overwriting other Health changes. Final combined checks and exact-head acceptance are required before release.

## 2026-10-12 | Venue profile media picker usability

- **Request:** Replace the increasingly narrow five-slot image strips with the existing event-style gallery selector in AkiBusiness Profile.
- **Change:** Each venue image slot opens the shared event gallery modal with searchable, paginated, touch-friendly previews. Existing venue image placements and Auto behavior still use the same authorized server actions. The venue-wide library and accommodation gallery remain unchanged.
- **Dependencies:** VenueMediaStudio, event media modal CSS, signed venue media URLs, EN/ES, tablet/phone/desktop, Supabase placement mutations. No schema, storage, permissions, email, payment or public page changes.
- **Regression:** Static venue-dashboard contract assertion added. CI format, lint, types, tests, Cloudflare build and tablet/browser acceptance must pass before merge. Rollback by reverting this UI-only change.

## 2026-10-12 | AkiBusiness shared media inventory (issue #118)

- Requested: Venue Profile, Event Media and Event Library must expose the same venue-owned media, with lightweight browsing by origin.
- Previously: venue profile hid event-path files; events received only their own event-bin files plus venue-origin files. Uploads already persisted into the common `venue_media` table.
- Changed: both editors now receive all signed assets for their authorised venue. The event media picker sees every asset; the library offers All/Venue/Events virtual folders and search. Event association buttons retain the existing `event_bin` placement actions. No data migration, duplicate storage, or automatic publishing is introduced.
- Dependencies: AkiBusiness EN/ES, venue-membership RLS and signed media URLs, venue/event image slots, existing event-bin placements, legacy upload API and server actions, responsive event editor and venue profile.
- Risk: Existing physical-media delete behaviour and signed URL freshness are unchanged; files shared across event and venue surfaces may still need explicit referential deletion protection. Full local build, database checks and E2E remain required before release.
- Regressions: Static contract assertions added to `tests/venue-dashboard.test.tsx`. Runtime checks are not claimed until CI or local execution confirms them.

## 2026-10-12 | Aki Spotlight public venue and event detail layouts

- **User request:** implement the selected **01 / Aki Spotlight** concept for
  both public detail page types across desktop, landscape tablet, portrait
  tablet and phone, then merge the verified result to live. Isolated source
  begins at public `master` commit `c651a69`.
- **Observed:** both detail types inherited the same generic cover/facts/action
  layout. The selected design instead prioritizes venue photography, menu and
  visiting actions on venues, and event artwork, timing, host and booking on
  events. EN/ES and light/dark modes are preserved.
- **Changes:** scoped shared detail chrome, distinct venue/event layout styles,
  accessible venue section navigation with real published catalogue previews,
  compact upcoming events, intact event posters and a clear date ribbon.
  Responsive action bars keep visiting and booking actions available. Shared
  sharing gains a named icon variant, clipboard status and native-cancel/error
  handling; existing text-button callers retain their presentation.
- **Dependency matrix:** public route -> existing repository/published rows and
  media placements -> server-authorized personal/booking state -> existing
  engagement forms, booking routes and catalogue/allergen component. Preserve
  metadata/JSON-LD, custom event location, Madrid start/end dates, external vs
  native booking, cancellation/sold-out gates, authenticated favorites/going,
  premium calendar/offers, loyalty, contact and accommodation redirect.
  The concept's sample opening hours and imagery are not production data.
- **Boundaries:** no SQL/RLS, API, credential, storage upload, production record,
  billing/email or other portal redesign. CSS is scoped to these public detail
  pages. Revert the source change for rollback; no data restoration needed.
- **Verification:** focused route/component and sharing tests, full repository
  check and Cloudflare package, plus the mandatory `test:spotlight:browser`
  command in tablet CI. The browser harness serves disposable read-only
  Supabase-shaped responses through the real Next routes; empty default
  fixtures cannot exercise venue/event detail. Detailed acceptance and release
  evidence is maintained in `docs/SPOTLIGHT_DETAIL_REDESIGN.md`. Full check
  passed with 623 tests and the production build; dedicated acceptance passed
  all 28 cases. The broad legacy suite was diagnostically interrupted after
  repeated obsolete-selector timeouts and is explicitly not green. Final
  browser/package, CI and live proof are recorded in the release document.

## 2026-10-12 | AkiPals companion playground and playable arcade

- **User request:** six specialist roles to improve the existing `/pals`
  interface, original characters/outfits, game progression/interactions,
  minigames, integrated supervision and QA, then merge the verified result to
  live. Work starts from public `master` at
  `554aeca23724e5049b4def403c48119e4f8b8f35`.
- **Observed:** live anonymous `/pals` correctly returns the private team
  sign-in gate. Source had English-only standalone nonce HTML, ten families,
  61 designs, banked parcels and ten choice stories. A story-card string
  precedence error could omit the card body and Start action; the interface
  rewrite repairs it while retaining all existing story choices.
- **Changes:** dark/light responsive collector studio, distinct vector faces
  and garment silhouettes, ten curated styles from stable existing IDs,
  wardrobe search/collection filters, care and permanent bond ranks,
  daily/weekly activity bonuses and two interactive arcade puzzles. Games
  validate bounded move transcripts server-side; rewards use existing account
  authorization, version checks, command UUID and `pals_commit` transaction.
- **Compatibility:** `journey` and arcade state are optional schema-1 fields.
  Existing equipment, appearance, entitlements, achievement trophies, maps and
  saved progress survive. Care rewards are once/activity/UTC day; completed
  but unclaimed journey bonuses remain available across period boundaries.
  No new SQL schema, service, external asset, currency purchase, invitation,
  public/social map exposure, auth role or production data backfill.
- **Dependency matrix:** isolated route -> preview shell/client/styles ->
  authenticated API -> engine/journey/arcade -> existing own-account JSONB
  save and command ledger. Art also feeds the existing opt-in marker. Other
  AkiSuite portals, bookings/claims/email, billing, analytics consent and
  discovery/SEO behavior are unchanged. Private response release marker
  `2026-10-12-playground-r1` lets the live smoke wait for this rollout.
- **Verification:** focused API tests exercise authorization, forged fields,
  stale versions and ambiguous committed-response replay. Disposable PGlite
  executes the existing save migration to verify own-row reads, denied client
  writes/commit, schema-1 extension persistence and duplicate/stale commands.
  Read-only live catalog inspection confirmed both existing saves are schema 1
  and `pals_commit` remains service-only with RLS on all three preview tables.
  All 15 Pals browser scenarios passed (32 completed games; 298 requests,
  297 commits), along with the 603-test repository check, clean Cloudflare
  packaging and Worker dry-run. The general site E2E suite is not green in
  the local fixture environment; two stale-selector failures reproduce with
  identical errors on untouched `master`. No unrelated tests were weakened.
  See `docs/AKIPALS_RELEASE_20261012.md` and the release PR for complete checks,
  remaining broad-suite limitations, CI and observed deployment evidence.
- **Rollback:** application revert; retain saves, inventory, entitlement and
  command history. No data deletion, reward replay, access relaxation or
  migration rollback. Authenticated live gameplay still needs a valid preview
  session; local test adapters never stand in for that evidence.

## 2026-10-10 | Staff operations overview includes pending ownership claims

- User-visible defect: the Staff operations hero, publishing queue badge and “por revisar” stat displayed 0 even while Moderation → Reclamaciones showed a pending venue claim.
- Cause: Staff homepage queried pending venues/events/community but omitted `venue_claims` entirely (and separately omitted pending offers), while Moderation queried the privileged, paginated `staff_pending_venue_claims` RPC.
- Fix: staff-only `staff_pending_venue_claim_count()` RPC with the same pending/venue/profile join and authorization; add offers to overview counts, explicit claims metric, direct claims shortcut, and responsive 4-metric grid.
- Completeness: any failed/null moderation counter gives an unavailable total rather than a false “all up to date”. Publishing queue shortcut goes straight to claims when claims are the only outstanding work.
- Security/data: aggregate-only count, moderator/administrator gate, schema-qualified private data, revoked PUBLIC/anon execute. Existing claimant contact details, decision workflow, notification emails, memberships and queued records unchanged.
- Validation: PGlite suite verifies count matches paginated claim RPC even with >20 records and denies anon/consumer/business roles; unit tests cover claims/offers and unknown counts; EN/ES labels share the same source. Pending release checks before merge: TypeScript, lint, Vitest and browser/Cloudflare acceptance.
- Deployment: public AkiPasa branch `master`, Supabase SQL migration before UI publication; verify count against real pending queue. No data backfill or schema column rewrite.

## 2026-10-10 | Stop database application-conflict retry storm

- Evidence: 63,163 catalogue and 974 workspace revision errors in 15 minutes;
  production PostgREST 14.5; five functions explicitly raise 40001 for stale
  application revisions, matching Supabase's documented infinite retry bug.
- Change: additive migration replaces only those five functions' conflict
  codes with PT409, retaining authorization, grants, validation and row locks.
  Venue-review API accepts both codes during rollout. No locale or layout change.
- Dependencies: AkiBusiness catalogue save/unpublish, staff venue review, AkiHQ
  company and workspace saves, shared production PostgreSQL/PostgREST. Public
  booking, billing, storage, Google integrations and analytics stay unchanged.
- Verification: embedded PostgreSQL regression covers stale conflict, denied
  authorization, valid writes, preserved function attributes/grants, idempotent
  migration and optional absent CRM functions. Release check and live evidence
  must be recorded after execution; see database-conflict-incident.md.
- Recovery: inspect current authenticator backends; terminate only confirmed
  in-flight loops. Restoring 40001 before PostgREST 16 recreates the incident.
- Secondary repair: restore missing offers.audience and the original Premium
  visibility policy. Existing rows default to public; embedded PostgreSQL tests
  verify anonymous, ordinary authenticated and Premium visibility under RLS.

Every behavior-changing PR adds an entry before merge. No invented verification.

## 2026-10-10 | AkiDuermo auth shell follow-up

- Live finding: the new same-host sign-in form worked but inherited the AkiPasa consumer sidebar from the shared locale layout.
- Change: stay-host auth, recovery and terms acceptance render inside an AkiDuermo header with theme and language controls; sign-in gets a dedicated night-sky hero and rounded form panel. The shared Auth and Supabase actions remain unchanged. Main AkiPasa and AkiBusiness layout paths retain their existing shells.
- Cross-portal/security: middleware product header selects the shell; no new data, role, cookie, redirect, storage or payment behavior. Rollback is UI-only.
- Verification: TypeScript, lint and formatting passed locally. Browser regression now asserts the AkiDuermo brand and absence of AkiPasa primary navigation on the stay-host sign-in page. Full check, CI browser matrix and live smoke are required before this follow-up release.

## 2026-10-10 | AkiDuermo navigation, Saved and map controls

- Live/user finding: Saved inherited the Explore search bar's negative hero overlap without a hero, map filters were always expanded over the map, and bottom navigation changed style/order between routes.
- UI changes: a shared five-link `StayNavigation` renders in the same order and position on discovery, Saved, property, map and member pages. Saved has a compact local search, while Explore retains its trip search. Map search and type controls sit inside an accessible disclosure; property mobile booking action sits above the fixed nav.
- Data/security: same read-only accommodation listing and localStorage saved filters; no API, auth, RLS, inventory, payment or redirect changes. AkiPasa and AkiBusiness unaffected.
- Verification: focused Saved filtering test, TypeScript and lint pass; EN/ES, light/dark, 390/1280 browser assertions for search isolation, disclosure and nav order added. Full check, CI browser matrix and live smoke pending at entry composition.

## 2026-10-10 | AkiDuermo consumer suite candidate

- User-visible expectation: guest sign-in stays on AkiDuermo and returns to the selected property; separate Explore/Saved/Map/Bookings/Account/Settings routes; the map fills its dedicated viewport and uses one-finger gestures.
- Paths: stay virtual-host middleware and routing, shared `/[locale]/auth` and terms flows, `StayBookingPanel`, `AkiDuermo`, `StayProperty`, `StayAppShell`, `StayMapPage`, new `/akiduermo/{map,saved,account,bookings,settings}` pages, responsive styles and EN/ES labels.
- Data/permissions: same Supabase Auth identity with host-scoped SSR cookies; no new credential store or tables. Bookings query only `profile_id=auth.uid()` under existing reservation RLS; cancellation also selects ownership and uses `accommodation_change_status`. Settings email/password changes use existing Supabase Auth. Saved items remain localStorage-only.
- Related surfaces: AkiPasa auth/terms actions are shared and retain their main-host redirect policy. Stay host allows only its auth, consent, booking and member POSTs; unrelated business/admin APIs stay rejected. Map reuses accommodation-only tile data and marker navigation. No billing, ads, email outbox or inventory migration changed.
- Security and rollback: local-path destination allowlist and trusted origin validation; no cross-host cookie sharing or service-role key. Code-only rollback preserves customer reservations. Exact production Supabase Auth redirect URLs for both locales need verification before releasing Google/magic/confirmation/recovery flows.
- Verification: focused routing, auth and saved-route tests passed (23). Full check, browser matrix, Cloudflare build and authenticated owner/customer production smoke pending at entry composition. NOT DEPLOYED.

## Entry template

### YYYY-MM-DD | PR # | Domain and owner

- User-visible change and exact expectation:
- Current code paths, routes, buttons/labels, EN/ES copy:
- Read/write data flow, DB tables/RPC, storage, external APIs, role/consent:
- Callers and downstream pages, other portals, Android, jobs, map/search/SEO/cache:
- Source-of-truth conflicts / earlier incidents checked:
- Files changed and why:
- Tests added/updated, exact commands and pass/fail/skip:
- Cross-role, cross-locale, theme, 360px/desktop coverage:
- Security/privacy, idempotency, migrations, rollback:
- Production build/deployment ID, URL smoke, metrics/logs (or NOT DEPLOYED):
- Outstanding gaps and accountable follow-up:

## 2026-10-09 | Initial contract baseline

- Reviewed: `AGENTS.md`, `README.md`, `package.json`, `wrangler.jsonc`, `docs/AI_HANDOFF.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/deployment-source.md`, `docs/PROJECT_STATUS.md`, `docs/CHANGELOG.md` plus accumulated user requests through 2026-10-09.
- Added `docs/AKIPASA_MASTER.md` as an initial **non-exhaustive** contract and agent playbook.
- No application code, database records, CI settings, production service or deployment touched.
- **Not run**: application/build/browser/production tests. Documentation-only change composed through GitHub connector; no local repository runtime available.
- Next required audit: programmatically traverse all `src/app` routes and `src/components` event handlers, labels, permissions and mutation flows and link each to specific code/tests. Inventory release branches, current DB policies and production observability with approved access.

## 2026-10-09 | PR #71 automation extension

- Added source scanner `scripts/generate-system-inventory.mjs` and PR contract guard `scripts/check-change-contract.mjs`; added `.github/workflows/master-system-contract.yml` to run both and upload the route inventory as an artifact.
- Static coverage: Next page/layout/route paths, UI tag/handler/label sites, integration keyword matches, migrations and tests. Dynamic runtime contracts, imports, all rendered text, DB policies and end-to-end click semantics are **not** exhaustively mapped by this heuristic.
- Verification: GitHub connector confirmed writes; no local source checkout or runnable CI environment. **Not run**: Node scripts, full source scan, unit/e2e tests or Actions build. Must inspect GitHub Actions result before claiming checks pass.
- No application runtime code, external services, paid campaign, secrets, database or deployment modified.
- Follow-up: make this workflow a required branch protection check; add richer AST-based interactive inventory and route-to-test mapping; run smoke/browser tests in a checked-out environment.

## 2026-10-09 | Advanced booking resources and recurrence (candidate PR)

- User-visible goal: resource pools, non-overlapping capacity, native
  recurring availability, SVG icons replacing emoji template visuals.
- Existing locations:
  `src/components/BookingManager.tsx`,
  `src/app/[locale]/business/venue/[id]/page.tsx`, and `actions.ts`.
- New DB migrations:
  `20261009115000_booking_resources.sql` and
  `20261009120000_recurring_booking_slots.sql`.
- Dependencies: venue slot RLS, owner/manager roles, `request_booking` RPC,
  public venue/event booking forms, time zone, native booking-mode settings.
- Integrity: resources belong to their venue; named resource capacity cannot
  be exceeded; only one active overlapping slot per resource; old records
  retain nullable resource assignment. The recurring RPC is permission-gated
  and bounded to 90 days.
- Regression coverage: new `tests/booking-manager.test.tsx` UI cases; SQL
  validation, full repository CI and live smoke status pending.
- Release state: NOT DEPLOYED. Existing schema and production booking data
  have not been changed by this feature branch.
- Remaining architecture: specialized stay inventory, dining/table joins,
  ticket tiers, payments and staff calendars need additional design/tests.

## 2026-10-09 | PR #74 extension: bookable offerings

- Business behavior: managers create independent named offerings with booking type, duration and capacity, then attach them to manual or recurring availability slots. Customers see offering names for eligible slots. Existing slots without offerings continue working.
- Paths: `src/components/BookingManager.tsx`, venue owner actions and loader, public venue booking page, `booking_offerings` migration, recurring RPC, SQL and UI test suites.
- Database: RLS and same-venue foreign key protect bookings from cross-venue references; offering capacity checked on slot insert/update. Existing resource lock and request_bookings RPC preserved.
- Other surfaces: bilingual venue booking UI and business dashboard, public availability reads, migration ordering. No changes to AkiHQ, Google Ads, Stripe or live pricing.
- Evidence: tests and GitHub CI pending for this latest extension; no staging acceptance or live smoke claimed. No production deployment.
- Remaining: managed cancellations, resource availability exceptions, full ticket/inventory/room-night models, authenticated browser tests and accessible UI review.

## 2026-10-09 | AkiBusiness booking flow redesign and consumer My Bookings (candidate)

- User intent: booking wizard with buttons and fewer text inputs; modern compact AkiBusiness workspace; saved subtab persistence; approved booking confirmation emailed to both customer and opted-in venue; personal Upcoming/Active/Past booking history.
- Paths: BookingWizard, MyBookings, Account layout/overview/bookings route, venue public booking route, business booking manager/editor/actions, email adapter, Supabase notification migration, tests and responsive CSS.
- Data: existing booking_requests and availability remain authoritative; recipient queue is keyed by booking and audience, approval is a conditional transition; venue notification recipient is explicit and private. All account queries filter by auth profile and rely on RLS.
- Integrations: Resend transactional API requires RESEND_API_KEY and verified BOOKING_EMAIL_FROM. Root akipasa.com domain is now verified in Resend and contact@akipasa.com is the default sender; Cloudflare secret verification is still outstanding.
- Rollout: Database migration ahead of application release; never send actual customer emails in tests. Verify EN/ES, mobile/desktop, light/dark, party max, permission boundaries, retry/idempotency, email formatting, saved tabs, status transitions.
- Status: draft branch, CI and staging/live acceptance NOT YET VERIFIED; production remains unchanged by this branch.

## 2026-10-09 | PR #75 release hardening and rollout

- Approval: user explicitly requested a live release and final runtime key instructions; no advertising budgets, payment plans, external accounts or real customer emails are modified by acceptance tests.
- Audit found and fixed: root sender fallback still using auth subdomain; customer UPDATE rights could change capacity/confirm their own booking; private notification email on a public settings table; history joins losing past dates; UI using total rather than remaining capacity; navigation restored only on initial mount; no automatic email retry or stale-lease recovery.
- Cross-layer fixes: public booking action/schema/wizard; owner loader/actions/workspace; Account route, polling, cancellation and export; private settings/outbox tables, status guard/queue triggers, approval/availability/history/request RPCs; rendered HTML/text emails and runtime dispatcher; Worker scheduled handler plus five-minute cron. Existing auth, map special routes, search, ads and Stripe behavior preserved.
- Tests: `npm run check`, `npm run build:cloudflare`, `node scripts/test-booking-engine-sql.mjs`, `npm run test:booking:browser`, and `npm run test:e2e`. Results are recorded against the final commit in the PR; at composition time these latest hardening changes await execution. The SQL suite uses real authenticated/anonymous/service roles with owner/editor/customer/stranger fixtures and independent concurrent transactions. Browser screenshots cover EN/ES, 360px/desktop, light/dark with mock client actions; these are not a claim of an authenticated production session.
- Security: direct booking ownership/party rewrites revoked; permissible state transitions enforced in database; customer cancellations only their future bookings; aggregate capacity contains no contact data; private email settings and queue protected by RLS; rendered email snapshot escaped; queued deliveries survive missing API keys and crashes. No test credentials or real personal data are included.
- Rollout order: final candidate checks, atomic application of both pending migrations, merge the exact tested head to master, verify connected Cloudflare rollout via `/api/bookings/release` and public routes. An edge version marker is deliberately public and contains no configuration or credentials.
- Rollback: do not revert the new DB security boundaries or delete queued/customer data. Keep additive migrations, restore a reviewed compatible Worker version, disable the booking cron if necessary, and inspect `review`/`failed` deliveries before any manual resend. The previous UI can still set status using the strengthened database checks.
- Outstanding operational prerequisite: the user must add `RESEND_API_KEY` as a Worker runtime Secret and Deploy. Queue sending/inbox delivery cannot be proven without this key. Root domain verification was inspected separately; it is not runtime-secret evidence.

## 2026-10-09 | PR pending | Event-first venue cards and event-linked menus

- User-facing: rich upcoming event cards above venue menu, optional multi-section venue menu selector in event editor, selected published catalogue sections on public event details.
- Source: `src/app/[locale]/venues/[slug]/page.tsx`, `src/app/[locale]/events/[slug]/page.tsx`, `src/app/[locale]/business/venue/[id]/page.tsx`, `src/components/BusinessEventEditPanel.tsx`, `src/app/compact-app.css`.
- Data: add `events.catalogue_section_ids text[]` default empty; server validation against matching venue catalogue section IDs, public reads via event ID, venue ID, published status; no duplicate item prices or allergens.
- Dependency: existing booking settings, catalogue publishing RPC, event permissions, media links, locale and themes. Migration must precede Cloudflare rollout.
- Verification: NOT RUN locally: checkout unavailable in tool runtime. GitHub CI requested; pending status, migration deployment and live smoke checks must not be represented as passed.
- Rollback: revert feature code first; added database column can safely remain with empty default. No live production changes performed as part of initial PR preparation.

## 2026-10-09 | PR pending | AkiDuermo claim selection and owner playtest seed

- Adds Activities/Accommodation selection to the existing AkiBusiness claim picker, reusing standard claim approvals and venue member authorization.
- Code: `src/components/ClaimVenuePicker.tsx`, `src/app/api/business/claim-search/route.ts`, `src/app/api/business/claim-map/route.ts` and `supabase/migrations/20261009130000_accommodation_claim_discovery.sql`.
- New RPCs maintain same output schema, restrict to published/unclaimed, geolocated, non-suspect accommodation, and limit map/search outputs. Existing activity functions are unchanged.
- Direct DB test fixture: AkiDuermo HQ at user-supplied address, approximate coordinate, explicitly fictional and not bookable; `discovery_enabled=false`, `search_enabled=false`, owned by the existing `alex@akipasa.com` account. No public claim or booking inventory generated.
- Verified: demo venue and owner membership by read-only SQL; migration applied. CI source/format/build/browser results remain pending until PR checks. No claim mutation or authenticated full browser test performed.
- Rollback: revert branch code; new claim read functions may remain unused. Keep demo listing private to discovery, remove only on user request.

## 2026-10-09 | Tablet viewport and per-host PWA identity candidate

- Observed: Android Chrome offered AkiBusiness as AkiPasa; shared manifest had one name/start URL. Tablet portrait AkiBusiness auth showed desktop two-column layout with cramped copy; split-window landscape venue rows clipped action buttons.
- Changes: host-sensitive PWA manifest name/id/start URL/theme, SVG colored icon, AkiDuermo manifest route allowlist, responsive auth tablet single column and wrap/stack venue management actions. No database/auth/API/role mutation.
- Source: src/app/manifest.ts, src/app/pwa-icon.svg/route.ts, src/lib/akiduermo-routing.ts, src/app/tablet-responsive.css, src/app/layout.tsx.
- Cross-portal impact: app installs on three hosts, AkiBusiness login, AkiBusiness venue list; global stylesheet import could affect other portal pages but selectors are scoped.
- Verification: connector file inspection and GitHub commits only. npm check, Next build, Android Chrome portrait/landscape/split-screen and end-to-end workflows **NOT RUN** in connector runtime. No production deployment.
- Risks: Chromium icon selection/installability with SVG-only manifests, CSS specificity on production, existing installed apps may cache old labels, uninspected routes might overflow. Browser QA and green checks required before merge.

## 2026-10-09 | PR #79 continuation | Tablet acceptance and install hardening

- Read full master contract, AGENTS, architecture, decisions, deployment-source and impact register; fetched master e2a1e54. Inspected the three supplied tablet screenshots.
- Fixed auth below 1200px, actual flex venue rows and action wrapping, narrow input tracks and topbar wrapping, AkiDuermo tablet search/card tracks, short-viewport delete dialog scrolling and long names.
- PWA: restore PNG 192/512 any/maskable with reproducible branded assets, hostname-aware favicon/application metadata, retain existing implicit AkiPasa identity, enable service worker on all origins, allow offline/service-worker host routes, remove stale manifest cache. No auth, permission, data, booking mutation, advertising, pricing or DB changes.
- Dependencies traced: root metadata/manifest, middleware/static asset exclusion, stay route gate, service-worker registration/cache, shared auth CSS, managed venue actions and actual module-based deletion dialog, VenueDashboard/BookingManager, AkiDuermo CSS.
- Browser evidence: 28 real-component combinations passed locally in headless Chromium 153 (390/600/768/820/1024/1280 widths plus 640x400), EN/ES light/dark. Deletion action is a disposable adapter; no production records touched. Public route/e2e and final check/Cloudflare results pending at this entry's composition; record final outcomes before handoff.
- First npm check attempt reached automation and failed because its nested dependencies were not installed; installed with npm ci --prefix automation and reran. Playwright CDN browser ZIP failed; isolated Chromium binary obtained from npm for local tests. No dependency changes to project.
- Rollback: revert PR application/assets; keep data unchanged. NOT DEPLOYED. Physical Android install, authenticated live roles/full editor content and on-device keyboard/rotation are not claimed verified.
- Interim validation: npm run check passed before the final test/document additions (357 application + 5 subscription + 41 automation tests, lint/typecheck/format/database-safety/automation dry-run/Next build); npm run build:cloudflare passed; six added PWA unit tests passed. Full site e2e currently exposes unavailable test backend and legacy selector failures and is not green. Merge remains blocked.
- Host browser acceptance exposed differing host resolution between middleware/colored SVG (Next URL hostname) and manifest/root metadata (request Host). Middleware and SVG now use the normalized request Host with URL fallback, matching the manifest and preserving exact portal hostname matching. No client-supplied product header is trusted. Host-level browser acceptance rerun required against the rebuilt candidate.
- Latest browser results: all four public route matrices passed on a stable production Next build (252 route/locale/theme/viewport visits), plus successful navigation sheet open/close after supplying an existing consent-version cookie; optional privacy choices remain false. Per-host manifest/PNG/SVG/service-worker/offline checks and AkiBusiness four-mode auth matrix passed after host normalization. Full combined rerun status is recorded below when complete.
- Expanded component acceptance passed all 28 combinations again, now including every booking subtab and visible booking form input/select/textarea/action bounds.
- The broad `npm run test:e2e` run was interrupted after unavailable backend and legacy-selector failures; it is FAILED/INCOMPLETE, not release evidence. Earlier isolated attempts affected by concurrent rebuilds and/or missing localhost server are superseded by the stable focused runs.
- Clean Cloudflare snapshot with symlinked dependencies failed on native sharp/esbuild resolution outside the snapshot. Reinstalling dependencies physically inside the snapshot and rerunning; this is an environment issue, not a removed application feature.
- Final focused combined browser suite: six tests PASSED in 3.3 minutes, covering 252 public route visits, responsive navigation interactions, 112 business auth-mode visits and per-host installation resources. Expanded component suite: 28 combinations PASSED. Screenshot samples inspected for business light/dark portrait, split-window actions and AkiDuermo tablet search layout.
- Final clean Cloudflare packaging PASSED after physically installing snapshot dependencies. Six PWA unit tests plus focused auth/SEO/accommodation regressions PASSED (29 tests); final lint, typecheck and formatting passed. Final npm run check PASSED with 363 application + 5 subscription + 41 automation tests, formatting, lint, typecheck, DB safety, automation dry-run and the production Next build.
- Release remains blocked: broad site e2e FAILED/INCOMPLETE, no authenticated staging data/session, no physical Android install/update/keyboard/rotation verification. PR remains unmerged and no production promotion was performed. See docs/TABLET_ACCEPTANCE.md.

## 2026-10-09 | Tablet booking inbox and scroll polish follow-up

- User supplied four live tablet screenshots after PR #79 and explicitly requested implementation, testing and merge to live. Observed: all requests rendered as an unbounded list; Services panel clipped at the edge of an independently scrolling, height-capped booking hub; oversized stretched status pills.
- Base: fetched master d26c4c5 (PR #79 merge); local f18b80c tree matches that merge. Traced BookingManager → venue loader → signed-in Supabase/RLS and availability/offering joins → update/retry actions → email state. Reviewed VenueDashboard module styles, global booking styles and tablet acceptance. Public consumer booking engine, account history, PWA, permissions/capacity/email dispatch rules are unchanged.
- Changes: 20-row server query with exact count, validated URL search/status/order/page, independent pending count, bounded email-state query, historical slot join, retained filters on mutation redirects, explicit read errors, accessible controls and expandable details. No migrations, secrets, live record writes, ads or billing changes. Supabase guidance informed query boundaries and permission preservation.
- Layout: one document scroll rather than nested clipped Services panel, compact manager spacing/status pills, responsive search grid. Existing service/resource creation and booking approve/decline/cancel/complete/retry controls remain.
- Planned acceptance: real Supabase-client HTTP query contract tests, existing booking regression tests, populated 65-request fixture browser paging/search/filter and form-boundary checks across EN/ES themes and nine viewports, full check and Cloudflare packaging. Results pending; no current production verification claimed.
- Rollback: revert application changes only; database and customer data unchanged. Physical tablet keyboard/touch and authenticated live sessions cannot be inferred from component fixtures.
- Verification: full `npm run check` passed (370 application, 5 subscription and 41 automation tests, format/lint/types/DB-safety/dry-run/Next build); focused booking suites passed 22 tests. Final populated tablet component rerun passed all 36 EN/ES/theme/viewport combinations, including bottom pager and screenshot capture. Existing customer/manager/history browser acceptance passed eight combinations. Final OpenNext packaging passed. Services and inbox screenshot samples inspected in portrait/split-window; connected PR checks and post-merge rollout must be independently verified.
- Read-only Supabase checks confirmed RLS on booking_requests and booking_confirmation_emails, existing venue-manager email read policy, and a real bounded booking query returned five rows. No records were changed and no authenticated browser session is implied.
- Broad browser suite was run fail-fast (`npx playwright test --max-failures=1 --workers=1`): failed on the existing BusinessPackages “Business type” selectOption selector; one authenticated production test skipped (session absent), 67 not run. That component/test is unchanged by this patch, and this is not a full-suite pass. Current PR #79 master Cloudflare build/check/booking live-read-only checks succeeded; separate AkiPals live smoke failed with repeated 403 responses. Neither issue is concealed or marked green by this follow-up.
- Additional screenshot inspection found sticky venue navigation hidden behind the product header. VenueDashboard now measures/observes its header and uses inherited offsets for desktop/sidebar and tablet/mobile tabs; search anchors share that measurement. One new observer/resize/cleanup regression test, plus the 36-case browser harness now includes a realistic wrapping header and explicit no-overlap assertion. This final follow-up awaits renewed full check/browser/Cloudflare evidence before merge.
- Header-aware `npm run check` passed with 371 application + 5 subscription + 41 automation tests. Literal apostrophes/underscores are preserved in search, with SQL LIKE and PostgREST quoted-value escaping; focused final inbox/dashboard suites passed 42 tests and lint passed. A local public-route attempt overlapped a rebuild and failed on stale page/hydration assets; it is NOT acceptance and is being rerun against a stable build. Final clean CI/rollout results are recorded in PR #80 before release approval.
- Final review follow-up preserves formatted phone parentheses, commas and quoted contact names rather than deleting punctuation. External inbox fields now use Zod; LIKE and PostgREST quoting are escaped independently. Updated real-client query regression assertions passed within the 42 focused tests. Renewed exact-head checks required before merge.

## 2026-10-09 | Booking services edit and persistent inbox polish

- User-visible change and exact expectation: AkiBusiness Services now lets venue managers edit existing servicios after creation, including name, category, duration, capacity and active state. Booking search/status/sort applies without a full document reload while keeping URL persistence, and booking request cards use a responsive grid instead of wasting tablet/desktop horizontal space.
- Current code paths, routes, buttons/labels, EN/ES copy: `src/components/BookingManager.tsx` Services and Bookings tabs; `src/app/[locale]/business/venue/[id]/actions.ts`; venue workspace wiring in `page.tsx`; labels include Edit/Editar, Save offering/Guardar servicio, Active/Activo, Search/Buscar.
- Read/write data flow, DB tables/RPC, storage, external APIs, role/consent: updates write only `booking_offerings` through the signed-in Supabase client after `requireBookingManager`; existing `booking_offerings_manage` RLS remains authoritative. No storage, email, analytics, Google Ads, Stripe or migrations.
- Callers and downstream pages, other portals, Android, jobs, map/search/SEO/cache: affects AkiBusiness booking manager and public availability indirectly through offering active/capacity/type; no AkiPasa discovery, AkiDuermo, AkiHQ, worker cron or SEO changes.
- Source-of-truth conflicts / earlier incidents checked: previous live screenshot showed create-only services and column-style booking list after PR #80; this extends that release without changing the booking database model.
- Files changed and why: `BookingManager.tsx` for edit form, client-side filter routing and grid class; `actions.ts` for update action; `page.tsx` wiring; `globals.css` layout; `tests/booking-manager.test.tsx` regressions; master/changelog docs.
- Tests added/updated, exact commands and pass/fail/skip: `npx vitest run --environment node tests/booking-manager.test.tsx tests/venue-dashboard.test.tsx` PASS, 44 tests. Full `npm run check`, Cloudflare build, CI and live smoke pending at entry composition.
- Cross-role, cross-locale, theme, 360px/desktop coverage: component coverage includes EN behavior and existing dashboard tablet tests; ES copy is present but not yet browser-smoked. Physical tablet and authenticated production session remain pending until post-merge/live verification.
- Security/privacy, idempotency, migrations, rollback: no new secrets or personal-data exposure; RLS and venue membership checks protect updates; no migrations. Rollback is code-only and leaves offering rows intact.
- Production build/deployment ID, URL smoke, metrics/logs (or NOT DEPLOYED): NOT DEPLOYED at entry composition.
- Outstanding gaps and accountable follow-up: run full repository check/build, push PR, merge only after checks pass, then verify Cloudflare master deployment and tablet UI.

## 2026-10-09 | AkiBusiness unified properties and AkiDuermo-specific manager candidate

- Requested: after AkiBusiness login, show all managed AkiPasa venues and AkiDuermo properties; opening each exposes an appropriate dedicated tool suite, with a full future accommodation reservation service.
- Source: src/app/[locale]/business/page.tsx membership select extended with discovery_vertical, labels and management link copy; VenueDashboard.tsx tool filtering by product; business/venue/[id]/page.tsx passes accommodation type and routes Bookings to AccommodationBookingWorkspace, preserving existing regular venue BookingManager; tablet-responsive.css supports narrow split screens.
- Security: existing requireBusinessAccess, is_venue_member and platform_staff access guards stay in place. No changes to role/RLS or data migrations. Accommodation overnight reservation remains deliberately blocked.
- Cross-surface: AkiBusiness account list and property editor, AkiDuermo preview linking; regular AkiPasa venue-specific bookings remain unchanged. Full target design in docs/AKIDUERMO_BOOKING_DESIGN.md.
- Verification: GitHub connector writes only; npm check, Playwright, DB schema and Cloudflare build not available in current tool runtime. NOT DEPLOYED; NO HOTEL RESERVATION ENGINE YET. Must complete inventory, transaction safety, migrations, tests and authenticated browser QA before merge.

### 2026-10-09 | Follow-up: interactive AkiDuermo management tabs

- Changed AccommodationBookingWorkspace from four static placeholder tiles to selectable, accessible Reservations/Calendar/Rooms/Rates panels; none claim false inventory or enable booking.
- Added narrow split-screen responsive tab styling and tests/akiduermo-manager.test.tsx, included in package.json default npm test command.
- Checks **not run locally**: lint/typecheck/build, CI pending. No DB migration, real hotel inventory or production deployment. Await green checks and full feature implementation before live reservation claims.

## 2026-10-09 | Accommodation room-night schema candidate on PR #82

- Implemented additive room type/unit, nightly rate, booking and maintenance block tables; exclusive check-out range semantics, overlap constraints and shared unit locking; authenticated owner/manager inventory RLS and no guest write grant.
- No live accommodation booking, no public customer price-quote API, no transaction RPC, no deployment.
- Added static SQL contract test to default test script, but no actual PostgreSQL acceptance run; must exercise migrations against a disposable seeded copy of the real base schema and confirm concurrent overlaps, blocks, RLS tenant isolation, rollback and historic schema compatibility.
- Security/deployment gate: hold merge and migration until automated checks and full booking product implementation are verified. This is a partial feature, not customer-ready.

## 2026-10-09 | PR #82 continuation | Owner-managed AkiDuermo inventory

- User-visible change and exact expectation: accommodation owners can now manage real room categories, physical units, nightly rates and maintenance blocks in the AkiDuermo-specific AkiBusiness workspace. Public overnight checkout remains disabled with explicit copy.
- Current code paths, routes, buttons/labels, EN/ES copy: `src/components/AccommodationBookingWorkspace.tsx`; `src/app/[locale]/business/venue/[id]/page.tsx`; actions in `src/app/[locale]/business/venue/[id]/actions.ts`; workspace tabs Reservations/Calendar/Rooms & units/Rates & rules.
- Read/write data flow, DB tables/RPC, storage, external APIs, role/consent: reads/writes `accommodation_room_types`, `accommodation_units`, `accommodation_nightly_rates`, `accommodation_unit_blocks` and reads `accommodation_reservations`; every write uses `requireBusinessAccess`, `is_venue_member(owner|manager)` and a `venues.discovery_vertical='accommodation'` check. No storage, email, payments, Google Ads, Stripe or customer writes.
- Callers and downstream pages, other portals, Android, jobs, map/search/SEO/cache: affects AkiBusiness accommodation management only; regular AkiPasa venue timed bookings keep `BookingManager`. Public AkiDuermo listing/booking UI still does not accept reservations.
- Source-of-truth conflicts / earlier incidents checked: branch was reconciled with current master including PR #81 service-edit, persistent filter and grid work. No newer booking/tablet fixes were reverted.
- Files changed and why: accommodation workbench for persisted management UI; business venue page for loading and action wiring; business venue actions for Zod-validated writes; VenueDashboard JSDOM-safe scroll guard and hook dependency; tests and handoff docs.
- Tests added/updated, exact commands and pass/fail/skip: PASS `npm run format:check`; PASS `npm run lint`; PASS `npm run typecheck`; PASS `npm test` (380 app + 5 subscription tests); PASS `npm run test:db-safety`; PASS `npm run automation:check` (41 automation tests + Wrangler dry-run); PASS `npm run build`; PASS `npm run build:cloudflare`.
- Cross-role, cross-locale, theme, 360px/desktop coverage: component tests cover EN/ES copy and accommodation-specific tool gating. Authenticated browser, tablet/physical-device, dark-mode and live role coverage remain pending.
- Security/privacy, idempotency, migrations, rollback: no public booking or guest write path enabled; SQL migration still requires real PostgreSQL RLS/concurrency validation before release. Rollback is code-only until migration is applied.
- Production build/deployment ID, URL smoke, metrics/logs (or NOT DEPLOYED): NOT DEPLOYED; not merged to master.
- Outstanding gaps and accountable follow-up: run the candidate migration in disposable PostgreSQL with concurrent connections and tenant fixtures; build secure availability/quote and atomic booking RPC; add customer booking UI and business guest operations; then run browser E2E and live smoke before merge/deploy.

## 2026-10-09 | PR #82 completion candidate | AkiDuermo room-night requests

- User-visible change: opted-in accommodations can publish real per-night availability, quote a complete stay, accept an authenticated request without double-booking, manage guest status in AkiBusiness, and expose the stay in the customer's My Bookings area. Disabled and external modes remain available and no online charge is taken.
- Paths/copy: public `StayProperty` and `StayBookingPanel`; `/api/stays/bookings`; AkiBusiness accommodation Reservations/Calendar/Rooms/Rates/Settings; Account Bookings; EN/ES confirmation email content.
- Data: additive accommodation settings, quotes, audit and confirmation outbox extend room types/units/rates/blocks/reservations. Server-side SECURITY DEFINER RPCs calculate/revalidate quotes, lock physical units, enforce idempotency and state transitions. Owner/manager and customer RLS remain distinct; anonymous users receive aggregate availability only.
- Dependencies: stay-host method routing, Supabase Auth/PostgreSQL/RLS, Worker five-minute Resend dispatch, GDPR export/deletion, account history, Cloudflare build. Stripe, Google Ads, venue timed bookings, AkiHQ and campaign budget are untouched.
- Security/privacy: strict same-origin POST, Zod request bounds, no client totals, no public guest details, quote expiry, cross-tenant checks, audit trail, leased/deduped mail and cancellation suppression. Rollback SQL removes only candidate accommodation objects; production data requires forward compensation/backup rather than destructive rollback.
- Verification so far: TypeScript PASS; lint PASS; DB-safety PASS; existing application suite PASS (380 tests before new accommodation assertions). Disposable PostgreSQL could not be launched under the current root-only managed runtime despite server binaries; the dedicated CI PostgreSQL workflow is the required execution record. Full check, browser E2E, Cloudflare package, CI and production smoke remain pending at this entry.
- Production: NOT DEPLOYED at entry composition. Do not enable AkiDuermo HQ or any imported stay until migration, CI, explicit property settings and post-release authenticated smoke pass.

## 2026-10-10 | AkiDuermo manager compact WebApp redesign

- Requested behavior: replace the accommodation manager's long stack of text and always-open forms with a comfortable one-screen WebApp while retaining every existing inventory, rate, block, settings and reservation action.
- Surface and data flow: `AccommodationBookingWorkspace.tsx` remains the UI boundary over the existing server actions and accommodation tables; no schema, RLS, API, email, payment or public booking behavior changes.
- UI changes: compact live summary metrics, horizontal tool navigation, one bounded scrollable work panel, responsive booking-mode cards, sticky save action, compact inventory grids, and collapsed create/edit disclosures. Setup messaging now distinguishes verified overlap protection from missing physical inventory.
- Responsive/accessibility: EN/ES copy remains present; native radio controls back the visual mode picker; disclosure controls remain keyboard-operable; desktop keeps a bounded work panel while phone layouts use document flow and horizontally scrollable tabs without page overflow.
- Verification at entry composition: focused TypeScript, lint and 16 accommodation/booking contract tests pass. Full repository check, Cloudflare package and multi-width browser evidence remain required before merge/deployment.
- Rollback: UI/CSS/test/docs-only revert; persisted room types, units, rates, blocks, settings and reservations remain untouched.

## 2026-10-10 | AkiDuermo map filter and Explore availability correction

- Requested behavior: filter the map without jumping back to its initial center, remove the stray box beneath the filter button, and have Explore date/guest searches find genuinely available rooms.
- Root cause: `ProductionMap` included stay filter values in its map-creation effect dependencies; the general map legend sat beneath the stay filter; Explore omitted dates/guests from `/api/stays` and only displayed a planning notice. Long search names expanded to many `ILIKE` clauses and the live `Fuengirola` and `AkiDuermo HQ` queries returned 503 while a short prefix succeeded.
- Changes: keep MapLibre alive and refresh markers inside the current bounds on filter changes, discarding stale responses; hide the redundant full-screen legend. Bound text search probes. `/api/stays` validates optional complete date/guest criteria and checks each candidate on the current 12-item page against `accommodation_available_rooms`, failing closed if availability fails. Explore labels page-scoped available results and retains the property-detail quote/revalidation flow. A signed-in owner/manager can see their own hidden stay as a labelled private preview when its name/address matches the search, including Fuengirola for AkiDuermo HQ.
- Data/permissions: anonymous aggregate RPC for availability; authenticated `venue_members` scoped by `auth.getUser()` and owner/manager role before exposing a hidden listing to that caller. Personalized responses are `private, no-store` and private previews cannot be saved to device favourites. No inventory mutation or private unit/guest disclosure. Candidate pagination count is still a listing count, not total available inventory. Existing discovery gating continues to exclude intentionally hidden properties from ordinary visitors and map results. No changes to AkiBusiness, email, payments, analytics, other maps or database schema.
- Verification: focused API/component tests, full `npm run check`, and `npm run build:cloudflare` passed locally. Live read-only reproduction showed `Fuengirola` and `AkiDuermo HQ` listing search returning 503, a short prefix returning rows, and HQ's room availability returning two room types for the selected four nights. EN/ES light/dark 390/1280 browser assertions were added, but local Playwright could not launch because Chrome is absent at `/opt/google/chrome/chrome`; CI browser evidence is required before merge. Existing production still has the defect until deployed.
- Rollback: revert UI/API/query changes; booking transaction and schema remain unchanged.

### Live follow-up: indexed Explore text query

- Post-merge live smoke confirmed the new availability response but `q=Fuengirola` still returned 503. Supabase PostgreSQL logs showed `canceling statement due to statement timeout`; `EXPLAIN ANALYZE` of the unindexed `name/address ILIKE` path took about 404 ms and scanned 21,001 accommodation rows. The existing indexed `venues.search_document` prefix query returned the same 30 discoverable matches in about 117 ms with a bitmap index scan. This is a read-only diagnostic, not evidence of live API success.
- Replace the listing text predicate with bounded, accent-normalized prefix terms against the existing GIN index through Supabase `textSearch`. Keep the owner-only preview and date/guest checks unchanged. No migration or production data change. Repeat CI and live search smoke before accepting this follow-up.

## 2026-10-10 | AkiBusiness accommodation media upload transport

- Observed: AkiDuermo property editor reports `Falló la subida ... Comprueba la conexión` for selected images. That copy is emitted only when the `uploadVenueImage` Server Action invocation rejects, before the UI receives its typed validation/storage/database result. The screenshot shows an accepted PNG in the media form and an empty management bin. An authenticated production reproduction and Worker trace were unavailable in this session.
- Change: use a dedicated same-origin multipart `/api/business/venue-media` POST for each file, bypassing the Server Action's 10 MB serialized body transport. The route checks exact origin and framing size, forces inline result handling, and calls the existing server-side upload action. The UI handles server rejection separately from network failure; existing Supabase ownership/RLS, MIME/10 MB file validation, translation, private media bin and placement semantics remain in the action.
- Affects: AkiBusiness media editor for ordinary venues and accommodation properties, both EN/ES, phone/tablet/desktop. No public AkiDuermo booking, consumer media visibility, schema, storage policy, auth session, analytics, email or payment change. Failure mode: an oversized or unsupported file is rejected; storage and database failures return explicit error. No migration; revert endpoint/UI call to roll back.
- Verification: route tests cover binary multipart forwarding, cross-origin denial and storage/invalid-body responses; component tests exercise the same-origin upload and preview in EN/ES. Local `npm run check` passed on the final tree and `npm run build:cloudflare` passed on the same production code before the component assertions were added. Authenticated live upload remains unverified without an owner session. No production image was uploaded by the agent.

## 2026-10-10 | Accommodation public header gallery and large-source compression

- Requested behavior: retain five listing media selections; expose a dedicated accommodation header upload/selection area; stop public stay pages from displaying one copy of each private bin item. Accept high-resolution source images and compress them before transport.
- Root cause: `loadStayDetail` selected the first five `venue_media` rows directly regardless of explicit placement. The media input rejected source files above 10 MB before compression.
- Paths: `src/lib/stay-detail.ts` now reads only ordered `venue_gallery/stay_header` placements (12 maximum) and signs owned media; `VenueMediaStudio` shows a separate gallery uploader and bin-to-header selection beside the existing five slots; placement server actions check accommodation identity and same-venue media, using existing RLS; `SafeMediaFileInput` compresses JPEG/PNG/WebP originals up to 50 MB to a bounded JPEG under 10 MB before existing same-origin multipart upload. Existing non-accommodation slot fallback and events remain unchanged.
- Security/data: no migration or new public access to the entire bin; public reads are confined to explicitly placed media. Authenticated mutations use the existing business access and `venue_media_placements` policies. No booking, payment, mail, analytics or consent change. Delete from the bin cascades placement; remove from header keeps the private file. Concurrency conflicts return an error instead of fabricating success.
- Verification: component regression test added for private bin-to-header assignment/removal. Full `npm run check`, browser tests and authenticated live upload are pending because this connector workspace has no repository checkout or installed dependencies. No migration or production deployment performed. Rollback: revert this UI/loader/actions change; existing placement rows can remain unused safely.

## 2026-10-10 | Business/Duermo portal home and branding unity

- Request: use unchanged AkiPasa as visual reference; overhaul AkiBusiness and AkiDuermo home/branding/navigation, using supplied yellow, green and purple AE marks. Screenshot showed generic A badges, inconsistent headers and oversized continuously stacked property rows.
- Matrix: EN/ES; anonymous stay discovery/auth, authenticated business home, owner/manager/editor + inherited staff editorial listing; light/dark; 360/390/512/600/820/960/1536 and short 640x400 split windows. Existing property-specific tools remain downstream of the same management links.
- Paths: `BusinessHome`, `BusinessHeader`, `PortalLogo`, `StayHeader`, Stay shell/property/Explore, localized/root layout, scoped portal stylesheet, uploaded brand masters and Business/Duermo PWA variants. Existing AkiPasa component source and raster icons remain unchanged. No AkiHQ repository changes.
- Ownership/dependencies: existing session-backed membership query/RLS supplies cards; filters/paging operate only on that authorized result. Management/deletion URLs/actions retain existing server checks. No auth, roles, booking transactions, email, DB, storage, consent, ads or paid campaign settings change. Analytics-view RPC reads are deferred off Home. Existing create/claim/event/reward/growth pages stay accessible. No migration.
- Failure/rollback: explicit membership-load failure; no fake property totals/activity. Native disclosure keeps dangerous delete out of primary action; existing reason/DELETE confirmation still applies. Revert UI/assets/CSS/conditional read changes to restore former behavior; no data rollback needed.
- Verification pending: focused interaction suite passed initially (7 cases). Local Chrome is absent and `npx playwright install chromium` returns truncated/invalid downloads, so real browser evidence must come from CI. A 64-combination real-component browser harness is added to tablet CI before build/routes; uploaded screenshots allow visual review. Full check and Cloudflare build are pending at entry composition. Not merged/deployed; authenticated production and physical PWA acceptance remain unperformed.

### Local verification update

- `npm run check` PASS: formatting, lint, TypeScript, 386 general + 5 subscription + 16 dedicated app tests, DB safety, 2 conflict tests, 41 automation tests/dry-run and Next production build. The final scoped language-visibility override is additionally checked in the subsequent Cloudflare build.
- The managed runtime has no Chrome executable; download failed with invalid ZIP contents, and the new browser harness bundles but fails at browser launch. Browser acceptance remains NOT RUN. Its CI step is prepared but the branch has not been pushed.
- Auto-review rejected GitHub push: authorization to publish the private changes to the remote feature branch was not verified. Local commit is complete; obtain user approval to push, then run CI and inspect its screenshots. No workaround publication or production deploy was attempted.
- Membership query now explicitly filters `profile_id` to the signed-in user, avoiding duplicate team rows/other members' role labels in the home catalogue; inherited editorial staff access remains explicit.

- Final `npm run build:cloudflare` PASS (Next production build and OpenNext Worker packaging). The first packaging attempt failed because shared dependencies resolved outside the isolated checkout; rerunning with checkout-local dependencies passed without any source/dependency changes. No Worker was uploaded.

- Route E2E runner (`node scripts/run-e2e.mjs` after the successful production build) could not pass local server readiness: `/en` reports missing Supabase environment variables in this checkout. Stopped the blocked runner; no route acceptance is claimed. The CI tablet job provides disposable test variables and installs Chrome before running the prepared browser checks.

- User approved remote publication; draft PR #92 is open. Booking browser CI and contract gate passed. The first tablet run installed Chrome, then the new standalone portal harness failed before rendering because imported configuration referenced browser `process.env`. Added disposable compile-time defaults and immediate page-error/failure screenshot diagnostics; no production configuration changed. Browser acceptance remains pending rerun.

- Corrected harness also waits for DOM before applying test theme; all 64 portal combinations PASS on `22be0bd`. Cleared the inherited 300px mobile hero minimum to honor the compact 190px design, and tightened first-screen search acceptance to require the CTA above fixed bottom navigation. Final rerun and screenshot review pending; no deployment.

- Final UI code `421a965`: local `npm run check` and Cloudflare packaging PASS; all 64 tightened portal cases PASS. Existing tablet route suite PASS. Guest-route suite failed solely on its old `/AkiDuermo\./` text locator after the shared header gained an explicit auth-brand link label; updated that acceptance locator. Separate Playwright output directories preserve portal/tablet screenshot evidence that the default root output cleanup discarded. CI rerun pending; no production deployment.

- All five workflows PASS on `b1a91ba`, including 6 tablet-route tests, 8 guest-route tests and 44 management-component combinations. Visual inspection of retained portal screenshots found default-sized Business shortcut SVGs expanding the quick-action cards. Scope of final polish: explicit icon dimensions only in `BusinessHome`; add a compact quick-action height browser guard and early portal artifact upload for prompt visual review. Shared AkiPasa icons/code and all management actions remain unchanged. Revert the size props to roll back; no data impact. Final browser rerun pending.

- Incorporated upstream master `59abeb9` (PR #91 accommodation media/gallery work) after it advanced during review. Kept both impact records and the automatically merged master contract; no application conflict or override. Combined-tree checks and final compact-icon browser evidence are pending.

## 2026-10-10 | Identical Business/Duermo header controls

- Observed/requested: Duermo used theme/language/settings while Business used language/theme/products; its AkiPasa link lacked the branded card. Both must use the same language/theme/Aki Apps controls and omit the current app. User authorized publication and live merge after testing.
- Traced paths: BusinessHeader via localized business layout; StayHeader via Explore/Saved, property and map/member shells; localized Duermo auth/terms header. Shared ThemeToggle preference/event remains intact; Business LanguageLink preserves pathname/query, Duermo callback preserves lang/cookie. PortalLogo gains only an AkiPasa menu variant using existing orange PWA artwork. Scoped CSS clears legacy header style differences.
- Matrix: EN/ES, light/dark, phone/tablet/split-screen/desktop, anonymous/authenticated Business logout, Duermo Settings, all three relative app links and current-app omission. Disclosure retains native keyboard operation plus Escape/focus return and outside-tap dismissal; short screens scroll the bounded menu.
- Data/upstream/downstream: existing app links and server logout retained; shared auth identity stays host-scoped. No DB/RLS/API, booking, media/storage, analytics, payments, consent, PWA assets or AkiPasa consumer component change. Revert shared header wiring/styles to roll back; no records change.
- Verification: focused suite passes 20 tests, including 10 portal home/header cases. Expanded real-component 64-case browser harness checks ordered controls, theme toggling, branded app links, current-app omission, menu bounds and keyboard/outside-tap dismissal. Full check, CI/browser and live results pending; no deployment yet.

## 2026-10-10 | Staff claim review details

- Request/observed: Claims showed only venue name and approve/reject; evidence and created_at were fetched but masked by the venue-name fallback, and claimant identity was not loaded.
- Matrix: EN/ES staff and administrator, regular and accommodation claims, light/dark, phone/tablet/desktop. Anonymous, consumer and business accounts must be denied at page and direct RPC boundaries.
- Paths/dependencies: StaffQueue, staff moderation page, moderation actions, scoped claim CSS; existing business `submitVenueClaim` -> venue_claims -> staff-only pending read -> unchanged audited moderate_item -> venue_members. Legacy moderation/admin navigation leads into the same staff workflow. SQL joins current profiles/Auth users and catalogue venues/cities; no contact snapshots or new submitted fields. No API handler, service credential, external message, storage, analytics, payment or consent change.
- Data/security: role-gated bounded SECURITY DEFINER read with empty search_path, qualified tables and explicit execution revocations. Pending claims only; deleted Auth email suppressed; no public profile email duplication. Full evidence is escaped text, HTTPS website links only. Current email and profile phone are separately labelled from venue contacts. Empty/error states remain distinct; pagination is stable; claim decisions preserve queue/page.
- Migration/release: new additive read function in both migration directories must precede app rollout. Revert app then DROP FUNCTION public.staff_pending_venue_claims(integer) for rollback; no claim or ownership data is removed. NOT DEPLOYED; no production migration applied.
- Verification so far: 4 bilingual/component cases and 3 executable PGlite SQL cases PASS, including direct anonymous/consumer/business denial, moderator/admin reads, 20+4 paging, invalid offsets and deleted Auth email. Full check, Cloudflare package and browser verification pending.

- Local validation update: `npm run check` PASS (format/lint/types, 389 general + 5 subscription + 24 dedicated cases, 2 conflict cases, 41 automation cases/dry-run, Next build); `npm run build:cloudflare` PASS. New browser harness lint PASS. Browser bundle compiles, but launch is blocked by absent Chrome and `npx playwright install chromium` fails with corrupted ZIP downloads. `node scripts/run-e2e.mjs` fails readiness because local Supabase variables are missing. PR #94 runs the 16 EN/ES, light/dark, 360/600/1536/short-window claim cases in CI with disposable form actions. Authenticated production acceptance remains unperformed; migration/deployment require approval.

## 2026-10-10 | Claim decision emails

- Request: send formatted welcome/approval or denial/resubmission emails from alex@akipasa.com after claim review. Before: audited decisions and ownership work, no claimant email. Existing business claims form accepts a new submission after rejection. Both venue and accommodation claims share this workflow.
- Trace/matrix: staff/admin -> moderateItem -> existing staff-gated moderate_item -> atomic pending transition/ownership/audit + new private trigger outbox -> immediate scoped service dispatch + five-minute Worker cron -> Resend. EN/ES claimant locale, approval/denial, missing name/contact, verified/missing/deleted/changed Auth email, anonymous/consumer/business denial, browser templates at 360/960px. Existing staff queue/mobile/light/dark and public/booking regression remain covered by CI.
- Source: claim-decision-email.ts, claim-mail-delivery.ts, moderation/actions.ts, custom-worker.ts, account-export.ts; mirrored migration 20261010114606_claim_decision_emails.sql. Provider/from is separate from existing booking mail. akipasa.com is verified in Resend with sending enabled and tracking disabled; runtime key capability is not established by domain status.
- Data/security: future decisions only, one immutable recipient/payload row per claim. Verified Auth recipient, escaped HTML and sanitized subjects, fixed HTTPS canonical links, no passwords/bank/identity-document requests. Claimant/staff read RLS, no client write access, service-only leases/ack, cascade privacy deletion/export. No changes to role/ownership/billing, signup mail, media, SEO, analytics, campaigns or consent.
- Reliability: stable claim provider idempotency key; same-transaction queue ensures failed review/audit leaves no email; immediate provider errors do not undo decisions; scheduled retry with locked eight-row batches, ten-minute stale-lease recovery, twelve attempts and exponential backoff. Persistent uncertain-delivery flag prevents later 429 responses clearing earlier uncertainty. After 23h uncertain delivery is held; permanent failures are blocked. Provider acceptance is not delivered/inbox proof.
- Rollback/release: apply additive migration before code, preserve old booking schema. Revert app and disable the new queue trigger to stop future notifications without deleting claim/member/audit history. Do not backfill or test-send real claimant emails. No migration applied or live deployment performed for this candidate.
- Verification: focused initial 24 tests PASS; expanded SQL reliability tests, full check, Cloudflare package and browser/CI evidence pending. Local email browser bundle compiles but cannot launch because Chrome is absent; CI installs browsers and retains eight template screenshots plus HTML. Authenticated live UI/email acceptance remains unperformed.

- Validation update on application tree e6dbc5f: local full check PASS (405 general, 5 subscription, 24 dedicated, 2 database-conflict, 41 automation tests and production build); Cloudflare packaging PASS. All 16 new SQL/renderer/delivery tests PASS. CI's eight email browser previews and 16 existing claim review cases PASS; mobile approval and desktop denial screenshots inspected. Booking browser, contract and format workflows PASS; wider tablet/public checks are still running. Local `npm run test:e2e` reached server readiness but failed because this checkout has no Supabase runtime variables; no local route acceptance is claimed.
- Production configuration investigation (read-only): the apex sending domain is verified, but four confirmed-booking messages have remained pending with zero attempts since October 9. No new AkiPasa application sending key appears in Resend key metadata; only the older Auth SMTP key is identifiable. This indicates a runtime-mail configuration gap, not proof of a particular missing secret. Wrangler reports unauthenticated and no Cloudflare connector is available. Verify/provision the Worker's runtime RESEND_API_KEY before accepting email activation; domain verification or a successful code build is insufficient. No real messages, database migration or deployment were performed for this investigation.

- Release verification follows the existing read-only `/api/bookings/release` endpoint: the booking marker remains unchanged, with a new claimNotifications release marker and configuration boolean. It exposes no credential or recipient data and allows direct post-deploy verification of runtime URL/service/Resend-key presence. This boolean is not proof of a valid sending key or inbox delivery. Application review and retry behavior are unchanged.

- An optional isolated `CLAIM_RESEND_API_KEY` takes precedence for claims, with the existing RESEND_API_KEY as fallback. Provisioning a claim-only key does not enable the older booking queues or change their senders. The release configuration check follows the same precedence. Added executable coverage of a claim-only key without a general booking key; no secrets are embedded in code or build variables.

## 2026-10-10 | Venue and accommodation team workspace access

- Request/observed: members added through Team are missing from their own management experience. Traced before implementation: `addTeamMember` -> owner-only `add_venue_member_by_email` -> `venue_members` -> membership/RLS -> AkiBusiness Home and venue workspace -> protected server actions. The basic entitlement guard rejects editors and members of unverified properties; Home separately rejects `consumer` platform roles even after entitlement access succeeds. Verified current database `is_venue_member` uses tenant membership without personal billing, and member read/venue read policies already allow the caller's assigned rows.
- Change: basic `requireBusinessAccess` checks the signed-in caller's editor/manager/owner membership before the existing billing fallback. Home relies on that guard rather than requiring a global organiser role. Existing team records now work without promotion or a separate personal subscription, including pending/unverified stays. No schema migration, entitlement/profile write, ownership transfer or production data repair.
- Matrix/dependencies: AkiBusiness EN/ES, venue and stay rows, regular consumer team members, owners, managers, editors, staff, subscribers, nonmembers, removed members and failed reads. User/terms guard remains first; caller-scoped membership read fails closed. RLS/RPC still restrict every operation/tenant; editor content access does not imply manager booking/inventory or owner team/deletion powers. Business Pro still independently requires its entitlement. AkiHQ billing, consumer plans, public discovery/media, email, cron, analytics/consent, SEO and Android identity are unchanged.
- Sources: `src/lib/entitlements.ts`, business Home loader; guard and real Home-loader regression suites wired into `npm test`. Existing booking/accommodation/portal suites exercise affected downstream surfaces. No visual/layout change; theme and device presentation remain existing components. Revert these two application changes for rollback without changing data.
- Session freshness: successful team additions invalidate both localized Home pages. `BusinessTeamRefresh` refreshes the managed list on window focus/visibility return and every 30 seconds while visible, preserving client filters and suspending hidden polling. Tests exercise timer/listener cleanup. The existing portal browser adapter is extended with a disposable router.
- Live read-only investigation: the screenshot assignments belong to the reported teammate account. That account is already an administrator; a read-only authenticated-role SQL transaction returns both rows and true workspace access. Therefore the ordinary-user guard defects alone do not explain his specific open-session symptom; list freshness is addressed, but his authenticated browser reproduction remains unverified. No real permissions or account data were changed.
- Validation: 8 admission tests, 4 real Home-loader EN/ES consumer/admin tests, refresh lifecycle and existing portal component tests PASS. Full `npm run check` PASS (414 general, 5 subscription, 27 dedicated, 2 conflict, 41 automation tests and production Next build; dedicated loader subsequently expanded from 2 to 4 passing cases). Cloudflare packaging pending. Local portal browser launch is blocked by absent Chromium; Playwright browser download failed. `npm run test:e2e` reached the server but its readiness route fails because Supabase runtime variables are absent; this is not authenticated acceptance. CI browser evidence and production verification remain pending. No release claimed.
- Final local validation: Cloudflare packaging PASS after replacing reused dependency symlinks with physical local dependencies (the symlink attempt failed native Sharp bundling). Final guard and Home/refresh/portal rerun PASS, 23 cases, including four consumer/admin locale loader cases; focused lint, typecheck, formatting and diff checks PASS. Automatic approval review rejected the GitHub push as unapproved external publication. The fix is committed locally; no PR, remote CI or production deployment has occurred. Publishing requires user approval, then CI browser and authenticated live verification remain necessary.

## 2026-10-11 | Staff ownership claim counter and two-recipient new-claim alerts

- Report: Staff overview showed “0 por revisar” despite a pending claim in Moderation → Reclamaciones, and staff discovered new ownership requests only by visiting the queue.
- Root cause: Staff overview omitted `venue_claims` from its count; submitting a new claim inserted only into `venue_claims`, with existing emails emitted only after review decisions.
- UI: Staff homepage separately displays pending ownership claims and includes them in total pending review; distinct direct moderation link; unavailable count displays dash, not fake zero. Existing venues/events/offers/community counts remain separate.
- Email pipeline: transactionally queue one private alert on new `venue_claims` INSERT, immediately attempt sending from the claim action, then recover via existing Cloudflare cron every five minutes. Resend-backed sender already used for claim-decision messages; the two fixed recipients are alex@akipasa.com and andrew@akipasa.com. Google Workspace receives ordinary email without Gmail API authorization; sending _through_ Workspace would require additional credentials.
- Privacy/security: static recipients; no applicant PII/evidence in outbound notification; protected review links; service-only outbox leasing/ack; status, attempt, ambiguous-delivery and permanent failure logging. No new public response or bypass to moderation roles. Account export covers the claimant's outbox row.
- Tests: PGlite tests of staff count authorization and no-backfill/private new-claim trigger; unit tests of dual-recipient sender, idempotency, provider errors and dispatcher acknowledgment. `npm run check`, Cloudflare packaging, staff EN/ES browser and release endpoint must pass before merge. Supabase migration before app, safe rollback via application revert keeping additive tables.
- Limits: an email accepted by a provider is not proof of inbox delivery. Existing pending claims are **not** backfilled. Customer claim-decision emails continue their separate queue.

## 2026-10-11 | Publish structured AkiBusiness claim form

- **Bug:** the live /business?view=claims form contained only a giant evidence textarea, even though Staff expected applicant name, phone, and business contact details. The earlier structured-form PR was never merged.
- **Surfaces:** `src/app/[locale]/business/page.tsx` (bilingual responsive form), `src/app/[locale]/business/actions.ts` (Zod + private `claim_details`), `src/app/[locale]/staff/StaffQueue.tsx` (explicit unverified applicant data), `src/app/globals.css` (mobile/light/dark), two mirrored migrations and tests.
- **Invariants:** profile/account email is not rewritten; unverified business website and phones are private claim metadata, not public venue fields. Existing owner-approval/denial policy, RLS, staff-only read RPC, subscriber decision emails and staff submission-alert trigger/dispatcher remain intact. No retroactive data from old claims; missing fields display “not provided.”
- **Release order:** run format/lint/typecheck, PGlite staff-only claim tests, EN/ES rendering checks, Cloudflare and browser builds; apply additive Supabase migration before merging. Verify the new form is present on the business hostname after deployment.
- **Rollback:** app-only rollback of form/UI; retain claim metadata and audit evidence. Do not delete pending claims or re-trigger notifications.

## 2026-10-11 | Premium focused ownership-claim review UI

- User observation: Moderation > Claims repeated the same applicant data in several ugly stacked blocks and required scanning too far for decision buttons. Approved mockup: compact claim summary, separate applicant submission vs canonical venue/profile, supporting evidence, decision actions, checklist and references. No unlicensed venue thumbnail or fake verified flag.
- Scope: `src/app/[locale]/staff/StaffQueue.tsx` selects one claim from the staff-gated loaded page and keeps other queue rendering unchanged; `ClaimReview.tsx` displays safe, responsive focused cards; `claim-review.css` provides scoped dark/light styling; `staff/moderation/page.tsx` passes claim selector, retains role gating/pagination and hides irrelevant auto-publication controls in Claims. Staff changes are EN/ES, regular venue and accommodation, phone/tablet/desktop/split-screen.
- Invariants: selected claim ID is matched to existing 20 authorized rows rather than fetched by arbitrary ID. Existing `moderateItem` `approve/reject` audited RPC, reason requirement, current page and customer decision emails preserved. Mailto Request More Information only composes in the local client; no new workflow state or promised outbound email. Guide checkboxes are ephemeral and explicitly non-audited. Canonical venue/account data shown once without modifying it; applicant-submitted data stays visibly unverified and separate.
- Validation: bilingual jsdom claim review/navigation assertions, selector and action form checks, browser Playwright layout and horizontal overflow at 360, 600, 1536 and 640x400 in light/dark; full `npm run check`, Cloudflare build, and other moderation queue smoke tests before merge. No SQL migration or content changes. Live Cloudflare publication and actual authenticated reviewer actions require separate verification. Rollback is app-only.

## 2026-10-11 | Unified bilingual AkiSuite lifecycle notifications

- Request: venue claim received and staff emails, four distinct product welcomes, confirmed event/stay messages, two-day saved event / five-day saved stay nudges, cancellation updates and a complete roadmap of useful notices.
- **Current:** Existing separate claim decision and booking confirmation queues remain; new `suite_email_outbox` adds receipt, first-visit welcome, pending booking request, cancellation and optional reminders. Verified `support@akipasa.com` sender templates. Separate HQ repo's welcome hook must ship with the public DB RPC.
- **Cross-domain:** Shared Supabase user, /[locale]/layout and AkiDuermo pages control first product visits; the AkiBusiness claim server action snapshots locale while retaining existing structured fields and staff alert dispatch; AkiHQ JavaScript queues after authorised workspace login. Existing /api/stays/saved and /account/saved act through authenticated RPCs.
- **Safety:** no old claim/booking backfill, marketing reminders require opt-in and current saved state, provider keys never embedded, stable idempotency, staff recipient list fixed, confirmed booking sender independent from pending request notice, cancellation only on a real status transition, no changes to Stripe subscriptions or fiscal invoices. Consent/preferences off by default.
- **Dependency map:** master auth + account saved + AkiBusiness + AkiDuermo + event booking -> guarded Supabase functions and immutable outbox -> scheduled worker -> Resend provider -> verified recipient. Existing booking and claim decision notifications untouched apart from from-address branding.
- **Validation:** suite contract, bilingual templates, dispatcher mock/provider errors, existing booking/claim regressions, PGlite safety, EN/ES responsive portal checks, full Next/OpenNext builds. SQL migration before master merge. Production Cloudflare secret correctness and actual end-to-end sends require separate verification; direct Resend previews do not prove worker credentials. Rollback app without deleting queued history.

## 2026-10-11 | Surface unsent claim-decision emails after provider 403

- **Observed live failure:** latest rejected claim plus four earlier moderation decisions persist, but all five customer outbox jobs are `blocked/provider_403`; three staff alerts and one suite notification also failed with 403. Provider IDs absent. The existing Staff UI only said the decision was recorded.
- **Change:** `moderateItem` preserves its authoritative audited status update, observes provider acceptance from the existing `dispatchClaimDecisions` result, and redirects with `mail=sent` or `mail=not_sent` for claim decisions only. An authenticated EN/ES Staff notice warns when the email send is unconfirmed. No sensitive recipient/payload/provider details are put in URLs. Non-claim moderation redirects are unchanged.
- **Dependencies/risks:** Staff desktop/mobile/theme presentation uses the existing notice style. No Supabase schema, permission, queue, sender, booking, accommodation, AkiHQ, consent or admin-email recipient change. Delayed cron sends may succeed later; the notice truthfully describes only immediate provider acceptance. Code cannot repair a bad production Cloudflare secret.
- **Tests:** claim-decision provider 403 dispatcher regression and static moderation redirect/notice contract. Full CI/browser verification remains required before merge; no production mail or blocked-row replay was attempted. Operator runbook: `docs/CLAIM_EMAIL_403_RECOVERY.md`.
- **Rollback:** revert action/page/contract-test changes only; retain immutable recorded mail failures. Repair worker secret and perform individual approved requeue after proven live sending.

## 2026-10-11 | Standardize all app-owned Resend mail on the support address

- Requested sender: `AkiPasa Support <support@akipasa.com>` through Resend (reply to support). Confirmed claim decision, staff alert, suite email and booking dispatchers already use Resend; removed the last configurable From override in the booking confirmation implementation.
- Surfaces: AkiPasa EN/ES confirmed venue/event reservations, AkiDuermo confirmed stays, AkiBusiness claim decision and staff notifications, shared suite welcome/requests/cancellation/reminders. No other production function behavior, database schema, recipient, plan or role changes.
- Testing: extended suite email contract to require the booking sender's Resend endpoint and fixed From/Reply-To and forbid legacy overrides. GitHub CI and browser acceptance must pass before merge. This does **not** resolve the actual Cloudflare API-key 403 or send historical blocked messages; see `docs/CLAIM_EMAIL_403_RECOVERY.md`.

## 2026-10-11 | Resend connection incident: canonical key priority

- Live evidence: newest claim denials at 12:02 and 12:09 UTC also `blocked/provider_403`, making seven failed claim-decision sends. A single direct Resend diagnostic to the owned inbox was independently marked delivered using the verified support sender; no matching Worker requests appeared in the connected Resend logs.
- Suspected cross-account credential drift: runtime source chose `CLAIM_RESEND_API_KEY` ahead of the corrected general key, despite identical sender/recipient behavior. This can shadow a valid `RESEND_API_KEY` and cause a separate account/domain permission rejection.
- Fix: central `resendSendingKey` selects `RESEND_API_KEY` first and uses claim-specific secret only as a backwards-compatible fallback. All claim, staff, suite, venue booking and AkiDuermo booking modules use it. The caller's role, security, queue leases, locale, send From and Reply-To, recipients and UI do not change. No migration.
- Tests: assert canonical selection when both secrets exist, legacy fallback, and real mocked claim delivery Authorization header. Contract assertions cover all dispatcher consumers. Required gates: full check, EN/ES browser and Cloudflare build. Live end-to-end validation and any requeue are deferred to corrected Cloudflare credentials.

## 2026-10-13 | Canonical Resend recovery instruction

The claim-email recovery runbook inspects production `RESEND_API_KEY` first, matching `resendSendingKey` in `booking-mail-delivery.ts`. Only absent or blank primary keys use legacy `CLAIM_RESEND_API_KEY`; rotating that fallback cannot repair an invalid nonblank primary. No keys, runtime configuration, queue status or messages are changed. Existing key-precedence regression coverage remains authoritative; live credential repair and individually authorized requeues are operational dependencies, not accomplished by this documentation change.

Canonical-key recovery validation: the existing `tests/claim-decision-email.test.ts` suite passed 10/10 cases on 2026-10-13, including trimmed primary-key selection, absent/blank-primary legacy fallback and dispatcher selection. The isolated command retained the existing timeout limits; no credentials or real messages were used. Required exact-head CI remains the merge gate.

## 2026-10-11 | Anchored overlay for sticky mobile workspace menus

- **Observed:** On Account/Staff/Admin, the menu button stayed at the mobile viewport top but opening it created an in-flow section near the page's beginning; the user had to scroll back upward to use its links.
- **Source/root cause:** Shared `src/components/WorkspaceShell.tsx` places the trigger, desktop navigation and conditional drawer; the late `src/app/globals.css` mobile override intentionally forced `.workspace-drawer-layer` and `.workspace-drawer` to `position: static`.
- **Fix:** Group the mobile trigger/drawer inside a sticky, desktop-hidden wrapper and absolutely position a height-limited independently scrollable panel beneath the trigger. Keep underlying content in place. Escape returns focus, outside pointer closes, navigation closes, breakpoint transition closes; render mobile navigation without stealing the desktop scroll ref.
- **Matrix:** EN/ES, Account/Staff/Admin, mobile/tablet at <=850px incl. landscape/short heights, light/dark and authenticated roles; >=851px desktop remains unchanged. Staff/Admin role gates continue on the server.
- **Dependencies:** UI/CSS only; no database, permissions, Supabase queries, cross-portal claims, bookings, billing, mail, analytics, storage, translations or API behavior. Routes and menu links remain unchanged. Rollback via UI/CSS/test/docs revert, with no migration.
- **Tests/evidence:** Expanded `tests/workspace-shell.test.tsx` to assert anchored wrapper, close interactions and CSS contracts in each route family. `npm run check`, CI browser evidence and authenticated production smoke remain pending; no claim of a tested live deployment.

## 2026-10-11 | Full-width Staff operations without audit disclosure

- **Requested:** Remove Staff's duplicate side audit and its full-audit navigation/permission; let the day-to-day Staff surface use the available width. Retain the more complex Admin dashboard for privileged operators.
- **Observed root causes:** `src/app/[locale]/staff/page.tsx` read the last six `moderation_actions` in an always-present right column; Staff layout and `/[locale]/staff/audit` offered full history. The existing database `moderation_actions_operator_read` SELECT policy explicitly allowed `moderator` as well as `administrator`, making UI-only hiding insufficient.
- **Changed:** EN/ES Staff page now uses all horizontal space for priority workflows, live counts, support and secondary tools, without an audit fetch or tile; scoped CSS handles phone/tablet/desktop. Removed Staff layout link. Staff audit route rejects non-admin users server-side and redirects admins to the Admin audit. Legacy view=audit goes to Admin. Admin audit adds an explicit page-level role check without changing display/queries.
- **Authoritative gate:** mirrored `20261011204631_staff_audit_admin_only_20261011.sql` ALTER POLICY on `moderation_actions` restricts direct authenticated SELECT to admin app role. All moderation insert/update RPC paths and records remain intact. Safe deployment ordering: apply migration before exposing the redesigned Staff UI; verify existing role assignments and confirm protected database reads before promoting.
- **Tests:** new `tests/staff-audit-access.test.ts` executes the policy in disposable PGlite for role split; source checks assert no Staff audit path/query and preserve Admin. Existing Staff moderation and role tests remain. Run `npm run check`, Cloudflare packaging and mobile/desktop EN/ES/browser checks; production role smoke must be verified separately.
- **Rollback:** UI revert + reviewed policy reversion if necessary, with no audit data deletion, claim decision replay, or booking/email change. No production migration/merge confirmed at drafting.

## 2026-10-11 | Staff promotions inbox instead of long text cards

- **Current UX:** Staff Promotions renders the last 50 rows as unfiltered, lengthy message and operator-note paragraphs underneath a duplicated Operations heading. Reported crowded desktop, tablet and small-screen appearance.
- **Requested:** concise, task-first Staff Promotions with controls to find requests quickly. No change to Admin commercial management.
- **Change:** `src/app/[locale]/staff/promotions/page.tsx` retains the bounded authorization-backed read; adds explicit moderator/administrator check and query-error feedback. New `StaffPromotionsInbox.tsx` displays compact cards with venue, localized service, status, date and short preview; full original message/notes on native disclosure; searchable and filterable recent-50 subset. `staff-promotions.css` eliminates only the route's duplicate global heading and styles EN/ES/light/dark/responsive windows.
- **Impact graph:** authenticated Staff layout -> authorized recent `promotion_requests` SELECT with `venues(name)` -> server normalization -> local UI filters. No DB migration, privileged write, state transition, booking, emails, billing, maps, storage, analytics, AkiBusiness or Admin page changes. Unknown states/services remain present in All; SQL errors are distinguished from no data.
- **Test:** `tests/staff-promotions-inbox.test.tsx` guards bilingual content, search/filter, detail expansion, HTML escaping, empty state and absence of mutation forms. Run complete `npm run check` and CI tablet/Cloudflare gates before merge. Deployment can roll back via UI-only revert; existing requests remain intact.
- **Existing tablet-gate repair:** An unrelated shared Business/Duermo header browser test asserted `boundingBox().height === 44` exactly, but Chrome returned `43.999999046325684` for a nominal 44px button. `scripts/test-portal-home-browser.mjs` now uses `toBeCloseTo(44, 1)` for width/height. No production header layout or click targets changed; this retains 44px acceptance while allowing subpixel rounding. Rerun the real browser matrix before merging.

## 2026-10-12 | Unified Admin suite and Rewards Centre

- **User issue:** rounded gradient page headings clip Spanish eyebrow/description, oversized duplicated "Administración" header appears on every Admin subpage, navigation has separate Passport/Grant/Achievement sections, audit/business/commercial/passport/flags lists lack efficient search.
- **Source audit:** `src/app/[locale]/admin/` route inventory includes Overview, User directory + identity details, Business Applications, Promotions, Privacy, Audit, Catalogue/categories/cities, Venue Relevance, AI Team, Personalisation, Settings, Passports/award grants, Achievements + venue categories. User search, relevance pagination, AI team tabs, achievement filters, and Award member lookup existed already. Missing local finders targeted only bounded lists. No new backend search endpoints are invented.
- **Shared design:** optional `WorkspaceShell.hidePageHeading` used by Admin; `admin-suite.css` adds safe padding/wrapping to section headers and long content, status pills, responsive control/row layouts without changing account/staff/business. Admin top navigation groups three existing rewards routes under one active Rewards item; tabs embedded on Passports, Grants, Achievements and the venue category child route. Old links and privileges remain.
- **Data:** `AdminSearchList` filters only server-authorized rendered rows in memory (existing limits, most importantly audit 150/business 100/cities 100, no claim of searching all database pages). Controls retain every original form with server actions/hidden record IDs/reasons, and never mutate on search. Admin lists and AI team loaded task/schedule/approval/activity now have search. Specialist user directory, relevance proposals, award lookup and achievement manager keep authoritative search.
- **Risk matrix:** EN/ES, dark/light, 360px/390px/tablet landscape/desktop/short split viewport; passwords/account deletion and reward grants gated by current Admin layout and existing server/RLS rules, no new scope. Venue claims, booking inventory, transactional email, usage ledger, Stripe, audit history, member XP and Rewards data untouched.
- **Tests/rollback:** `tests/admin-suite.test.tsx` covers search filtering/status/reset, unified tabs, retained privileged forms/routes. CI full check, browser matrices and Cloudflare package are release gates; authenticated production UI smoke remains required for complete acceptance. No DB migration. Roll back UI commit if regressions; do not replay mutations.

## 2026-10-12 | Admin commercial requests and user-search overlap follow-up

- Screenshot regression: Users & Roles search label/help text intersect the rounded input, while commercial requests render as oversized unstructured accordions with expanded forms that feel like a text minefield.
- UI-only: Admin-scoped CSS makes search label, input and helper separate grid rows, preventing overlap at tablet widths; commercial request summaries become compact and details group message + editable fields with sensible spacing and mobile one-column dates.
- Preserves Admin authorization, server-side user search, request IDs, form actions, promotion status, event selection, dates and internal notes. No SQL/RLS/data mutations, changes to Staff or other AkiSuite apps. Verify EN/ES, dark/light, tablet landscape and portrait. Rollback via revert.
- **2026-10-12 follow-up (disclosure indicator):** Admin Business Applications `settings-disclosure full-width-disclosure` uses global disclosure chevron borders, but Admin stylesheet also injected `+`/`−` into the same `summary::after` pseudo-element. These combined visually into an X plus an arrow. Add a narrowly scoped CSS override that renders only one 45° chevron (225° when open), hides the native marker, and leaves the existing summary button and audited action form untouched. Source-regression test `tests/admin-suite.test.tsx` checks the two states. No permissions, migration or API changes.

## 2026-10-12 | Three one-screen Admin master-detail workbenches

- **User intent and evidence:** Catalogue Categories currently presents a full-width vertical form per expanded item; Relevance displays repeated evidence/form cards across ~1,505 pending proposals; Configuration similarly expands full-width flag forms. In tablet landscape, excessive unused horizontal space and long vertical scrolling obscure the active workflow. Explicit requirement: desktop, tablet **and phone**, not tablet alone.
- **Source/dependency tracing:** `/admin/catalogue` loads categories or top 100 cities and delegates form actions `saveCategory`/`saveCity` to `src/app/[locale]/admin/actions.ts`; `/admin/settings` loads flags and delegates `updateFeatureFlag`, which invokes `set_feature_flag` RPC. `VenueRelevanceReview` uses authenticated `/api/admin/venue-relevance` GET and POST with fingerprint checks, stale protection, weight bounds, a 10-character reason and server-side authorization/RPC. Both route families are under `src/app/[locale]/admin/layout.tsx` administrator role guard. No new permissions, data source or backend pagination route was added.
- **Implementation:** new client `AdminWorkbench` handles selection, in-memory search/status and new category/city pane, rendering exactly one original Server Action form at a time with original IDs/reason inputs. Relevance becomes a paged proposal queue plus one selected decision form and evidence. New `admin-compact.css` uses desktop wide 30/70, tablet 38/62 and phone records/editor switch <=700px. Under short landscape windows, bounded internal scrolling keeps actions accessible. Client search only covers rows already loaded; API relevance search is server-backed and paginated. Do not claim whole-database search for cities.
- **Matrix:** >=1450px desktop, 701–1080px tablet (portrait/landscape and split-screen), <=700px phone, <=600px tall-short viewports; ES/EN labels, light/dark token styling, touch/keyboard. The existing authenticated actions and stale-row handling must stay intact, and actual live authenticated cross-device smoke remains needed.
- **Risks/rollback:** React Server Action form slots are passed as ReactNode content to an RSC-compatible client presentation component, following the existing `AdminSearchList` pattern. No migration/RLS/API schema, ledger, booking, map, media, analytics, email or account mutations. Revert files if forms do not hydrate correctly; never replay submitted actions. `tests/admin-compact-workbenches.test.tsx` covers selected editor, mobile panes and decision POST. Run full CI and Cloudflare package before requested merge; merge is not proof of live Cloudflare deployment.

## 2026-10-12 | Account workspace overhaul and Spanish text integrity

- Request/evidence: uploaded Account Saved, Following, Bookings, Activity, Premium and Settings screenshots show clipped left-hand labels. The shared consumer header resets padding to zero while another rule retains rounded overflow clipping. Repeated generic Account banners and inherited 12-column placements consume space and hide useful controls. User requests a complete responsive account overhaul, Progress removal in favour of Passport, and repair of corrupted Spanish accents.
- Before editing: traced every Account route and layout, WorkspaceShell, AccountItems, AccountWorkspacePortals, MyBookings, profile/media, MembershipPicker, PersonalisationSettings, auth/terms guards, account actions, consent, subscription/calendar/export endpoints and current Admin compact workbenches. Matrix: EN/ES, light/dark, Free/Premium, anonymous/authenticated, consumer/staff/admin, phone/tablet/desktop/short split window, empty/populated/error and long names.
- Scope: dedicated AccountPageHeader and account-only styles; generic hero hidden with existing WorkspaceShell opt-in, all wider-screen navigation destinations visible, contextual cards/actions and native edit disclosures. Old /account/rewards retains requireUser and redirects to localized /passports; overview links there directly and stops reading the duplicate XP ledger. Saved/following summary reads explicitly scope the signed-in profile and show unavailable counters as unavailable.
- Dependencies preserved: existing server actions/IDs/authorization/RLS and locale destinations, opt-in reminder defaults, booking status/pagination/cancellation, profile/media uploads, email/password confirmation, subscription checkout/portal and signed payment entitlement, privacy/export and typed account deletion. No user identity, consent, billing, booking record, reward grant, map/search indexing or external email mutation is part of UI validation. Disposable browser fixture actions never contact real recipients.
- Encoding investigation: tracked source and current public auth/privacy DOM retain proper UTF-8. Read-only live SQL found historical mojibake in category labels literature/tradition and feature flag recommendation_reasons, despite correct source migration literals. Server and client encodings are UTF8. Only exact verified textual corrections may be repaired; no broad reinterpretation of valid names, IDs, values or flags. Final scan/repair results are recorded below.
- Validation status at implementation: component/browser tests, full npm run check, npm run test:e2e and Cloudflare packaging pending. Account browser harness uses actual route components with isolated Auth/database/action adapters; it does not establish authenticated production acceptance. No merge/deployment yet. Rollback: revert Account source and restore only documented original labels if required; never restore data by replaying user actions.

- Encoding repair verified: `database/repairs/2026-10-12-spanish-ui-copy.sql` passed disposable PGlite checks for exact-row correction, retained IDs/English labels/feature states, repeat no-op and preservation of later edits. Applied the same SQL under the user's text-fix authorization: literature = Literatura y poesía, tradition = Tradición, recommendation_reasons = Motivos de recomendación. Read-back confirms all three and zero remaining markers across the checked system label tables. Published venue name/Spanish description scan found only the legitimate name Âgora Café Bar, which was retained. New source UTF-8/mojibake regression passes. This fixes verified historical stored-copy drift; it does not claim to diagnose an unseen example elsewhere.

- Release evidence: the existing read-only `/api/bookings/release` response includes `accountWorkspace: 2026-10-12-account-suite-v1`. This additive public build marker has no account data or credentials and leaves existing booking/mail markers untouched. It distinguishes the connected deployment from a successful GitHub merge without requiring a production login. Authenticated account smoke remains separate.

- Integration evidence: merged current public `master` at `c651a69` into the work branch, retaining the AkiPals release and its tests. `npm run check` passed with 641 tests across app, database conflicts and automation, plus formatting, lint, TypeScript, database safety, automation Worker dry-run and production build. Cloudflare/OpenNext packaging also passed. Generated browser bundles under `test-results` are excluded from lint just like other generated reports; harness and test source remain checked.
- Account browser evidence: 282 route/locale/theme/viewport and boundary cases passed, followed by 60 targeted cases after correcting two visually observed inherited-grid problems: Overview implicit columns and the old Profile marker placing its title under navigation. New assertions cover both defects. All ten current account screens were visually inspected; long accented labels, native disclosures, original action fields, opt-in preferences and authenticated legacy Passport redirects are exercised with disposable data.
- Wider browser acceptance traced stale homepage/Passport selectors to the current search overlay, location picker, mobile Passport drawer and explicit auth routes. Existing motion-feedback and 44px touch assertions revealed real Passport CSS issues: `display:none` hid the existing status from sight and assistive technology, while several phone controls were 38–42px. The CSS-only repair restores wrapping feedback and minimum 44px controls; no sensor permission, consent, state, storage, API or reward behavior changes. Full production-server E2E and connected live release verification remain pending at this checkpoint.
- Failed-read follow-up: Profile no longer exposes blank edit/upload forms after a query error; Privacy distinguishes unavailable consent/deletion status from Off/no request; Membership offers recovery before new checkout when any of its four access reads fails; Manage billing remains available when the customer read succeeded. Successful missing-row defaults, original consent API/form actions, export, checkout attribution and confirmation refresh remain unchanged. This is UI recovery, not a change to backend billing authorization or duplicate-payment guarantees. All 51 focused Account tests pass, including 15 new failure/default cases. Four Profile plus eight Privacy/Membership browser failure cases pass at 360/1536px in EN/ES; screenshots were inspected. The default Account browser matrix now contains 302 cases.
- Final Account browser matrix passed 302/302: 240 normal screens (ten routes, EN/ES, both themes, six viewport sizes), 60 boundary cases and two localized legacy Progress redirects. Full results and reviewed screen captures are preserved as browser evidence. Broader public acceptance also retains exact auth/status/SEO/consent checks while following current menus/forms. Map legend touch sizing is corrected from 36px to at least 44px in its existing scoped selector. CI also exposed the undersized native MapLibre attribution summary: its toggle and compact wrapper now have matching 44px dimensions, with reserved space for expanded attribution text. The map stylesheet test distinguishes the standalone vendor selector from legitimate scoped layout rules; no map bundling change was needed.
- Public test infrastructure supplies read-only synthetic venue discovery and details on an explicitly configured disposable localhost port: 2,105 records exercise 20-card nearby paging, the real Next map API's 2,000-record cursor continuation and the existing venue detail renderer. The fixture permits the two pagination RPCs, the public catalogue read (no catalogue), published venue lookup by slug/ID, and empty event, offer, loyalty, media, booking-setting and feature-flag reads; unsupported requests and all writes are rejected. The runner enables the existing Supabase repository only for its Next child through a private server-only flag, with independent guards requiring the fixture provider and the same build-time uncredentialed loopback HTTP URL used by the public client. Ordinary fixture, Supabase and hybrid deployments retain their existing selection. The E2E runner starts/stops the fixture with its production server, and CI runs the full public suite including exact 200 checks for synthetic card links. This does not authenticate users, forward requests or claim PostgreSQL/RLS integration. Authenticated production acceptance still requires separately supplied disposable QA credentials.
- Final repository check passed after the recovery, public CSS and fixture-detail fixes: 680 tests (637 application, two database-conflict and 41 automation), formatting, zero-warning lint, TypeScript, database safety, automation Worker dry-run and the production Next build. The 24 new provider-guard cases verify exact opt-in, unchanged ordinary providers, safe local URLs and server-only selection. The final full public E2E run and CI Cloudflare package are release gates; their final outcomes and the connected live marker are recorded in the release PR.
- Native map interaction follow-up: 44px sizing alone did not catch Privacy intercepting attribution on narrow screens or Support covering it on desktop. Scoped responsive offsets reserve space for all three controls and the short-window geolocation column; the map status caption wraps within its available horizontal space. A deterministic, tileless basemap response supplies attribution to the actual MapLibre control in one added public test: EN/ES, five viewport sizes, native disclosure clicks, control/container bounds, privacy reopening and screenshots. No forced clicks, hidden controls, consent saves or production map-style changes are used. At this checkpoint, before integrating Spotlight, the public suite contains 78 cases. A separate AkiDuermo test race is corrected by waiting for the canvas before marking it and always checking that filtering preserves that same canvas; the previous independent conditional counts could mark nothing and later assert against a newly loaded canvas. Application map lifecycle behavior is unchanged. Final focused, full-suite and CI results remain in the release PR.
- Latest release integration retains public `master` at `4443b12`, including the Aki Spotlight venue/event layouts and all their test gates. Both the Account and Spotlight component suites remain in `npm test`. Generic public E2E now discovers 106 cases: the 28 Spotlight cases have an explicit separate-fixture gate and run through the mandatory `npm run test:spotlight:browser` command in tablet CI; the existing authenticated-production case retains its credential gate. These separate suites rebuild with different disposable backends and must run sequentially locally. Final combined check, browser and deployment outcomes are recorded in the release PR.

## 2026-10-13 | Recover PR #120 starter catalogue publication review

- Evidence: #120 fixed immediate draft saves by providing nonempty New item / Nuevo elemento names, but blankCatalogueItem also defaulted visible=true and priceCents=0. Publishing unrelated changes could expose unfinished starter rows.
- Trace: blankCatalogueItem -> VenueCatalogueEditor.addItem -> existing explicit visibility checkbox -> translated draft document -> save_venue_catalogue. SQL validates nonempty names even for hidden drafts; publishing and food-index generation already respect visibility. PublicVenueCatalogue filters hidden rows for venues and event-selected sections.
- Repair: only newly added rows default hidden. Keep starter names, zero price, variants and unknown-allergen defaults unchanged; no name heuristics, automatic visibility, price restriction or rewrite of existing documents. EN/ES editors can explicitly enable visibility using the existing control.
- Paths: src/lib/venue-catalogue.ts, focused foundation/public-rendering tests registered in existing AkiDuermo Vitest group. No schema, RLS, auth/venue membership, API, Storage, paid entitlement, email, booking, analytics, consent or live-data change.
- Validation: foundation and EN/ES rendering tests verify starter exclusion, explicit visibility, preserved existing visibility and legitimate zero/custom prices. Full repository checks/CI and deployment remain required; no authenticated production editing is claimed. Rollback via source revert; no data restoration.

## 2026-10-12 | AkiBusiness catalogue unable to save

- Reported: multiple editors cannot add/remove catalogue items or categories; the UI returns generic permission guidance.
- Evidence: authenticated save RPC returned repeated HTTP 400 on October 12; matching PostgreSQL `Invalid item` logs. Existing persisted items pass database item-shape checks. The client creates new items with blank names, while the database requires a non-empty title for draft saves as well as publish.
- Changed: bilingual default names in `src/lib/venue-catalogue.ts`, precise catalogue-error routing in `src/app/[locale]/business/venue/[id]/actions.ts`, localized error guidance in `page.tsx`, and starter item regression test.
- Security: venue access and SQL/RLS unchanged. Published allergen confirmation enforcement unchanged. Existing catalogue records unchanged. Other portals, translations of existing content, API and SEO unaffected.
- Rollback: revert code-only commits; no schema or data migration.
- Checks: no local Node checkout in connector runtime; full npm, browser E2E, Cloudflare build and authenticated live checks unverified. Do not merge without green checks and release approval.

## 2026-10-12 | Independent AkiSuite catalogue foundation (NOT LIVE)

- Request: separate AkiBusiness marketing from AkiHQ operations, AkiDuermo and consumer premium, with 20% annual discount and bundle.
- Change: add typed standalone catalogue with pricing and composition tests; add staged rollout and rollback documentation. No checkout, DB, webhook, media or event behavior changed.
- Dependencies: existing Stripe billing and migrations use legacy premium/business/business_pro; the staged catalogue does not grant access. Locales, routes, analytics, claims and storage untouched.
- Verification: review only; no npm check/CI or Stripe live transaction verified. Do not merge without verified checks. Rollback: revert new files and documentation.

## 2026-10-12 | Staged AkiBusiness Growth overview

- Request: move toward a responsive AkiBusiness Growth marketing dashboard and accurate new tier positioning.
- Before: Growth view contained only commercial promotion requests; analytics was a separate view.
- After: Growth presents authorised venue and event counts, existing per-venue engagement RPC results and quick links, followed by the unchanged promotion request flow. Premium capabilities are labelled coming later, without functioning checkout or fabricated statistics.
- Dependencies: BusinessPage auth/permissions, venue_members and venue_analytics RPC, managed events, responsive CSS, EN/ES. No schema, data mutation, Stripe, cloud environment or scheduled job changes.
- Checks: CI required on updated head; no local execution claimed. Rollback: revert Growth component/CSS and BusinessPage integration.

## 2026-10-12 | Staged AkiSuite Stripe mapping

- Added isolated Stripe price ID mapping/validator for all seven new commercial plans, plus unit tests for annual/interval/amount mismatch and HQ add-on eligibility.
- Does not touch live Stripe products, old membership pages, webhook code, database migrations or existing entitlements. Checkout remains inactive pending cross-portal rollout.
- Live merchant ambiguity: connected account named Alex Ashing LTD; no Tax registrations surfaced. Do not launch without confirmed merchant of record and VAT settings.
- Regression: new Stripe tests plus existing legacy checkout and webhook suite, app check and E2E required. Rollback by removing adapter and tests.

## 2026-10-12 | Staged multi-plan Stripe ledger and checkout guard

- **Request:** distinct AkiBusiness marketing, AkiHQ operations, AkiDuermo and consumer plans, Enterprise bundle, 20% annual savings, safe legacy migration.
- **Change:** separate AkiSuite Stripe ledger plus RLS/SQL RPC, signed webhook dispatch into new ledger, disabled-by-default checkout action with account/tax/price gates and duplicate-payment checks, and focused regression tests.
- **Dependencies:** existing `billing_customers`, Stripe webhook event lock, profile reconciliation, CRM AkiHQ gates, venue ownership, legacy subscription records, AkiBusiness/AkiDuermo EN/ES and Stripe Tax. No live Stripe write performed. No customer-facing new checkout enabled.
- **Risk:** account connected as Alex Ashing LTD with unrelated products and no tax registrations; current staging attaches plan to billing profile, not a validated multi-location organisation. Production migrations require SQL/RLS and end-to-end tests; don't merge or provision paid resources until resolved.
- **Rollback:** revert application and SQL migration only after reviewing any new subscription records; never drop paid entitlements or overwrite legacy subscriptions.

## 2026-10-12 | Unified four-app membership centre

- **Requested:** clean, horizontal-space-efficient, responsive membership overview/management for AkiPasa, AkiDuermo, AkiBusiness and AkiHQ, plus `/membership` and account membership routes.
- **Before:** account subscription page displayed legacy three-plan billing cards and access records; public membership displayed a separate legacy picker; new suite UI was hidden behind readiness flags; AkiHQ lacked a central membership link.
- **After:** bilingual responsive hub and shared seven-plan grid; data grounded in per-user Stripe-backed subscription rows and grants; current legacy records remain valid; Stripe Customer Portal handles payment updates and cancellation; disabled new checkout unless readiness flags are set. On desktop app overview displays four horizontal tiles and a side summary; tablet/mobile collapse cleanly. Account aliases redirect and AkiBusiness sidebar includes membership. Separate AkiHQ PR #25 provides matching nav link.
- **Dependencies:** `billing_subscriptions`, `billing_customers`, `staff_billing_grants`; opt-in new AkiSuite table via `AKISUITE_SUBSCRIPTIONS_READY`, authenticated RLS, `openBillingPortal` server action, host-local EN/ES routing, workspace navigation, membership styling and account error/retry states. No direct Stripe charges or database mutations.
- **Release checks:** typecheck, formatting, unit + UI, EN/ES, phone/tablet/desktop, paid/legacy/missing-data grants, Customer Portal click and rollback smoke. The plan UI must not offer unavailable Premium benefits as purchasable.
- **Rollback:** revert hub and page integrations; leave existing customer subscriptions and Stripe products untouched. AkiHQ nav-only PR can revert independently.

## 2026-10-12 | Workspace Premium implementation and gated catalogue release

- **Scope and dependencies:** seven-plan catalogue and all EN/ES membership aliases across public AkiPasa, Business, Duermo and companion HQ; authenticated billing customer/subscription/grant reads; workspace ownership and existing member role templates; signed Stripe webhook, price allowlist and server Checkout; event/recurrence/moderation tables; shared private storage/media; consent-derived analytics; existing five-minute Cloudflare cron and release marker. Current master design and booking/room-night systems are retained.
- **Behaviour:** catalogue remains visible with checkout off. New ledger is workspace-scoped for business plans, customer read-only/service-write, chronology and ownership protected. Legacy billing/grants/free management remain authoritative. Superseded sales close without cancelling existing subscriptions. Replacement updates an existing Stripe item through hosted confirmation; ambiguous consolidation is refused. SQL checks enforce recurrence, template, media and report access. Recurrence uses IANA/DST exceptions/cancellation and duplicate constraints. Approved-content scheduled publishing and conditional add-on renewal use bounded service jobs.
- **Retention/security:** 15-image free workspace/250-image Premium allowances and fair-use bytes apply to future uploads only; existing content/files remain after downgrade. Storage accounting and folder tenancy are server-enforced. Consumer Enterprise access never propagates to employees; HQ tools retain role-template restrictions. No Stripe identity/tax registration or production schema changes were performed. All five activation flags and private database launch default false.
- **Evidence:** initial full check exposed an unused variable and old-tab tests; fixed and rerun. Focused AkiSuite SQL/RLS/render/routing/billing suites passed 76 tests. HQ full check passed 339 with one existing gated skip. Full check/package and remote CI outcomes are recorded in the PR. Local browser launch is blocked by OS socket denial, not a screenshot success. Earlier CI clipping and pricing expectations were investigated and repaired; action_required is unvalidated. Sandbox provisioning requires sign-in. Production baseline still has legacy membership and plural alias 404s.
- **Release limitations:** actual tax registrations absent; product tax codes unset and price tax behaviour unspecified; legal invoice/profile/descriptor reconciliation required. Disposable tests are a bounded schema, not a full production clone. No production migrations, actual sandbox charges, authenticated portal acceptance or live rollout claimed at this checkpoint. Disable checkout/feature/private-launch flags and revert source for rollback; retain customer data and legacy subscriptions. See the rewritten rollout contract for exact activation gates and outstanding checks.

- **CI follow-up:** the first current account browser run reached subscription rendering and then timed out on its old Business tab selector. Replace the interaction with seven-plan/annual payload checks and assert that disabled catalogue forms remain visible during billing errors. The actual ten-page browser bundle compiles. Updated shared-media checks deny new cross-venue reuse after downgrade while retaining existing placements; owner deletion checks every referencing venue through an authorised RPC. The publication worker now preserves both legacy Business tiers and staff grants without requiring a linked new workspace. New CI evidence remains required before merge.

- **Additional acceptance:** real SQL tests exercise AkiDuermo confirmed-night comparisons, retained cross-venue media after downgrade, global reference protection, conditional renewal queue and authenticated employee role-template restrictions. Account exports add only the payer's new billing rows and only after the schema-ready flag. Public CI's lone catalogue failure was an ambiguous Premium/add-on heading selector; exact heading matching retains both visible plans. HQ entry and offline-cache versions refresh the new navigation for existing installations. Full current checks and browser CI remain release gates.

- **Storage/billing enforcement:** restrictive Storage INSERT/UPDATE checks count physical objects and protect byte limits; Storage DELETE checks all shared references, and placement writes serialize against deletion. Gated public reads retain selected artwork and the existing fallback while protecting private bin contents. Policies use authorised definer wrappers, never direct calls into the revoked private schema. A staff grant or trialing Pro retains its legacy access but cannot qualify for a discounted paid add-on. Disposable tests exercise actual authenticated/anonymous roles and direct Storage writes, not just disabled buttons.

- **Release checkpoint:** HQ #26 merged at `21843db608932eea46d1e83d82b8481ee19b5767`; live bundle v36 and cache v110 verified. AP checkpoint passed repository/Cloudflare, tablet, booking and Pals CI; updated account/public browser selectors still require fresh CI. Workspace-wide media/template reuse requires explicit active company membership as well as venue rights; existing assigned assets remain usable after downgrade. Approval fingerprints now use SHA-256, and already-verified venue drafts can be scheduled without briefly publishing them first. Rollback after accepting any new payment must retain its billing adapter/jobs.

- **Production compatibility preflight:** zero current legacy recurrence rules. The connected `postgres` role is not a superuser or member of the Storage table owner (`supabase_storage_admin`); hosted policy-management permission remains a concrete disposable-schema validation requirement. No production DDL attempted to probe that permission.

- **Membership compatibility:** preserve origin through public/account sign-in redirects, permit named HQ workspace preparation without requiring a venue, and reject new-plan webhook customer-map reassignment. No global HQ profile upgrade or implicit venue verification.

Responsive catalogue screenshot review also corrected Spanish add-on wording and preserved whole words in compact disabled purchase buttons.

Live membership smoke verification found that the parent account layout replaced the subscription destination with the account root before page authentication. A server-derived, same-locale membership return header now preserves subscription/from through sign-in and terms acceptance; middleware removes caller-supplied headers, and unrelated account routes keep their previous return behavior. Regression coverage includes the actual layout guard, spoofed headers, and signed-out EN/ES browser aliases.

2026-10-13 membership presentation refinement (PR #129): Public AkiSuite pricing retains all seven plans and the existing checkout eligibility, amounts, intervals and entitlements. Compact two-column mobile cards and wider responsive desktop comparison reduce vertical card height; the billing-period switch and sector-specific AkiHQ tool exploration now follow the plan catalogue. Business categories only change displayed tools, never granted access. Billing/migration readiness flags remain unchanged. Validate responsive overflow, screen-reader disclosure state and locale-aware prices before production promotion.

2026-10-13 AkiSuite membership width/overlap follow-up: The membership-only shell now uses available desktop/tablet viewport width up to a 1720px bound while keeping responsive gutters. Catalogue cards reflow across wider screens, and the Enterprise card brand/header badge can wrap without label collision. No subscription billing, entitlement, feature flag, migration or checkout change. Validate EN/ES membership layouts on mobile, tablet and desktop.

## 2026-10-13 | Recovered Stripe tax-audit follow-up (#127)

Read-only live revalidation confirms the same approved account `acct_1SVLH2GfzDhsgsQZ` now displays AkiPasa Marketing S.L., all fourteen AkiSuite prices use inclusive tax behaviour, and all seven products have tax codes (AkiPasa Premium `txcd_10103000`, others `txcd_10103001`). Stripe Tax registrations remain absent. Technical classification and account display name do not establish legal identity or VAT approval. `docs/AKISUITE_PRICING_ROLLOUT.md` and the checked-in price audit must describe the same observed state; the obsolete unspecified-tax update instruction is removed.

The linked Supabase project's read-only schema probe found neither `public.akisuite_billing_subscriptions` nor `akisuite_private.launch_settings`. The two new migrations, hosted Storage DDL compatibility, legal registration, isolated payment lifecycle acceptance and authenticated portal validation remain release blockers. No flags, prices, products, registrations, subscriptions, permissions, schema or production data changed. Historic release-test claims remain dated evidence, not new validation. Documentation rollback is a source revert.

## 2026-10-13 | Exact source deployment verification

- Before: Booking live smoke accepted the constant October 9 feature marker and reported a hardcoded historical application commit, allowing success before the triggering source deployed.
- Change: successful clean-Git Cloudflare packaging writes an ignored asset source stamp. Existing read-only Worker release JSON resolves only the internal ASSETS binding and reports validated full source SHA or null. Smoke polls four public hostnames for the triggering GitHub SHA and original booking marker.
- Dependencies: `scripts/run-cloudflare.mjs`, source-stamp utility, Worker endpoint, ASSETS and booking-live workflow. No customer state, migration, billing/tax flags, auth, locale/theme/UI, email or external credentials change. Revert code/assets to roll back.
- Validation: targeted tests exercise clean/dirty Git, invalid stamp, exact current-host asset reads, legacy/missing/error responses. Full checks, packaging and connected production evidence remain required; none is implied by this entry.

- Review follow-up: remove the master-push path filter so every connected deployment, including dependencies/assets/config changes, receives exact-source verification.

### 2026-10-13 | Recovered venue media picker review defects

Unmerged PRs #121/#122 contained review findings still present after #123: search/folder controls consumed the gallery scroll row, and the modal lacked keyboard focus containment, Escape dismissal, restoration and slot-specific trigger names. VenueMediaStudio now groups controls into one intrinsic row and empty/results into the scroll row, with dedicated CSS preserving the event editor modal. EN/ES triggers identify the image surface; opening resets filters, focuses search, traps keyboard/programmatic focus and closing restores the opener. Existing upload/placement/Auto actions, permission checks, media inventory, accommodation header, event editor, billing and SQL remain unchanged. Rollback is code-only. Component regression tests exercise actual focus wrapping, Escape/close restoration, filter reset and variable-content DOM rows in both locales. Full check, responsive browser/Cloudflare CI and authenticated live owner acceptance remain required before deployment; no live storage/data mutation or deployment is claimed.

## 2026-10-13 | Recovered picker browser gates

Tablet CI now runs `test-claim-picker-browser.mjs` and `test-venue-media-picker-browser.mjs`. These exercise real components/CSS with disposable actions; no production records are changed. Local browser downloads failed; actual browser execution remains a CI release gate.

## 2026-10-13 | Recover current authority from historical handoff links

- **Observed:** README instructed new sessions to start with the July handoff
  and described August project status/July TODO as current. Those records
  retain historical prices, pending migrations and inconsistent acceptance
  boundaries, while the October master already identifies them as stale.
- **Change:** point README to AGENTS/master and add prominent historical
  notices to AI_HANDOFF, PROJECT_STATUS and TODO. Preserve their dated content
  and link current impact/billing evidence instead of marking old tasks done.
- **Scope:** documentation only, across all readers/portals. No runtime,
  locales, roles, database, storage, analytics, CI or production settings
  change. Rollback is a source revert with no customer-data impact.
- **Validation:** review Markdown links against tracked files, preserve the
  historical file bodies, check formatting and whitespace; CI remains
  authoritative for required PR checks. No application or live workflow was
  tested by this documentation change.

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

### 2026-10-13 | First-visit privacy dismissal restores stay filter access

- **Observed:** current-head CI failed four 390px EN/ES × light/dark AkiDuermo consumer cases at the normal Hotels click: the initially visible privacy aside intercepted the map filter after dock-clearance repair. Existing consent-version cookies in layout tests had not exercised this first-visit state.
- **Change:** `PersonalisationConsent` adds localized Close, Escape from panel controls, a labelled expanded/controls trigger and focus restoration without scrolling the page. A dedicated CSS module keeps the heading readable and Close at 46px minimum height without changing shared global styles. Dismissal only hides the panel and preserves drafts, persisted permissions, denied defaults and the existing save/error path. It does not set the consent version, POST, request motion, grant telemetry or permanently suppress the initial prompt.
- **Dependencies:** shared root privacy controls across AkiPasa/Business/Duermo, Passport portal trigger, EN/ES reactive locale state, cookie-backed `privacy-consent`, on-device motion preference, ConsentAnalytics and the existing consent API; account settings event reopening still reloads its saved preferences as before. No server/schema/RLS/Storage/auth/payment/email/map-instance or production-state change.
- **Acceptance:** four new component cases plus all seventeen existing consent cases; eight existing guest-route cases now exercise the actual first-visitor panel, checkboxes denied, normal Close/focus, no consent cookies/POST, and normal search/map Hotels interaction. Do not force clicks or prepopulate consent to pass this regression. Full suite/browser/short-window visual/Cloudflare/current-head CI and deployment verification are pending until evidence is recorded.
- **Rollback:** revert source and tests; no data migration or replay. First-visit obstruction remains release-blocking until final-source browser acceptance passes.

## 2026-10-14 | Measure claim-picker geometry in one rendered state

- Before: the empty-text assertion could pass before the search effect set loading, while separate geometry reads crossed renders. The copy height changed by 19.1875px between reads, reproducing the exact false -2.1875px overlap.
- Cause/evidence: actual unchanged component snapshots show 17px results/map separation in transient-empty, pending and settled-empty states; no same-frame CSS defect was established.
- Change: exact query/vertical response readiness, spinner absence and atomic DOMRect sampling; held-response tests cover loading and settled-empty separately. Actual input bounds are now checked alongside every unchanged label/result/map/overflow inequality.
- Paths: scripts/test-claim-picker-browser.mjs. API, map, actions, EN/ES, themes and all existing 24 cases/two verticals/24-row scrolling/natural selection/clear remain. No application, schema, role, email, billing, consent or production data changes.
- Validation: 24/24 browser combinations, 144 atomic snapshots, minimum input gap 13.59375px/map gap 17px, 48 natural last-result selections and clears; representative captures, scoped ESLint/Prettier and diff checks passed. Required integrated check, tablet/public/Cloudflare CI and live acceptance are not inferred from these local results.
- Rollback: source revert of the harness. Coordination: #131/#132; do not independently take over Cleanup #143/#136.

## 2026-10-14 | Isolate customer AI context and effective tool execution

Actual gateway and installed-client fixtures reproduced two boundaries: same-account operator messages entered later customer prompts, including after role demotion, and an unsolicited provider call executed an agent-permitted tool despite the request advertising no tools. History now filters audience before ordering/limiting while retaining actor, agent and user/assistant filters. Untagged legacy history remains operator-only. Customer history additionally requires context version 1 because earlier customer replies could already contain echoed operator context; fresh customer messages and replies carry that version. Historical customer context restarts without rewriting or deleting records. Operator legacy behavior stays compatible. Execution also requires the effective advertised tool set before existing permission, validation, approval and audit checks.

Thirty-two focused cases, TypeScript, scoped ESLint/Prettier and whitespace checks passed. Inert base-to-persisted-state-to-patched replay confirms old customer replies cannot re-enter; fresh multi-turn context, JSON audience/version negatives, latest-message filtering, budgets and allowed-tool approvals remain covered. No real provider request, database migration, role grant, mail, paid activation or production write occurred. Existing admin-authorized dashboard mixed-history display is a separate presentation gap. Full integrated/Cloudflare/browser/current-head CI and exact deployed-source verification remain release gates. Rollback is a source revert; existing stored rows remain intact.

Dependencies: `/api/support-agent/chat`, operator AI routes/schedules, shared gateway/provider/tool executor, service-only chat and budget tables, existing actor authorization and EN/ES customer instruction selection. No new endpoint, schema, permissions, entitlements, pricing or model contract. Independent one-cycle review found no surviving gateway bypass; its fixture and persisted-state feedback was incorporated and directly verified. Coordination: Health #132 / Cleanup #131.

## 2026-10-14 | Public venue signing request reduction

Both public venue loaders signed photos one request at a time. A shared signer now deduplicates requested paths and uses one createSignedUrls batch, retaining the 3600-second TTL, original media order/IDs/localized alt text, existing cover selection/fallback and published/venue-only selectors. Only requested, successful batch entries are used; denied, missing and unknown paths cannot become images. Empty media performs no signing request. A failed batch returns the existing missing-media fallback rather than retrying every asset. There is no shared signed-URL cache or permission/bucket change.

Installed-SDK HTTP fixtures pass 44/44 repository cases, including 14 new boundary cases. Each direct loader changes signing calls from 60 to 1 and 12 to 1; empty remains 0. This measures request counts, not field latency or CWV. Historical Storage 400s were signed-object GET downloads, not signing POSTs, so this optimization is not claimed to remediate those errors. Public browser fixtures already support the batch endpoint. Scoped lint/format/diff checks pass; full current-head checks, Spotlight browser acceptance, Cloudflare package and exact deployed-source verification remain required. Rollback is a source revert with no data rollback. Cleanup #136 shares repository.ts selected-media code; reconcile that reviewed change after the serialized Health release, retaining both behaviors.

Dependencies: hybrid Supabase public venueBySlug/venueById loaders, venue/event details, event-media bucket and installed Storage SDK, preserved published-row filters and EN/ES metadata. Static/mock providers, row selection, roles/RLS, expiry, uploads, booking, billing and consent are unchanged. Independent QA source/test review found no blocker. Health #132 / Cleanup #131.

## 2026-10-14 | Pin runtime fixes and guard MapLibre attribution artifacts

The runtime audit identified six affected packages. Next and its ESLint configuration are pinned to 15.5.27, PostCSS to 8.5.23 with nanoid 3.3.18/source-map-js 1.2.2, and Sharp to 0.35.5. MapLibre remains exactly 5.12.0 because the fixed major release changes worker/ESM/WebGL contracts; its upstream PR #8189 attribute-removal fix is applied narrowly to DOM source and all four distributed map bundles. Snapshotting attributes prevents adjacent unsafe attributes from being skipped. Existing worker, CSS, license, map API and WebGL behavior remain byte-identical. Patched bundles stop advertising their stale upstream source maps; remaining map files are not valid patched-source debugging evidence.

Postinstall validates exact package version/license/runtime entry and all pristine/patched SHA256 fingerprints before writing, rejects unknown/missing/mixed installs, and is idempotent. Build, Cloudflare build, development and check refuse unpatched artifacts. Twenty-nine inert native AttributionControl/metadata/failure tests pass, covering each bundle, consecutive/nested attributes, safe OSM credits, source metadata updates and package-entry overrides. A clean lifecycle-enabled install applies the backport and full repository checks/build pass; final integrated checks and native browser/Cloudflare/current-head CI remain gates. The runtime audit falls from six package flags to one version-based critical MapLibre flag; npm does not understand the verified local backport. This flag is explicitly retained, not waived or claimed absent. Dev-tool findings are outside this focused runtime repair.

The unchanged upstream sanitizer still permits iframe srcdoc in inert tests. No ordinary user-controlled style/attribution input was found; external configured tile/style providers remain a separate trust/hardening risk, with no production exploit or script execution demonstrated. Independent one-cycle review found no adjacency blocker and identified the runtime-entry guard, which is incorporated and directly regression-tested. No production data, SQL, role, payment, email, analytics or service configuration changes. Source/lockfile revert followed by a clean reinstall is rollback; restoring vulnerable versions requires security review. Physical Android/iOS/WebGL1 acceptance is unperformed.

Dependencies: public Next server/browser build, OpenNext1.20.2 worker packaging, Tailwind/PostCSS compilation, Node image processing, ProductionMap/StayMapPage attribution, npm lifecycle/checks and release-source packaging. OpenNext peer compatibility is declared; successful actual package/dry-run evidence remains separate. Node/image advisory reachability is not inferred as a demonstrated production Cloudflare exploit. Coordination: Health #132 / Cleanup #131, stacked source prerequisites only.

## 2026-10-14 | Shared native geolocation accessibility and browser static transport

- **Requested/observed:** Health continuation owns two shared failures reported by Cleanup. Public UI run 38492216310/job 115619854895 reports a visible disabled unnamed native geolocate button on /es/map. Run 38491307253/job 115616882352 reports route.fetch socket hang up for the real compiled CSS asset while opening AkiDuermo EN/dark/390 auth. Each run retains 144 passes and 29 intentional skips; neither is a full acceptance pass.
- **Established map cause:** installed MapLibre 5.12.0 creates an icon-only disabled button synchronously; its permission-support promise later supplies title and aria-label. Holding that promise reproduces the exact failing HTML. The application now supplies a localized initial name through a native-control subclass onAdd boundary; native permission settlement updates supported/unavailable names and state normally. No observer, polling or extra geolocation call.
- **Map dependencies:** src/lib/map-geolocation.ts, ProductionMap and ClaimVenuePicker; AkiPasa EN/ES map, AkiDuermo /map and AkiBusiness activity/accommodation claims. Original control options, initial-location logic, camera, viewport/cache/filter/discovery contracts, authorization, native onRemove and guarded attribution vendor artifacts remain. Native tests are included in the existing npm test command.
- **Transport change:** three host-forwarding browser fixtures bypass only /\_next/static/ through route.continue. Middleware already excludes this compiled asset namespace; actual CSS/JS bytes, status and headers still come from Next. HTML, RSC, auth, manifest, dynamic /pwa-icon.svg and API behavior retain original forwarding/fixtures. No retries, timeout changes, swallowed HTTP failures, permission bypasses or relaxed acceptance. The original CI socket reset is recorded, not attributed to an unproven application/server cause.
- **Ownership/safety:** separate Health integration branch based on public master 8613edbd. Cleanup #136 selected-media and #143 catalogue deltas remain untouched. No SQL, RLS, grants, linked data, billing activation, provider mail, session cookies, analytics/consent changes or GSC work. Root coordinates docs and exact-head gates.
- **Verification/status:** see docs/HEALTH_SHARED_CONTROLS_20261014.md for native/HTTP evidence and exact limitations. Hosted public/tablet/Spotlight, full checks and clean Cloudflare packaging remain required before merge; no deployment is implied. Local browser confinement is distinct from application failure. Real account-role/room-night/device/printer acceptance and commercial release holds remain.
- **Rollback:** revert application helper/call sites and test transport changes. No production data rollback or migration is needed.

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

## 2026-10-14 | AkiBusiness events grid, image dialog and claimed listings (#167)

Scope: AkiBusiness EN/ES event catalogue, desktop/tablet/mobile grid and pagination; image-slot selection and keyboard access; public venue claim gating plus secure claim submission; database `public_venue_is_claimed` function; GitHub build cache. Safeguards: existing roles, event mutations, image storage permissions and claims approval are unchanged; existing ownership records are authoritative without requiring owners to edit listing data. The RPC migration is mirrored in `database/migrations/` and `supabase/migrations/`, recorded on Supabase ref `vhpbvcfkcteswlsdjrfl` as `20261014143947_public_venue_claim_ownership`, and verified by read-only inspection of its definition and grants. The repository runbook maps this ref to production, but the connected Supabase project listing labels it `AkiPasa Development`; confirm the deployment role before claiming production application. Regression evidence: `tests/business-event-workspace.test.ts` covers nine-item pagination/reset, bilingual current-group labels, EN/ES/responsive grid and accessible filter state, plus media-dialog keyboard containment and focus restoration. Local `npm run check`, exact-head hosted CI, Cloudflare build, browser acceptance and live-release smoke passed. Merge conflict resolution retained both the #167 entry and all newer master entries in this register and contract. Rollback: revert frontend changes after verifying migration compatibility; do not delete approved ownership memberships or claim records.

## 2026-10-14 | Historical #103 Passport frame recovery

- **Before editing:** current master `8613edbd` PassportBook unconditionally reschedules requestAnimationFrame and writes every foil property while visible, even when idle. Existing draft #103 at `aef15f534ca68051d1bed5828ffddee486614a03` contains a bounded demand-driven helper. Latest coordination issue #131 reserves this scope independently of active Health and billing work.
- **Dependencies traced:** PassportBook surface refs/page/city effects, pointer handlers, sensor calibration, foilTarget/foilProperties, passport-motion preference/permission events, reduced-motion media listener, visibility lifecycle, CityStamps and existing Passport Playwright suite. EN/ES and all roles share this client surface; data/RPC/awards and server access remain unchanged. Theme/CSS/layout, locale navigation and auth caches are not edited.
- **Recovered change:** retain original interpolation and optical mapping, stop when target settles, deduplicate pending frames, cancel hidden/unmounted work and wake for input/recenter/new surface. Only the Passport scheduler hunks/helper are recovered; the old draft's NavigationLink and every other feature are excluded. Existing optional motion permission and revocation remain authoritative.
- **Regression evidence:** deterministic scheduler tests and real-component tests exercise idle settling, both locale sensor controls, hidden input/no frames, visibility recovery, recentering, reduced motion, motion revocation, pointer fallback/leave, foil off/on and chapter changes. New tests run through the existing mandatory subscription suite. Baseline reproduction and final results are recorded in the focused PR. Fixture clocks prove scheduling behavior, not physical frame rate or battery gains.
- **Release limitations:** full check/build and existing public Passport browser CI must pass on the final candidate; authenticated live and physical gyro acceptance remain separate. No production action, permissions, storage, billing, email, analytics, database or customer data changed. Revert these source/test additions to roll back.

- **Validation checkpoint:** the unchanged master component fails all six new component regressions because one frame remains queued after 100 ticks. Recovered helper/component tests pass 8/8, independently repeated by another reviewer with no blocking findings. Scoped ESLint/Prettier pass. Local full check/build is deferred due simultaneous Health/billing builds; hosted full check, Cloudflare packaging and public Passport browser checks are mandatory before merge.

## 2026-10-14 | Public membership account handoff

The public catalogue has no authenticated owned-workspace or entitlement context. Its ready plan CTAs now navigate to the existing same-locale account subscription hub with the allowlisted originating app, rather than posting a workspace checkout without a workspace. Authentication and terms use the existing middleware/account return path; the account still loads authorised workspaces, exposes existing setup and requires a separate final purchase. Public closed gates retain seven disabled Coming soon buttons. Account workspace purchases are disabled until a workspace exists, with EN/ES setup guidance; personal purchases, included/access-error guards and selected-workspace add-on eligibility remain intact.

Dependencies: public/Business/Duermo aliases and HQ origin, shared catalogue, account layout/auth/terms, gated owned-workspace RPC/setup, existing checkout server authorisation and Stripe safeguards. No server billing action, entitlement, readiness flag, price, migration, live service call, analytics or customer-data change. Five new rendered regressions fail against the original grid; all 18 focused rendered/UI/checkout cases pass after the patch. Full check, current-head CI/browser/Cloudflare and authenticated acceptance remain pending. Rollback is a source revert; paid rollout remains blocked by the separate legal/tax/schema/lifecycle gates.

Validation follow-up: full check passed formatting, lint, TypeScript, all application suites (855 tests including AkiSuite 114), database safety and two conflict tests, then stopped because the isolated automation workspace lacked Hono dependencies. After installing that subproject from its lockfile, automation checks/dry-run passed; the production build is being checked separately. The existing account browser workflow now includes eight ready/closed public-handoff cases (EN/ES, both themes, 360/1536px), actual anchor target/text geometry, account navigation with zero checkout actions and disabled closed gates. Its disposable bundle compiles. Local Chrome cannot launch because ProcessSingleton socket() is prohibited; geometry assertions and screenshots must pass hosted CI before acceptance. Scoped anchor CSS shares the existing button dimensions. Independent source review found no functional/security blocker; neither hosted browser execution nor payment acceptance is claimed.

Hosted handoff follow-up: run 38500939403/account job 115647472508 passed the pre-existing matrix but stopped before the new geometry assertions. Expanding a card changed its accessible button name, shrinking the live name-filtered nth locator set and making nth(4) disappear. The harness now iterates stable article containers and explicitly verifies false-to-true aria-expanded per card. All eight cases, CTA geometry and zero-checkout assertions remain unchanged; no production source or timeout change. Fresh hosted execution remains required.

## 2026-10-14 | Recovered lazy owner toolbox (#103)

The owner-only launcher previously imported the full toolbox, achievement scopes and Pals engine before activation. The bounded recovery extracts the current panel intact and dynamically imports it only after a click or Ctrl/Meta+Shift+O. Saved appearance still applies immediately. Concurrent activations share the pending load; an EN/ES busy/retry trigger retains the existing responsive class and accessible name; late completion after unmount is ignored. Once loaded, the panel remains mounted so Escape, outside-close and reopen preserve its existing state. The locale layout's server has_owner_console gate and every owner/award action remain unchanged; lazy delivery grants no authorization.

Eight focused cases cover import deferral, immediate appearance, mouse/keyboard activation, pending deduplication, failed-load retry, unmount and actual panel state across close/reopen in EN/ES. These are component/module-boundary evidence, not live bandwidth or authenticated acceptance. No CSS, auth cache, route, SQL, data, rewards, billing, email or consent changes. Current-head full checks, production/Cloudflare packaging and required CI remain release gates. Rollback restores the original eager component; no data restoration.

## 2026-10-14 | Parallel tablet acceptance jobs (#169)

Scope: GitHub Actions tablet workflow only. Existing tablet route, AkiDuermo route, portal smoke and layout/Spotlight tests remain required; route suites run with two workers in a separate job, other suites run concurrently, and stale same-PR workflow runs are cancelled. Evidence artifacts use distinct job names and `tablet-ui` remains the required check. No app, database, permission or test assertion changes. Validation: an initial hosted run failed the contract documentation gate; this entry and the master contract update address that failure. Fresh exact-head checks must pass before merge. Monitor parallel runner pressure; reverting route worker count to one preserves job concurrency.

## 2026-10-14 | Remove unavailable duplicate Wrangler job

Scope: remove the added GitHub Actions Wrangler deployment workflow after its Cloudflare build succeeded but deploy failed because `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` resolve empty in repository and `automation-production` scopes. The existing connected Cloudflare release published commit `31c643a6ecf8bd618b5e7f86ebb178da9102ab3e`; read-only live smoke passed with that exact source SHA and confirmed AkiConduzco's root, map, robots and sitemap return HTTP 200. This cleanup removes a duplicate failing job only; no app code, database, auth or customer data changed. Rollback is to restore the workflow after valid Cloudflare credentials are configured.

## Independent AkiBusiness candidate

Requested: independently buildable management product at akibusiness.com while
preserving original AkiPasa and shared tenant/user/billing identities. Copied only
tracked source; retained complete business management and required API/auth graph.
Changed product routing, trusted origin validation, recovery task sanitizer,
canonical links, metadata/PWA, preview Worker and independent CI. No SQL/provider,
role, billing, ownership, email replay or production-route changes were executed.
Validation: results and outstanding hosted acceptance recorded in EXTRACTION.md.
Rollback: revert this application's code/Worker routing; original app and shared
records are untouched. New production traffic must wait for all release gates.

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

Manager completion follow-up: vehicle name/category/transmission/fuel/seats/luggage
can now be edited through both existing authorized action paths. Optional supplied
fields share Zod bounds, preserving older rate-only clients. Operators can reopen
only maintenance blocks after company/vehicle ownership or venue-manager checks;
booking-created blocks are never deleted through this action. Focused action
regressions cover invalid specifications, scoped updates, ownership denial and
maintenance-only deletion. No production vehicle/block records were modified.

## 2026-10-15 | Fullscreen privacy control integration

Live rental acceptance found the root privacy control adding a footer below the
customer viewport; the fixed operator desk also covered that global control.
Scoped rental styles now keep privacy access in a reserved bottom strip, above
the desk, without document scrolling. The existing consent panel and choices
remain unchanged. Responsive browser fixtures now include the shared footer and
assert that its control remains within the viewport. No data or auth changes.

## 2026-10-15 | Independent AkiCoches branches and booking operations

Rental locations are independent Branches / Sucursales with their own profile,
coordinates and private rental-media library. Existing company/fleet/booking IDs
remain stable. The one-time migration snapshots current venue owner/manager grants
as independent branch memberships, clears the historical venue link, disables the
old link RPC and imports only previously selected covers into branch media rows.
The authenticated branch workspace copies those legacy files into rental-media;
failed copies remain visible with a retry notice and never delete source files.
New uploads and selected covers/profile/hero media must belong to the same branch.
Public media reads are restricted to published branch profile or active-car covers.

Customer requests require name, valid phone and the verified account email, checked
in the UI, API and authoritative SQL RPC. Existing historical incomplete contacts
are retained. Booking details include email, phone, message, dates, car, status and
quote. The operator overview reports current rentals, pending requests, today pick-
ups and returns in Europe/Madrid; a separate scoped API pages live/upcoming/pending/
historical bookings and rechecks manager authorization on every request. Requests
are distinct from confirmations; no payment or instant availability is fabricated.

Rental lifecycle email uses the existing AkiPasa suite outbox and five-minute sender,
not a scheduler in either extracted product. Request/confirmation/decline/cancel/
completion changes enqueue deduplicated customer and verified branch-owner emails.
The dispatcher rechecks current verified addresses, branch owner, renter and status
before sending. No historical email backfill or test email to real customers.
New rental email events wait for the compatible sender during rollout. Its service-only activation releases only those events; its bounded media copy preserves the original venue files.

Rollback uses a reviewed forward migration and app version rollback; do not drop
branch media, re-link companies, rewrite bookings or reapply migration history.
Owner-session production mutations remain a separate acceptance check.

Migration `20261015220302_independent_rental_branches` is applied to confirmed
shared project `vhpbvcfkcteswlsdjrfl`. Readback: zero linked rental branches, one
selected legacy cover imported, the existing booking count preserved, the old
authenticated link RPC disabled and anonymous email activation denied. Security
advisors flag the intentional deny-all legacy audit and explicitly guarded
definer RPCs; no new public booking/contact access is granted.

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

### Independent accommodation team and paginated inventory

- Adds canonical-owner-only explicit verified UUID manager assignment/revocation, with
  SQL authority, owner preservation, no inherited organisation permissions or emails.
- Adds bounded deterministic inventory/list navigation and partial-failure handling.
- Requires additive team/pagination migration 20261016050000 before accommodation readiness.
- Fixes standalone rental browser fixture environment definitions after shared role imports;
  all existing browser assertions remain in place. No production configuration changed.

## 2026-10-20 | AkiHQ auth-mode destination sanitization

- **Observed:** production EN/ES Google OAuth correctly initiated through the shared Supabase provider and returned to `https://akihq.app/{locale}/auth/callback?next=/{locale}/business`. A crafted recovery URL could not become a callback destination because forms use `safeAuthDestination`, but the mode-switch links copied the raw `query.next` value into their internal hrefs.
- **Change:** mode links now serialize the already sanitized `next` value. Valid locale-scoped management and recovery tasks are preserved; external, protocol-relative, encoded-path and backslash values become the locale business-home fallback before appearing in the next auth URL.
- **Dependencies:** AkiHQ EN/ES sign-in, signup, magic link, recovery, Google OAuth initiation and password recovery continuity. Server actions, Supabase Auth, callback exchange, terms, host-scoped sessions and global post-reset revocation are unchanged. No database, role, identity, email send, subscription, billing or Cloudflare configuration mutation.
- **Evidence/rollback:** product-routing regression asserts the rendered source cannot reintroduce raw `query.next` serialization alongside the existing destination/callback cases. Run format, lint, types, complete tests, Next/OpenNext builds, browser auth-mode navigation and exact-source production smoke. Roll back with an application-source revert; no data restoration is required. A real provider account login and real recovery email remain separate acceptance gates.

## 2026-10-20 | Shared account eligibility candidate

Adds the AkiPasa-owned caller-only completion contract to local member/auth guards
and supported customer API/optional tracking boundaries. Server-only readiness
defaults off; existing accounts and RLS remain unchanged. Pending/negative state
hands off to same-language canonical completion without cross-domain credentials.
No cohort/schema/billing/role/production setting changes. See
`SHARED_ACCOUNT_ELIGIBILITY.md` for coverage, central privacy safety, no seamless
resume limitation, release gates and non-destructive rollback. Local guard tests
are regression evidence, not authenticated five-domain acceptance.

## 2026-10-20 | Narrow analytics_events table capabilities

Read-only hosted evidence: anon/authenticated held all seven table capabilities;
existing analytics_operator_read SELECT policy was tenant/admin scoped. Source
callers were traced through the same-origin analytics API's service-only checked
RPC, behavior ingestion, signed-in legacy definer recording, tenant reads and
privileged AI/reporting service reads. No anonymous direct table reader is needed.

Targeted mirrored migration20261020173020 revokes ALL from PUBLIC/anon/authenticated,
restores authenticated SELECT and preserves original RLS/function/service grants.
No data deletion or broad default-privilege edit. Four PGlite tests use actual
historical source SQL/roles to reproduce local RLS-bypassing TRUNCATE before repair,
then assert direct capability denial, own/foreign/admin reads and service/legacy
recording compatibility. Test is included in npm test. Scoped TypeScript/lint and
hosted CI precede selective application; no live mutation occurred. Rollback must
never restore broad ALL/TRUNCATE; resolve any overlooked caller with a narrow RPC.

## 2026-10-20 | Suite language and canonical handoffs

- Before: management/operations selector destinations omitted language; operations
  ignored incoming locale and could reload a workspace's previous language.
- After: fixed-origin suite-navigation v1 preserves the current EN/ES across all
  five products. Canonical free-management and paid-operations roles are retained.
- Dependencies: desktop/mobile selectors, locale headers, static workspace cache,
  membership back links, auth portal links and explicit location handoffs. Public
  referral codes are bounded; callback/redirect wrappers and credentials are not
  forwarded. No DB/API/RLS, subscription, consent or analytics behavior changes.
- Verification: fixed-origin/security matrix and actual selector EN/ES rendering;
  complete CI/build, responsive browsers and canonical authenticated journeys
  remain required. Source/deployment rollback preserves all stored data.

## 2026-10-20 | Owner listing allowance compatibility

Traced AkiHQ business event composer/action, venue and venue-backed accommodation
media, same-origin upload API, SafeMediaFileInput, legacy recurrence/duplication,
AkiPasa subscription handoff and shared database guards. Mirrored source changes
from AkiPasa PR215 without overwriting HQ-specific organisation/auth/rental work.
Event drafts retain controlled fields on quota/provider rejection; owner image
counts/upgrade controls use independent listing readiness. Billing links remain
central at akipasa.com and preserve EN/ES. Shared migration is owned by AkiPasa;
this app owns no new schema, scheduler or billing webhook. Existing independent
accommodation media API is separately gated on absent live property tables;
its future schema needs its own quota guard and is not claimed covered here.

Tests:4 image-policy and3 EN/ES/provider draft cases added to npm test; related
business workspace/venue regressions, TypeScript and scoped lint are required.
Current-head hosted CI/Cloudflare/owner/browser acceptance remain release gates.
No production mutation or activation. Keep AKISUITE_LISTING_RESOLUTION_READY off:
header validation/browser preparation do not close direct Storage bypass. Rollback
source/UI flag only; preserve all media/events/customer billing and shared ledger.

## 2026-10-20: Reserved image upload consumer

HQ mirrors AkiPasa's byte-inspected service upload, quota reservation, readback
verification and authenticated one-use receipt for venue/event images. Existing
HQ-specific organisation, rental and authentication actions remain. Strict flag
stays false until two-product Storage acceptance. No shared migration is applied
from HQ; no live settings, billing or retained media changed. Runbook:
ENFORCED_LISTING_UPLOADS.md.

## 2026-10-20 | Gated AkiPulse scoped booking aggregates

Owner: independent AkiHQ source. Adds bounded management-authorised booking-created
cohorts and current inventory for venue/property/fleet/org scopes. Requires shared
read-only RPC migration20261020180504 and explicit rollout flag, defaults off.
No paid entitlement, booking mutation, identity, billing or routing change.
Cross-app booking sources retain original IDs and ownership. Unknown commercial
attribution and organisation links remain unavailable. SQL/UI regressions cover
cross-tenant denial, revocation, scope fanout, cohort boundaries and missing data.
Production/authenticated preview and realistic query plans are not yet verified.

## 2026-10-20 | PostGIS reference-table client privileges

The shared PostGIS spatial_ref_sys table is extension-owned and retained without
RLS changes. A narrow mirrored migration revokes PUBLIC/anon/authenticated table
capabilities and restores only client SELECT, preserving other explicit role
grants, extension ownership and existing reference rows. Effective table/column
postconditions reject silent no-op/inherited-grant repairs transactionally.
See SPATIAL_REFERENCE_PRIVILEGES.md for role tests, executor prerequisites, live
geography acceptance and safe rollback. No live application is claimed by CI.

## 2026-10-21 | Independent property listing foundation (gated)

Native accommodation uses real property UUID ownership and CRM intersection,
separate property listing entitlements and verified service-upload reservations.
Free/Premium media quotas are8/250 with1920/3840 dimensions; retained old media
survive downgrade. New property schema refuses ambiguous historical/native data
for explicit reconciliation. No legacy venue inventory or billing state changes.
See NATIVE_ACCOMMODATION_FOUNDATION.md for roles, evidence and rollout gates.
This is implemented/tested source, not merged or production verified; native
inventory adapter compatibility remains a separately tracked follow-on.

## 2026-10-21 | Native property inventory compatibility (gated)

Additive002500 uses distinct accommodation*property*\* inventory with immutable
property scope, RLS, composite identity FKs, non-overlapping rates/occupancy and
audited manager reservation status changes. AkiHQ maps native sections explicitly
and never falls back to existing venue tables. Native runtime/database inventory
gates default off; no customer booking/quote or payment path is enabled.
See NATIVE_ACCOMMODATION_INVENTORY.md for tests, corrected001000 prerequisite,
privacy preservation and actual-provider/concurrent acceptance requirements.

## Listing schema-reader source configuration

Adds server-only LIMITS_READY and UPLOADS_READY runtime vars after the standalone
shared schema is installed. Database count/strict gates remain independently off;
strictfalse retains legacy authenticated upload. No customer, billing, global old
feature flag or library activation changes. See LISTING_SCHEMA_READINESS.md for
actual owner paths, native-property dependency, acceptance and coordinated rollback.

## 2026-10-21 | Business home recovery and compact AkiPulse

- Reproduced the signed-in Home failure as a PostgREST 400 caused by selecting
  removed `venues.phone`; the live schema retains `contact_phone`. The loader now
  aliases `phone:contact_phone` and keeps a successful venue or rental source
  visible when the other source fails. Both-source failure still blocks closed.
- AkiPulse is condensed into glanceable KPIs, action bars and readiness rows.
  Methodology and the separately scoped booking report are collapsed; promotion
  request/history appears only in Pulse and opens on demand with localised labels.
- Dependencies traced: authenticated venue membership, independent rental branch
  RPC, venue/stay/rental routing, EN/ES, responsive Home/Pulse UI, analytics RPCs,
  promotion action and shared Supabase RLS. No database, grants, subscription,
  Stripe, identity, storage or deployment mapping change.
- Regression evidence: the loader test asserts the exact current column alias and
  all business/Pulse component and scoped SQL suites. TypeScript, lint, formatting,
  full tests, Cloudflare build, hosted CI and live exact-SHA acceptance are release
  gates. Roll back the source commit only; no customer-data rollback is required.

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

Referral resume followup also covers existing HQ locations, mobility, accommodation and application server loaders. All four pass the real pending/underage eligibility gate in EN/ES before any management query runs. Existing bounded task allowlist remains authoritative.

## 2026-10-21 | Supported Next16 runtime for AkiHQ

Next/eslint-config-next16.4.2, OpenNext1.20.12 and Wrangler4.151.3 replace the expired major support window without a bypass. Existing React, security overrides, edge middleware, tenant/authentication rules and one-minute image cache policy remain intact. Explicit Webpack and native flat lint preserve build behavior. Documented new compiler recommendations are deferred while compiler is disabled; original hooks/security/a11y rules remain. New internal-navigation findings use the Next router with regression evidence. See docs/NEXT16_RUNTIME_UPGRADE.md for primary sources, migration choices, verification and rollback. No billing, schemas, product roles, provider or production mutations are part of this dependency branch.

## Completion scope preservation — 21 October 2026

Shared task contract now retains bounded legacy property/company/organisation names consumed by real management destinations. Regressions cover all5/EN/ES, duplicates/URL rejection, and actual HQ pending/underage-to-complete destination consumption. No dependency, billing, DB, ownership, consent or deployment configuration change.

## 2026-10-21 | Bounded native gallery controls

Premium250-photo media editing now shares one datalist for positions instead
of rendering250 options in each of250 rows. Numeric per-photo position forms
retain explicit Save and blank-private behavior, preserving the same backend
position/entitlement rules and retained media. A full250-photo regression checks
250 options total and the exact selected property's placement request.
18 focused media/API/service-adapter cases pass with TypeScript and zero-warning
lint. Native runtime/database activation remains gated; no live changes.

## 2026-10-21 | Reconcile native property media with current management source

Reconciles immutable native media69 into current main781d685, preserving the
validated management task resume, venue loyalty workspace and supported Next16
runtime. Verified server uploads and native property inventory adapters stay
independently gated; no legacy venue inventory or direct browser upload fallback
is introduced for native properties. The complete local test command passes.
Canonical schema uses accommodation_property_private from corrected Pasa255.
Hosted exact-head packaging and authenticated Storage acceptance remain gates;
no live flags, customer records, deployment or primary branch changed here.

## 2026-10-21 | Native gallery current-policy retry

A quota/resolution rejection refreshes authoritative property limits before a
retry. The form stays mounted, preserving captions, while uploads fail closed if
refresh fails. EN/ES expiry and refresh-failure regressions cover the stale Premium
to Free transition. No entitlement, schema, billing or live activation changes.

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

## 21 October 2026 — explicit independent-resource analytics

Touches scoped Pulse dispatch/contracts/components, an owner-only rental mapping
server action, and eight additive short SQL phases. Native property identities and
independent rental branch identities are preserved. Explicit org/workspace/resource
links and live management intersections drive every cohort; no owner-wide inference,
raw PII, invented revenue or duplicated claim summation. New flags stay false.
Shared collection, billing, entitlements and existing source records are unchanged.
See AKIPULSE_EXPLICIT_SCOPES.md for security boundaries, validation and rollback.

### Rental workspace link transport recovery

Narrow client catch around the owner link server action prevents transport errors
from replacing the management view. Success/denial/network rejection retain the
selected draft; network failures never display saved confirmation. No SQL or flags
change. The 80-case real-component browser matrix includes a throwing transport.

### Own rental-link activity portability

Adds my_pulse_management_export_page and subject/cursor indexes only, plus actual
PostgreSQL privacy tests. Fixed section allowlist, auth.uid identity and curated
own actor/linked_by rows prevent foreign/private business data export. Restricted
users retain privacy access without gaining operational access. Requires central
account-export dispatch before rental mapping activation; no UI/flag changes.

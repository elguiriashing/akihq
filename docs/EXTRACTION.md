# AkiBusiness extraction acceptance

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

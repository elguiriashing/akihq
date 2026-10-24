# AkiSuite customer journeys · 24 October 2026

## Product and identity contract

One Supabase identity and one public.profiles row per person. Each product owns its
account UI and host-only session. Signing in never silently grants workspace or
Premium access. Profile edits write the verified caller's row atomically, so all
five products read the same name, bio, contact details, language, visibility and
photo paths. There is no browser-to-browser sync or cross-domain cookie assumption.

AkiHQ is free public-listing management. AkiBusiness is operating software usable
with a private workplace and no public venue/property/branch. Choosing a plan,
creating an account or making a location never implies a paid entitlement.

| Audience/product       | Journey under test                                                                                                 | Intended destination                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Individual / AkiPasa   | Explore → detail/map → sign in or sign up → account/profile/settings/membership → saved/following/bookings         | AkiPasa; deliberate product switches only                                    |
| Individual / AkiDuermo | Explore/map → stay → sign in with local return → request/bookings/saved → shared profile/security/memberships      | AkiDuermo `/account` and `/settings`                                         |
| Individual / AkiCoches | Explore/map → rental → sign in with local return → requests/saved → shared profile/security/memberships            | AkiCoches `/account` and `/settings`                                         |
| Business / AkiPasa     | Listing → ownership/claim → free listing tools → appropriate upgrade                                               | Explicit AkiHQ venue handoff; ownership remains server-authorized            |
| Business / AkiDuermo   | Property marketing/account → free property management → independent property tools                                 | Explicit AkiHQ `/business/accommodations`, with no AkiPasa venue requirement |
| Business / AkiCoches   | Fleet marketing/account → free rental management → branch/fleet tools                                              | Explicit AkiHQ `/business/mobility`, with no AkiPasa venue requirement       |
| Business / AkiHQ       | Sign in → managed listings/locations → local account/settings → listing membership options                         | AkiHQ; operations is an explicit AkiBusiness switch                          |
| Business / AkiBusiness | Choose Basic/Standard/Pro → native account/sign in → choose/create private location → authorized dashboard/toolbox | AkiBusiness throughout; no Pasa→HQ detour or compulsory public claim         |

## Concrete repairs

- AkiBusiness plan CTAs retain the approved tier and locale on `/account`. Location
  identifiers are bounded and must be in the caller-authorized list. A foreign or
  ambiguous request never opens another location as a fallback.
- A signed-in account with no operating workspace retains its session and enters
  native setup. Existing owner RPC creates a private operating location using a
  per-attempt idempotency UUID. Setup does not enable tools or collect payment.
- HQ, Duermo and Coches render shared profile/security forms natively, including
  profile/cover uploads into the existing caller-owned Storage folder. Read failure
  withholds profile editing, rather than offering a destructive blank form.
- Local account/profile/settings aliases remain local and preserve the language.
  Existing OAuth and password recovery use the approved same-host callback paths.
- Membership summaries and billing management use a central authenticated API,
  without navigating through AkiPasa. It verifies the bearer with Supabase, requires
  current eligibility/terms and scopes every table read to that identity. A caller
  cannot choose a customer ID, profile ID, arbitrary destination or portal config.
  Existing suite management-only configurations remain required where applicable.
- Stripe portal sessions return to the originating product. New checkout and paid
  activation remain gated; no subscriptions or prices are migrated by this work.
- Membership reads stream separately from profile controls in the Next products;
  AkiBusiness refreshes them independently. A billing outage leaves profile access.

## Evidence and acceptance limits

AkiPasa's existing account remains the shared-profile source, with updated copy.
The admin incident is separately repaired by administrator-only audit initPlan
and latest-first index; its live recent-five query is ~3ms after repeated8-second
application waits. Signed-in live Admin now shows complete counts/recent changes.

The new native-account browser workflows compile the actual shared component
against disposable identity/actions and exercise twelve EN/ES, light/dark, phone,
tablet and desktop combinations per product. AkiBusiness additionally clicks
the actual Standard CTA through to its native account and validates the local
authorized-dashboard target. Hosted results must be checked, not inferred from
fixture compilation.

New regression suites cover the administrator SQL policy under real database
roles; the shared billing API under verified/invalid/foreign/restricted identities;
EN/ES profile rendering, validation and unavailable reads; and native AkiBusiness
plan/location/profile/no-workspace/OAuth/logout behavior with disposable data.
Existing suites continue to exercise discovery, booking boundaries, saved states,
auth callbacks, role isolation, monthly tool rotation and pricing separation.

Local Chromium installation failed because the downloaded archive was truncated.
Hosted browser CI and signed-in production readback are required before calling
new routes released. No real signup, profile alteration, booking, claim, payment,
refund, cancellation, uploaded customer image or password change is used as a test.
Provider redirect acceptance is checked via existing native callbacks; no new
OAuth credential or redirect allowlist is installed.

Explicit shared privacy/export/deletion and gated age/onboarding review remain
central safety workflows; links label these as shared account actions. This batch
moves routine profile/security/membership UI onto each product, not the existing
legal/safety engines. New Premium checkout stays unavailable until the separately
tracked launch acceptance gates are satisfied (issue284).

Release order: central account API → native product frontends. Keep clean source
stamps, hosted checks and provider live-source proof for each repository. Rollback
native UI independently; keep compatible API until consumers are rolled back.
Never drop profiles, workspaces, bookings, billing records or audit history.

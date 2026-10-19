# AkiBusiness

Independent AkiSuite management application extracted from `elguiriashing/akipasa`
master `080ea0ffb2dd6612436acd04c25b4daf8ff71129`. Canonical domain:
`https://akibusiness.com`. This source does not modify or replace AkiPasa.

The application preserves the complete venue workspace (claims, profile/media,
menus, events, promotions, analytics, roles and teams), AkiDuermo property inventory,
room-night rates/reservations and AkiCoches rental-company/fleet management.
Historical `akiconduzco` database/function identifiers remain compatible.

## Development

Use Node 22+, `npm ci`, copy `.env.example` to an ignored `.env.local` and supply
shared Supabase public configuration securely. Run `npm run dev` and visit
`http://localhost:3000/es/business` or `/en/business`. `npm run check` runs lint,
TypeScript, scoped regression suites and production compilation. Dependencies are
pinned in package-lock; no imports point into another checkout. The MapLibre
security backport is verified during postinstall and every build.

`GET /api/health` exposes product liveness without database/customer details.
Public placeholder Supabase configuration permits build-only verification; it
cannot establish login, real provider integration or production readiness.

## Application boundary

The business application runs on canonical, localhost and preview hosts without
relying on the legacy hostname. Middleware permits business, authentication,
terms/privacy and the management API allowlist. Consumer/account/membership links
return to AkiPasa with locale/query preserved. Unknown mutation routes and unrelated
APIs return 404. Every workspace retains server-side authorization and shared RLS.
No staff/admin UI, consumer discovery, public booking API or Stripe webhook is
exposed. All responses are noindex; private responses are not cached.

The same Supabase project retains user IDs, memberships, ownership and billing
identities. Sessions use host-only cookies. Each domain signs into the same user
account independently; this extraction does not pretend cookies can be shared
between root domains or implement seamless cross-domain SSO. Before release,
allowlist exact EN/ES callback and recovery URLs in Supabase and verify OAuth,
password sign-in/out, magic link, recovery and expired sessions on the actual host.
Register exact preview origins in `AKISUITE_ALLOWED_PREVIEW_ORIGINS`; arbitrary
forwarded-host/Origin headers cannot redirect callbacks to another application.

## Deployment and ownership

`npm run build:cloudflare` packages a clean committed source and stamps its SHA;
`npx wrangler deploy --dry-run` validates bindings without provider writes.
`wrangler.jsonc` targets **akibusiness-preview** with workers.dev and no production
custom domains. Configure shared Supabase public vars and secrets securely first.
The existing `AKIHQ_GATEWAY` service binding must be available in the target account.
CI independently verifies this repository and never deploys on a push.

No cron handler/schedule, billing webhook, subscription renewal or queue dispatcher
is copied into the deployment. AkiPasa remains their single operational owner.
Immediate existing action-driven mail behavior remains gated by existing provider
credentials; no mail, payment or database operations were run during extraction.
Shared migration history is reference-only: **never run a reset, seed or blanket
migration from this repository against the existing project**.

After preview deployment, perform authenticated EN/ES owner/editor/other-tenant,
claims, media, menu/event, property inventory/request and fleet workflows; verify
AkiHQ authorization, subscription gates, mobile/desktop, certificates and source SHA.
Only then attach the canonical domain, verify it and redirect legacy domains.
Keep the existing business hostname serving AkiPasa throughout acceptance. Rollback
removes new routing/redirects or restores the prior new Worker version; it requires
no deletion or rewriting of users, venue ownership, billing or shared database data.

Shared source is copied initially for deploy independence. Track updates against
the recorded upstream SHA and move stable auth, permissions, catalogue and UI into
reviewed versioned packages with contract tests before further products diverge.
See `docs/EXTRACTION.md` for verification and release gates.

Incoming remote migration groundwork (`aa672aa`) has been merged with unrelated
local extraction ancestry preserved. Its auth allowlist contract is retained in
[docs/SUPABASE_AUTH_REDIRECTS.md](docs/SUPABASE_AUTH_REDIRECTS.md). Hosted settings
remain unverified and must preserve the existing Site URL/redirect entries.

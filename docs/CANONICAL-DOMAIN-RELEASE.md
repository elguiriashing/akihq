# AkiHQ canonical domain: staged release and rollback

## 2026-10-15 execution continuation

PR #30 is confirmed open, draft and mergeable through the GitHub connector. The
frozen gateway dependency install now succeeds; its complete local verification
suite passed 357 tests with one optional workbook fixture skipped. The gateway
keeps all existing bindings and scheduled jobs. Cloudflare added exact canonical
and current Pages-preview CORS origins without altering those bindings or crons.

The login screen now includes password recovery. Reset email returns to the
current origin root, retaining the existing implicit SPA strategy. The app captures
the recovery fragment before SDK initialization and shows a dedicated password
form before any workspace boot. A verified current user is required for password
updates, and recovery closes the local session before returning to sign-in. EN/ES
forms and eight isolated recovery tests cover origin retention, expired sessions,
password mismatch, provider-error privacy and session-closure failure. Passwords
and tokens are never copied to another application or logged.

Hosted recovery email delivery and end-to-end test-user authentication still need
provider-backed acceptance. The public current-origin root must be in Supabase's
exact allowlist, including the specific Pages preview origin. Shared identity is
preserved; seamless cross-root-domain SSO has not been implemented or claimed.

The older execution-limit notes below describe the previous environment and are
retained as history; current release evidence must distinguish local fixture
tests, hosted checks, deployed endpoint checks and authenticated acceptance.

This branch extends the existing PR #30 (`9d44ef8`) instead of recreating its
canonical `CRM_URL` change. PR open/draft/check state remains unverified: Git pull
refs are readable, but the GitHub GraphQL request was denied by this environment.

## What this change prepares

- The public CRM link uses `https://akihq.app` as prepared in PR #30.
- The integration gateway accepts both `https://akihq.app` and
  `https://crm.akipasa.com`; no CORS wildcard is added.
- The active HQ login navigation stays on the current host. Google login already
  returns to the initiating origin; it must not send tokens to another host.
- The existing social OAuth fallback, gateway bindings, encryption, backend
  authorization, scheduled jobs, inventory and PoS logic are unchanged. Social
  OAuth initiated by the canonical origin returns there through the existing
  origin-checked handler. `SOCIAL_RETURN_URL` remains on the legacy host until
  the canonical deployment has been verified.

## Required external verification before redirecting traffic

1. Read Cloudflare Pages project `akihq` and its current deployment, DNS,
   `akihq.app` custom-domain state and certificate state. Account ID supplied by
   the migration request is `501bc9434d8ae555a6ac984a26dd2725`; verify ownership.
2. Preserve the existing Pages deployment and rollback deployment ID. Deploy this
   branch to a Pages preview first. The frontend is static: no framework/build
   command; output is the repository root. Run gateway `npm ci && npm run check`
   and a Wrangler dry run before releasing its separate configuration.
3. Append exact canonical Supabase redirect URLs without replacing the shared
   Site URL or current allowlist; see `AKIHQ_APP_OAUTH_REDIRECT_FIX.md`. Preserve
   project `vhpbvcfkcteswlsdjrfl`, existing users, RLS and billing data.
4. Keep preview noindex. Verify English/Spanish desktop/mobile rendering, email
   and Google login, logout/session expiration and recovery, staff role denial,
   CRM, support, inventory, restaurant tables and sandbox PoS. Verify the gateway
   from both origins and social OAuth return on each host. Existing password
   recovery and cross-product SSO require separate verification; this branch
   does not certify either workflow.
5. Verify the canonical HTTPS domain using a browser, including all API calls,
   before adding any permanent redirect on `crm.akipasa.com`. Preserve URL path
   and query only after classifying auth callbacks; never forward token fragments
   or credentials between domains. There is no legacy redirect in this branch.
6. If checks fail, restore the saved Pages and gateway deployment IDs. Keep DNS,
   the legacy domain, legacy CORS origin and prior auth allowlist operational.
   An additive redirect allowlist does not require deleting any user/session data.

## Current execution limits

The environment has no configured Cloudflare/Supabase bindings or provider tools.
The policy snapshot lacks provider API and production domains. GitHub API access
returns Forbidden, while read-only Git refs work. Dependency `xlsx@0.20.3` is
pinned to `cdn.sheetjs.com`, whose download is denied by the current policy. Do
not substitute another package or disable TLS/checksum checks. Until API access,
provider authority and dependency access are available, PR status, Pages/DNS/SSL,
Supabase allowlists, full gateway tests and production workflows remain pending.

## Local validation on this branch

- `node --check assets/app-v32.js` and `node --check cloudflare/worker.js` pass.
- 81 focused Node tests pass across `commerce-export`, `inventory-ops`,
  `multi-tenant`, conflict contracts, dialog accessibility, floor editor,
  hospitality/table and atomic-checkout fixtures, ledger, rapid taps, membership
  navigation and the four new domain/OAuth/CORS cases.
- The initial DOM test attempt could not load `jsdom` because gateway `npm ci`
  remained blocked. Exact `jsdom@26.1.0` and `@electric-sql/pglite@0.3.14` were then
  installed into external temporary test tooling; a temporary module symlink
  allowed focused fixture tests without changing the repository's dependency
  manifest or lockfile. This does not validate the missing gateway dependencies.
- Provider-backed login, recovery, production data operations and payment flows
  remain unverified; database tests use isolated disposable local fixtures.
- Chromium browser presentation acceptance passes 16 language/theme/viewport
  combinations, hospitality payment focus and native/shortcut dialog layering.
  The browser uses disposable fixtures and blocks external requests; it is not a
  deployed-domain or live-auth acceptance test.

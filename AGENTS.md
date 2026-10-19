# AkiBusiness repository guidance

This is the independent AkiBusiness application, extracted from AkiPasa master
`080ea0ffb2dd6612436acd04c25b4daf8ff71129`. Its default branch is `main`; feature
work uses pull requests. Use the existing checkout, without creating worktrees
unless the user requests one. Original AkiPasa source/production remain independent.

Read `README.md`, `docs/EXTRACTION.md`, the shared baseline contract
`docs/AKIPASA_MASTER.md` and relevant impact entries before changing behavior.
Historical documents describe upstream AkiPasa; they do not change this app's
release branch or authorize deploying the consumer application. Append verified
cross-product impacts and unresolved acceptance to the contract/register.

Run `npm ci` with Node 22+, `npm run format:check`, `npm run lint`,
`npm run typecheck`, `npm test`, and `npm run build:cloudflare`. Packaging requires
clean committed source and stamps the full SHA. For local anonymous browser
acceptance, start the compiled app on 127.0.0.1:3013 and run `npm run test:e2e`
with the installed Playwright browser or PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH.
Use disposable local public configuration for fixtures; never real customer writes.

Keep all business venue/property/fleet tools, tenant authorization and RLS intact.
Never import from another repository checkout. Shared copied modules must retain
an upstream provenance and regression evidence until moved into versioned packages.
Preserve historical database identifiers, UTC storage and venue IANA rendering.
Validate mutations server-side. Never commit secrets or expose service keys through
NEXT_PUBLIC configuration. Sessions are host-only; cross-root cookies are invalid.

This Worker owns no cron, billing webhook, renewal or outbox scheduler. Shared
migration history is reference-only: never seed/reset/reapply it against the existing
Supabase project. Deployment defaults to akibusiness-preview with no canonical
traffic. Require authenticated preview/provider/role/SSL acceptance and rollback
before production domains or legacy redirects are changed. Follow the user's
current authorization; do not infer production success from CI or DNS alone.

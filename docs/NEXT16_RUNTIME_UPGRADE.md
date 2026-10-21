# Supported Next.js runtime upgrade — 21 October 2026

AkiHQ upgrades from Next.js 15.5.28 to the current stable **16.4.2**.
OpenNext enforces a two-year major support window; the release-date boundary
blocked the old major despite its security patches. No unsupported-version bypass,
experimental cache components or React Compiler is enabled.

## Exact dependency contract

- Next.js and eslint-config-next: **16.4.2**.
- @opennextjs/cloudflare: **1.20.12** (Next peer accepts >=16.4.1).
- Wrangler: **4.151.3**, satisfying adapter peer ^4.148.0.
- React/react-dom remain the existing patched **19.1.10**, accepted by Next's peers.
- Existing sharp **0.35.5** and PostCSS security overrides remain intact.
- Lockfile is regenerated and npm ci is run; no floating new version is introduced.

Official release and upgrade references checked on 21 October 2026:

- https://nextjs.org/support-policy
- https://nextjs.org/blog/nextjs-security-update-october-14-2026
- https://nextjs.org/docs/app/guides/upgrading/version-16
- https://opennext.js.org/cloudflare
- https://github.com/opennextjs/opennextjs-cloudflare/releases

The October security advisory identifies Next 16.4.1 as patched; selected 16.4.2
includes that fix. The installed adapter and registry metadata are checked in
addition to prose documentation; a normal Cloudflare build must accept the version.

## Compatibility choices

Manual migration follows the official version 16 guide. Existing cookies(),
headers(), route params and searchParams are already asynchronous; no blanket
codemod changes are needed. Next typegen generates valid route types and applies the required react-jsx runtime plus the .next/dev/types include in tsconfig. The existing edge middleware remains middleware:
proxy forces Node runtime, so blindly renaming would change routing execution.
Development and production explicitly use --webpack to retain the existing
maplibre server alias instead of silently switching bundlers. ESLint uses the
native flat Next configuration, preserving the original global ignores. Image
minimumCacheTTL is explicitly 60 seconds, retaining the previous default instead
of adopting Next 16's four-hour minimum. Existing allowlisted image hosts and
signed-storage paths are unchanged; no SVG or local-IP permission is opened.

## Explicit lint compatibility

React Compiler remains disabled. The previous hooks contract enforced
rules-of-hooks(error) and exhaustive-deps(warning); both remain unchanged.
Only the following newly introduced compiler-recommendation rules diagnosed
existing hydration/ref/render patterns and are explicitly deferred for this
runtime-only release:

- react-hooks/set-state-in-effect
- react-hooks/refs
- react-hooks/purity

Every other Next/React/TypeScript/security/accessibility rule remains enabled.
This is an explicit compatibility decision, not a blanket lint suppression or
framework support bypass. Future compiler adoption requires reviewing these
existing patterns and enabling its recommendations. Actual new Next navigation
findings are repaired with the client router and exercised by regression tests.

## Verification and release

Run npm ci, format, full lint, typecheck, tests, security checks applicable to
the application, product build and Cloudflare packaging on the final source.
Retain existing owner/staff, authentication and locale browser acceptance.
Record actual results in the PR; dependencies alone do not prove deployment.
Packaging stamps a clean exact source commit. No primary branch, provider,
subscription, schema, production domain, deployment or runtime flag is mutated
by this branch. The release manager owns merge and production verification.

Rollback requires a previously accepted **supported** release artifact. Reverting
only to the expired major cannot be assumed to pass adapter packaging. Preserve
customer data, billing state and the current deployment while investigating any
regression; do not add an unsupported-version override.

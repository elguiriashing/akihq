# AkiSuite navigation v1

Status: implemented and focused-tested; not merged or production verified by this change.

All five products use the current locale explicitly. AkiPasa uses `/en` or `/es`;
AkiDuermo and AkiCoches use unprefixed routes with `lang`; free AkiHQ management
uses `/{locale}/business`; paid AkiBusiness operations uses `?locale`.
AkiBusiness consumes the incoming language before rendering login and after each
workspace-cache load. An explicit later language choice replaces that incoming
choice and is retained on that device. Membership back links preserve it.

`src/lib/suite-navigation.ts` is a versioned synchronized source contract in each
Next application. The static operations equivalent is `assets/suite-navigation.js`.
No runtime imports cross repositories. Fixed origins and plain path validation
reject external destinations, credentials, arbitrary queries, encoded paths,
fragments and dot traversal. The optional workspace identifier expresses intent,
not authorization; existing destination membership checks remain authoritative.

Only one public `ref` matching `[A-Z0-9]{8,24}` is carried by suite selectors.
This code contains no customer identity. Callback credentials, tokens and the
source URL are never propagated. Shared authenticated attribution, consent and
financial eligibility remain the referral service's responsibility.

No database, billing, entitlement, session-cookie, provider callback, analytics
or customer-data changes. Authenticated cross-domain SSO is not introduced.

## Validation and release

`npm run test:suite-navigation` runs 23 fixed-origin/locale/security regressions
in each Next repo. Selector render tests cover real EN/ES markup; AkiPasa's
workspace-shell suite covers the actual desktop/mobile launcher entries.
The static app runs `node --test tests/suite-navigation.test.mjs
 tests/product-release.test.mjs` plus existing tenant/export/inventory smoke.
Runtime language precedence, saved choice, workspace reload and referral filtering
are covered. Product-release tests build both role modes and retain initiating-
origin OAuth callback behavior.

Before release: run each repository's complete checks/build, CI at the exact
commit, responsive keyboard/browser acceptance and authenticated canonical-domain
smoke. Rollback is a source/deployment revert; no data rollback is required.

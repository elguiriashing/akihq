# Aki Product Reset — AkiHQ private entry (28 October 2026)

AkiHQ is the independent business-management and listing-owner workspace. AkiBusiness is a separate commercial operations product and **must not be folded into AkiHQ**.

This change retires the publicly promoted AkiHQ root homepage and makes `/` a locale-aware redirect: signed-in users to `/{locale}/business`, other users to `/login?lang={locale}`. The existing login page, authentication callbacks, canonical business routes, team/tenant permissions, subscriptions and API entry points remain unchanged. The root remains noindex. No cookies or credentials are transferred across domains.

Cross-product dependencies: AkiPasa / AkiDuermo / AkiCoches will expose separate, branded `/hq-login` links; the AkiSelector on public discovery surfaces will show only the three consumer products. AkiBusiness continues separately. Existing deep links and staff bookmarks must keep working.

Acceptance: CI formatting/lint/types/tests/build, EN/ES anonymous redirect, EN/ES authenticated business workspace, preservation of tenant isolation, direct /login and /{locale}/business, no loops on callback/recovery. Verify the exact deployed SHA at production before declaring live.

No schema, payments, accounts, existing subscribers, provider settings, production data or marketing communications are modified. Rollback by reverting the root page change.

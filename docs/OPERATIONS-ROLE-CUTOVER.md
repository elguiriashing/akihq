# Operations app release for AkiBusiness

Status: implemented release preparation, not a deployed domain swap. The repository
and Pages project retain the legacy `akihq` name. Existing APIs, schemas, capability
keys (`akihq_standard`, `akihq_pro`), cache partitions, printer pairing, gateway
bindings and subscription meaning must remain stable.

## Build and release

The checked-in static site remains the current AkiHQ operations app. Build a new,
empty output directory for the coordinated release:

```sh
NEXT_PUBLIC_AKISUITE_ROLE_SWAP=true node tools/build-product-release.mjs dist-product
```

Publish **dist-product**, not the repository root. An unset flag or any value other
than literal `true` produces the legacy AkiHQ presentation. This is the same flag
used by the management app in AkiBusiness's repository. The release builder changes
only explicitly reviewed presentation strings, login navigation, page/PWA metadata,
canonical link configuration and cache versions. It fails on source drift, refuses
existing output directories, and writes `release-source.json` with the source Git
commit, dirty-tree indicator and product role. Reject a release stamp with
`sourceTreeDirty: true` for production. Commit first, build from a clean checkout, and compare the
served stamp against that commit after deployment. It copies only public static
assets; it cannot package database scripts, gateway secrets or printer tooling.

Default existing Pages builds are unchanged; pointing a watched branch at this
commit does not silently swap products. Configure an isolated preview output and
verify it before changing production build settings. Do not rename the integration
gateway, KV namespace, media bucket, email routes, service bindings or scheduled jobs.

## Coordinated domain and authentication gates

Keep both canonical domains live. Move the operations app to `akibusiness.com` only
with the free management app ready for `akihq.app`; never redirect either whole
canonical domain to the other. Keep `crm.akipasa.com` serving the legacy operations
entry during compatibility verification. `_redirects` remains a local SPA rewrite.
OAuth and password recovery return to their initiating origin, preserving callback
fragments locally. Append verified exact origins to Supabase's existing allowlist;
do not replace its Site URL or invent a cross-domain SSO session broker.

The gateway CORS list adds `https://akibusiness.com` and retains both legacy origins.
Its separate Worker configuration needs a controlled release before browser API
acceptance. `SOCIAL_RETURN_URL` remains the verified legacy fallback; change it only
when the canonical callback is verified. Provider app callback settings and exact
preview origins require provider verification. Invalid/unrelated origins remain
denied. A shared account is not evidence of transparent cross-root-domain SSO.

The swapped artifact pauses automatic product-welcome queuing: the legacy
`queue_suite_portal_welcome('akihq')` template would identify the wrong product.
Approve shared email templates, canonical links and existing deduplication mapping
before restoring that queue. Other operational mail and gateway workflows retain
existing contracts. Do not send customer emails to test this release.

## Private location onboarding dependency

Existing `loadAccessibleWorkspaces` supports `source_venue_id = null`: it selects
active memberships and verifies each workspace using server `crm_workspace_access`.
No public listing is necessary for an already provisioned and authorised workspace.
Explicit management handoffs use `?workspace=<id>`. The operations app requires an
exact server-authorized match with enabled capabilities; missing, duplicate,
unknown and unlicensed targets show “Location access pending” before any workspace
activation. They never fall back to another saved location. Only requested IDs
are retained in tab-local storage for up to 30 minutes across same-origin OAuth;
callback credentials are never stored there. Normal entry without an explicit
location retains its existing saved-workspace behavior. Empty membership refreshes
replace the prior available list so revoked entries cannot remain selectable.

All existing PoS, inventory, staff, fiscal, support and export permissions remain
server controlled. The role switch does not grant an entitlement or alter pricing.

Private location creation belongs in the free management hub. The coordinated
additive migration `20261016003000_private_operating_location.sql` prepares
`create_private_operating_location(p_request_id uuid, p_name text) RETURNS text`.
It must verify the signed-in account, preserve the request ID on retries, reject
same-ID/different-name retries with PT409, create owner membership without a venue,
and grant no paid capability. Operations consumes the resulting membership and
scoped entitlements; creation alone never grants access. The switched access-denied
screen links to AkiHQ management without transferring authentication material or
automatically creating a location. Verify this migration in production before
enabling management onboarding.

The older pending AkiPasa RPC `prepare_akisuite_workspace`
selects the first owned workspace/venue and links all owned venues. It is unsuitable
for explicit location onboarding and must not be silently repurposed. Never detach an existing `source_venue_id`: the legacy detach trigger can suspend
the workspace and delete memberships. Do not apply the entire pending premium
migration merely to gain its creation function.

## Acceptance and rollback

Run `npm ci && npm run check` in `cloudflare`; it includes both release-mode tests.
Run existing browser PoS/dialog/mobile checks with disposable data and all outbound
mail, payment and printer effects isolated. Then verify both real domains, exact
release stamps, TLS, Google/email login, recovery, logout, owner/staff/denied users,
location switching, private workspace access and sandbox bookings/operations.
To exercise the generated artifact with the existing isolated real-browser harness:

```sh
AKIHQ_STATIC_ROOT=/absolute/path/to/dist-product AKIHQ_EXPECTED_PRODUCT=AkiBusiness \
AKIHQ_PLAYWRIGHT_PATH=/path/to/@playwright/test BROWSER_PATH=/path/to/chromium \
node tests/dialog-accessibility-browser.cjs
```

Local generated-artifact tests do not certify live auth or entitlement mapping.

Record current Pages deployment ID, gateway version, Worker routes, DNS, Supabase
allowlist and both app builds before cutover. On failure restore the saved app and
gateway deployment IDs and original routes/build output. Keep additive callback
entries while sessions settle. Rollback requires no database deletion, subscription
mutation, identity change, or reversal of existing workspace IDs. Clear/update the
service-worker version through the restored artifact, then verify both domains.

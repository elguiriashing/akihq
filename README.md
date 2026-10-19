# AkiHQ · Independent management hub

Canonical website: **https://akihq.app** · Source owner: **elguiriashing/akihq**.

This repository holds the independently buildable Next.js AkiHQ management application: organisations, locations, public listing ownership, events, accommodation inventories and fleet management. The previous AkiBusiness extraction was imported into this isolated migration branch so the production AkiHQ product can be deployed from its own repository instead of another product's repository.

## Local verification

Use Node 22+, `npm ci`, then `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. Shared Supabase project configuration comes from private Cloudflare environment bindings / ignored `.env.local`, not source code. Build/test can use disposable public placeholders; real authenticated tenancy testing requires the existing production backend in an isolated preview.

The role-swap switch `NEXT_PUBLIC_AKISUITE_ROLE_SWAP=true` activates the AkiHQ management identity. `wrangler.jsonc` is scoped to the existing management Worker, `akihq-management-preview`, with no custom production domain hardcoded. This application does not depend on a sibling GitHub checkout or proxy frontend to AkiPasa.

## Deployment separation

Target: Cloudflare Worker **akihq-management-preview** currently serving **akihq.app**. Cloudflare builds must be reconnected to this repository's `main` **only after** checks pass and the existing production binding/secrets are retained. The existing Worker currently builds from another repository; changing source prematurely may break production.

AkiBusiness PoS/operations is maintained separately in `elguiriashing/AkiBusiness`. Shared identity and API backend are intentional; each product owns its own web build, domain, internal routes and deployment.

Release gates: CI, Worker dry-run, Google login/callback and password recovery, owner vs non-owner permissions, claims, venue/rooms/fleet tools, media, navigation, English/Spanish/mobile, secrets and rollback. Keep existing users, records and billing untouched. No automatic merge/cutover without checks.

## Isolated Cloudflare Worker staging

Cloudflare worker `akihq-selfowned-staging` is connected to this GitHub repository and this staging branch, **not** to production `akihq.app`. It builds a Node 22 Next.js/OpenNext management app with test-only placeholder Supabase access (the actual production credential is deliberately NOT reused), so authenticated tests will not succeed in this preview until securely configured. Never attach `akihq.app` to this preview worker. To ship production, verify and preserve the separate existing `akihq-management-preview` worker's real private bindings and coordinate the source switch with the AkiBusiness release.

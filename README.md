# AkiHQ · Independent management hub

Canonical website: **https://akihq.app** · Source owner: **elguiriashing/akihq**.

This repository holds the independently buildable Next.js AkiHQ management application: organisations, locations, public listing ownership, events, accommodation inventories and fleet management. The previous AkiBusiness extraction was imported into this isolated migration branch so the production AkiHQ product can be deployed from its own repository instead of another product's repository.

## Local verification

Use Node 22+, `npm ci`, then `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. Shared Supabase project configuration comes from private Cloudflare environment bindings / ignored `.env.local`, not source code. Build/test can use disposable public placeholders; real authenticated tenancy testing requires the existing production backend in an isolated preview.

The AkiHQ identity is the repository default. Local test/build wrappers set `NEXT_PUBLIC_AKISUITE_ROLE_SWAP=true` and safe disposable provider values when no environment is supplied; production packaging loads and validates the existing public provider bindings from Cloudflare before compiling. `wrangler.jsonc` is scoped to the existing management Worker, `akihq-management-preview`, with no custom production domain hardcoded. This application does not depend on a sibling GitHub checkout or proxy frontend to AkiPasa.

## Deployment separation

Target: Cloudflare Worker **akihq-management-preview** currently serving **akihq.app**. Cloudflare Workers Builds owns automatic production releases from this repository's `main` branch, preserves the Worker's runtime bindings and secrets, and stamps the exact Git commit. The GitHub Actions production workflow is a manual fallback; it verifies the canonical binding, imports existing non-secret public configuration for the build, and fails closed unless a scoped `CLOUDFLARE_API_TOKEN` repository secret is configured.

AkiBusiness PoS/operations is maintained separately in `elguiriashing/AkiBusiness`. Shared identity and API backend are intentional; each product owns its own web build, domain, internal routes and deployment.

Release gates: CI, Worker dry-run, Google login/callback and password recovery, owner vs non-owner permissions, claims, venue/rooms/fleet tools, media, navigation, English/Spanish/mobile, secrets and rollback. Keep existing users, records and billing untouched. No automatic merge/cutover without checks.

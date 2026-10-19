# AkiHQ brand acceptance checkpoint

Blue/gold HQ mark, favicon, 180/192/512 PNG icons and maskable variants are generated from the source-controlled blue/gold SVG. The AkiHQ management experience uses the existing shared backend, historical authorisation and billing keys. This release changes no Supabase schema or Stripe configuration.

Exact-head CI must pass including Next/OpenNext bundle, role-swapped route acceptance and Wrangler deploy dry-run. Confirm `roleSwapEnabled:true` and `publicProduct:AkiHQ` on the canonical `/api/health`, then verify header, icon files, manifest and source stamp after publishing a validated release to the existing AkiHQ Worker. Preserve its previous version for rollback.

## Black/gold production release follow-up

The approved AkiHQ favicon/PWA source is now the black (`#111111`) pin and
gold (`#FFC533`) four-point star on a white tile, sharing AkiPasa's icon
geometry. The legacy blue-house notes above describe the previous visual
checkpoint only. The production workflow targets the existing
`akihq-management-preview` Worker bound to `akihq.app`, while building from
`release/akihq-management-brand-v1` with `NEXT_PUBLIC_AKISUITE_ROLE_SWAP=true`.
It preserves other live feature flags, Supabase public credentials, service
bindings and secrets. A missing GitHub `CLOUDFLARE_API_TOKEN` secret fails
closed. The exact source fingerprint, SVG/favicon, PNG and installed PWA manifest
are checked after deployment. The separate AkiBusiness purple AB icon is not
modified. Rollback uses the previous Worker version, not a schema migration.

## Git branch promotion / production deployment

After the reviewed management release has been promoted to repository `main`,
only `main` pushes may trigger production deployment to the existing
`akihq-management-preview` Worker bound to `akihq.app`. The long-lived
`release/akihq-management-brand-v1` branch is a staging/review source; pushing
there must not automatically publish unmerged work. Production deployment still
requires the scoped GitHub Actions `CLOUDFLARE_API_TOKEN` secret and must fail
closed when credentials, domain bindings or exact-source validation are missing.

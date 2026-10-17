# AkiBusiness operations brand release

The operations application now uses the AkiBusiness violet/indigo AB mark instead of the former purple/white AE icon. Its operational capabilities, Supabase table identifiers, Stripe billing and account/tenant authorization remain unchanged.

Palette: navy `#090e28`, violet `#8958ff`, lilac `#d599ff`, high contrast white `#f8f6ff`. The new `assets/akibusiness-brand.css` loads after the original stylesheet and overrides common surface/accent tokens for both dark and light modes.

Brand assets are sourced from `assets/icons/icon.svg` and `assets/icons/maskable.svg`; `tools/render-brand-assets.mjs` deterministically generated favicon.ico, PNG 16/32/48/64/180/192/512 and maskable 192/512. The existing `tools/build-product-release.mjs` must still be invoked with `NEXT_PUBLIC_AKISUITE_ROLE_SWAP=true`, publishing the resulting `dist-product` to Cloudflare Pages on `akibusiness-operations-preview`. The release source stamp must show `product:AkiBusiness`, `roleSwap:true`, clean working tree, and matching commit SHA. Do not deploy untransformed repo root to canonical `akibusiness.com`.

Acceptance: test anonymous EN/ES desktop/mobile, login, CRM/PoS/booking page access with authorized and denied users, favicon, PWA manifest and install icon. Keep the existing canonical Pages version available for rollback. This source change does not modify live Cloudflare until a production build is separately promoted.

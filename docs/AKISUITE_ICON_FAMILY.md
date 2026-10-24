# AkiSuite icon family v3 — 25 October 2026

Owner-requested shared brand assets. All five selectors use local copies of the
same five versioned SVG tiles, under `brand/v3`. Pasa remains navy/orange/gold,
Duermo remains teal/mint, Coches uses burgundy #3B101B with the current red pin
and black sparkle (no car), HQ uses space grey #252830 with its black pin and
gold sparkle. Fine red/gold keylines retain legibility of the black artwork on
the new dark canvases. AkiBusiness retains its existing purple AB mark.

The existing in-repository vectors preserve the source geometry; Drive Media's
AkiCoches Logo+Text 1920x1080.png (18 October) confirms the car-free brand. Canva
returned no accessible designs after the user relinked it. No new AI artwork.

Selectors, product header logos, membership logos, route icon.svg, favicon.svg,
Apple touch icons and raster/maskable PWA assets now reference this family.
Versioned URLs avoid previously cached artwork; legacy aliases are refreshed
for older installed manifests. Existing installed app IDs and start URLs remain
stable. Coches dark canvas and default HQ dark canvas match their tiles; light
mode and explicitly selected owner themes remain available. Both locales share
the assets; links, focus behavior and permissions are unchanged.

`mobile/icons` includes a 1024px store icon, transparent padded adaptive
foreground and background colour for each product. Existing Android shells
(Pasa, Duermo, HQ) use the same safe-area geometry and colours. Coches and
Business contain store preparation only, so these assets do not claim a signed
native app or store release. Installed Android apps require a new signed build;
a website deploy cannot replace an installed package's launcher icon. iOS
archives and store listing uploads are not performed by this change.

Dependencies: five repositories, build-time asset generation, public static asset
serving, icon metadata/PWA registration, static Business service-worker cache and
release transformations, Android drawable resources. No API, database, identity,
RLS, storage bucket, pricing, analytics, cron or payment configuration changes.
Rollback: revert these source/assets and publish the preceding application
version; retain customer records. Browser/PWA caches may refresh later.

Validation: generated dimensions, SVG background/shape and byte parity across
five products, referenced-asset existence, maskable geometry and native XML;
visual family review; existing selector/product/check suites and exact-head CI.
CI and production readback are recorded in the pull request, not inferred from
local asset generation. Signed device/store acceptance remains separate.

Regenerate from a clean repo using `node scripts/generate-icon-family.mjs`
(or `node tools/generate-icon-family.mjs` for the static operating suite, with
Sharp available). The Sharp dependency is already installed by Next builds;
the static suite's checked-in SVG/PNG assets require no build dependency.

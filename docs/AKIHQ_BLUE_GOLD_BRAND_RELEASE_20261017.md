# AkiHQ blue-gold visual release

The free management product uses a blue HQ/venue mark with a gold location pin and navy background. The shared brand components now use `public/brand/hq-mark.svg`, `public/brand/hq-icon.png` and the generated PWA/Apple/maskable sizes, with matching theme variables loaded after legacy CSS.

The release must be built with `NEXT_PUBLIC_AKISUITE_ROLE_SWAP=true` and deployed to the existing `akihq-management-preview` Worker currently bound to `akihq.app`; the old machine permission IDs and billing keys must remain unchanged. Do not enable independent accommodation schema or checkout with this release. Validate HTML header, `/api/health` publicProduct AkiHQ, `release-source.json`, favicon, both theme modes and bilingual authenticated venue management. Roll back to the recorded prior Worker version if required.

Approved original raster artwork is also retained in the user's Canva asset library; the GitHub icon set is the scalable SVG/raster app-mark implementation of the agreed blue/gold concept.

# AkiBusiness operations visual release gate

This release branch contains only the reviewed, successful brand PR #32 on the existing role-swapped operations candidate. It is connected to Cloudflare Pages project `akibusiness-operations-preview` on `akibusiness.com`. Use the role-swapped output builder, retain prior production deployments, verify `release-source.json` equals the exact build commit, `roleSwap:true`, `product:AkiBusiness`, and clean tree.

Visual identity: navy/violet/lilac AB, all sizes of rasterized PWA icons, favicon.ico, maskable assets and `assets/akibusiness-brand.css` loaded last.

Do not enable migration flags, purchase new Supabase infrastructure, alter Stripe offerings, remove `crm.akipasa.com`, or deploy the untransformed repository root. Roll back the Cloudflare Pages project deployment if anonymous routes/auth fail. Authenticated PoS and customer journeys need account-level acceptance.

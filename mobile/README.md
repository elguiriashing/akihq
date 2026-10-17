# AkiHQ | Mobile store-release preparation

**Status: prep only. NOT a shippable AAB or IPA.** This branch intentionally does not deploy to production, create a store record, generate signing keys or submit an app. See [store-release.json](./store-release.json) for proposed IDs, localized first-pass copy, sources and explicit release gates.

## Confirmed source and product-specific review

Free organization/location management hub target. This repository currently has a static original AkiHQ implementation. Verify Cloudflare worker and AkiSuite role swap before associating store product with this source. Test company switching, claimed listings, invitations, team access and auth on a physical tablet.

## Native packaging and release sequence

1. Verify this repository's **actual production source/Worker**, canonical URL, auth redirects, current theme/logo, permissions, content, and target role (especially AkiHQ/AkiBusiness). Check the app works on mobile and tablet before native work.
2. Choose an Android build approach based on real functionality: TWA requires a qualifying PWA and verified Digital Asset Links; Capacitor is appropriate if native bridge features are necessary. Provide an independent installable Android application and signed **AAB** targeting **API 36+**. Android App Links require the genuine **Play App Signing** SHA-256 certificate fingerprint, never a guessed hash.
3. Build iOS with **Xcode 26+ / iOS 26 SDK** (iOS deployment target at least 13). iOS must deliver a genuine mobile app experience and comply with App Review guideline 4.2, not just a website in a shell. Generate an archive, sign with the company team, upload to TestFlight, and test on device. For Universal Links, use a real Apple team ID plus the final bundle identifier in `apple-app-site-association`.
4. Make navigation, safe areas, full-screen map, system Back, external browser/payment links, permissions, links from emails, OAuth/recovery redirects, image upload, deep links, locale, and accessibility reliable in the mobile builds. Never store secrets in JavaScript or a repository.
5. Review **existing Stripe flows** separately: digital premium subscriptions or paid software features may need Apple In-App Purchase / Google Play Billing or approved regional alternatives; offline/physical hotel and vehicle bookings are a different category. Do not blindly enable the web payment flow inside a store app.
6. Confirm **in-app account deletion**, a **public web deletion request page**, privacy policy, cookie/analytics consent, purpose-limited location handling, user-generated content moderation/reporting if applicable, Sign in with Apple/equivalent login where required, and legitimate reviewer demo accounts.
7. Prepare app icon (1024x1024 original), launch/splash artwork, screenshots **from actual native builds**, EN/ES titles and descriptions, categories, age rating, disclosures, support URL, privacy policy URL, accurate data safety/app privacy answers, and notes for reviewers. Generate assets from the latest approved AkiSuite brand, not stale repository colors.
8. Create **one individual application record per product** in Google Play Console and App Store Connect under **AkiPasa Marketing S.L.**. Finalize package/bundle IDs **before** registration. Configure Play App Signing, signing credentials via secure CI secrets, TestFlight and Play internal testing. No keys or provisioning secrets in Git.
9. Test Android and iOS sign in/out/recovery, app resume, cold launch, deep links, map GPS disabled/granted, uploads, notifications where used, account delete, subscriptions, bookings, tablet landscape, light/dark, ES/EN. Check business workspaces and Supabase RLS boundaries. Track crashes and consented telemetry.
10. Only when reviewer testing and all release gates are proven: complete JSON metadata, mark each gate true with supporting evidence, set status to `READY_FOR_INTERNAL_REVIEW`, and run `node mobile/validate-store-release.mjs --ship` as an additional configuration gate. Native compiled builds still require signed artifact and device test verification before submission.

## What the current CI actually validates

`node mobile/validate-store-release.mjs` checks basic JSON structure, unique-style IDs, policy minimums and typed gates. It **does not** claim store approval or validate functioning apps. `--ship` intentionally fails while the release is blocked. This is a guardrail, not a shortcut.

## Credentials and external steps

The Google organisation D-U-N-S conversion is pending. Apple's **separate** organisation enrolment also uses legal-entity verification and D-U-N-S; it is not unlocked automatically by Google. Company agreement, payment/tax profile, privacy declarations, final Android signing fingerprints, Apple team ID, reviewer access and app record creation require the relevant store-holder account. Do not copy D-U-N-S or private account data into public logs.

## Official references

- Google Play target API: https://support.google.com/googleplay/android-developer/answer/11926878
- Apple build requirements: https://developer.apple.com/news/upcoming-requirements/
- Apple review 4.2, 4.8, 5.1.1: https://developer.apple.com/app-store/review/guidelines/
- Play payments: https://support.google.com/googleplay/android-developer/answer/9858738
- Play account deletion: https://support.google.com/googleplay/android-developer/answer/13327111
- Apple privacy: https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy
- Android App Links certificate: https://developer.android.com/training/app-links/configure-assetlinks

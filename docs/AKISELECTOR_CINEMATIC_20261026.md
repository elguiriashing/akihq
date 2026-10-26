# AkiSelector cinematic overhaul — validation

26 October 2026. Presentation-only scope; see the master/impact entries for
cross-product dependencies and rollback.

- Shared React engine and CSS synchronized across the four Next apps. Static
  Business CSS is byte-identical and its DOM adapter has equivalent hover state.
- Local Chromium 153: all 60 selector locale/theme/viewport cases passed,
  including direct navigation, swipe click suppression, referral filtering,
  retained login draft, keyboard focus, 44px targets, image loading, zero scene
  scroll and reduced motion. Four React runners additionally sampled real
  incoming/outgoing opacity and interrupted transitions.
- AkiPasa: full `npm run check` passed; focused selector suites passed 18 tests.
- Duermo: `npm run check` passed. Coches/HQ: full `npm run check` including
  production builds passed. Duermo production build also passed.
- Business: focused selector/release suites passed 12 tests. An initial full
  gateway run lacked its separate xlsx dependency; re-run uses its own lockfile
  install. Final gateway check passed: 713 passed, one skipped, zero failed.
- An initial Pasa broad E2E invocation had no disposable Supabase configuration
  and timed out before browser acceptance. The configured broad run completed
  171 passed / 29 skipped / 16 failed. Twelve wordmark failures exposed narrow
  card label wrapping, now fixed in the shared login CSS; the actual-route
  EN/ES × light/dark × 360/390/600px re-run passes all 12 cases. Two auth cases
  pass with the fixture Google-auth flag enabled; the initial tablet-menu
  failure also passed its re-run. One map-attribution visibility test outside
  selector scope still fails; its cause is unverified and it remains a release
  limitation. No production credentials or data were used.
- All changes are committed locally. GitHub publishing was blocked by automatic
  approval review, which requires explicit authorization for the five-repo push.
  No pull requests, merge or deployment are claimed.

Hosted exact-head CI/Cloudflare packaging, deployment, actual account sign-in
and physical-device frame-rate acceptance remain separate release gates. No
production release, database/provider change or Android rebuild is claimed.

## Product story follow-up

Each login option now has its own one-shot opening and separate sustained
material. The new optional arrival property leaves generic lab effects intact.
Inline vector actors depict a destination pin, rolling suitcase, passing car,
location hub and till/receipt; their 1.25–1.7s openings resolve into calmer idle
energy. Product labels stay visible while their logo is revealed after the story.
No activation delays navigation. Explicit/system reduced motion hides the actors.

Updated focused React suites pass 19 tests; static selection/release suites and
the full Business gateway check pass (714 passed / one skipped / zero failed).
All 60 local selector browser cases pass, including actual actor visibility,
single iteration, disappearance and full idle opacity for all five products.
The four Next apps' full-check results are verified before local handoff.
Earlier broad map-attribution failure remains outside this scoped change and
is not claimed fixed. Hosted CI, Cloudflare packaging, production and physical
Android acceptance remain unperformed; publishing approval is still pending.

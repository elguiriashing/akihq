# Deployment source reconciliation — September 2026

The current public-site design and the September membership/business updates
were on `agent/ai-team-spain-address-search` at `93e1acaaaa6067d89df322c8de72854dffe2622f`.
`master` was still based on the older UI when sitemap commit `b39a7a5` and
PageSpeed commit `7a4865a` were published, so those automatic builds restored
the older site. `main` contains the CRM project, not the current public site.

The combined release starts from the current public-site source, retains both
SEO/performance patches, and adds the achievement manager. Conflict resolutions
retain discovery-redesign.css, analytics session cookies, the full modern test
suite, and the sitemap/auth-crawl rules. The production build now checks the
current discovery and venue-dashboard source contract before compilation.

Use `master` for subsequent public-site releases after this reconciliation.
Fetch it before editing. Do not publish a tree assembled from an older branch.
The release commit records both branch tips as parents. The CRM deployment
branch remains separate.

Before accepting a release, inspect `/es` and `/en` for CityDiscovery, check the
membership packages and venue dashboard, confirm the achievement route is
admin-only, and verify sitemap XML. A Cloudflare rollback changes live traffic;
it does not update GitHub source.

The Cloudflare build now requires clean tracked source and stamps its full Git HEAD in the generated release asset. Commit changes before packaging. The booking live smoke compares `sourceCommit` from `/api/bookings/release` with the triggering commit on all four public hostnames; feature markers do not prove latest deployment. Missing evidence fails readiness rather than inventing a commit.

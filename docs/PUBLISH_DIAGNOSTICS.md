# Publishing diagnostics

## Gateway logs

`cloudflare/wrangler.toml` enables persisted Workers logs, invocation logs and 100% sampling for `akihq-integration-gateway`. Apply this configuration with `cd cloudflare && npx wrangler deploy` using an authenticated Cloudflare account. A CRM static-site deployment alone does not deploy this Worker.

For an existing live Worker, Cloudflare Dashboard → Workers & Pages → akihq-integration-gateway → Settings → Observability → Logs also permits enabling Logs, Include Invocation logs and Persist logs, then Deploy. This updates the logging setting without replacing the running application code. Keep the repository configuration in sync so future Wrangler deployments preserve it.

After activation, open the Worker's Observability tab, select Logs/Events and a time range covering a new publishing run. Inspect failed requests and correlate their timestamps with the downloaded CRM diagnostics (which use UTC). Logs are collected from activation onward; earlier failures cannot be recovered retroactively. Enabling logs exposes invocation metadata and existing application logs, but does not add upstream address-provider timings or status codes where the running backend does not already log them. A generic `address_provider_unavailable` error alone still cannot establish which paid upgrade would help.

The full sampling rate is intended to capture intermittent import failures. Review log volume after the import and adjust sampling if needed. Enabling logs does not require accepting new billing terms in the dashboard.

## CRM session diagnostics

The publish dialog shows cumulative call/failure counts and average/maximum round-trip times for database claim, publishing service, and database save. The latest three errors remain visible. Download diagnostics exports the latest 20 errors plus aggregate counters for the current dialog session. Closing the dialog clears this diagnostic history; publication progress remains in the database.

Errors retain the original message (bounded to 500 characters), HTTP status, error code and request ID when available. Cross-origin responses may not expose request ID or Retry-After headers. No company payload, access token or response body is exported. Existing error messages can contain business-related text, so review the download before sharing publicly.

Publishing-service duration includes gateway, address lookup and any downstream database/AI work. It is not a measurement of any individual upstream provider. A 429 indicates rate limiting but does not identify its origin. A browser fetch failure can be a network or CORS issue. Database stage failures identify the failing request, not necessarily the underlying cause. Use timestamp and request ID to correlate with gateway logs; do not select a paid upgrade from the generic status alone.

Isolated transient publishing failures retry only the affected leased company, with delays of 1, 2, 4 and 8 seconds plus up to 500 ms jitter. They do not reduce global concurrency. The most recent 100 completed publishing attempts within 30 seconds form a bounded error window. At least five failures and a failure rate of 10% are required to trigger a global cooldown. Explicit HTTP 429/rate-limit errors or a readable positive Retry-After trigger cooldown immediately. Each global reduction is 20%, with a floor of one check; concurrent errors during the same cooldown do not stack reductions. A later Retry-After can extend the wait. Retry counts and the original lease deadline remain bounded. Diagnostics include recentRequests and recentFailures for the current window; the window resets at a global slowdown. The selected value measures simultaneous checks, not requests per second. After at least 25 completed checks and 30 seconds of healthy operation following cooldown or the last increase, the limit increases by 10% of the user's selected maximum, never above that maximum. Pause and authentication/unrecognized failures retain the existing drain-and-stop behavior. Browser network failures are still paused because the outcome of a write may be unknown; they are not classified as rejected addresses.

The update requires reloading the CRM. Pause publishing and allow current requests to drain before reloading; then resume. Existing published companies are preserved.

## Retrying companies needing review

Companies → **Review & retry unpublished** previews the internal AI budget and review count. Starting queues the current skipped records in batches of 500, then uses the existing publisher, including its AI fallback and authoritative address verification. Published/linked, archived, active and undone-import records are excluded from requeueing. Newly failed addresses are not requeued again within that run. Ordinary pending work can also be processed by the publisher. Pause drains active requests; progress survives closing the tab.

Review defaults to two simultaneous checks and spaces publishing attempts by 1.2 seconds within the tab. This is not an account-wide rate limiter; other tabs and AI jobs share the backend limits. Budget failures returned as a successful HTTP response now pause the run, and AI concurrency/rate failures get bounded retries rather than being saved as invalid addresses. Existing spend caps and model pricing are not changed. Open AI Team → Usage & budget to intentionally adjust the internal cap. The internal EUR ledger is an estimate, not an OpenAI invoice or synchronized credit balance.

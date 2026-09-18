# Publishing diagnostics

The publish dialog shows cumulative call/failure counts and average/maximum round-trip times for database claim, publishing service, and database save. The latest three errors remain visible. Download diagnostics exports the latest 20 errors plus aggregate counters for the current dialog session. Closing the dialog clears this diagnostic history; publication progress remains in the database.

Errors retain the original message (bounded to 500 characters), HTTP status, error code and request ID when available. Cross-origin responses may not expose request ID or Retry-After headers. No company payload, access token or response body is exported. Existing error messages can contain business-related text, so review the download before sharing publicly.

Publishing-service duration includes gateway, address lookup and any downstream database/AI work. It is not a measurement of any individual upstream provider. A 429 indicates rate limiting but does not identify its origin. A browser fetch failure can be a network or CORS issue. Database stage failures identify the failing request, not necessarily the underlying cause. Use timestamp and request ID to correlate with gateway logs; do not select a paid upgrade from the generic status alone.

On recognized transient publishing failures, the global concurrency limit halves and retries remain bounded to the original lease window. Retry-After is respected when readable. After at least 25 completed checks and 30 seconds of healthy operation following cooldown or the last increase, the limit increases by 10% of the user's selected maximum, never above that maximum. Pause and authentication/unrecognized failures retain the existing drain-and-stop behavior. Browser network failures are still paused because the outcome of a write may be unknown; they are not classified as rejected addresses.

The update requires reloading the CRM. Pause publishing and allow current requests to drain before reloading; then resume. Existing published companies are preserved.
